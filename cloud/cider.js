
var User = Parse.Object.extend(Parse.User);
var CiderEvent = Parse.Object.extend("Event");
var Cider = Parse.Object.extend("Cider");
var CiderRequest = Parse.Object.extend("CiderRequest");
var Notif = Parse.Object.extend("Notification");

Parse.Cloud.afterSave("Cider", function(request) {
    var cider = request.object;
    var creationDate = cider.get('createdAt');
    var updateDate = cider.get('updatedAt');
    var isCreation = (creationDate == updateDate);

    if (isCreation) {
        var request = new CiderRequest();
        request.set("isEnabled", true);
        request.set("isMuted", false);
        request.set("isOwner", true);
        request.set("cider", cider);
        request.set("user", cider.get("creator"));
        request.set("status", "accepted");

        /* Be careful with this function:
           There is an afterSave Event saving a cider so it could create a loop
           if you put this out of isCreation condition
         */
        var event = new CiderEvent();
        event.set("cider", cider);
        event.set("user", cider.get("creator"));
        event.set("type","add_cider");

        Parse.Object.saveAll([event, request]).then(function(){
            console.log("Request and event created");
        }, function(error){
            console.log("Error creating event and request: " + JSON.stringify(error));
        });
    }
});

Parse.Cloud.define("attachAdvisors", function(request, response) {
    var usersId = request.params["usersId"];
    var ciderId = request.params["ciderId"];

    var ciderRequests = [];

    if (usersId.length > 0) {
        var ciderQuery = new Parse.Query(Cider);
        ciderQuery.equalTo("objectId",ciderId);
        ciderQuery.include("creator");
        ciderQuery.first().then(function(cider) {
            if (cider) {
                var ownerId = cider.get("creator").id;
                if (ownerId == request.user.id) {
                    return Parse.Promise.as(null);
                } else {
                    return Parse.Promise.error("You don't own this Cider");
                }
            } else {
                return Parse.Promise.error("Cider not found");
            }
        }).then(function(){
            for (var i = 0; i < usersId.length; i++) {
                var userId = usersId[i];
                var request = new CiderRequest();
                request.set("isEnabled", true);
                request.set("isMuted", false);
                request.set("isOwner", false);
                request.set("cider", Cider.createWithoutData(ciderId));
                request.set("user", User.createWithoutData(userId));
                request.set("status", "accepted");
                ciderRequests.push(request);
            }
            return Parse.Object.saveAll(ciderRequests, { useMasterKey: true });
        }).then(function(){
            var notifs = [];
            ciderRequests.forEach(function(req){
              var notif = new Notif();
              notif.set("type", "request_added");
              notif.set("sender", request.user);
              notif.set("receiver", req.get("user"));
              notif.set("cider", Cider.createWithoutData(ciderId));
              notifs.push(notif);
            });
            return Parse.Object.saveAll(notifs, { useMasterKey: true });
        }).then(function(){
            response.success("");
        }, function(err) {
            console.log("Impossible to attach users: " + JSON.stringify(err));
            response.error(err);
        });
    } else {
        response.success("");
    }
});

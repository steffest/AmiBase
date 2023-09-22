import {uuid} from "../util/dom.js";
let Network = ()=>{
    let me ={};

    var WsPort = 443;
    var WsDomain = "relay.amibase.com";

    let localUuid;
    var serverConnection;
    var peerConnections = {}; // key is uuid, values are peer connection object and user defined display name string
    let registeredApps = {};

    me.init = ()=>{
        console.log("Network init");
        localUuid = uuid();

        console.log("setup WS to " + WsDomain);
        serverConnection = new WebSocket('wss://' + WsDomain + ':' + WsPort);
        serverConnection.onmessage = gotMessageFromServer;
        serverConnection.onopen = function(event){
            console.log("serverConnection open");
            setTimeout(function(){
                serverConnection.send(JSON.stringify({ command:'hello', displayName: "ami user", from: localUuid, to: 'all' }));
            },100);

        };
    }

    me.register = (appName,handler)=>{
        console.log("registering app for network access: ",appName);
        registeredApps[appName] = handler;
    }

    me.send = (message)=>{
        if (typeof message === "string"){
            message = {
                command: "message",
                message: message
            }
        }
        message.from = localUuid;
        serverConnection.send(JSON.stringify(message));
    }

    function gotMessageFromServer(message) {
        var data;
        try {data = JSON.parse(message.data);} catch (e){}
        console.error("gotMessageFromServer",data);
        if (data && data.command){
            if (data.command === "hello"){
                peerConnections[data.from] = data;
                return;
            }

            if (data.from){
                let from = peerConnections[data.from];
                if (from) data.displayName = from.displayName;
            }

            let app = registeredApps[data.command];
            if (app) app(data);
        }
    }

    return me;
}

export default Network();
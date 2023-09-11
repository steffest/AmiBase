/*
    main library that other apps can import to communicate with AmiBase
 */

let AmiBase = ()=>{
    let me = {};
    let isAmiBased = false;
    let windowId;
    let menu;
    let messageHandler;
    let callbacks = {};

    me.init = function(){
        let messageTimeOut;

        return new Promise((next)=>{
            if (window.self !== window.top && window.parent){
                // we are running in an iframe, let's see if we can contact the host
                console.log("registering with host");
                window.parent.postMessage({
                    command: "register",
                    url: window.location.href
                },"*");
                messageTimeOut = setTimeout(function(){
                    console.log("no host found");
                    next(false);
                },500);
            }else{
                next();
            }

            window.addEventListener("message", function (event) {
                // We got a message from outside our window;
                if (event && event.data){
                    let message = event.data;
                    if (message.registered) {
                        // look at that! AmiBase has replied
                        console.log("registered with host");
                        clearTimeout(messageTimeOut);
                        windowId = message.id;
                        isAmiBased = true;
                        next(true);
                    }else if (message.message === "callback"){
                        // this is a callback from a previous request we initiated
                        let callback = callbacks[message.data.id];
                        if (callback){
                            callback(message.data.data);
                            delete callbacks[message.data.id];
                        }
                    }else{
                        // this is a message from the host
                        //console.log(event.data);
                        if (messageHandler) messageHandler(message);
                    }
                }
            }, false);
        });

    }

    me.iAmReady = function(){
        // Tell AmiBase we are ready to receive messages
        if (isAmiBased){
            window.parent.postMessage({
                command: "ready",
                windowId: windowId
            },"*");
        }
    };

    me.setMenu = function(_menu){
        // Sets the AmiBase menu to ours if our window is active
        menu = _menu;
        if (isAmiBased){
            window.parent.postMessage({
                command: "setMenu",
                windowId: windowId,
                data: menu
            },"*");
        }
    };


    me.requestFileOpen = async function(andOpen){
        // Request a file from AmiBase - this will pop up a file dialog and return the path of the selected file (including the file content if andOpen is true)
        let path = await callAmiBase("requestFileOpen");
        let result = {path: path};
        if (!andOpen) return result;
        result.data = await callAmiBase("readFile",{path: path, asBinary: false});
        return result;
    }

    // get the content of a file based on its amiBase path
    me.readFile = async function(path,asBinary){
        return await callAmiBase("readFile",{path: path, asBinary: asBinary});
    };

    me.writeFile = async function(path,data,asBinary){
        // write a file to the AmiBase file system
        let messageData = {
            path: path,
            data: data,
            asBinary: asBinary
        }
        return await callAmiBase("writeFile",messageData);

    }

    me.setMessageHandler = function(handler){
        messageHandler = handler;
    };

    function callAmiBase(command,data){
        return new Promise(next=>{
            if (!isAmiBased) return next();
            let message ={
                command: command,
                windowId: windowId,
                data: data,
                callbackId: getId()
            }
            callbacks[message.callbackId] = next;
            window.parent.postMessage(message,"*");
        });
    }

    // generate a (very temporary) unique-ish ID, so we can match the callback to the request
    function getId(){
        return ("" + new Date().getTime() + Math.random()).replace(".","");
    }

    return me;
}

window.AmiBase = AmiBase(); // this is here so you still can include this file in a script tag, without importing it.
export default AmiBase();


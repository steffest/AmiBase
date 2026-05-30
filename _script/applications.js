import security from "./security.js";
import fetchService from "./util/fetchService.js";
import system from "./system/system.js";
import mainMenu from "./ui/mainmenu.js";
import fileSystem from "./system/filesystem.js";
import user from "./user.js";
import amiIcon from "./ui/icon.js";
import desktop from "./ui/desktop.js";
import settings from "./settings.js";

/*
Provides a bridge for external applications and plugins
There are 2 types of plugins:
 - trusted ones that run directly in the same context as AmiBase,
 they can access all the methods (end DOM) of amiBase
 - external ones that run in their own iframe and can only communicate with amibase through a messageBus
 */

let Applications = function(){
    var me = {};
    var plugins={};

    window.addEventListener("message", receiveMessage, false);

    function receiveMessage(event) {
        var message = event.data;
        if (message === "process-tick") return; // message form audioclock
        handleMessage(message,event);
    }

    me.sendMessage = function(window,message,data){
        console.error("DEPRECATED !!!!!, this has moved to a direct method on the window object");
        window.sendMessage(message,data);
    };

    
    me.load = function(url,appWindow){
        // load an external plugin into a window
        console.log("loading " + url + " into window" + appWindow.getCaption());

        return new Promise(async function(next){
            appWindow.setContent("");

            if (url.indexOf(":")>0){
                var pluginType = url.split(":")[0];
                url = url.split(":")[1];
            }else{
                pluginType = "plugin"
            }
            let pluginPath = "plugins/" + url + "/";

            switch (pluginType) {
                case "plugin":
                    let plugin = await system.loadPlugin(url);
                    if (plugin){
                        createPluginInstance(plugin,appWindow);
                        next();
                    }
                    break;
                case "frame":
                    fetchService.json(pluginPath + "config.json",function(config){
                        appWindow.application = config;
                        if (config){
                            if (config.width && config.height){
                                appWindow.setSize(config.width,config.height);
                            }
                            if (config.index){
                                var frameUrl = config.index;
                                if (config.index.indexOf("://")<0) frameUrl = pluginPath + frameUrl;
                                loadFrame(frameUrl,appWindow);
                            }
                        }else{
                            console.error("Error: Plugin " + url + " not found");
                        }
                    });
                    break;
                default:
                    console.error("Error: Unknown plugin type: " + pluginType);
            }
        })
    };

    function loadFrame(url,window,skipSecurity){
        console.log("loadFrame",url,window);
        var frame = document.createElement("iframe");
        window.setContent(frame);
        window.application = window.application || true;
        window.isLoading = true;

        frame.addEventListener("mouseleave",function(){
           window.deActivateContent(true);
        });
        if (!skipSecurity) security.registerUrl(url,window);
        frame.src = url;
    }
    me.loadFrame = loadFrame;

    function registerApplicationActions(pluginName,actions){
        console.error("DEPRECATED !!!!!, use exported methods")
    };

    me.getPlugins = function(){
        return plugins;
    };


    function createPluginInstance(plugin,window){
        console.log(" createPluginInstance",plugin);

        let config = plugin.config;
        if (config.width && config.height) window.setSize(config.width,config.height);
        if (config.left && config.top) window.setPosition(config.left,config.top);

        if (config.index && config.index.indexOf("://")>0){
            console.log("loading external plugin",config.index);
            loadFrame(config.index,window);
            return;
        }

        if (plugin.html){
            window.setContent(plugin.html);
        }

        let instance = plugin.handler;
        if (typeof instance === "function"){
            plugin.instances = plugin.instances||[];
            instance = instance();
            plugin.instances.push(instance);
        }
        if (instance){
            window.application = instance;
            console.log("setting application",instance)
            if (instance.init){
                instance.init(window,me.amiBridge(plugin.name));
            }
        }
    }

    function handleMessage(message,event){
        if (message && message.target && message.target.indexOf("metamask-")===0) return;

        console.log("Got Message",message);
        if (typeof message === "string"){

        }else{
            var command = message.command;
            var windowId = message.windowId;


            if (command !== "register"){
                var appWindow = security.getWindow(windowId);
                if (!appWindow){
                    console.error("Application window not found, app is not registered");
                    return;
                }
            }

            if (command){
                switch (command) {
                    case "register":
                       var isRegistered = security.registerWindow(message.url);
                       if (isRegistered){
                           var window = isRegistered.window;
                           window.messageTarget = event.source;
                           window.messageOrigin = event.origin;
                           event.source.postMessage({
                               registered: true,
                               id:isRegistered.id
                           }, event.origin);
                           if (isRegistered.onload) isRegistered.onload(window);
                       }else{
                           console.error("Can't register app, url " + message.url + " was not launched from here.");
                           event.source.postMessage({
                               registered: false,
                           }, event.origin);
                       }
                        break;
                    case "ready":
                        // app is completely loaded and ready for input
                        // check if we have messages for this app
                        if (appWindow.messageQueue && appWindow.messageQueue.length>0){
                            appWindow.messageQueue.forEach(function(msg){
                                appWindow.sendMessage(msg.message,msg.data);
                            });
                            appWindow.messageQueue = [];
                        }
                        //if (appWindow.onload) appWindow.onload(appWindow);
                        break;
                    case "focus":
                        appWindow.activate();
                        break;
                    case "setMenu":
                        appWindow.setMenu(message.data);
                        mainMenu.setMenu(message.data,appWindow);
                        break;
                    case "requestFileOpen":
                        system.requestFileOpen().then(file=>{
                            var callbackId = message.callbackId;
                            event.source.postMessage({
                                message: "callback",
                                data: {
                                    id: callbackId,
                                    data: file.path,
                                    filename:  file.name
                                }
                            }, event.origin);
                        });
                        break;
                    case "requestFileSave":
                        system.requestFileSave(message.data?message.data.path:"").then(file=>{
                            var callbackId = message.callbackId;
                            event.source.postMessage({
                                message: "callback",
                                data: {
                                    id: callbackId,
                                    data: file.path,
                                    filename:  file.name
                                }
                            }, event.origin);
                        });
                        break;
                    case "readFile":
                        var data = message.data;
                        var callbackId = message.callbackId;
                        fileSystem.readFile(data.path,!!data.asBinary).then(file => {
                            event.source.postMessage({
                                message: "callback",
                                data: {
                                    id: callbackId,
                                    data: data.asBinary ? file.buffer : file,
                                    filename:  file.name
                                }
                            }, event.origin);
                        });
                        break;
                    case "getUrl":
                        var data = message.data;
                        var callbackId = message.callbackId;
                        let mount = fileSystem.getMount(data.path);
                        let fs = fileSystem.getFileSystem(mount);
                        if (fs && fs.getUrl){
                            fs.getUrl(data.path,mount).then(url=>{
                                event.source.postMessage({
                                    message: "callback",
                                    data: {
                                        id: callbackId,
                                        data: url
                                    }
                                }, event.origin);
                            });
                        } else {
                            event.source.postMessage({
                                message: "callback",
                                data: {
                                    id: callbackId,
                                    data: false
                                }
                            }, event.origin);
                        }
                        break;
                    case "writeFile":
                        var data = message.data;
                        var callbackId = message.callbackId;
                        fileSystem.writeFile(data.path,data.data,!!data.asBinary).then(result => {
                            console.error("writeFile",result);
                            event.source.postMessage({
                                message: "callback",
                                data: {
                                    id: callbackId,
                                    data: result
                                }
                            }, event.origin);
                        });
                        break;
                    case "activateWindow":
                        appWindow.activate();
                        break;
                    case "closeWindow":
                        appWindow.close();
                        break;
                    case "moveWindow":
                        if (message.data && typeof message.data.x === "number" && typeof message.data.y === "number") {
                            appWindow.setPosition(appWindow.left + message.data.x, appWindow.top + message.data.y);
                        }
                        break;
                    case "relay":
                        // The window has opened other frames and wants to relay messages to them
                        appWindow.sendMessage("relay",message);

                }
            }
        }
    }

    // main object to pass to trusted plugins and apps
    me.amiBridge = function(pluginName){
        function isAllowed(capability){
            if (!pluginName) return true;
            return system.pluginHasCapability(pluginName, capability);
        }

        function guard(capability, value){
            if (isAllowed(capability)) return value;
            if (typeof value === "function"){
                return function(){
                    console.warn(`Plugin ${pluginName} is missing capability ${capability}`);
                };
            }
            return undefined;
        }

        return{
            fetch: guard("net.fetch", fetchService),
            readFile: guard("fs.read", fileSystem.readFile),
            writeFile: guard("fs.write", fileSystem.writeFile),
            copyFile: guard("fs.write", fileSystem.copyFile),
            moveFile: guard("fs.write", fileSystem.moveFile),
            uploadFile: guard("fs.write", desktop.uploadFile),
            getDirectory: guard("fs.read", fileSystem.getDirectory),
            createDirectory: guard("fs.write", fileSystem.createDirectory),
            getUniqueName: guard("fs.write", fileSystem.getUniqueName),
            getUrl: guard("fs.read", (file)=>{
                return new Promise(next=>{
                    let mount = fileSystem.getMount(file);
                    let fs = mount.handler;
                    if (fs && fs.getUrl){
                        fs.getUrl(file.path,mount).then(url=>{
                            next(url);
                        });
                    }else{
                        next();
                    }
                });
            }),
            getMounts: guard("fs.read", fileSystem.getMounts),
            requestFileOpen: guard("fs.dialog", system.requestFileOpen),
            requestFileSave: guard("fs.dialog", system.requestFileSave),
            launchProgram: guard("ui.desktop", system.launchProgram),
            isReadOnly: guard("fs.read", fileSystem.isReadOnly),
            getObjectInfo: guard("system.inspect", system.getObjectInfo),
            detectFileType: guard("system.inspect", system.detectFileType),
            loadScript: guard("system.loadScript", system.loadScript),
            user: guard("system.user", user),
            desktop: guard("ui.desktop", desktop),
            util:{
                sha256: guard("crypto.sha256", security.sha256),
            },
            settings: guard("system.settings", settings),
        }
    }

    // needed for backwards compatibility: :-/
    me.registerApplicationActions = registerApplicationActions;
    window.Applications = me;

    return me;
};

export default Applications();
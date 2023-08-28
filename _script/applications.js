import security from "./security.js";
import fetchService from "./util/fetchService.js";
import system from "./system/system.js";
import mainMenu from "./ui/mainmenu.js";
import fileSystem from "./system/filesystem.js";
import user from "./user.js";
import {loadCss} from "./util/dom.js";

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
    var mainContext = window;

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
            appWindow.setContent("loading");

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
                instance.init(window,me.amiBridge());
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
                            console.error(file);
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
                }
            }
        }
    }

    // main object to pass to trusted plugins and apps
    me.amiBridge = function(){
        return{
            fetch: fetchService,
            readFile: fileSystem.readFile,
            writeFile: fileSystem.writeFile,
            getDirectory: fileSystem.getDirectory,
            getUrl: (file)=>{
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
            },
            getMounts: fileSystem.getMounts,
            requestFileOpen: system.requestFileOpen,
            requestFileSave: system.requestFileSave,
            isReadOnly: fileSystem.isReadOnly,
            getObjectInfo: system.getObjectInfo,
            detectFileType: system.detectFileType,
            loadScript: system.loadScript,
            user: user
        }
    }

    // needed for backwards compatibility: :-/
    me.registerApplicationActions = registerApplicationActions;
    window.Applications = me;

    return me;
};

export default Applications();
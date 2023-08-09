import amiWindow from "./window.js";
import amiFile from "../system/file.js";
import {loadCss} from "../util/dom.js";
import user from "../user.js";
import ui from "./ui.js";
import fetchService from "../util/fetchService.js";
import input from "../input.js";
import eventBus from "../util/eventBus.js";
import {EVENT} from "../enum.js";
import mainMenu from "./mainmenu.js";
import applications from "../applications.js";
import fileSystem from "../system/filesystem.js";
import system from "../system/system.js";
import amiObject from "../system/object.js";

let Desktop = function(){
    let me = amiWindow({
        type: 'desktop',
        paddingLeft: 20,
        paddingTop: 30
    });

    me.left = 0;
    me.top = 0;

    var container;
    var screen;
    var windows=[];
    var focusElement={};
    var selectedElements=[];
    var selectBox;
    var loadTimer;

    me.init = function(){
        container = me.getInner();
        container.classList.add("desktop");
        container.id = "desktop";

        screen = document.createElement("div");
        screen.id = "screen";
        screen.appendChild(container);
        document.body.appendChild(screen);
        me.height = document.body.offsetHeight;
        me.width = document.body.offsetWidth;

        container.addEventListener("mousedown",function(e){
            if (e.target.id === "desktop"){
                me.setFocusElement(me);
            }
        });

        ui.enableSelection(me,container);
        me.setDropTarget(container);
    };

    me.createWindow = function(config){
        var window = amiWindow(config);
        container.appendChild(window.element);
        window.activate();
        windows.push(window);
        return window;
    };


    me.openFolder = async function(folder){
        console.log("open Folder",folder);

        // TODO: folders don't have IDs anymore ? move to paths?
        var w = windows.find(function(w){return w ? w.id === folder.id : false});
        
        if (w){
            w.activate();
        }else{
            w = me.createWindow(folder);
            let items = await folder.getContent();
            items.forEach(item=>{
                w.createIcon(item);
            });
            w.cleanUp();
        }
        return w;
    };

    me.openDrive = async function(drive){
        console.log("open Drive",drive);
        if (drive.volume){
            let w = me.createWindow(drive);
            let items = await drive.getContent();
            items.forEach(item=>{
                w.createIcon(item);
            });
            w.cleanUp();
        }  else{
            me.openFolder(drive)
        }
    };
    
    me.getWindows = function(){
      return windows;  
    };

    me.launchUrl = function(config){
        if (config.target === "_blank"){
            window.open(config.url);
        }else{
            var w = me.createWindow(config.name || config.label || config.path || config.url);
            w.setSize(800,600);
            if (config.url){
                applications.loadFrame(config.url,w);
            }else{
                if (config.binary){
                    var urlObject = URL.createObjectURL(new Blob([config.binary.buffer],{type: config.mimeType}));
                    applications.loadFrame(urlObject,w,true);
                }
            }

        }
    };

    me.removeWindow = function(window){
        var index = windows.findIndex(function(item){return item.id === window.id});
        if (index>=0){
            windows.splice(index,1);
        }
        window.element.remove();
        
        // TODO move focus to previous window?
        me.setFocusElement(me);
    };

    me.getTopZindex = function(){
        var max = 1;
        windows.forEach(function(item){
            max = Math.max(max,item.zIndex);
        });
        me.getIcons().forEach(function(item){
            if (item){
                max = Math.max(max,item.zIndex);
            }

        });
        return max;
    };

    me.setFocusElement = function(elm){
        var undoSelection = true;
        if (elm.type === "icon" && elm.isActive()) undoSelection = false;
        if (input.isShiftDown) undoSelection=false;
        if (input.isCtrlDown) undoSelection=false;

        if (undoSelection){
            me.getSelectedIcons().forEach(function(item){
                if (item.id !== elm.id){
                    item.deActivate();
                }
            });
        }

        
        if (focusElement.id !== elm.id){
            if (undoSelection) if (focusElement.deActivate) focusElement.deActivate();
            focusElement = elm;
            eventBus.trigger(EVENT.ACTIVATE_DESKTOP_ELEMENT);
        }

        mainMenu.hideMenu();

    };


    me.getFocusElement = function(){
        return focusElement;
    };
    
    me.uploadFile = function(target){
        let inputElm = document.createElement('input');
        inputElm.type = 'file';
        inputElm.onchange = function(e){
            me.handleUpload(e.target.files,target);
        };
        inputElm.click();
    };

    me.loadFile = function(url,next){
        fetchService.arrayBuffer(url,async function(arrayBuffer){
            if (arrayBuffer){
                var fileName = url.split("/").pop();
                var fileInfo = await System.inspectBinary(arrayBuffer,fileName);
                fileInfo.path = "http";
                next(fileInfo);
            }else{
                next({});
            }
        });
    };

    me.handleUpload = function(files){
        console.log("file uploaded");
        if (files.length){
            var uploadfile = files[0];

            var reader = new FileReader();
            reader.onload = async function(){
                let fileInfo = {
                    type: "file",
                    name: uploadfile.name,
                    path: "ram:" + uploadfile.name,
                    mimeType: uploadfile.type
                }

                let BinaryStream = await system.loadLibrary("binaryStream.js");
                fileInfo.binary = new BinaryStream(reader.result,true);

                // TODO: should I use the mimeType for this?
                fileInfo.filetype = await system.detectFileType(fileInfo);

                console.log("uploaded file is of type " + fileInfo.filetype.name);
                fileInfo.className = fileInfo.filetype.className;

                var file = amiObject(fileInfo);
                me.createIcon(file);
                me.cleanUp();

                if (file.filetype.mountFileSystem){
                    fileSystem.mount(file.name,file.filetype.mountFileSystem.volume,file.filetype.mountFileSystem.plugin,file)
                }else{
                    fileSystem.getMount("ram:").handler.addFile(file);
                }
            };
            reader.readAsArrayBuffer(uploadfile);
        }
    };


    me.loadContent = function(data,mounts){
        if (!data || typeof data === "string"){
            data = data||"content/default.json";
            fetchService.json(data,function(_data){
                setContent(_data);
            });
        }else{
            setContent(data);
        }

        function setContent(content){
            content.forEach(function(item){
                addContent(item)
            })
            if (mounts && mounts.length){
                mounts.forEach(function(item){
                    addContent(item)
                });
            }
            me.cleanUp();
        }

        function addContent(item){
            let object = amiObject(item);
            me.createIcon(object);
            if (object.type === "drive"){
                fileSystem.mount(object);
            }
        }
    };

    me.loadTheme = function(name){
        return new Promise(function (resolve,reject) {
            var url = "themes/" + name + "/theme.css";
            var loaded = false;
            clearTimeout(loadTimer);
            loadTimer = setTimeout(function(){
                if (!loaded){
                    console.warn("Theme not loaded properly");
                    resolve();
                }
            },3000);

            function apply(){
                var remove = [];
                document.body.classList.forEach(function(className){
                    if (className.indexOf("theme_")>=0) remove.push(className);
                });
                remove.forEach(function(className){document.body.classList.remove(className)});
                document.body.classList.add("theme_" + name);
                user.storeSetting("theme",name);
                resolve();
            }

            loadCss(url,function(){
                clearTimeout(loadTimer);
                loaded=true;
                apply();
            });
        });
    };
    
    me.setBackground = function(config){
        console.error(config);
        if(config === "reset"){
            container.style.backgroundImage = "";
            container.style.backgroundSize = "";
            container.style.backgroundPosition = "";
            container.style.backgroundRepeat = "";
            screen.style.width = "";
            screen.style.height = "";
            screen.style.margin = "";
            return ;
        }

        if (typeof config === "string"){
            config = {backgroundImage: config};
        }

        if (config.backgroundImage) {
            if (config.backgroundImage === "none"){
                container.style.background= "none";
            }else{
                container.style.background= "url('"+config.backgroundImage+"')";
            }
        }
        if (config.scale){
            container.style.backgroundSize = config.scale==="stretch"?"cover":"initial";
            container.style.backgroundPosition = config.scale==="center"?"center center":"top left";
            container.style.backgroundRepeat = (config.scale==="tile")?"repeat":"no-repeat";
        }
        if (config.color) container.style.backgroundColor=config.color;


        if (config.screen){
            var w,h;

            if (config.screen.indexOf("x")>0){
                w = config.screen.split("x")[0];
                h = config.screen.split("x")[1];
            }

            if (w && h){
                screen.style.width = w + "px";
                screen.style.height = h + "px";
                screen.style.margin = "auto";
            }else{
                screen.style.width = "";
                screen.style.height = "";
                screen.style.margin = "";
            }

        }
    }

    me.getScreen = function(){
        return screen;
    }
    
    me.showMessage = function(message){
        Toolbar.showMessage(message);
    };
    

    return me;
};

export default Desktop();
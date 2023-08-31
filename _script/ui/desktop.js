import amiWindow from "./window.js";
import $,{loadCss} from "../util/dom.js";
import user from "../user.js";
import SelectBox from "./selectBox.js";
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
        type: 'desktop'
    });

    me.left = 0;
    me.top = 0;

    var container;
    var screen;
    var windows=[];
    var focusElement={};
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
        let selectBox = SelectBox({
            parent: container,
            onSelect:(x,y,w,h)=>{
                let icons = me.getIcons();
                icons.forEach(function(icon){
                    if (icon.left>x && icon.left<x+w && icon.top>y && icon.top<y+h){
                        if (!icon.isActive()){
                            icon.activate(true);
                            icon.moveToTop();
                        }
                    }else{
                        icon.deActivate(true);
                    }
                });
            }
        });

        container.classList.add("handle");
        container.onClick = function(e){
            me.setFocusElement(me);
        }
        container.onDrag = (touchData)=>selectBox.update(touchData);
        container.onUp = ()=>selectBox.remove();
    };

    me.createWindow = function(config){
        var window = amiWindow(config);
        container.appendChild(window.element);
        window.activate();
        windows.push(window);
        return window;
    };

    me.openDrive = me.openFolder = async function(folder){
        let window = me.createWindow(folder);
        applications.load("filemanager",window).then(function(){
            window.sendMessage("hideSideBar");
            window.sendMessage("openFolder",folder);
        });
    };

    
    me.getWindows = function(){
      return windows;  
    };

    me.launchUrl = function(config){
        if (config.target === "_blank"){
            window.open(config.url);
        }else{
            var w = me.createWindow(config.name || config.label || config.path || config.url);
            w.setSize(config.width||800,config.height||600);
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
        if (elm && elm.id === "popupmenu") return;

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
            let deActivate = undoSelection;
            if (elm.parent && elm.parent.id === focusElement.id){
                deActivate = false;
            }
            if (!focusElement.deActivate) deActivate = false;
            if (deActivate){
                focusElement.deActivate();
            }
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

    me.handleUpload = function(files,target){
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

                if (target){
                    // upload to application
                    if (target.uploadFile){
                        target.uploadFile(file);
                        return;
                    }
                }

                // upload to desktop/ram
                me.createIcon(file);
                me.cleanUp();

                if (file.filetype.mountFileSystem){
                    let drive = {
                        type: "drive",
                        name: file.name,
                        volume: file.filetype.mountFileSystem.volume,
                        handler: file.filetype.mountFileSystem.plugin,
                        binary:file.binary
                    }
                    fileSystem.mount(drive);
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
        console.log("load theme " + name);
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

    me.openWith = function(object){
        let w = me.createWindow({
            caption: "Open With",
            width: 400,
            height: 300,
        });

        let open = function(appName){
            w.close();
            system.openFile(object,appName);
        }

        let programList = [
            {name: "Notepad",icon: "notepad",plugin: "notepad"},
            {name: "Hex Editor",icon: "hex",plugin: "hex"},
            {name: "Monaco Editor",icon: "vs",plugin: "monaco"},
            {name: "Image Viewer",icon: "imageviewer",plugin: "imageviewer"},
            {name: "Media Player",icon: "mediaplayer",plugin: "mediaplayer"},
            {name: "Media Player (HTML)",icon: "mediaplayer",plugin: "htmlAudio"},
            {name: "Video Player",icon: "videoplayer",plugin: "videoplayer"},
            {name: "Bassoon Tracker",icon: "mediaplayer",plugin: "bassoon"},
            {name: "Dpaint",icon: "iconeditor",plugin: "dpaint"},
            {name: "Frame",icon: "frame",plugin: "iframe"},
        ]

        let list = $(".content.full");
        programList.forEach(program=>{
            list.appendChild($(".button." + program.icon,{onClick:()=>{open(program.plugin)}},program.name));
        });

        w.setContent(list);

    }

    me.getScreen = function(){
        return screen;
    }
    
    me.showMessage = function(message){
        Toolbar.showMessage(message);
    };

    me.cleanUp = function(){
        var left=30;
        var top= 50;
        let grid = me.getGridSize();

        var h = (me.height||350) - grid.height;
        var w = (me.width||me.getInner().offsetWidth||500) - grid.width;

        let icons = me.getIcons();
        icons.forEach(function(icon){
            if (icon){
                icon.setPosition(left,top);
                top += grid.height;
                if (left>w){
                    top+=grid.height;
                    left = 30;
                }
            }
        })
    }
    

    return me;
};

export default Desktop();
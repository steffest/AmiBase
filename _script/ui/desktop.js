import amiWindow from "./window.js";
import $ from "../util/dom.js";
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
import Notification from "./notification.js";
import filesystem from "../system/filesystem.js";
import settings from "../settings.js";

let Desktop = function(){
    let me = amiWindow({
        type: 'desktop',
        path: "desktop:",
    });

    me.left = 0;
    me.top = 0;

    var container;
    var screen;
    var windows=[];
    var focusElement={};
    var loadTimer;
    var themeStylesheetId = "amibase-theme";

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
        window.addEventListener('resize', function(){
            me.height = document.body.offsetHeight;
            me.width = document.body.offsetWidth;
        });
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

    // Opens a URL as a real, native browser window (a genuinely separate
    // process, not an iframe), when running inside the Electron shell --
    // kiosk-image's Openbox window manager gives it normal window behavior
    // (movable, resizable, closable, Alt+Tab) with no AmiBase involvement
    // beyond launching it. Falls back to a plain new browser tab otherwise.
    me.openWebsite = async function(url){
        if (window.electronBridge){
            // --no-sandbox: matches the kiosk image's top-level Electron shell --
            // this chroot-built image has no setuid sandbox helper configured, so
            // Chromium (bundled inside Electron, or here spawned standalone) won't
            // start without it. --no-first-run/--noerrdialogs/--disable-infobars/
            // --disable-session-crashed-bubble avoid first-run or crash-restore UI.
            let result = await window.electronBridge.launchApp(
                "chromium --app=" + url + " --ozone-platform=x11 --no-sandbox" +
                    " --no-first-run --noerrdialogs --disable-infobars --disable-session-crashed-bubble" +
                    " --user-data-dir=/tmp/amibase-website-" + Date.now()
            );
            if (!result.ok) me.showError("Couldn't open website: " + result.reason);
        }else{
            window.open(url,"_blank");
        }
    };

    // Opens a real, native terminal (xterm) the same way openWebsite opens a
    // browser, when running inside the Electron shell. Falls back to the
    // existing term-server-backed web terminal (plugin:terminal) otherwise,
    // since that already works in any plain-browser context without
    // electronBridge.
    me.openTerminal = async function(){
        if (window.electronBridge){
            let result = await window.electronBridge.launchApp("xterm");
            if (!result.ok) me.showError("Couldn't open terminal: " + result.reason);
        }else{
            system.launchProgram({url: "plugin:terminal"});
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

    // Read all entries from a DirectoryReader, handling the browser's batching
    function readAllDirEntries(reader) {
        return new Promise(resolve => {
            let all = [];
            function batch() {
                reader.readEntries(entries => {
                    if (!entries.length) { resolve(all); return; }
                    all = all.concat(Array.from(entries));
                    batch();
                });
            }
            batch();
        });
    }

    // Get a File object from a FileSystemFileEntry
    function getFileFromEntry(entry) {
        return new Promise(resolve => entry.file(resolve));
    }

    // Process a single File object and place it in RAM (and optionally on the desktop)
    async function processSingleFile(file, target, ramFolderPath) {
        return new Promise(resolve => {
            let reader = new FileReader();
            reader.onload = async function() {
                let filePath = ramFolderPath
                    ? "ram:" + ramFolderPath + "/" + file.name
                    : "ram:" + file.name;
                let fileInfo = {
                    type: "file",
                    name: file.name,
                    path: filePath,
                    mimeType: file.type
                };
                let BinaryStream = await system.loadLibrary("binaryStream.js");
                fileInfo.binary = new BinaryStream(reader.result, true);
                fileInfo.filetype = await system.detectFileType(fileInfo);
                console.log("uploaded file is of type " + fileInfo.filetype.name);
                fileInfo.className = fileInfo.filetype.className;
                let fileObj = amiObject(fileInfo);

                if (!ramFolderPath) {
                    // Root-level file: show on desktop
                    if (target && target.uploadFile) {
                        target.uploadFile(fileObj);
                        resolve(); return;
                    }
                    me.createIcon(fileObj);
                    me.cleanUp();
                    if (fileObj.filetype.mountFileSystem) {
                        let drive = {
                            type: "drive",
                            name: fileObj.name,
                            volume: fileObj.filetype.mountFileSystem.volume,
                            handler: fileObj.filetype.mountFileSystem.plugin,
                            binary: fileObj.binary,
                            url: fileObj.path || fileObj.url
                        };
                        fileSystem.mount(drive);
                    } else {
                        fileSystem.getMount("ram:").handler.addFile(fileObj);
                    }
                } else {
                    // Nested file inside an uploaded folder: store in RAM only
                    fileSystem.getMount("ram:").handler.addFile(fileObj);
                }
                resolve();
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // Recursively upload a FileSystemDirectoryEntry into RAM
    async function uploadDirEntry(entry, parentRamPath) {
        let name = entry.name;
        let myRamPath = parentRamPath ? parentRamPath + "/" + name : name;
        let ramHandler = fileSystem.getMount("ram:").handler;
        await ramHandler.createDirectory(parentRamPath || "", name);

        // At root level, show a folder icon on the desktop
        if (!parentRamPath) {
            me.createIcon(amiObject({ type: "folder", name: name, path: "ram:" + name }));
            me.cleanUp();
        }

        let children = await readAllDirEntries(entry.createReader());
        for (let child of children) {
            if (child.isDirectory) {
                await uploadDirEntry(child, myRamPath);
            } else {
                let file = await getFileFromEntry(child);
                await processSingleFile(file, null, myRamPath);
            }
        }
    }

    me.handleUpload = async function(files, target, items) {
        console.log("file uploaded", files);

        // Use the FileSystem Entry API when available — supports dropped folders
        if (items && items.length && items[0] && items[0].webkitGetAsEntry) {
            let entries = [];
            for (let i = 0; i < items.length; i++) {
                let entry = items[i].webkitGetAsEntry();
                if (entry) entries.push(entry);
            }
            if (entries.length) {
                for (let entry of entries) {
                    if (entry.isDirectory) {
                        await uploadDirEntry(entry, null);
                    } else {
                        let file = await getFileFromEntry(entry);
                        await processSingleFile(file, target, null);
                    }
                }
                return;
            }
        }

        // Fallback: plain FileList (e.g. from <input type="file">)
        if (files.length) {
            await processSingleFile(files[0], target, null);
        }
    };


    // Resolves once all content objects and mounts have been added and every
    // mounted drive's handler is fully wired. Boot code awaits this before
    // running startup-sequences, so it must not depend on fetch/mount timing.
    me.loadContent = function(data,mounts,path){
        return new Promise(function(resolve){
            if (!data || typeof data === "string"){
                data = data||"content/default.json";
                fetchService.json(data,function(_data){
                    setContent(_data).then(resolve);
                });
            }else{
                setContent(data).then(resolve);
            }

            async function setContent(content){
                let driveObjects = [];
                function add(item){
                    let icon = me.addObject(item);
                    // icon.object is the amiObject-wrapped instance that
                    // fileSystem.mount registered (and keyed whenReady on),
                    // not the raw item, so collect that one.
                    if (item && item.type === "drive" && icon && icon.object){
                        driveObjects.push(icon.object);
                    }
                }
                content.forEach(add);
                if (mounts && mounts.length) mounts.forEach(add);
                syncRamDriveDisplay();
                me.cleanUp();
                // Wait for each drive's handler to be fully wired. addObject ->
                // fileSystem.mount registers the mount synchronously, but a
                // string handler is loaded asynchronously; whenReady awaits that.
                await Promise.all(driveObjects.map(function(object){
                    return fileSystem.whenReady(object).catch(function(e){
                        console.warn("mount failed during loadContent",object,e);
                    });
                }));
            }

            if (path){
                filesystem.getDirectory(path).then(list=>{
                    list.forEach(me.addObject);
                    me.cleanUp();
                });
            }
        });
    };

    function isRamDriveIcon(icon){
        let object = icon && icon.object ? icon.object : {};
        if (object.type !== "drive") return false;
        let volume = typeof object.volume === "string" ? object.volume.toUpperCase() : "";
        let label = typeof (object.label || object.name) === "string" ? (object.label || object.name).toUpperCase() : "";
        let handlerName = typeof object.handler === "string" ? object.handler : object.filesystemName;
        let handler = typeof handlerName === "string" ? handlerName.toLowerCase() : "";
        return volume === "RAM" || label === "RAM" || handler === "ram";
    }

    function syncRamDriveDisplay(forceState){
        let showRamDrive = typeof forceState === "boolean" ? forceState : settings.displayRamDrive === true;
        let ramIcons = me.getIcons().filter(isRamDriveIcon);

        if (showRamDrive && !ramIcons.length){
            me.addObject({
                type: "drive",
                label: "RAM",
                volume: "RAM",
                handler: "ram"
            });
            return;
        }

        if (!showRamDrive && ramIcons.length){
            ramIcons.forEach(function(icon){
                me.removeIcon(icon);
            });
        }
    }

    me.refreshRamDriveDisplay = function(showRamDrive){
        syncRamDriveDisplay(showRamDrive);
        me.cleanUp();
    }

    me.addObject = function(item){
        let object = amiObject(item);
        let icon = me.createIcon(object);
        if (icon && icon.element) icon.element.classList.add("desktopicon");
        if (object.type === "drive"){
            fileSystem.mount(object);
        }
        return icon;
    }

    me.loadTheme = function(name){
        console.log("load theme " + name);

        settings.UIConcept = name === "ink" ? "plain" : "desktop";
        if (settings.UIConcept === "plain"){
            me.setGridSize(200,30);
        }

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

            var link = document.getElementById(themeStylesheetId);
            if (!link){
                link = document.createElement("link");
                link.id = themeStylesheetId;
                link.rel = "stylesheet";
                link.type = "text/css";
                document.head.appendChild(link);
            }

            if (link.getAttribute("data-theme") === name){
                clearTimeout(loadTimer);
                loaded = true;
                apply();
                return;
            }

            link.onload = function(){
                clearTimeout(loadTimer);
                loaded = true;
                apply();
            };

            link.onerror = function(){
                clearTimeout(loadTimer);
                console.warn("Theme stylesheet failed to load: " + url);
                apply();
            };

            link.setAttribute("data-theme",name);
            link.href = url;
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

    me.showNotification = function(config){
        return Notification.show(config);
    }
    me.hideNotification = function(config){
        return Notification.hide(config);
    }

    me.showError = function(message,autoHide){
        console.error(message);
        if (typeof autoHide === "undefined") autoHide = false;
        me.showNotification({
            label:"Error",
            text:message,
            type:"error",
            autoHide: autoHide
        });
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

        let programList = system.getRegisteredApplications().filter(item=>item.openWith);

        let list = $(".content.full.centered",{style:{padding: "10px 20px"}});
        programList.forEach(program=>{
            list.appendChild($(".button.square.transparent",{onClick:()=>{open(program.plugin)}},
                $(".icon",{style:{backgroundImage: "url('plugins/" + program.plugin + "/icon.png')"}}),
                $("label", program.name)));
        });

        w.setContent(list);
    }

    me.mountWithDialog = function(object){
        console.error(object);
        system.launchProgram("addMount");
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
                if (top>h){
                    left += grid.width;
                    top = 50;
                }
            }
        })
    }

    me.reset = ()=>{
        me.getWindows().slice().forEach(function(windowHandle){
            if (windowHandle && windowHandle.close) windowHandle.close();
        });
        me.clear();
        me.setBackground("reset");
    }
    

    return me;
};

export default Desktop();
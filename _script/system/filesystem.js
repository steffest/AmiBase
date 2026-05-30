
import system from "./system.js";
import amiObject from "./object.js";
import http from "./filesystems/http.js";
import ram from "./filesystems/ram.js";
import rad from "./filesystems/rad.js";
import desktop from "../ui/desktop.js";
import user from "../user.js";
import {uuid} from "../util/dom.js";
import notification from "../ui/notification.js";

let FileSystem = function(){
   var me = {};

    var mounts = {
        ram:{
            name: "RAM",
            filesystem: "ram",
            readOnly: false,
            handler: ram
        },
        desktop:{
            name: "DESKTOP",
            filesystem: "rad",
            readOnly: false,
            handler: rad
        }
    };
    var fileSystems = {
        ram: ram,
        desktop: rad,
        rad: rad,
    };

    me.register=function(name,handler){
        console.log("registering filesystem " + name);
        fileSystems[name] = handler;
        for (var mount in mounts){
            if (mounts[mount].filesystem === name){
                mounts[mount].handler = handler;
            }
        }
    };

    me.mount = function(drive){
        return new Promise(async function(next){
            const mountSource = drive.url || drive.path;
            const existingMount = me.getMountByUrl(mountSource);
            if (existingMount){
                // Keep caller object aligned so follow-up openFolder(drive) still works.
                drive.volume = existingMount.volume;
                drive.path = existingMount.path;
                drive.handler = existingMount.handler;
                drive.mounted = true;
                next(existingMount);
                return;
            }

            let volume = drive.volume.toLowerCase()
            if (volume !== "ram"){
                var c = getVolumeIndex(volume);
                volume = volume.toLowerCase() + c;
            }
            mounts[volume] = drive;
            drive.volume = volume;
            drive.path = volume + ":";

            if (drive.handler && typeof drive.handler === "string"){
                drive.filesystemName = drive.handler;
                if (drive.handler === "local") drive.handler = "localFileSystemAccess";
                if (!fileSystems[drive.handler]) await system.loadLibrary(drive.handler);
                mounts[volume].mounted = true;
                mounts[volume].handler = fileSystems[drive.handler];
                next(drive);
            }else{
                next(drive);
            }
        });
    };

    me.unmount = async function(drive,persistSettings){
        if (!drive) return;
        if (typeof persistSettings === "undefined") persistSettings = true;

        let volumeKey = String(drive.volume || me.getVolume(drive.path || "") || "").toLowerCase();
        if (persistSettings){
            let settings = await user.getAmiSettings();
            settings.mounts = settings.mounts || [];
            let index = settings.mounts.findIndex(mount=>mount.id === drive.id);
            if (index>=0){
                settings.mounts.splice(index,1);
                user.setAmiSettings(settings);
            }
        }

        if (volumeKey && volumeKey !== "ram" && volumeKey !== "desktop"){
            delete mounts[volumeKey];
        }
    };

    me.mountLocalDrive = async function(){
        if (!window.showDirectoryPicker){
            desktop.showError("showDirectoryPicker not supported");
            return;
        }
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        console.error(dirHandle);
        console.error(dirHandle.values());
        let settings = await user.getAmiSettings();
        console.error(settings);
        settings.mounts = settings.mounts || [];
        let mount = {
            type: "drive",
            label: dirHandle.name,
            handler: "local",
            volume: "LOCAL",
            handle: dirHandle,
            id: uuid()
        };
        desktop.addObject(mount);
        desktop.cleanUp();
        settings.mounts.push(mount);
        user.setAmiSettings(settings);

    }

    me.reset = async ()=>{
        let currentMounts = me.getMounts();
        for (const key of Object.keys(currentMounts)){
            let mount = currentMounts[key];
            let volume = String((mount && mount.volume) || key || "").toLowerCase();
            if (volume === "ram" || volume === "desktop"){
                if (mount && mount.handler && typeof mount.handler.reset === "function"){
                    mount.handler.reset();
                }
            }else{
                await me.unmount(mount,false);
            }
        }
    }

    me.isReadOnly = function(file){
        let mount = me.getMount(file);
        if (typeof mount.readOnly === "boolean") return mount.readOnly;
        let fs = mount.handler;
        if (fs && typeof fs.isReadOnly === "function") return fs.isReadOnly(file);
        return true;
    }

    me.getMount = function(path){
        let volume = me.getVolume(path);
        return mounts[volume] || {
            name: "http",
            filesystem: "http",
            readOnly: true,
            handler: http
        };
    };

    me.getVolume = function(path){
        if (!path) return;

        if (typeof path !== "string"){
            if (path.isAmiObject){
                path=path.path;
            }else{
                path = amiObject(path).path;
            }
        }
        if (!path) return;
        return path.split(":")[0].toLowerCase();
    };


    me.getMounts = function(){
        return mounts;
    };

    // Find an existing mount that was created from a given source file path/url.
    // Used to prevent mounting the same .zip/.adf file multiple times.
    me.getMountByUrl = function(url){
        if (!url) return null;
        const normalizedUrl = normalizeMountSource(url);
        for (const key of Object.keys(mounts)){
            const m = mounts[key];
            const mountSource = m.url || m.path;
            if (mountSource && normalizeMountSource(mountSource) === normalizedUrl) return m;
        }
        return null;
    };


    me.getDirectory = async function(folder, resolveFiletypes){
        console.log("getDirectory",folder);
        if (!folder){
            console.error("Error opening folder: no folder specified");
            return;
        }
        let path = typeof folder === "string" ? folder : folder.path;
        var mount = me.getMount(path);
        let fs = mount.handler;

        if (fs){
            console.log("mount",mount);
            var data = await fs.getDirectory(path,mount);
            var result = [];

            for (const dir of data.directories) {
                result.push(amiObject({
                    type: "folder",
                    name: dir.name,
                    path: path + dir.name + "/",
                    head:dir.head
                }));
            }

            for (const file of data.files) {
                if (file.isAmiObject){
                    result.push(file);
                    continue;
                }
                let type = file.type || "file";

                var fileConfig = {
                    type: type,
                    name: file.name,
                    path: path + file.name,
                    head:file.head
                }
                if (resolveFiletypes) fileConfig.filetype = await system.detectFileType(file);

                // This is used to enable "load content by url" over HTTP
                // e.g. for videoplayers to avoid loading the whole file into memory
                if (fs.getFileUrl) fileConfig.url = fs.getFileUrl(path + file.name,mount);

                if (file.url) fileConfig.url = file.url;
                if (file.handler) fileConfig.handler = file.handler;
                if (file.label) fileConfig.label = file.label;
                if (file.icon) fileConfig.icon = file.icon;
                if (file.iconActive) fileConfig.iconActive = file.iconActive;


                result.push(amiObject(fileConfig));

            }

            return result;
        }else{
            console.warn("Can't read directory, no handler");
            return [];
        }
    };


    me.createDirectory = function(path,newName){
        console.log("createDirectory");
        var mount = me.getMount(path);
        let fs = mount.handler;
        if  (fs){
            return fs.createDirectory(path,newName,mount);
        }
    };

    // returns the content of the file, default as ascii, optional as binarystream
    me.readFile = function(file,binary){
        console.log("readFile",file,binary);
        file = normalize(file);
        return new Promise(async next => {
            let mount = me.getMount(file);
            let fs = mount.handler;
            if  (fs){
                let result = await fs.readFile(file.path,binary,mount);
                next(result);
            }else{
                console.error("Can't get file, no handler");
                next("");
            }
        });
    };

    me.readJson = async function(file){
        let content = await me.readFile(file);
        let result = {};
        if (content){
            try{
                result = JSON.parse(content);
            }catch(e){
               result = {};
            }
        }
        return result;
    }


    me.writeFile = function(file,content,binary,onProgress){
        notification.toast("waiting");
        file = normalize(file);
        return new Promise(async next => {
            var mount = me.getMount(file.path);
            let fs = mount.handler;
            if (fs){
                let response = await fs.writeFile(file.path,content,binary,mount,progress=>{
                    if (onProgress) onProgress(progress);
                },file);
                notification.toast({type:"success",timeout:10});
                next(response);
            }else{
                notification.toast({type:"success",timeout:30});
                console.error("no handler");
                next();
            }
        });
    };

    me.getFileProperties = function(file){
        return new Promise(async next => {
            var mount = me.getMount(file.path);
            let fs = mount.handler;
            if (fs && fs.getInfo){
                let response = await fs.getInfo(file.path,mount);
                next(response);
            }else{
                next({name:file.name});
            }
        });
    }

    me.getDownloadUrl = function(path){
        var volume = me.getVolume(path);
        if (volume === "http" || volume === "https"){
            return path;
        }
        return path;
    };

    me.copyFile = function(file,toPath){
        return new Promise(async next => {
            let fromPath = file.path;
            console.log("Copy File",fromPath,toPath);
            let mount = me.getMount(fromPath);
            let fs = mount.handler;
            let targetMount = me.getMount(toPath);
            let targetFs = targetMount.handler;

            if (fs){
                if (mount.path === targetMount.path){
                    // copy inside same volume
                    var result = await fs.copyFile(fromPath,toPath,mount);
                    next(result);
                }else{
                    let content = await fs.readFile(fromPath,true,mount);
                    toPath = toPath + '/' + file.name;

                    let notification = {
                        label:"Copying",
                        text:file.name
                    }
                    notification.id = desktop.showNotification(notification);

                    let written = await targetFs.writeFile(toPath,content,true,targetMount,(progress)=>{
                        console.error("progress",progress);
                        if (progress.computable) notification.progress = progress.loaded/progress.total;
                        notification.progressText = formatSize(progress.loaded) + " of " + formatSize(progress.total);
                        desktop.showNotification(notification);
                    });
                    desktop.hideNotification(notification.id);
                    console.log("result:",written);
                    next(written);
                }
            }else{
                console.warn("can't copy file - no handler");
                next();
            }
        });

    };

    me.moveFile = function(file,fromPath,toPath){
        return new Promise(async next => {
            console.log("Move File",file,fromPath,toPath);
            let mount = me.getMount(fromPath);
            let fs = mount.handler;
            let targetMount = me.getMount(toPath);
            let targetFs = targetMount.handler;
            //fromPath = fromPath + '/' + file.name;

            if (fs){
                if (mount.path === targetMount.path){
                    // move inside same volume
                    console.log("move into same volume");
                    var result = await fs.moveFile(fromPath,toPath,mount);
                    next(result);
                }else{
                    let content = await fs.readFile(fromPath,true,mount);
                    toPath = toPath + '/' + file.name;
                    let written = await targetFs.writeFile(toPath,content,true,targetMount);
                    let deleted;
                    if (written) deleted = await fs.deleteFile(fromPath,mount);
                    console.log("result:",written,deleted);
                    next(written && deleted);
                }
            }else{
                console.warn("can't move file - no handler");
                next();
            }
        });


    };

    me.deleteFile = function(file){
        return new Promise(async next => {
            console.log("Delete",file);
            let mount = me.getMount(file.path);
            let fs = mount.handler;
            if (fs){
                var result = await fs.deleteFile(file.path,mount);
                next(result);
            }else{
                // can't get file - no handler
                console.warn("can't delete file - no handler");
            }
        });
    };

    me.deleteDirectory = function(folder){
        return new Promise(async next => {
            console.log("Delete",folder);
            let mount = me.getMount(folder.path);
            let fs = mount.handler;
            if (fs){
                var result = await fs.deleteDirectory(folder.path,mount);
                next(result);
            }else{
                console.warn("can't delete folder - no handler");
            }
        });
    }

    me.rename = function(path,newName){
        return new Promise(async next => {
            console.log("Rename",path,newName);
            var mount = me.getMount(path);
            let fs = mount.handler;
            if  (fs){
                var result = await fs.renameFile(path,newName,mount);
                next(result);
            }else{
                // can't get file - no handler
                console.warn("can't rename file - no handler");
            }
        });
    };

    me.deleteStorage = function(drive){
        var mount = me.getMount(drive.path || (drive.volume + ":"));
        let fs = mount.handler;
        if (fs && typeof fs.deleteStorage === "function"){
            return fs.deleteStorage(mount);
        }
    };

    me.deleteIcon = function(icon){
        return new Promise(async next => {
            let parent = icon.parent;
            let selectedIcons = parent ? parent.getSelectedIcons() : [];
            let targetIcons = selectedIcons.includes(icon) ? selectedIcons : [icon];

            for (let targetIcon of targetIcons) {
                let obj = targetIcon.object;
                if (obj) {
                    if (obj.type === "folder") {
                        await me.deleteDirectory(obj);
                    } else {
                        await me.deleteFile(obj);
                    }
                    if (parent && parent.removeIcon) {
                        parent.removeIcon(targetIcon);
                    }
                }
            }

            if (parent && parent.sendMessage) {
                parent.sendMessage("refresh");
            }
            next(true);
        });
    };

    me.getUniqueName = function(path,name){
        return new Promise(async next => {
            var mount = me.getMount(path);
            let fs = mount.handler;
            if (fs){
                var result = await fs.getUniqueName(path,name,mount);
                next(result);
            }else{
                // can't get file - no handler
                console.warn("can't get unique name - no handler");
            }
        });
    }

    me.wrap = function(list){
        return list.map(item=>amiObject(item));
    }

    me.getParentPath = function(path){
        if (!path) return;
        let volume = me.getVolume(path);
        if (volume) path = path.substr(volume.length+1);
        if (path.endsWith("/")) path = path.substr(0,path.length-1);
        let parts = path.split("/");
        parts.pop();
        path = parts.join("/");
        if (parts.length) path += "/";
        if (volume) path = volume + ":" + path;
        return path;
    }

     me.parseMeta = function(meta,object){
        if (!meta) return;
        if (typeof meta === "string") meta = JSON.parse(meta);

        for (var key in meta){
            object[key] = meta[key];
        }
     }

     me.writeMeta = async function(object){
        console.error("writeMeta",object);
        let meta = {};
        let metaKeys = ["handler","icon"];
        for (var key in object){
            if (metaKeys.indexOf(key)>=0){
                meta[key] = object[key];
            }
        }
        let metaPath = object.path + ".aminfo";
        let currentMeta = await me.readJson(metaPath);
        console.error("currentMeta",currentMeta);
        for (let key in meta){
            currentMeta[key] = meta[key];
        }
        console.error(metaPath,currentMeta);
        return await me.writeFile(metaPath,JSON.stringify(currentMeta,null,2));
     }

    function getVolumeIndex(volume){
        var result = 0;
        Object.keys(mounts).forEach(key=>{
            var nr = key.match(/\d+/);
            if (nr && key.substr(0,nr.index)===volume ) result++;
        })
        return result ;
    };

    function normalize(file){
        if (typeof file === "string" || !file.isAmiObject){
            if (typeof file === "string"){
                file={
                    type: "file",
                    path: file
                }
            }
            file=amiObject(file);
        }
        return file;
    }

    function normalizeMountSource(source){
        if (!source || typeof source !== "string") return "";
        let normalized = source.trim();
        if (normalized.indexOf("://")<0){
            const index = normalized.indexOf(":");
            if (index>0){
                const volume = normalized.substring(0,index).toLowerCase();
                let path = normalized.substring(index+1);
                if (path.startsWith("/")) path = path.substring(1);
                normalized = volume + ":" + path;
            }
        }
        return normalized;
    }

    function formatSize(byte){
        if (byte<1024) return byte + " bytes";
        if (byte<1024*1024) return Math.round(byte/1024) + " KB";
        if (byte<1024*1024*1024) return Math.round(byte/1024/1024) + " MB";
        return Math.round(byte/1024/1024/1024) + " GB";
    }



   return me;

};

export default FileSystem();
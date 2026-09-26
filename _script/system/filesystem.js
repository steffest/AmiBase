
import system from "./system.js";
import amiObject from "./object.js";
import http from "./filesystems/http.js";
import ram from "./filesystems/ram.js";
import rad from "./filesystems/rad.js";
import assign from "./filesystems/assign.js";
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
        assign: assign,
    };

    // Tracks per-mount readiness: mount object -> Promise that resolves once its
    // handler is fully wired (a string handler is loaded asynchronously). Lets
    // boot code await a fire-and-forget mount before touching the volume.
    var mountReady = new Map();

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
        let promise = new Promise(async function(next){
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
            // An assign keeps its exact name (AmigaDOS: ASSIGN WORK: ...), unlike
            // a real drive which gets an auto-incremented suffix (dh0, dh1, …).
            let isAssign = drive.handler === "assign" || drive.filesystem === "assign" || drive.isAssign;
            if (isAssign){
                volume = String(drive.volume).replace(/:+$/,"").toLowerCase();
            }else if (volume !== "ram"){
                var c = getVolumeIndex(volume);
                volume = volume.toLowerCase() + c;
            }
            mounts[volume] = drive;
            drive.volume = volume;
            drive.path = volume + ":";
            if (isAssign){
                drive.isAssign = true;
                drive.filesystem = "assign";
                // Inject the resolver the assign handler uses to reach its target's
                // real mount/handler (kept out of the handler module to avoid a
                // circular import).
                drive._resolve = function(p){ return me.getMount(p); };
            }

            if (drive.handler && typeof drive.handler === "string"){
                drive.filesystemName = drive.handler;
                if (drive.handler === "local") drive.handler = "localFileSystemAccess";
                try {
                    if (!fileSystems[drive.handler]) await system.loadLibrary(drive.handler);
                } catch (e) {
                    // A failed library load must not leave whenReady() pending
                    // forever (boot awaits it) — settle the mount regardless.
                    console.warn("failed to load filesystem handler " + drive.handler, e);
                }
                mounts[volume].mounted = true;
                mounts[volume].handler = fileSystems[drive.handler];
                probeCapabilities(mounts[volume]);
                // Must settle the mount's own whenReady() before applying meta:
                // applyDriveMeta reads "<volume>:.aminfo" through the normal
                // filesystem.readFile path, which awaits whenReady(mount) on this
                // very mount. If that's still unresolved at this point (true for
                // any handler that needed an async loadLibrary above), it would
                // deadlock on itself.
                next(drive);
                applyDriveMeta(drive);
            }else{
                probeCapabilities(mounts[volume]);
                next(drive);
                applyDriveMeta(drive);
            }
        });
        mountReady.set(drive, promise);
        return promise;
    };

    // Resolves once the given mount's handler is fully wired. Returns immediately
    // for mounts not created through me.mount (e.g. the built-in ram/desktop).
    me.whenReady = function(mount){
        return mountReady.get(mount) || Promise.resolve(mount);
    };

    // Eagerly probe a mount's capabilities right after it connects, so features
    // that depend on them light up immediately instead of waiting for a first
    // filesystem action on the volume. For an AmiBase-server mount this fills in
    // providesShell/shell, which is what makes the shell's `host` command (and
    // its interactive PTY) appear as soon as the drive is mounted. Fire-and-forget:
    // a slow or unreachable server must never block or fail the mount itself.
    //
    // Retries with backoff before giving up: a system drive's backing server
    // (e.g. term, on the kiosk image) can still be starting up when AmiBase's
    // own static files are already being served — a real boot race (see
    // docs/bootable-kiosk-plan.md §5 risk #2). A single failed attempt used to
    // leave the mount permanently missing providesShell/shell/root until a
    // user happened to reopen it, which never happens unattended on a kiosk.
    var CAPABILITY_PROBE_DELAYS = [500,1000,2000,4000,8000];
    function probeCapabilities(mount){
        let handler = mount && mount.handler;
        if (!handler || typeof handler.capabilities !== "function") return;
        function attempt(n){
            handler.capabilities(mount).catch(function(e){
                if (n < CAPABILITY_PROBE_DELAYS.length){
                    setTimeout(function(){ attempt(n+1); }, CAPABILITY_PROBE_DELAYS[n]);
                }else{
                    console.warn("capability probe failed for " + (mount && mount.volume) + " after " + (n+1) + " attempts", e);
                }
            });
        }
        Promise.resolve().then(function(){ attempt(0); });
    }

    // A drive's own icon override lives in a ".aminfo" sidecar at its volume
    // root (there's no parent folder listing to discover it from otherwise).
    async function applyDriveMeta(drive){
        try{
            let meta = await me.readJson(drive.path + ".aminfo");
            if (meta) me.parseMeta(meta,drive);
        }catch(e){
            // handler may not support reading a root-level file - icon override
            // just won't persist for that mount type yet.
        }
    }

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

    // --- ASSIGN: alias a (new) volume to a path on another volume -------------

    // Validate inputs and build the mount object for an assign. Throws a short
    // AmigaDOS-style string on bad input.
    function buildAssignMount(name, target, options){
        options = options || {};
        let volume = String(name||"").replace(/:+$/,"").trim().toLowerCase();
        if (!volume) throw "assign: missing volume name";
        if (!/^[a-z0-9_.+-]+$/.test(volume)) throw "assign: invalid volume name '" + name + "'";

        let targetClean = String(target||"").trim();
        if (targetClean.indexOf(":")<0) throw "assign: target must be a volume path, e.g. dh0:folder/sub";
        let targetVolume = targetClean.split(":")[0].toLowerCase();
        if (!mounts[targetVolume]) throw "assign: unknown target volume '" + targetVolume + ":'";
        if (targetVolume === volume) throw "assign: cannot assign a volume to itself";

        let readOnly;
        if (typeof options.readOnly === "boolean"){
            readOnly = options.readOnly;
        }else{
            let tm = mounts[targetVolume];
            readOnly = typeof tm.readOnly === "boolean" ? tm.readOnly : false;
        }

        return {
            type: "drive",
            label: options.label || String(name).replace(/:+$/,""),
            volume: volume,
            handler: "assign",
            filesystem: "assign",
            isAssign: true,
            target: targetClean,
            readOnly: readOnly,
            id: options.id || uuid()
        };
    }

    // Create (or replace) an assign and register it system-wide for this session.
    // Assigns are deliberately NOT persisted (like AmigaDOS assigns, which live in
    // the startup-sequence) — they are not written to the user's settings and do
    // not survive a reload. They are added to the desktop so they show up in the
    // file manager and everywhere getMounts() is read.
    me.createAssign = function(name, target, options){
        let mount = buildAssignMount(name, target, options);
        // addObject mounts drive-type objects (-> me.mount) and creates the icon.
        desktop.addObject(mount);
        desktop.cleanUp();
        return mount;
    };

    // Remove a (session) assign: the live mount and its desktop icon. Refuses to
    // touch a real drive.
    me.removeAssign = function(name){
        let volume = String(name||"").replace(/:+$/,"").trim().toLowerCase();
        if (!volume) throw "assign: missing volume name";
        let mount = mounts[volume];
        if (!mount || !mount.isAssign) throw "assign: '" + volume + ":' is not an assign";

        if (typeof desktop.getIcons === "function"){
            desktop.getIcons().forEach(function(icon){
                let obj = icon && icon.object;
                if (obj && String(obj.volume||"").toLowerCase() === volume && typeof desktop.removeIcon === "function"){
                    desktop.removeIcon(icon);
                }
            });
        }
        delete mounts[volume];
        if (typeof desktop.cleanUp === "function") desktop.cleanUp();
        return true;
    };

    me.listAssigns = function(){
        let result = [];
        Object.keys(mounts).forEach(function(key){
            let m = mounts[key];
            if (m && m.isAssign) result.push({ volume: key, target: m.target, label: m.label });
        });
        return result;
    };

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
        // A string-handler mount's ".handler" is still the raw handler name
        // until its library finishes loading (see me.mount) - wait for that
        // so we never call .getDirectory() on a string.
        await me.whenReady(mount);
        let fs = mount.handler;

        if (fs){
            console.log("mount",mount);
            var data = await fs.getDirectory(path,mount);
            var result = [];

            for (const dir of data.directories) {
                var dirConfig = {
                    type: "folder",
                    name: dir.name,
                    path: path + dir.name + "/",
                    head:dir.head
                }
                if (dir.handler) dirConfig.handler = dir.handler;
                if (dir.label) dirConfig.label = dir.label;
                if (dir.icon) dirConfig.icon = dir.icon;
                if (dir.iconClass) dirConfig.iconClass = dir.iconClass;
                if (dir.iconActive) dirConfig.iconActive = dir.iconActive;
                result.push(amiObject(dirConfig));
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
                if (file.iconClass) fileConfig.iconClass = file.iconClass;
                if (file.iconActive) fileConfig.iconActive = file.iconActive;


                result.push(amiObject(fileConfig));

            }

            return result;
        }else{
            console.warn("Can't read directory, no handler");
            return [];
        }
    };


    me.createDirectory = async function(path,newName){
        console.log("createDirectory");
        var mount = me.getMount(path);
        await me.whenReady(mount);
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
            await me.whenReady(mount);
            let fs = mount.handler;
            if  (fs){
                let result;
                try{
                    result = await fs.readFile(file.path,binary,mount);
                }catch(e){
                    console.error("file not found",file.path);
                    result = undefined;
                }
                next(result);
            }else{
                console.error("Can't get file, no handler");
                next("");
            }
        });
    };

    // Resolves a virtual AmiBase path to a URL an <img>/CSS background can load.
    // Tries the mount's own getUrl() first (cloud handlers hand back a direct
    // link), then falls back to a full read + blob URL, which works on every
    // backend but is heavier - fine for the small images used as icons.
    me.getDisplayUrl = async function(path){
        let mount = me.getMount(path);
        await me.whenReady(mount);
        let fs = mount.handler;
        if (fs && fs.getUrl){
            try{
                let url = await fs.getUrl((path && path.path) || path,mount);
                if (url) return url;
            }catch(e){}
        }
        try{
            let file = await me.readFile(path,true);
            if (file && file.buffer) return URL.createObjectURL(new Blob([file.buffer]));
        }catch(e){}
        return null;
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
            await me.whenReady(mount);
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
            await me.whenReady(mount);
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
            let targetMount = me.getMount(toPath);
            await Promise.all([me.whenReady(mount),me.whenReady(targetMount)]);
            let fs = mount.handler;
            let targetFs = targetMount.handler;

            if (fs){
                if (mount.path === targetMount.path && fs.copyFile){
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
            let targetMount = me.getMount(toPath);
            await Promise.all([me.whenReady(mount),me.whenReady(targetMount)]);
            let fs = mount.handler;
            let targetFs = targetMount.handler;
            //fromPath = fromPath + '/' + file.name;

            if (fs){
                if (mount.path === targetMount.path && fs.moveFile){
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
            await me.whenReady(mount);
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
            await me.whenReady(mount);
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
            await me.whenReady(mount);
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

    me.deleteStorage = async function(drive){
        var mount = me.getMount(drive.path || (drive.volume + ":"));
        await me.whenReady(mount);
        let fs = mount.handler;
        if (fs && typeof fs.deleteStorage === "function"){
            return fs.deleteStorage(mount);
        }
    };

    me.deleteIcon = function(icon,object){
        return new Promise(async next => {
            let deleteObject = async (obj) => {
                if (!obj) return;
                if (obj.type === "folder") {
                    await me.deleteDirectory(obj);
                } else {
                    await me.deleteFile(obj);
                }
            };

            let parent = icon && icon.parent;
            let selectedIcons = parent && parent.getSelectedIcons ? parent.getSelectedIcons() : [];
            let targetIcons = icon ? (selectedIcons.includes(icon) ? selectedIcons : [icon]) : [];

            if (targetIcons.length) {
                for (let targetIcon of targetIcons) {
                    let obj = targetIcon.object;
                    if (obj) {
                        await deleteObject(obj);
                        if (parent && parent.removeIcon) {
                            parent.removeIcon(targetIcon);
                        }
                    }
                }
            } else if (object) {
                // no icon context (e.g. deleted from the file manager) - delete the object directly
                await deleteObject(object);
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
            await me.whenReady(mount);
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
        let meta = {};
        let metaKeys = ["handler","icon","iconClass"];
        for (var key in object){
            if (metaKeys.indexOf(key)>=0){
                meta[key] = object[key];
            }
        }
        // Folder paths end in "/" - strip it so the sidecar lands as a sibling
        // ("Apps.aminfo" next to "Apps") instead of inside the folder itself,
        // matching what getDirectory's ".aminfo" sibling scan looks for.
        let metaPath = object.path.replace(/\/$/,"") + ".aminfo";
        let currentMeta = await me.readJson(metaPath);
        for (let key in meta){
            currentMeta[key] = meta[key];
        }
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

import system from "./system.js";
import amiObject from "./object.js";
import http from "./filesystems/http.js";
import ram from "./filesystems/ram.js";

let FileSystem = function(){
   var me = {};

    var mounts = {
        ram:{
            name: "RAM",
            filesystem: "ram",
            readOnly: false,
            handler: ram
        }
    };
    var fileSystems = {
        ram: ram
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
            let volume = drive.volume.toLowerCase()
            if (volume !== "ram"){
                var c = getVolumeIndex(volume);
                volume = volume.toLowerCase() + c;
            }
            mounts[volume] = drive;
            drive.volume = volume;
            drive.path = volume + ":";

            if (drive.handler && typeof drive.handler === "string"){
                if (!fileSystems[drive.handler]) await system.loadLibrary(drive.handler);
                mounts[volume].mounted = true;
                mounts[volume].handler = fileSystems[drive.handler];
                next();
            }else{
                next();
            }
        });
    };

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

                var fileConfig = {
                    type: "file",
                    name: file.name,
                    path: path + file.name,
                    head:file.head
                }
                if (resolveFiletypes) fileConfig.filetype = await system.detectFileType(file);

                // This is used to enable "load content by url" over HTTP
                // e.g. for videoplayers to avoid loading the whole file into memory
                if (fs.getFileUrl) fileConfig.url = fs.getFileUrl(path + file.name,mount);

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


    me.writeFile = function(file,content,binary){
        file = normalize(file);
        return new Promise(async next => {
            var mount = me.getMount(file.path);
            let fs = mount.handler;
            if (fs){
                let response = await fs.writeFile(file.path,content,binary,mount);
                next(response);
            }else{
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
                    let written = await targetFs.writeFile(toPath,content,true,targetMount);
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
            fromPath = fromPath + '/' + file.name;

            if (fs){
                if (mount.path === targetMount.path){
                    // move inside same volume
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
                var result = await fs.deleteFolder(folder.path,mount);
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

    me.wrap = function(list){
        return list.map(item=>amiObject(item));
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



   return me;

};

export default FileSystem();
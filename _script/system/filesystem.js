
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
        if (mount.handler && typeof mount.handler.isReadOnly === "function") return mount.handler.isReadOnly(file);
        return true;
    }

    me.getMount = function(path){
        let volume = me.getVolume(path);
        console.error(volume);
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
        console.log("mount",mount);
        
        if (mount.handler){
            var data = await mount.handler.getDirectory(folder,mount);
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

                // TODO: where is this used?
                if (mount.handler.getFileUrl) fileConfig.url = mount.handler.getFileUrl(path + file.name);

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
        if  (mount.handler){
            console.error(mount.handler);
            mount.handler.createDirectory(path,newName);
        }
    };

    // returns the content of the file, default as ascii, optional as binarystream
    me.readFile = function(file,binary){
        console.log("readFile",file);
        file = normalize(file);
        return new Promise(async next => {
            let mount = me.getMount(file);
            console.error(mount);
            if  (mount.handler){
                let result = await mount.handler.readFile(file,binary);
                next(result);
            }else{
                console.error("Can't get file, no handler");
                next("");
            }
        });
    };


    me.writeFile = function(path,content){
        return new Promise(async next => {
            var mount = me.getMount(path);
            if  (mount.handler){
                var response = await mount.handler.writeFile(path,content);
                if (response){
                    response = JSON.parse(response);
                    console.log(response.result);
                }
            }else{
                // can't get file - no handler
                // assume it's http then
                console.error("no handler");
                next("error");
            }
        });
    };
    
    me.getDownloadUrl = function(path){
        var volume = me.getVolume(path);
        if (volume === "http" || volume === "https"){
            return path;
        }
        if (volume === "amigasys"){
            // TODO move to amigasys filisystem handler
            var iconSet = "Dual_png";
            var theme = User.getTheme();
            if (theme === "dark_reduced") iconSet = "Color_icon";
            if (theme === "mui") iconSet = "MUI";
            var result = path.replace("amigasys:","https://www.stef.be/amiga/ICO/amigasys/icons/48x48/"+iconSet+"/");
            return result;
        }
        return path;
    };

    me.copyFile = function(file,fromPath,toPath){
        console.log("Copy File",file,fromPath,toPath);
    };

    me.moveFile = function(file,fromPath,toPath){
        return new Promise(async next => {
            console.log("Move File",file,fromPath,toPath);
            var mount = me.getMount(fromPath);
            var targetMount = me.getMount(toPath);
            if (mount.handler){
                // TODO: move accross different volumes
                fromPath = fromPath + '/' + file.name;

                var result = await mount.handler.moveFile(fromPath,toPath);
                next(result);
            }else{
                // can't get file - no handler
                console.warn("can't move file - no handler");
            }
        });


    };

    me.deleteFile = function(){

    };

    me.rename = function(path,newName){
        return new Promise(async next => {
            console.log("Rename",path,newName);
            var mount = me.getMount(path);
            if  (mount.handler){
                var result = await mount.handler.renameFile(path,newName);
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
            file=amiObject(file);
        }
        return file;
    }



   return me;

};

export default FileSystem();
import desktop from "../ui/desktop.js";
import amiDrive from "./drive.js";
import system from "./system.js";
import fetchService from "../util/fetchService.js";
import amiFile from "./file.js";
import amiFolder from "./folder.js";
import http from "./filesystems/http.js";
import ram from "./filesystems/ram.js";
import AmiFile from "./file.js";

let FileSystem = function(){
   var me = {};

    var mounts = {
        ram:{
            name: "ram",
            filesystem: "ram",
            readOnly: false,
            handler: ram
        }
    };
    var fileSystems = {};

    me.register=function(name,handler){
        console.log("registering filesystem " + name);
        fileSystems[name] = handler;
        for (var mount in  mounts){
            if (mounts[mount].filesystem === name){
                mounts[mount].handler = handler;
            }
        }
    };

    me.mount = async function(name,volume,plugin,data){
        var c = getVolumeIndex(volume);
        volume = volume.toUpperCase() + c;
        mounts[volume] = {
            name: name,
            filesystem: plugin,
            data: data
        };
        desktop.createIcon({
            type: "drive",
            label: name,
            attachment: amiDrive({
                name: name,
                volume: volume,
                path: volume + ":"
            })
        });
        desktop.cleanUp();

        await system.loadLibrary(plugin);
        mounts[volume].mounted = true;
        mounts[volume].handler = fileSystems[plugin];
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
            if (path.isAmiFile){
                path=path.path;
            }else{
                path = amiFile(path).path;
            }
        }
        return path.split(":")[0];
    };


    me.getMounts = function(){
        return mounts;
    };


    me.getDirectory = async function(folder, resolveFiles, resolveFiletypes, target){
        if (typeof folder === "string") folder={path:folder};
        var path = folder.path;
        var mount = me.getMount(path);
        
        if  (mount.handler){
            var data = await mount.handler.getDirectory(folder);
            if (resolveFiles){
                var result = {
                    directories:[],
                    files:[]
                }
                for (const dir of data.directories) {
                    var folder = amiFolder({
                        name: dir.name,
                        path: path + dir.name + "/",
                        head:dir.head
                    })
                    
                    result.directories.push(folder);
                    
                    if  (target){
                        var iconConfig = {
                            type: "folder",
                            label: dir.name,
                            attachment: folder
                        };

                        
                        // check if there's an icon
                        // TODO: shouldn't this be part of the implementation?
                        var index = data.files.indexOf(dir.name + ".info");
                        if (index >= 0){
                            var filetype = await system.detectFileType(dir.name + ".info");
                            iconConfig.iconInfo = {
                                path: path + dir.name + ".info",
                                filetype: filetype
                            };
                            if (mount.handler.getFileUrl) iconConfig.iconInfo.url = mount.handler.getFileUrl(path + dir.name + ".info");
                            iconConfig.icon = path + dir.name + ".info";
                            data.files.splice(index,1);
                        }
                        target.createIcon(iconConfig);
                    }
                }

                for (const file of data.files) {
                    var fileConfig = {
                        name: file.name,
                        path: path + file.name,
                        head:file.head
                    }
                    if (resolveFiletypes) fileConfig.filetype = await system.detectFileType(file);
                    if (mount.handler.getFileUrl) fileConfig.url = mount.handler.getFileUrl(path + file.name);
                   
                    var aFile = amiFile(fileConfig);
                    
                    result.files.push(aFile);

                    if (target){
                        var iconConfig = {
                            type: "file",
                            label: file.name,
                            attachment: aFile
                        };
                        if (fileConfig.filetype){
                            if (fileConfig.filetype.className){
                                iconConfig.iconClassName = fileConfig.filetype.className;
                            }
                            if (fileConfig.filetype.customIcon){
                                iconConfig.iconClassName = "";
                                iconConfig.image = "";
                                iconConfig.icon = path + file.name;
                            }
                        }
                        
                        target.createIcon(iconConfig);
                    }
                }
                
                if (target){
                    target.cleanUp();
                }else{
                    return result;
                }
            }else{
                return data;
            }
        }else{
            console.warn("Can't read directory, no handler");
            return {};
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

    // returns the content of the file, default as ascii, optionals as binarystream
    me.readFile = function(file,binary){
        file = normalize(file);
        console.error("readFile",file);
        return new Promise(async next => {
            let mount = me.getMount(file);
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
            if (fromPath === "upload"){
                var result = await targetMount.handler.uploadFile(file,toPath);
                next(result);
            }else if (mount.handler){
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

    function getVolumeIndex(volume){
        var result = 0;
        Object.keys(mounts).forEach(key=>{
            var nr = key.match(/\d+/);
            if (nr && key.substr(0,nr.index)===volume ) result++;
        })
        return result ;
    };

    function normalize(file){
        if (typeof file === "string" || !file.isAmiFile){
            file=amiFile(file);
        }
        return file;
    }



   return me;

};

export default FileSystem();
import fileSystem from "../../../_script/system/filesystem.js";
import ADF from '../../adftools/adf.js';
import BinaryStream from "../../binaryStream/binaryStream.js";

let AmigaFileSystem = async function() {
    var me = {};
    let cache = [];

    me.getDirectory = async function(path,config){
        var mount = fileSystem.getMount(path);
        console.error(path);
        console.error(config);
        console.error(mount);

        return new Promise(async next => {
            path = getFilePath(path);
            console.error(path);

            if (!config.binary){
                config.binary = await fileSystem.readFile(config.url,true);
            }

            var info = ADF.setDisk(config.binary);
            let sector;

            if (path){
                let cached = cache.find(item=>item.path === path);
                if (cached) sector = cached.sector;
            }

            if (sector){
                var dir = ADF.readFolderAtSector(sector);
            }else{
                dir = ADF.readRootFolder();
            }

            var directories = [];
            var files = [];
            dir.folders.forEach(folder=>{
                folder.path = path + folder.name + "/";
                cache.push(folder);
                directories.push({name: folder.name, head: folder.sector});
            })
            dir.files.forEach(file=>{
                file.path = path + file.name;
                cache.push(file);
                files.push({name: file.name, head: file.sector});
            })

            next({
                directories: directories,
                files:files
            });
        });
    };

    me.readFile = function(path,binary,config){
        console.error("readFile",path,binary,config);
        return new Promise((next) => {
            var mount = fileSystem.getMount(path);
            path = getFilePath(path);
            let sector;
            let file = cache.find(item=>item.path === path);
            console.error("file",file,path,cache);
            if (file) sector = file.sector;

            if (!sector) sector = resolvePath(path);
            console.error("final sector",sector);
            var result = ADF.readFileAtSector(sector,true);

            if (binary){
                next(BinaryStream(result.content.buffer,true));
            }else{
                console.error(typeof result.content);
                console.error(result.content);
                next(new TextDecoder().decode(result.content));
               //next(result.content);
            }
        });
    };

    function resolvePath(path,startSector){
        if (path.indexOf(":")>0){
            var mount = fileSystem.getMount(path);
            ADF.setDisk(mount.data.binary);
            path = path.split(":")[1];
        }

        let parts = path.split("/");
        let dir = startSector ? ADF.readFolderAtSector(startSector):ADF.readRootFolder();
        let sector=0;
        if (parts.length>1){
            console.log("looking for folder",parts)
            for (let i = 0, max = dir.folders.length;i<max;i++){
                let folder = dir.folders[i];
                if (folder.name === parts[0]){
                    sector = folder.sector;
                    console.log("found folder " + folder.name + " at sector " + sector);
                    parts.shift();
                    return resolvePath(parts.join("/"),sector);
                }
            }
        }else{
            console.log("looking for file",parts);
            for (let i = 0, max = dir.files.length;i<max;i++){
                let file = dir.files[i];
                if (file.name === parts[0]){
                    sector = file.sector;
                    console.log("found file at ",sector);
                }
            }
            return sector;
        }
    }


    me.createDirectory = function(path,name,_next){

    };

    me.moveFile = function(fromPath,toPath){

    };

    me.renameFile = function(path,newName){

    };

    me.updateFile = function(path,content){

    };

    me.uploadFile = function(file,path){

    };

    // strip out the mount or protocol part
    function getFilePath(path){
        path = path || "";
        var p = path.indexOf(":");
        if (p>0) path = path.substr(p+1);
        if (path[0] === "/") path = path.substr(1);
        if (path[0] === "/") path = path.substr(1);
        return path;
    }

    fileSystem.register("AmigaFileSystem",me);

    return me;

};

export default AmigaFileSystem();

import fileSystem from "../../../_script/system/filesystem.js";
import ADF from '../../adftools/adf.js';
import BinaryStream from "../../binaryStream/binaryStream.js";

let AmigaFileSystem = async function() {
    var me = {};


    me.getDirectory = async function(folder,_next){
        var path = folder.path;
        var mount = fileSystem.getMount(path);
        console.error(folder);

        return new Promise((resolve,reject) => {
            var next = _next || resolve;
            console.error(path);
            path = getFilePath(path);
            console.error(mount.data);

            var info = ADF.setDisk(mount.data.binary);
            if (folder.head){
                var dir = ADF.readFolderAtSector(folder.head);
            }else{
                dir = ADF.readRootFolder();
            }

            var directories = [];
            var files = [];
            dir.folders.forEach(folder=>{
                directories.push({name: folder.name, head: folder.sector});
            })
            dir.files.forEach(file=>{
                files.push({name: file.name, head: file.sector});
            })

            next({
                directories: directories,
                files:files
            });
        });
    };

    me.readFile = function(file,asBinaryStream){
        return new Promise((next) => {
            var path = file.path;
            var mount = fileSystem.getMount(path);
            if (typeof file.head === "number"){
                var result = ADF.readFileAtSector(file.head,true);

                if (asBinaryStream){
                    next(BinaryStream(result.content.buffer,true));
                }else{
                    next(result.content);
                }
            }else{
                let sector = resolvePath(path);
                console.log("final sector",sector);
                let result = ADF.readFileAtSector(sector,true);
                if (asBinaryStream){
                    next(BinaryStream(result.content.buffer,true));
                }else{
                    next(result.content);
                }
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

import fileSystem from "../../_script/system/filesystem.js";
import ADF from '../adftools/adf.js';
import BinaryStream from "../binaryStream/binaryStream.js";

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
        return new Promise(async (next) => {
            var mount = fileSystem.getMount(path);
            if (!mount.binary) {
                mount.binary = await fileSystem.readFile(mount.url, true);
            }
            ADF.setDisk(mount.binary);

            path = getFilePath(path);
            let sector;
            let file = cache.find(item=>item.path === path);
            if (file) sector = file.sector;

            if (!sector) sector = resolvePath(path);
            console.log("readFile sector",sector,path);

            if (!sector) {
                // File not found on ADF
                console.warn("amigafs readFile: file not found",path);
                next(null);
                return;
            }

            var result = ADF.readFileAtSector(sector,true);

            if (binary){
                next(BinaryStream(result.content.buffer,true));
            }else{
                next(new TextDecoder().decode(result.content));
            }
        });
    };

    function resolvePath(path,startSector){
        if (path.indexOf(":")>0){
            var mount = fileSystem.getMount(path);
            ADF.setDisk(mount.binary);
            path = path.split(":")[1];
        }

        if (path.startsWith("/")) path = path.substring(1);
        if (path.endsWith("/")) path = path.substring(0, path.length-1);

        if (!path) return startSector || ADF.readRootFolder().sector;

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
            console.log("looking for file or folder",parts);
            for (let i = 0, max = dir.files.length;i<max;i++){
                let file = dir.files[i];
                if (file.name === parts[0]){
                    sector = file.sector;
                    console.log("found file at ",sector);
                    return sector;
                }
            }
            for (let i = 0, max = dir.folders.length;i<max;i++){
                let folder = dir.folders[i];
                if (folder.name === parts[0]){
                    sector = folder.sector;
                    console.log("found folder at ",sector);
                    return sector;
                }
            }
            return sector;
        }
    }


    me.createDirectory = function(path,name,mount){
        console.error("amigafs createDirectory",path,name,mount);
        return new Promise(async next => {
            if (!mount.binary) {
                mount.binary = await fileSystem.readFile(mount.url,true);
            }
            ADF.setDisk(mount.binary);

            let filePath = getFilePath(path);
            let parentSector;
            if (filePath){
                parentSector = resolvePath(filePath);
            }else{
                parentSector = ADF.readRootFolder().sector;
            }

            if (!parentSector){
                console.error("Parent sector not found for path: " + path);
                next(false);
                return;
            }

            let newSector = ADF.createFolder(name,parentSector);
            if (newSector){
                if (mount.url) {
                    await fileSystem.writeFile(mount.url,mount.binary.buffer,true);
                }
                next({
                    name:name,
                    path:path + (path.endsWith("/") ? "" : "/") + name + "/",
                    type:"folder",
                    sector:newSector
                });
            }else{
                console.error("ADF.createFolder returned false/undefined");
                next(false);
            }
        });
    };

    me.moveFile = function(fromPath,toPath){

    };

    me.renameFile = function(path,newName,mount){
        console.error("amigafs renameFile",path,newName,mount);
        return new Promise(async next => {
            if (!mount.binary) {
                mount.binary = await fileSystem.readFile(mount.url,true);
            }
            ADF.setDisk(mount.binary);

            let filePath = getFilePath(path);
            let sector = resolvePath(filePath);
            if (sector){
                ADF.renameFileOrFolderAtSector(sector,newName);
                if (mount.url) {
                    await fileSystem.writeFile(mount.url,mount.binary.buffer,true);
                }
                next(true);
            }else{
                next(false);
            }
        });
    };

    me.writeFile = function(path,content,binary,mount,progress,object){
        console.error("amigafs writeFile",path,content,binary,mount,progress,object);
        return new Promise(async next => {
            if (!mount.binary) {
                mount.binary = await fileSystem.readFile(mount.url,true);
            }
            ADF.setDisk(mount.binary);

            let filePath = getFilePath(path);
            let filename = filePath.split("/").pop();
            let parentPath = filePath.split("/");
            parentPath.pop();
            parentPath = parentPath.join("/");

            let parentSector;
            if (parentPath){
                parentSector = resolvePath(parentPath);
            }else{
                parentSector = ADF.readRootFolder().sector;
            }

            if (!parentSector){
                console.error("Parent sector not found for path: " + path);
                next(false);
                return;
            }

            // Check if file already exists and delete it
            let existingSector = resolvePath(filePath);
            if (existingSector){
                console.log("File already exists, deleting first: " + filePath);
                ADF.deleteFileAtSector(existingSector);
            }

            let buffer;
            if (typeof content === "string"){
                buffer = new TextEncoder().encode(content);
            } else if (content && content.buffer && (content.byteLength !== undefined)) {
                // TypedArray
                buffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
            } else if (content && content.buffer) {
                // BinaryStream or other object with buffer
                buffer = content.buffer;
            } else {
                buffer = content;
            }

            let newSector = ADF.writeFile(filename,buffer,parentSector);
            if (newSector){
                if (mount.url) {
                    await fileSystem.writeFile(mount.url,mount.binary.buffer,true);
                }
                next({
                    name:filename,
                    path:path,
                    type:"file",
                    sector:newSector
                });
            }else{
                console.error("ADF.writeFile returned false/undefined");
                next(false);
            }
        });
    };

    me.deleteFile = function(path,mount){
        console.error("amigafs deleteFile",path,mount);
        return new Promise(async next => {
            if (!mount.binary) {
                mount.binary = await fileSystem.readFile(mount.url,true);
            }
            ADF.setDisk(mount.binary);

            let filePath = getFilePath(path);
            let sector = resolvePath(filePath);
            if (sector){
                ADF.deleteFileAtSector(sector);
                if (mount.url) {
                    await fileSystem.writeFile(mount.url,mount.binary.buffer,true);
                }
                next(true);
            }else{
                next(false);
            }
        });
    };

    me.deleteDirectory = function(path,mount){
        console.error("amigafs deleteDirectory",path,mount);
        return new Promise(async next => {
            if (!mount.binary) {
                mount.binary = await fileSystem.readFile(mount.url,true);
            }
            ADF.setDisk(mount.binary);

            let filePath = getFilePath(path);
            let sector = resolvePath(filePath);
            if (sector){
                let result = ADF.deleteFolderAtSector(sector);
                if (result && mount.url) {
                    await fileSystem.writeFile(mount.url,mount.binary.buffer,true);
                }
                next(result);
            }else{
                next(false);
            }
        });
    };

    me.getInfo = function(path,mount){
        console.error("amigafs getInfo",path,mount);
        return new Promise(async next => {
            if (!mount.binary) {
                mount.binary = await fileSystem.readFile(mount.url,true);
            }
            ADF.setDisk(mount.binary);

            let filePath = getFilePath(path);
            let sector = resolvePath(filePath);
            if (sector){
                let block = ADF.readHeaderBlock(sector);
                next({
                    size: block.size || 0,
                    type: block.typeString === "FILE" ? "file" : "folder",
                    comment: block.comment || "",
                    date: {
                        days: block.lastChangeDays,
                        minutes: block.lastChangeMinutes,
                        ticks: block.lastChangeTicks
                    }
                });
            }else{
                next({});
            }
        });
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

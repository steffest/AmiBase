import fileSystem from "../../../_script/system/filesystem.js";
import fetchService from "../../../_script/util/fetchService.js";
import BinaryStream from "../../binaryStream/binaryStream.js";

var LocalFileSystemAccess = async function() {
    var me = {};

    let fileEntries = {}
    // ref: https://developer.chrome.com/articles/file-system-access/



    me.getDirectory = async function(path,config){
        console.error("getDirectory",path,config);
        path = getFilePath(path);
        let result = {
            directories: [],
            files:[]
        }
        let handle = config.handle;
        if (path) handle = fileEntries[path];

        let permission = await checkPermission(handle);
        if (!permission) return result;

        for await (const entry of handle.values()) {
            if (entry.kind === 'file') result.files.push({name:entry.name});
            if (entry.kind === 'directory') result.directories.push({name:entry.name});
            fileEntries[path + entry.name + (entry.kind==='directory'?"/":"")] = entry;
        }
        return result;
    };


    me.readFile = async function(path,binary,config){
        console.log("readFile",path,binary);
        path = getFilePath(path);
        let entry = fileEntries[path];
        if (!entry) return null;
        let file = await entry.getFile();
        if (binary){
            return BinaryStream(await file.arrayBuffer(),true);
        }
        return await file.text();
    };

    me.isReadOnly = (file)=>{
        return false;
    }


    me.createDirectory = async function(path,name,config){
        console.log("createDirectory",path,name);
        path = getFilePath(path);
        if (path && !path.endsWith("/")) path += "/";
        let entry = fileEntries[path];
        if (!entry) return;
        await entry.getDirectoryHandle(name,{create:true});
    };

    me.moveFile = async function(fromPath,toPath,config){
        console.log("moveFile",fromPath,toPath);
    };

    me.renameFile = async function(path,newName,config){
        console.log("renameFile",path,newName);
        path = getFilePath(path);
        let entry = fileEntries[path];
        if (!entry) return;
        console.error("renameFile",entry);
        await entry.move(newName);
    };

    me.deleteFile = async function(path,config){
        console.log("deleteFile",path);
        path = getFilePath(path);
        let entry = fileEntries[path];
        if (!entry) return;
        await entry.remove();
    };

    me.deleteFolder = async function(path,config){
        console.log("deleteFolder",path);
    };

    me.writeFile = async function(path,content,binary,config,onProgress){
        console.log("writeFile",path,content,binary);

        path = getFilePath(path);
        let entry = fileEntries[path];
        if (!entry){
            let parentPath = path.split("/").slice(0,-1).join("/");
            if (parentPath && !parentPath.endsWith("/")) parentPath += "/";
            let fileName = path.split("/").pop();
            console.error("parentPath",parentPath);
            console.error("entry",fileEntries[parentPath]);
            console.error(fileEntries);
            let parentEntry = parentPath ? fileEntries[parentPath] : config.handle;
            if (!parentEntry){
                // we're lost ...
                // fallback to request dialog to get one
                entry = await window.showSaveFilePicker();
            }else{
                entry = await parentEntry.getFileHandle(fileName,{create:true});
            }
        }

        if (!entry) return;

        const writable = await entry.createWritable();
        if (binary){
            let buffer = content;
            if (content.buffer) buffer = content.buffer;
            console.error(typeof content.arrayBuffer);
            if (content.arrayBuffer && typeof content.arrayBuffer === "function") buffer = await content.arrayBuffer();
            await writable.write(buffer);
        }else{
            await writable.write(content);
        }
        await writable.close();
        return true;

    };

    me.getInfo = async function(path,config){
        console.log("getInfo",path);
    }

    async function checkPermission(handle){
        if (!handle || !handle.queryPermission) return false;
        let permission = await handle.queryPermission({mode: 'readwrite'});
        if (permission !== 'granted') permission = await handle.requestPermission({mode: 'readwrite'});
        return permission === 'granted';
    }


    function setConfig(config){
        if (config){
            //endPoint = config.url || endPoint;
        }
    }

    function getFilePath(path){
        path = path || "";
        let p = path.indexOf(":");
        if (p>0) path = path.substr(p+1);
        return path;
    }

    fileSystem.register("localFileSystemAccess",me);

    return me;

};

export default LocalFileSystemAccess();
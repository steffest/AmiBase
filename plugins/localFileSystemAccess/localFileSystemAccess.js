import fileSystem from "../../../_script/system/filesystem.js";
import BinaryStream from "../../binaryStream/binaryStream.js";

var LocalFileSystemAccess = async function() {
    var me = {};

    let fileEntries = {}
    // ref: https://developer.chrome.com/articles/file-system-access/



    me.getDirectory = async function(path,config){
        console.log("getDirectory",path,config);
        path = getFilePath(path);
        let result = {
            directories: [],
            files:[]
        }
        let handle = config.handle;
        if (path) handle = fileEntries[path];

        let permission = await checkPermission(handle);
        if (!permission) return result;

        let list = await handle.values();
        let meta = {};
        for await (const entry of list) {
            if (entry.kind === 'file' && entry.name.endsWith(".aminfo")){
                let content = await entry.getFile();
                let text = await content.text();
                let filename = entry.name.substr(0,entry.name.length-7);
                try{meta[filename] = JSON.parse(text)}catch(e){}
            }
        }
        console.error("meta",meta);
        list = await handle.values();

        for await (const entry of list) {
            let object;
            if (entry.kind === 'file' && !entry.name.endsWith(".aminfo")){
                object = {name:entry.name};
                let metaInfo = meta[entry.name];
                if (metaInfo){
                    fileSystem.parseMeta(metaInfo,object);
                }
                result.files.push(object);
            }
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

        let metaFile = fileEntries[path + ".aminfo"];
        if (metaFile){
            await metaFile.move(newName + ".aminfo");
        }
    };

    me.deleteFile = async function(path,config){
        console.log("deleteFile",path);
        path = getFilePath(path);
        let entry = fileEntries[path];
        if (!entry) return;
        await entry.remove();

        let metaFile = fileEntries[path + ".aminfo"];
        if (metaFile){
           await metaFile.remove();
        }
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

    me.getUniqueName = async function(path,name,config){
        let files = (await me.getDirectory(path, config)).files;
        let item = files.find(item=>item.name === name);
        if (item){
            let ext = name.split(".").pop();
            let base = name.substr(0,name.length-ext.length-1);
            let i = 2;
            while (files.find(item=>item.name === base + i + "." + ext)){i++;}
            return base + i + "." + ext;
        }else{
            return name;
        }
    }

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
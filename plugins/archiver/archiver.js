import * as uzip from 'https://cdn.skypack.dev/uzip?min';
import fileSystem from "../../_script/system/filesystem.js";
import BinaryStream from "../binaryStream/binaryStream.js";
import {encodeLhaFromMap} from "./lha/lhaWriter.js";

let Archiver = ()=>{
    let me ={};
    let amiBase = {};
    let amiWindow;
    let currentArchive;

    me.getDirectory = async function(path,config){
        let filePath = getFilePath(path);
        console.error("getDirectory",filePath,config.binary);

        return new Promise(async next => {
            await ensureUnpacked(config);

            let files = [];
            let directories = [];
            Object.keys(config.unpacked).forEach(name=>{
                if (name.startsWith(filePath)){
                    name = name.substr(filePath.length);
                    if (name && name.indexOf("/")<0){
                        files.push({name:name});
                    }else{
                        if(name.endsWith("/")){
                            name = name.substr(0,name.length-1);
                            if (name.indexOf("/")<0) directories.push({name:name});
                        }
                    }
                }
            });

            console.error("files",files);

            next({
                directories: directories,
                files:files
            });
        });
    }

    me.readFile = function(path,binary,config){
        console.error("readFile",path,binary,config);
        return new Promise(async (next) => {
            await ensureUnpacked(config);
            path = getFilePath(path);
            let data = toByteArray(config.unpacked[path]);
            if (binary){
                next(BinaryStream(data.buffer,true))
            }else{
                next(new TextDecoder().decode(data));
            }
        });
    }

    me.writeFile = async function(path,content,binary,config){
        await ensureUnpacked(config);
        let filePath = getFilePath(path);
        let data = toByteArray(content);

        config.unpacked[filePath] = {buffer:data};
        ensureParentFolders(config.unpacked,filePath);
        await persist(config);

        return {
            type: "file",
            name: filePath.split("/").pop(),
            path: path
        };
    }

    me.deleteFile = async function(path,config){
        await ensureUnpacked(config);
        let filePath = getFilePath(path);
        if (Object.prototype.hasOwnProperty.call(config.unpacked,filePath)){
            delete config.unpacked[filePath];
            await persist(config);
            return true;
        }
        return false;
    }

    me.getUniqueName = async function(path,name,config){
        await ensureUnpacked(config);
        let folderPath = getFilePath(path);
        if (folderPath.endsWith("/")) folderPath = folderPath.substr(0,folderPath.length-1);

        let uniqueName = name;
        let i = 2;
        while (hasEntry(config.unpacked,joinPath(folderPath,uniqueName))){
            uniqueName = getIndexedName(name,i);
            i++;
        }
        return uniqueName;
    }

    function getFilePath(path){
        path = path || "";
        var p = path.indexOf(":");
        if (p>0) path = path.substr(p+1);
        if (path.startsWith("/")) path = path.substr(1);
        return path;
    }

    async function ensureUnpacked(config){
        if (!config.binary){
            console.log("reading archive");
            config.binary = await fileSystem.readFile(config.url,true);
        }

        if (!config.unpacked){
            console.log("unpacking archive");
            let type = config.name.split(".").pop().toLowerCase();
            if (type === "zip"){
                config.unpacked = uzip.parse(config.binary.buffer);
                console.error(config.unpacked);
            }else{
                let module = await import("./libArchive/archive.mjs");
                const entries = module.extractAll(config.binary.buffer);
                console.error(entries);
                let map = {};
                let folders = [];
                entries.forEach(entry => {
                    if (entry.type === "FILE"){
                        let name = entry.path;
                        map[name] = {buffer:entry.data};
                        if (name.indexOf("/")>0){
                            let parts = name.split("/");
                            parts.pop();
                            let folder = parts.join("/");
                            if (!folders.includes(folder)){
                                folders.push(folder);
                                map[folder+"/"] = {buffer:new Uint8Array(0)};
                            }
                        }
                    }else{
                        console.error(entry);
                    }
                });
                config.unpacked = map;
            }
        }
    }

    function toByteArray(content){
        if (!content) return new Uint8Array(0);
        if (content instanceof Uint8Array) return content;
        if (content instanceof ArrayBuffer) return new Uint8Array(content);
        if (typeof content === "string") return new TextEncoder().encode(content);
        if (content.buffer instanceof ArrayBuffer){
            let offset = content.byteOffset || 0;
            let length = content.byteLength || content.buffer.byteLength;
            return new Uint8Array(content.buffer.slice(offset,offset+length));
        }
        return new Uint8Array(0);
    }

    function ensureParentFolders(unpacked,path){
        if (path.indexOf("/")<0) return;
        let parts = path.split("/");
        parts.pop();
        for (let i=1;i<=parts.length;i++){
            let folder = parts.slice(0,i).join("/") + "/";
            if (!unpacked[folder]) unpacked[folder] = {buffer:new Uint8Array(0)};
        }
    }

    async function persist(config){
        if (!config.url) return;
        let type = config.name.split(".").pop().toLowerCase();
        let map = {};
        Object.keys(config.unpacked).forEach(name=>{
            map[name] = toByteArray(config.unpacked[name]);
        });

        if (type === "zip"){
            let packedZip = uzip.encode(map);
            config.binary = BinaryStream(packedZip.buffer,true);
            await fileSystem.writeFile(config.url,packedZip.buffer,true);
            return;
        }

        if (type === "lha" || type === "lzh"){
            let packedLha = encodeLhaFromMap(map);
            config.binary = BinaryStream(packedLha,true);
            await fileSystem.writeFile(config.url,packedLha,true);
            return;
        }
    }

    function joinPath(folderPath,name){
        return folderPath ? folderPath + "/" + name : name;
    }

    function hasEntry(unpacked,path){
        return Object.prototype.hasOwnProperty.call(unpacked,path) || Object.prototype.hasOwnProperty.call(unpacked,path + "/");
    }

    function getIndexedName(name,index){
        let dot = name.lastIndexOf(".");
        if (dot>0){
            return name.substring(0,dot) + " " + index + name.substring(dot);
        }
        return name + " " + index;
    }

    fileSystem.register("Archiver",me);

    return me;
}

export default Archiver();
import binaryStream from "../../../plugins/binaryStream/binaryStream.js";
import {uuid} from "../../util/dom.js";
import storage from "../../storage.js";
let RAD = ()=>{
    let me = {}

    function getStorageKey(mount){
        if (mount && mount.volume){
            let vol = mount.volume.toLowerCase();
            if (vol === "desktop"){
                return "rad";
            }
            return "rad_" + vol;
        }
        return "rad";
    }

    me.readFile = async function(path,binary,mount){
        let key = getStorageKey(mount);
        return new Promise((next) => {
            path = getFilePath(path);
            let filename = path.split("/").pop();
            path = getParentPath(path);
            storage.getObject(key).then(data=>{
                let currentItems = data || [];
                let item = currentItems.find(item=>item.path === path && item.name === filename);
                if (item){
                    storage.getObject(item.id).then(file=>{
                        if (file){
                            if (binary){
                                console.error("binary",typeof file.content);
                                let data = file.content;
                                if (typeof data === "string"){
                                    data = new TextEncoder().encode(file.content);
                                    data = data.buffer;
                                }
                                next(binaryStream(data,true));
                            }else{
                                let data = file.content;
                                if (data instanceof ArrayBuffer){
                                    data = new TextDecoder("utf-8").decode(data);
                                } else if (data && data.buffer instanceof ArrayBuffer) {
                                    data = new TextDecoder("utf-8").decode(data.buffer);
                                }
                                next(data);
                            }
                        } else {
                            next();
                        }
                    });
                }else{
                    next();
                }
            });
        });
    }

    me.writeFile = async function(path,content,binary,mount,progress,object){
        console.error(object);
        let key = getStorageKey(mount);
        path = getFilePath(path);
        let filename = path.split("/").pop();
        path = getParentPath(path);

        let type = "file";
        let ext = filename.split(".").pop();
        if (ext === "link" || ext === "url") type = "link";

        let data = await storage.getObject(key);
        let currentItems = data || [];
        let item = currentItems.find(item=>item.path === path && item.name === filename);

        if (!item){
            item = {
                name:filename,
                path:path,
                type:type,
                id:uuid()
            }
            currentItems.push(item);
            storage.setObject(key,currentItems);
        }
        if (type === "link" && object){
            console.error("link",object);
            item.label = object.label;
            item.url = object.url;
            item.handler = object.handler;
            item.icon = object.icon;
            item.iconActive = object.iconActive;

            if (item.label){
                let name = item.label.split("/").pop() + ".link";
                console.error("name",name);
                item.name = await me.getUniqueName(path,name,mount);
            }

            storage.setObject(key,currentItems);
        }

        if (content){
            if (content.buffer) content = content.buffer;
            let file ={
                id:uuid(),
                binary:binary,
                content:content,
            }
            storage.setObject(item.id,file);
        }

        return item;
    }

    me.deleteFile = function(path,mount){
        let key = getStorageKey(mount);
        path = getFilePath(path);
        let filename = path.split("/").pop();
        path = getParentPath(path);
        storage.getObject(key).then(data=>{
            let currentItems = data || [];
            let itemIndex = currentItems.findIndex(item=>item.path === path && item.name === filename);
            if (itemIndex >= 0){
                let item = currentItems[itemIndex];
                let id = item.id;
                currentItems.splice(itemIndex,1);
                storage.setObject(key,currentItems);
                if (id) storage.removeObject(id);
            }
        });
    }

    me.moveFile = function(fromPath,toPath,mount){
        let key = getStorageKey(mount);
        fromPath = getFilePath(fromPath);
        toPath = getFilePath(toPath);
        let filename = fromPath.split("/").pop();
        fromPath = getParentPath(fromPath);
        storage.getObject(key).then(data=>{
            let currentItems = data || [];
            let itemIndex = currentItems.findIndex(item=>item.path === fromPath && item.name === filename);

            if (itemIndex >= 0){
                let item = currentItems[itemIndex];
                console.log("moving RAD item",item);
                item.path = toPath;
                storage.setObject(key,currentItems);
            }else{
                console.error("file not found",fromPath,filename);
            }
        });
    }

    me.createDirectory = function(path,name,mount){
        let key = getStorageKey(mount);
        path = getFilePath(path);
        console.error(path,name);
        return new Promise((next) => {
            storage.getObject(key).then(data=>{
                let currentItems = data || [];
                let folder = {
                    name:name,
                    path:path,
                    type:"folder",
                    id:uuid()
                };
                currentItems.push(folder);
                storage.setObject(key,currentItems);
                next(folder);
            });
        });
    };

    me.deleteDirectory = function(path,mount){
        let key = getStorageKey(mount);
        path = getFilePath(path);
        let foldername = path.split("/").pop();
        path = getParentPath(path);
        storage.getObject(key).then(data=>{
            let currentItems = data || [];
            let itemIndex = currentItems.findIndex(item=>item.path === path && item.name === foldername);
            if (itemIndex >= 0){
                let item = currentItems[itemIndex];
                currentItems.splice(itemIndex,1);
                storage.setObject(key,currentItems);
                // TODO: delete all files in folder
            }
        });
    }

    me.getDirectory = async function(folder,mount){
        let key = getStorageKey(mount);
        let path = getFilePath(folder.path || folder || "");
        return new Promise((next) => {
            storage.getObject(key).then(data=>{
                let currentItems = data || [];
                console.log("getDirectory",path,currentItems);
                let directories = [];
                let files = [];
                if (data){
                    data.forEach(item=>{
                        if (item.path === path){
                            if (item.type === "folder"){
                                directories.push(item);
                            }else{
                                console.error("file",item);
                                files.push(item);
                            }
                        }
                    });
                }
                next({
                    directories: directories,
                    files:files
                });
            })
        });
    };

    me.renameFile = function(path,newName,mount){
        let key = getStorageKey(mount);
        path = getFilePath(path);
        let filename = path.split("/").pop();
        path = getParentPath(path);
        storage.getObject(key).then(async data=>{
            let currentItems = data || [];
            let item = currentItems.find(item=>item.path === path && item.name === filename);

            if (item && item.name !== newName){
                item.name = await me.getUniqueName(path,newName,mount);
                storage.setObject(key,currentItems);
            }
        });
    }

    me.getUniqueName = function(path,name,mount){
        let key = getStorageKey(mount);
        return new Promise((next) => {
            storage.getObject(key).then(data=>{
                let currentItems = data || [];
                let item = getItemFromPath(path + "/" + name,currentItems);
                if (item){
                    let parts = name.split(".");
                    let ext = "";
                    if (parts.length>1){
                        ext = "." + parts.pop();
                    }
                    let base = parts.join(".");
                    let i = 2;
                    while (item){
                        name = base + " " + i + ext;
                        item = getItemFromPath(path + "/" + name,currentItems);
                        i++;
                    }
                    next(name);
                }else{
                    next(name);
                }
            });
        });
    }

    me.isReadOnly = (file)=>{
        return false;
    }

    me.deleteStorage = function(mount){
        let key = getStorageKey(mount);
        storage.getObject(key).then(data=>{
            let currentItems = data || [];
            currentItems.forEach(item=>{
                if (item.id) storage.removeObject(item.id);
            });
            storage.removeObject(key);
        });
    }

    me.getInfo = async function(path,mount){
        let key = getStorageKey(mount);
        return new Promise((next) => {
            path = getFilePath(path);
            let filename = path.split("/").pop();
            path = getParentPath(path);
            storage.getObject(key).then(data=>{
                let currentItems = data || [];
                let item = currentItems.find(item=>item.path === path && item.name === filename);
                if (item){
                    storage.getObject(item.id).then(file=>{
                        if (file && file.content){
                            let size = 0;
                            if (file.content.byteLength) size = file.content.byteLength;
                            else if (typeof file.content === "string") size = file.content.length;
                            else if (file.content.length) size = file.content.length;
                            next({
                                file: {
                                    size: size
                                }
                            });
                        } else {
                            next({});
                        }
                    });
                } else {
                    next({});
                }
            });
        });
    }

    function getFilePath(path){
        path = path || "";
        var p = path.indexOf(":");
        if (p>0) path = path.substr(p+1);
        if (path[0] === "/") path = path.substr(1);
        if (path[0] === "/") path = path.substr(1);
        path = path.split("//").join("/");
        if (path.endsWith("/")) path = path.substr(0,path.length-1);
        return path;
    }

    function getItemFromPath(path,currentItems){
        path = getFilePath(path);
        let filename = path.split("/").pop();
        path = getParentPath(path);
        return currentItems.find(item=>item.path === path && item.name === filename);
    }

    function getParentPath(path){
        path = getFilePath(path);
        if (path.endsWith("/")) path = path.substr(0,path.length-1);
        var parts = path.split("/");
        parts.pop();
        path = parts.join("/");
        return path;
    }

    return me;
}

export default RAD();
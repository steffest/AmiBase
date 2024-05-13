import binaryStream from "../../../plugins/binaryStream/binaryStream.js";
import {uuid} from "../../util/dom.js";
import storage from "../../storage.js";
let RAD = ()=>{
    let me = {}
    let items = [];

    me.readFile = async function(path,binary){
        return new Promise((next) => {
            path = getFilePath(path);
            let filename = path.split("/").pop();
            path = getParentPath(path);
            let item = items.find(item=>item.path === path && item.name === filename);
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
                            next(file.content);
                        }
                    }
                });
            }
        });
    }

    me.writeFile = async function(path,content,binary,mount,progress,object){
        console.error(object);
        path = getFilePath(path);
        let filename = path.split("/").pop();
        path = getParentPath(path);

        let type = "file";
        let ext = filename.split(".").pop();
        if (ext === "link" || ext === "url") type = "link";

        let item = items.find(item=>item.path === path && item.name === filename);

        if (!item){
            item = {
                name:filename,
                path:path,
                type:type,
                id:uuid()
            }
            items.push(item);
            storage.setObject("rad",items);
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
                item.name = await me.getUniqueName(path,name);
            }

            storage.setObject("rad",items);
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

    me.deleteFile = function(path){
        path = getFilePath(path);
        let filename = path.split("/").pop();
        path = getParentPath(path);
        let itemIndex = items.findIndex(item=>item.path === path && item.name === filename);
        if (itemIndex >= 0){
            let item = items[itemIndex];
            let id = item.id;
            items.splice(itemIndex,1);
            storage.setObject("rad",items);
            if (id) storage.removeObject(id);
        }
    }

    me.moveFile = function(fromPath,toPath){
        fromPath = getFilePath(fromPath);
        toPath = getFilePath(toPath);
        let filename = fromPath.split("/").pop();
        fromPath = getParentPath(fromPath);
        let itemIndex = items.findIndex(item=>item.path === fromPath && item.name === filename);

        if (itemIndex >= 0){
            let item = items[itemIndex];
            console.log("moving RAD item",item);
            item.path = toPath;
            storage.setObject("rad",items);
        }else{
            console.error("file not found",fromPath,filename);
        }
    }

    me.createDirectory = function(path,name){
        path = getFilePath(path);
        console.error(path,name);
        return new Promise((next) => {
            let folder = {
                name:name,
                path:path,
                type:"folder",
                id:uuid()
            };
            items.push(folder);
            storage.setObject("rad",items);
            next(folder);
        });
    };

    me.deleteDirectory = function(path){
        path = getFilePath(path);
        let foldername = path.split("/").pop();
        path = getParentPath(path);
        let itemIndex = items.findIndex(item=>item.path === path && item.name === foldername);
        if (itemIndex >= 0){
            let item = items[itemIndex];
            items.splice(itemIndex,1);
            storage.setObject("rad",items);
            // TODO: delete all files in folder
        }
    }


    me.getDirectory = async function(folder){
        let path = getFilePath(folder.path || folder || "");
        return new Promise((next) => {
            storage.getObject("rad").then(data=>{
                items = data || [];
                console.log("getDirectory",path,items);
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

    me.renameFile = function(path,newName){
        path = getFilePath(path);
        let filename = path.split("/").pop();
        path = getParentPath(path);
        let item = items.find(item=>item.path === path && item.name === filename);

        if (item && item.name !== newName){
            item.name = me.getUniqueName(path,newName);
            storage.setObject("rad",items);
        }
    }

    me.getUniqueName = function(path,name){
        return new Promise((next) => {
            let item = getItemFromPath(path + "/" + name);
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
                    item = getItemFromPath(path + "/" + name);
                    i++;
                }
                next(name);
            }else{
                next(name);
            }
        });
    }

    me.isReadOnly = (file)=>{
        return false;
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

    function getItemFromPath(path){
        path = getFilePath(path);
        let filename = path.split("/").pop();
        path = getParentPath(path);
        return items.find(item=>item.path === path && item.name === filename);
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
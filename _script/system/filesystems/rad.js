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
                            next(binaryStream(file.binary,true));
                        }else{
                            next(file.content);
                        }
                    }
                });
            }
        });
    }

    me.writeFile = async function(path,content,binary){
        path = getFilePath(path);
        let filename = path.split("/").pop();
        path = getParentPath(path);

        let item = items.find(item=>item.path === path && item.name === filename);
        if (!item){
            item = {
                name:filename,
                path:path,
                type:"file",
                id:uuid()
            }
            items.push(item);
            storage.setObject("rad",items);
        }

        console.error("writeFile",content)
        let file ={
            id:uuid(),
            binary:binary,
            content:content,
        }
        storage.setObject(item.id,file);

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
        console.log("getDirectory",path,folder);
        return new Promise((next) => {
            storage.getObject("rad").then(data=>{
                items = data;
                let directories = [];
                let files = [];
                if (data){
                    data.forEach(item=>{
                        if (item.path === path){
                            if (item.type === "folder"){
                                directories.push(item);
                            }else{
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
        console.error("rename",item,path,filename,items)
        if (item){
            item.name = newName;
            storage.setObject("rad",items);
        }
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
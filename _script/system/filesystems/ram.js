/*
    This is the in-memory filesystem where e.g. uploaded files are stored.
    Normally all binary content should be already present in the file object
 */
import binaryStream from "../../../plugins/binaryStream/binaryStream.js";

let RAM = ()=>{
    let me = {}
    let items = [];
    let folders = [];

    me.readFile = async function(path,binary){
        path = getFilePath(path);
        let file = items.find(a=>a.path === path);
        path = "ram:" + path;
        if (!file) file = items.find(a=>a.path === path);
        console.log("reading file",path,file);
        console.log("items",items);
        if (binary){
            return file.binary;
        }else{
            return file.binary.toString();
        }
    }

    me.writeFile = async function(path,content,binary){
        path = getFilePath(path);
        console.log("writing file",path,content,binary);
        let data;
        if (binary){
            if (content.arrayBuffer){
                content = await content.arrayBuffer();
            }
            if (content.buffer) content = content.buffer;
            data = binaryStream(content,true);
        }else{
            content = content || "";
            let encoded = new TextEncoder("utf-8").encode(content);
            data = binaryStream(encoded.buffer,true);
        }

        let file = items.find(a=>a.path === path);
        if (file){
            file.binary =  data;
            return;
        }
        file = {name:path.split("/").pop(),path:path,binary: data,folderPath: getParentPath(path)};
        items.push(file);
        return true;
    }

    me.createDirectory = function(path,name){
        path = getFilePath(path);
        return new Promise((next) => {
            folders.push({name:name,path:path});
            next();
        });
    };

    me.addFile = function(file){
        // add to the root when files are dropped on the desktop
        console.error("adding file",file.binary);
        items.push(file);
    }

    me.getDirectory = async function(folder){
        let path = getFilePath(folder.path || folder || "");
        console.log("getDirectory",path,folder);
        console.log(folders);
        console.log(items);
        return new Promise((next) => {
            next({
                directories: folders.filter(a=>a.path === path),
                files:items.filter(a=>a.folderPath === path)
            });
        });
    };

    me.renameFile = function(path,newName){
        return new Promise((next) => {
            path = getFilePath(path);
            let fileIndex = items.findIndex(a=>a.path === path);
            let file = items[fileIndex];
            if (file){
                file.name = newName;
                let p = path.lastIndexOf("/");
                if (p>0){
                    file.path = path.substr(0,p+1) + newName;
                }else{
                    file.path = newName;
                }
                items[fileIndex] = file;
                next();
            }else{
                console.error("file not found",path);
                next();
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

export default RAM();
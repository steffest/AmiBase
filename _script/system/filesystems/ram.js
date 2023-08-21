import system from "../system.js";
import folder from "../folder.js";

/*
    This is the in-memory filesystem where e.g. uploaded files are stored.
    Normally all binary content should be already present in the file object
 */
let RAM = ()=>{
    let me = {}
    let items = [];
    let folders = [];

    me.readFile = async function(file,binary){
        if (!file.binary){
            // file was passed as filename only
            let path = getFilePath(file.path || file);
            file = items.find(a=>a.path === path);
            console.log("reading file",path,file);
            console.log("items",items);
        }
        if (binary){
            return file.binary;
        }else{
            return file.binary.toString();
        }
    }

    me.writeFile = async function(path,data){
        path = getFilePath(path);
        console.log("writing file",path,data);
        let file = items.find(a=>a.path === path);
        if (file){
            file.binary = data;
            return;
        }
        file = {name:path.split("/").pop(),path:path,binary:data,folderPath: getFolderPath(path)};
        items.push(file);
        return true;
    }

    me.createDirectory = function(path,name){
        path = getFilePath(path);
        return new Promise((next) => {
            folders.push({name:name,path:path});
        });
    };

    me.addFile = function(file){
        // add to the root when files are dropped on the desktop
        console.error("adding file",file.binary);
        items.push(file);
    }

    me.getDirectory = async function(folder){
        var path = getFilePath(folder.path || folder || "");
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

    function getFilePath(path){
        path = path || "";
        var p = path.indexOf(":");
        if (p>0) path = path.substr(p+1);
        if (path[0] === "/") path = path.substr(1);
        if (path[0] === "/") path = path.substr(1);
        return path;
    }


    function getFolderPath(path){
        var parts = path.split("/");
        parts.pop();
        return parts.join("/") + "/";
    }

    return me;
}

export default RAM();
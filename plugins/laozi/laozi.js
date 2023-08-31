import fileSystem from "../../../_script/system/filesystem.js";
import fetchService from "../../../_script/util/fetchService.js";
import BinaryStream from "../../binaryStream/binaryStream.js";

var Laozi = async function() {
    var me = {};

    var endPoint = "https://www.amibase.com/api/";

    var {default: api} = await import("./api.js");

    me.getDirectory = async function(path,config){
        console.error("getDirectory",path);
        setConfig(config);

        return new Promise((next) => {
            path = getFilePath(path);
            fetchService.json(endPoint + "file/" + path,function(data){
                var directories = [];
                var files = [];
                data.result.directories.forEach(dir=>{
                    directories.push({name:dir})
                });
                data.result.files.forEach(file=>{
                    files.push({name:file})
                });

                next({
                    directories: directories,
                    files:files
                });
            });
        });
    };


    me.readFile = function(path,binary,config){
        setConfig(config);
        return new Promise((next) => {
            var url = me.getFileUrl(path);
            console.log("Get File", url);
            if (binary){
                fetchService.arrayBuffer(url).then(_file => {
                    next(BinaryStream(_file,true));
                })
            }else{
                fetchService.get(url).then(_file => {
                    next(_file);
                })
            }
        });
    };

    me.isReadOnly = (file)=>{
        return false;
    }

    me.getFileUrl = function(path,config){
        setConfig(config);
        path = getFilePath(path);
        return endPoint + "file/" + path;
    };

    me.createDirectory = function(path,name,config){
        setConfig(config);
        return new Promise((next) => {
            path = getFilePath(path);
            fetchService.json(endPoint + "file/createdirectory/" + path + "/" + name,function(data){
                console.log(data);
                next();
            });
        });
    };

    me.moveFile = function(fromPath,toPath,config){
        setConfig(config);
        return new Promise((next) => {
            fromPath = getFilePath(fromPath);
            toPath = getFilePath(toPath);
            fetchService.json(endPoint + "file/move/" + fromPath + "?to=" + toPath,function(data){
                console.log(data);
                next();
            });
        });
    };

    me.renameFile = function(path,newName,config){
        setConfig(config);
        return new Promise((next) => {
            path = getFilePath(path);
            fetchService.json(endPoint + "file/rename/" + path + "?name=" + newName,function(data){
                console.log(data);
                next();
            });
        });
    };

    me.deleteFile = function(path,config){
        setConfig(config);
        return new Promise((next) => {
            path = getFilePath(path);
            fetchService.json(endPoint + "file/delete/" + path,function(data){
                console.log(data);
                next(data.status === "ok");
            });
        });
    };

    me.deleteFolder = function(path,config){
        setConfig(config);
        return new Promise((next) => {
            path = getFilePath(path);
            fetchService.json(endPoint + "file/delete/" + path,function(data){
                console.log(data);
                next(data.status === "ok");
            });
        });
    };

    me.writeFile = function(path,content,binary,config){
        console.log("writeFile",path,content,binary);
        setConfig(config);
        return new Promise((next) => {
            path = getFilePath(path);
            let data;
            if (binary){
                let buffer = content ? content.buffer || content : null;
                let filename = path.split("/").pop();
                path = path.substr(0,path.length-filename.length);

                if (buffer){
                    data = new FormData();
                    let b = new Blob([buffer], {type: "application/octet-stream"});
                    data.append('files[]', b, filename);
                    fetchService.sendBinary(endPoint + "file/uploadfile/" + path,data,function(data){
                        console.log(data);
                        next(data.status === "ok");
                    });
                }else{
                    console.error("nothing no write, no buffer");
                    next();
                }
            }else{
                data = {editorcontent:content};
                fetchService.post(endPoint + "file/update/" + path,data ,function(data){
                    next(data);
                });
            }
        });
    };

    me.getInfo = function(path,config){
        setConfig(config);
        return new Promise((next) => {
            path = getFilePath(path);
            fetchService.json(endPoint + "file/info/" + path,function(data){
                console.log(data);
                next(data.result);
            });
        });
    }


    // strip out the mount or protocol part
    function getFilePath(path){
        path = path || "";
        var p = path.indexOf(":");
        if (p>0) path = path.substr(p+1);
        if (path[0] === "/") path = path.substr(1);
        if (path[0] === "/") path = path.substr(1);
        if (path[path.length-1] === "/") path = path.substr(0,path.length-1);
        return path;
    }

    function setConfig(config){
        if (config){
            endPoint = config.url || endPoint;
        }
    }

    fileSystem.register("laozi",me);

    return me;

};

export default Laozi();
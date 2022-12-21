import fileSystem from "../../../_script/system/filesystem.js";
import fetchService from "../../../_script/util/fetchService.js";
import BinaryStream from "../../binaryStream/binaryStream.js";

var Laozi = async function() {
    var me = {};

    var endPoint = "https://www.amibase.com/api/";

    var {default: api} = await import("./api.js");


    me.getDirectory = async function(folder,_next){
        var path = folder.path;

        return new Promise((resolve,reject) => {
            var next = _next || resolve;
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

    me.readFile = function(file,binary){
        return new Promise((next) => {
            var url = me.getFileUrl(file.path);
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

    me.getFileUrl = function(path){
        path = getFilePath(path);
        return endPoint + "file/" + path;
    };

    me.createDirectory = function(path,name,_next){
        return new Promise((resolve,reject) => {
            var next = _next || resolve;
            path = getFilePath(path);
            fetchService.json(endPoint + "file/createdirectory/" + path + "/" + name,function(data){
                console.log(data);
                next();
            });
        });
    };

    me.moveFile = function(fromPath,toPath){
        return new Promise((next) => {
            fromPath = getFilePath(fromPath);
            toPath = getFilePath(toPath);
            fetchService.json(endPoint + "file/move/" + fromPath + "?to=" + toPath,function(data){
                console.log(data);
                next();
            });
        });
    };

    me.renameFile = function(path,newName){
        return new Promise((next) => {
            path = getFilePath(path);
            fetchService.json(endPoint + "file/rename/" + path + "?name=" + newName,function(data){
                console.log(data);
                next();
            });
        });
    };

    me.writeFile = function(path,content){
        return new Promise((next) => {
            path = getFilePath(path);
            let data = {editorcontent:content};
            console.error(data);
            fetchService.post(endPoint + "file/update/" + path,data ,function(data){
                next(data);
            });
        });
    };

    me.uploadFile = function(file,path){
        return new Promise((next) => {
            path = getFilePath(path);
            var data = new FormData();
            file.getAttachment((attachment) => {
                var b = new Blob([attachment.file.buffer], {type: "application/octet-stream"});
                data.append('files[]', b, attachment.file.name);
                fetchService.sendBinary(endPoint + "file/uploadfile/" + path,data,function(data){
                    console.log(data);
                    next();
                });
            });
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

    fileSystem.register("laozi",me);

    return me;

};

export default Laozi();
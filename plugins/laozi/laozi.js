import fileSystem from "../../_script/system/filesystem.js";
import fetchService from "../../_script/util/fetchService.js";
import BinaryStream from "../binaryStream/binaryStream.js";

var Laozi = async function() {
    var me = {};

    var endPoint = "https://www.amibase.com/api/";

    me.getDirectory = async function(path,config){
        console.error("getDirectory",path);
        setConfig(config);

        return new Promise((next,fail) => {
            path = getFilePath(path);
            fetchService.json(endPoint + "file/" + path,function(data){
                // The API always answers with HTTP 200; a missing/unreadable
                // path is signalled via status:"nok" (with result as a plain
                // string) rather than an actual error response.
                if (!data || data.status !== "ok"){
                    fail((data && data.result) || "could not read directory");
                    return;
                }
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
        return new Promise((next,fail) => {
            var url = me.getFileUrl(path);
            console.log("Get File", url);
            if (binary){
                fetchService.arrayBuffer(url).then(_file => {
                    next(BinaryStream(_file,true));
                })
            }else{
                fetchService.get(url).then(_file => {
                    // A missing file still comes back as HTTP 200 with a
                    // {status:"nok", result:"File not found..."} JSON envelope -
                    // surface that as a rejection instead of handing back the
                    // envelope as if it were the file's content (this corrupts
                    // callers like filesystem.js's .aminfo meta merge).
                    if (isErrorEnvelope(_file)){
                        fail("file not found");
                        return;
                    }
                    next(_file);
                })
            }
        });
    };

    function isErrorEnvelope(text){
        if (typeof text !== "string" || text[0] !== "{") return false;
        try{
            var parsed = JSON.parse(text);
            return !!parsed && parsed.status === "nok";
        }catch(e){
            return false;
        }
    }

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

    me.writeFile = function(path,content,binary,config,onProgress){
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
                    fetchService.sendBinary(endPoint + "file/uploadfile/" + path,data,onProgress).then(result=>{
                        next(result.status === "ok");
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

    me.getUniqueName = async function(path,name,config){
        setConfig(config);
        let dir = await me.getDirectory(path,config);
        let names = (dir.files || []).map(f=>f.name)
            .concat((dir.directories || []).map(d=>d.name));
        let uniqueName = name;
        let ext = name.split(".").pop();
        let base = ext === name ? name : name.substr(0,name.length-ext.length-1);
        let i = 2;
        while (names.indexOf(uniqueName) >= 0){
            uniqueName = ext === name ? base + i : base + i + "." + ext;
            i++;
        }
        return uniqueName;
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
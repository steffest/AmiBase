import * as uzip from 'https://cdn.skypack.dev/uzip?min';
import fileSystem from "../../../_script/system/filesystem.js";
import BinaryStream from "../../binaryStream/binaryStream.js";

let Archiver = ()=>{
    let me ={};
    let amiBase = {};
    let amiWindow;
    let currentArchive;

    me.getDirectory = async function(path,config){
        let filePath = getFilePath(path);
        console.error("getDirectory",filePath,config.binary);

        return new Promise(async next => {
            if (!config.binary){
                console.log("reading archive");
                config.binary = await fileSystem.readFile(config.url,true);
            }

            if (!config.unpacked){
                console.log("unpacking archive");
                config.unpacked = uzip.parse(config.binary.buffer);
            }

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
        return new Promise((next) => {
            var mount = fileSystem.getMount(path);
            path = getFilePath(path);
            let data = config.unpacked[path] || new Uint8Array(0);
            if (binary){
                next(BinaryStream(data.buffer,true))
            }else{
                next(data);
            }
        });
    }

    function getFilePath(path){
        path = path || "";
        var p = path.indexOf(":");
        if (p>0) path = path.substr(p+1);
        return path;
    }

    fileSystem.register("Archiver",me);

    return me;
}

export default Archiver();
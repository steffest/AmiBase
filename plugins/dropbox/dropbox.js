import fileSystem from "../../../_script/system/filesystem.js";
import BinaryStream from "../../binaryStream/binaryStream.js";
let Dropbox = function(){
    let me = {};
    let sdk;
    let cache = [];

    /*
    to get and access token:
    visit https://dropbox.github.io/dropbox-api-v2-explorer/#files_list_folder
    click "get token"
    copy the token into the "password" field of the settings of this mount

     */

    fileSystem.register("dropbox",me);

    me.isReadOnly = (file)=>{
        return (!sdk);
    }

    me.getDirectory = async function(path,config){
        await loadSDK(config);
        path = getPath(path);
        if (path) path = "/" + path;

        return new Promise((next)=>{
            let directories = [];
            let files = [];

            sdk.filesListFolder({path: path})
                .then(function(response) {
                    let result = response.result;
                    console.error(result);
                    result.entries.forEach(entry=>{
                        if (entry[".tag"] === "folder"){
                            directories.push({name:entry.name});
                        }else{
                            cache.push(entry);
                            files.push({name:entry.name});
                        }
                    });
                })
                .catch(function(error) {
                    console.error(error);
                }).finally(()=> {
                    next({
                        directories: directories,
                        files:files
                    });
                })
        });
    }

    me.readFile = async function(path,binary,config){
        await loadSDK(config);
        path = getPath(path);
        if (path) path = "/" + path;

        return new Promise((next)=>{
            sdk.filesDownload({path: path})
                .then(function(response) {
                    console.error(response);
                    let result = response.result;
                    let file = result.fileBlob;
                    console.error(file);
                    if (binary){
                        file.arrayBuffer().then(_file => {
                            next(BinaryStream(_file,true));
                        })
                    }else{
                        file.text().then(next)
                    }
                })
                .catch(function(error) {
                    console.error(error);
                });
        });
    }

    me.writeFile = async function(path,content,binary,config){
        await loadSDK(config);
        path = getPath(path);
        if (path) path = "/" + path;

        return new Promise((next)=>{
            sdk.filesUpload({path: path, contents: binary?content.buffer:content, mode: {".tag": "overwrite"}})
                .then(function(response) {
                    console.error(response);
                    next(true);
                })
                .catch(function(error) {
                    console.error(error);
                    next(false);
                });
        });
    }

    me.getUniqueName = async function(path,name,config){
        await loadSDK(config);
        path = getPath(path);
        if (path) path = "/" + path;

        return new Promise((next)=>{
            sdk.filesListFolder({path: path})
                .then(function(response) {
                    let result = response.result;
                    console.error(result);
                    let names = result.entries.map(entry=>entry.name);
                    let uniqueName = name;
                    let ext = name.split(".").pop();
                    let base = name.substr(0,name.length-ext.length-1);
                    let i = 2;
                    while (names.indexOf(uniqueName)>=0){
                        uniqueName = base  + i + "." + ext;
                        i++;
                    }
                    next(uniqueName);
                })
                .catch(function(error) {
                    console.error(error);
                    next(name);
                });
        });
    }

    me.getUrl = async function(path,config){
        await loadSDK(config);
        path = getPath(path);
        if (path) path = "/" + path;

        return new Promise((next)=>{
            sdk.filesGetTemporaryLink({path: path}).then(function(response) {
                console.error(response);
                next(response.result.link);
            }).catch(function(error) {
                console.error(error);
                next("");
            });
        });
    };


    async function loadSDK(config){
        let url = "https://cdnjs.cloudflare.com/ajax/libs/dropbox.js/10.34.0/Dropbox-sdk.min.js";

        return new Promise((next)=>{
            if (sdk){
                next();
            }else{
                let script = document.createElement('script');
                script.onload = function () {
                    console.error(window.Dropbox);
                    sdk = new window.Dropbox.Dropbox({ accessToken: config.pass });
                    next();
                };
                script.src = url;
                document.head.appendChild(script);
            }
        });
    }

    function getPath(path){
        let volumePos = path.indexOf(":");
        if (volumePos>=0) path = path.substr(volumePos+1);
        return path;
    }

    return me;
}

export default Dropbox();
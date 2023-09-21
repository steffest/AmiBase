import fileSystem from "../../../_script/system/filesystem.js";
import BinaryStream from "../../binaryStream/binaryStream.js";
import fetchService from "../../../_script/util/fetchService.js";

let Friend = function(){
    let me = {};
    fileSystem.register("friend",me);

    let defaultVolume = "Home:";
    let sessionId;

    me.getDirectory = async function(path,config){
        console.log("getDirectory",path);
        path = getPath(path);
        path = defaultVolume + path;
        sessionId = await login(config);
        let url = getFriendApiUrl(config) + "file/dir?";
        url += "sessionid="+sessionId;
        url += "&path="+encodeURIComponent(path);
        url += "&r="+Math.random();

        let response = await fetch(url);
        response = await response.text();
        response = parseFriendResponse(response);

        let directories = [];
        let files = [];

        response.forEach(item=>{
            if (item.Type === "File") files.push({name: item.Filename});
            if (item.Type === "Directory") directories.push({name: item.Filename});
        })

        return {
            directories:directories,
            files:files
        }
    }

    me.readFile = async function(path,binary,config){
        console.log("readFile",path,binary);
        path = getPath(path);
        path = defaultVolume + path;
        sessionId = await login(config);

        let url = getFriendApiUrl(config) + "file/read?";
        url += "sessionid="+sessionId;
        url += "&path="+encodeURIComponent(path);
        url += "&mode=rs";

        let response = await fetch(url);
        let result;
        if (binary){
            response = await response.blob();
            let buffer = await response.arrayBuffer();
            result = BinaryStream(buffer,true);
        }else{
            result = await response.text();
        }
        return result;
    };

    me.writeFile = async function(path,content,binary,config,onProgress){
        console.log("writeFile",path,binary);
        path = getPath(path);
        path = defaultVolume + path;
        path = path.split("//").join("/"); // bweargh... still?
        sessionId = await login(config);

        if (binary){
            let url = getFriendApiUrl(config) + "file/upload";

            let buffer = content ? content.buffer || content : null;
            let filename = path.split("/").pop();
            path = path.substr(0,path.length-filename.length);

            let data;
            if (buffer){
                data = new FormData();
                let b = new Blob([buffer], {type: "application/octet-stream"});

                data.append('sessionid', sessionId);
                data.append('path', path);
                data.append('module', "files");
                data.append('command', "uploadfile");
                data.append('file', b, filename);

                return await fetchService.sendBinary(url,data,onProgress);
            }else{
                console.error("nothing no write, no buffer");
            }
        }else{
            let url = getFriendApiUrl(config) + "file/write";
            content = content || " ";

            let data = {
                sessionid: sessionId,
                path: path,
                encoding: "url",
                mode: "w",
                data: encodeURIComponent(content)
            }

            return await fetchService.post(url,data);
        }
    }

    me.deleteFile = async function(path,config){
        path = getPath(path);
        path = defaultVolume + path;
        sessionId = await login(config);

        let url = getFriendApiUrl(config) + "file/delete";
        let data = {
            sessionid: sessionId,
            path: "Home:" + path,
            args:'{"path": "Home:' + path + '"}'
        }
        await fetchService.post(url,data);
        data = {
            sessionid: sessionId,
            path: "Home:" + path + ".info",
            args:'{"path": "Home:' + path + '.info"}'
        }
        return await fetchService.post(url,data);
    }

    me.createDirectory = async function(path,name,config){
        path = getPath(path);
        path = defaultVolume + path;
        sessionId = await login(config);

        let url = getFriendApiUrl(config) + "file/makedir";
        let data = {
            sessionid: sessionId,
            path: path  + name,
            args:'{"path": "' + path  + name + '"}'
        }

        return await fetchService.post(url,data);
    }

    me.renameFile = async function(path,newName,config){
        path = getPath(path);
        path = defaultVolume + path;
        sessionId = await login(config);

        let url = getFriendApiUrl(config) + "file/rename";
        let data = {
            sessionid: sessionId,
            path: path,
            newname: newName,
            args:'{"path": "' + path + '","name": "' + newName + '"}'
        }
        await fetchService.post(url,data);
        data = {
            sessionid: sessionId,
            path: path + ".info",
            newname: newName + ".info",
            args:'{"path": "' + path + '.info","name": "' + newName + '.info' + '"}'
        }
        return await fetchService.post(url,data);
    };

    me.getFileUrl = function(path,config){

    };

    function getPath(path){
        let volumePos = path.indexOf(":");
        if (volumePos>=0) path = path.substr(volumePos+1);
        return path;
    }

    async function login(config){
        if(sessionId) return sessionId;

        console.error(config);

        let url = getFriendApiUrl(config) + "login/";
        let data = {
            username: config.login,
            password:config.pass,
            deviceid:"Ami"
        }
        let response = await fetchService.post(url,data);
        response = toJson(response);
        sessionId = response.sessionid;
        return sessionId;
    }

    function getFriendApiUrl(config){
        let url = config.url || "https://me.friendsky.cloud/"
        if (!url.endsWith("/")) url += "/";
        url += "system.library/";
        return url;
    }

    function parseFriendResponse(response){
        if (response.indexOf("<!--separate-->")>=0){
            response = response.split("<!--separate-->");
            if (response[0] === "ok"){
                response = toJson(response[1],[]);
            }
        }
        return response;
    }

    function toJson(data,fallback){
        try {
            data = JSON.parse(data);
        }catch (e){
            data = fallback || {};
        }
        return data;
    }

    me.isReadOnly = (file)=>{
        return false;
    }

    return me;
}

export default Friend();
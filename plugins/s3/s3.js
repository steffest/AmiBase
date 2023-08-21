import fileSystem from "../../../_script/system/filesystem.js";
import BinaryStream from "../../binaryStream/binaryStream.js";

import Auth from "./auth.js";
let S3 = function(){
    let me = {};
    let sdk;
    let bucket=[];
    let currentPublicUrl = "";

    fileSystem.register("s3",me);

    me.isReadOnly = (file)=>{
        console.error("isReadOnly",file);
        return !sdk;
    }

    me.getDirectory = async function(path,config){
        let list = await getBucket(config);
        path = getPath(path);
        console.error("getDirectory",path);
        let directories = [];
        let files = [];
        list.forEach(item=>{
            if (!item.startsWith(path)) return;
            let relativePath = item.substr(path.length);
            if (!relativePath.length) return;
            let parts = relativePath.split("/");
              if (parts.length === 1){
                    files.push({name:relativePath});
              }else{
                  let d = parts[0];
                  if (directories.findIndex(dir=>dir.name===d)<0){
                      directories.push({name:d});
                  }
              }
        });

        return {
            directories: directories,
            files:files
        }
    }

    me.readFile = async function(path,binary,config){
        if (!sdk) await loadSDK(config);
        if (!sdk) return;
        path = getPath(path);
        console.log("Get File", path);
        path = path.split("//").join("/");
        return new Promise(next=>{
            var params = {
                Bucket: config.url,
                Key: path
            };
            sdk.getObject(params, function(err, data) {
                var result = "";
                if (err){
                    if (err.toString().indexOf("NoSuchKey")>=0){
                        console.log("no existing file");
                    }else{
                        console.log(err, err.stack);
                    }
                }else{
                    if (binary){
                        result = BinaryStream(data.Body.buffer,true);
                    }else{
                        result = new TextDecoder().decode(data.Body);
                    }
                }
                next(result);
            });
        });
    };

    me.writeFile = function(path,content,binary,config){
        console.log("writeFile",path,content,binary);

        content = content || "";
        path = getPath(path);
        return new Promise(next=>{
            sdk.putObject({
                Bucket: config.url,
                Key: path,
                Body: binary?content.buffer:content,
            }, function(err, data) {
                console.warn(data);
                console.warn(err);
                next(!err);
            });
        });
    }

    me.deleteFile = function(path,config){
        path = getPath(path);
        return new Promise(next=>{
            sdk.deleteObject({
                Bucket: config.url,
                Key: path
            }, function(err, data) {
                console.warn(data);
                console.warn(err);
                next(!err);
            });
        });
    }

    me.createDirectory = function(path,name,config){
        path = getPath(path);
        path = path + name + "/";
        path = path.split("//").join("/");
        return new Promise((next) => {
            sdk.putObject({
                Bucket: config.url,
                Key: path,
                Body: ""
            }, function(err, data) {
                console.log(data);
                if (err) console.warn(err);
                next(!err);
            });
        });
    }

    me.getFileUrl = function(path,config){
        if (currentPublicUrl){
            path = getPath(path);
            return currentPublicUrl + (config.url + "/" + path).split("//").join("/");
        }
    };


    async function loadSDK(config,retry){
        if (typeof AWS === "undefined") await loadAWS();
        AWS.config.update({
            region: "eu-west-1"
        });
        let credentials = await Auth.init(config);
        if (credentials){
            sdk = new AWS.S3({
                apiVersion: "2006-03-01",
                params: { Bucket: config.url },
                accessKeyId: credentials.AccessKeyId,
                secretAccessKey: credentials.SecretAccessKey,
                sessionToken: credentials.SessionToken,
                sslEnabled: true
            });
            // see if we can access the bucket
            let location = await getBucketLocation();
            if (location === "ExpiredToken"){
                sdk = null;
                Auth.clearTokens();
                if (!retry){
                    await loadSDK(config,true);
                }
            }
            console.log("S3 SDK ready",sdk);
        }else{
            console.error("no credentials");
        }
    }

    function loadAWS(){
        let url = "https://sdk.amazonaws.com/js/aws-sdk-2.899.0.min.js";

        return new Promise((next)=>{
            let script = document.createElement("script");
            script.onload = function(){
                next();
            }
            script.src = url;
            document.body.appendChild(script);
        });
    }

    function getBucketLocation(){
        return new Promise((next)=>{
            sdk.getBucketLocation({}, function(err, data) {
                if (err){
                    if (err.toString().indexOf("ExpiredToken")>=0){
                        next("ExpiredToken");
                    }
                    next();
                }else{
                    console.error(data);
                    next(data);
                }
            });
        });
    }

    async function getBucket(config){
        if (bucket && bucket.length) return bucket;
        bucket = [];
        if (!sdk) await loadSDK(config);
        if (!sdk) return bucket;
        return new Promise((next) => {
            sdk.listObjects({ Delimiter: "" }, function(err, data) {
                if (err){
                    if (err.toString().indexOf("ExpiredToken")>=0){
                        console.warn("ExpiredToken");
                        //Auth.clearTokens();
                        //window.location.reload();
                    }
                }else{
                    currentPublicUrl = this.request.httpRequest.endpoint.href;
                    console.error(data);
                    if (data && data.Contents){
                        data.Contents.forEach(item=>{
                            bucket.push(item.Key);
                        });
                    }
                }
                console.error(bucket);
                next(bucket);
            });
        });
    }

    function getPath(path){
        let volumePos = path.indexOf(":");
        if (volumePos>=0) path = path.substr(volumePos+1);
        return path;
    }

    return me;
}

export default S3();
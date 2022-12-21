var AmigaFileSystem = async function() {
    var me = {};


    me.getDirectory = async function(folder,_next){
        var path = folder.path;
        var mount = FileSystem.getMount(path);
        console.error(folder);

        return new Promise((resolve,reject) => {
            var next = _next || resolve;
            console.error(path);
            path = getFilePath(path);
            console.error(mount.data);

            var info = ADF.setDisk(mount.data.binary);
            if (folder.head){
                var dir = ADF.readFolderAtSector(folder.head);
            }else{
                dir = ADF.readRootFolder();
            }

            var directories = [];
            var files = [];
            dir.folders.forEach(folder=>{
                directories.push({name: folder.name, head: folder.sector});
            })
            dir.files.forEach(file=>{
                files.push({name: file.name, head: file.sector});
            })

            next({
                directories: directories,
                files:files
            });
        });
    };

    me.getFile = function(file,asBinaryStream){
        return new Promise((next) => {
            var path = file.path;
            var mount = FileSystem.getMount(path);
            if (typeof file.head === "number"){
                var result = ADF.readFileAtSector(file.head,true);

                if (asBinaryStream){
                    next(BinaryStream(result.content.buffer,true));
                }else{
                    next(result.content);
                }
            }else{
                next("");
            }
        });
    };


    me.createDirectory = function(path,name,_next){
        return new Promise((resolve,reject) => {
            var next = _next || resolve;
            path = getFilePath(path);
            FetchService.json(endPoint + "file/createdirectory/" + path + "/" + name,function(data){
                console.log(data);
                next();
            });
        });
    };

    me.moveFile = function(fromPath,toPath){
        return new Promise((next) => {
            fromPath = getFilePath(fromPath);
            toPath = getFilePath(toPath);
            FetchService.json(endPoint + "file/move/" + fromPath + "?to=" + toPath,function(data){
                console.log(data);
                next();
            });
        });
    };

    me.renameFile = function(path,newName){
        return new Promise((next) => {
            path = getFilePath(path);
            FetchService.json(endPoint + "file/rename/" + path + "?name=" + newName,function(data){
                console.log(data);
                next();
            });
        });
    };

    me.updateFile = function(path,content){
        return new Promise((next) => {
            path = getFilePath(path);
            let data = {editorcontent:content};
            console.error(data);
            FetchService.post(endPoint + "file/update/" + path,data ,function(data){
                next(data);
            });
        });
    };

    me.uploadFile = function(file,path){

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

    FileSystem.register("AmigaFileSystem",me);

    return me;

}();
var FileSystem = function(){
   var me = {};

    var mounts = {};
    var fileSystems = {};

    me.register= function(name,handler){
        console.log("registering filesystem " + name);
        fileSystems[name] = handler;
        for (var mount in  mounts){
            if (mounts[mount].filesystem === name){
                mounts[mount].handler = handler;
            }
        }
    };

    me.mount = async function(name,volume,plugin){
        mounts[volume] = {
            name: name,
            filesystem: plugin
        };
        Desktop.createIcon({
            type: "drive",
            label: name,
            volume: volume,
            path: volume + ":"
        });
        Desktop.cleanUp();

        await System.loadLibrary(plugin);
        mounts[volume].mounted = true;
        mounts[volume].handler = fileSystems[plugin];

    };

    me.getMount = function(path){
        var volume = me.getVolume(path);
        return mounts[volume];
    };

    me.getVolume = function(path){
        return path.split(":")[0];
    };


    me.getDirectory = function(path,target){
        return new Promise(async next => {
            var mount = me.getMount(path);
            if  (mount.handler){
                var data = await mount.handler.getDirectory(path);
                if (target){
                    //data.directories.forEach(dir => {
                    for (const dir of data.directories) {
                        var drawerInfo = {
                            type: "drawer",
                            label: dir,
                            path: path + dir + "/"
                        };

                        // check if there's an icon
                        var index = data.files.indexOf(dir + ".info");
                        if (index >= 0){
                            var filetype = await System.detectFileType(dir + ".info");
                            console.error(filetype);
                            drawerInfo.attachment = {
                                path: path + dir + ".info",
                                url: mount.handler.getFileUrl(path + dir + ".info"),
                                filetype: filetype
                            };
                            drawerInfo.icon = path + dir + ".info";
                            data.files.splice(index,1);
                        }
                        target.createIcon(drawerInfo);
                    }
                    for (const file of data.files) {
                        var filetype = await System.detectFileType(file);
                        //console.error(filetype);
                        var fileInfo = {
                            type: "file",
                            label: file,
                            attachment: {
                                path: path + file,
                                url: mount.handler.getFileUrl(path + file),
                                filetype: filetype
                            }
                        };
                        if (filetype.className){
                            fileInfo.iconClassName = filetype.className;
                        }
                        if (filetype.customIcon){
                            fileInfo.iconClassName = "";
                            fileInfo.image = "";
                            fileInfo.icon = path + file;
                        }

                        target.createIcon(fileInfo);
                    }
                    target.cleanUp();
                }
                next(data);
            }else{
                console.warn("Can't read directory, no handler");
            }
        });


    };


    me.createDirectory = function(path,newName){
        console.log("createDirectory");
        var mount = me.getMount(path);
        if  (mount.handler){
            console.error(mount.handler);
            mount.handler.createDirectory(path,newName);
        }
    };

    me.getFile = function(path,asBinaryStream){
        return new Promise(async next => {
            var mount = me.getMount(path);
            if  (mount.handler){
                var file = await mount.handler.getFile(path,asBinaryStream);
                next(file);
            }else{
                // can't get file - no handler
                console.warn("can't get file - no handler");
            }
        });
    };

    // returns the content of the file, default as ascii, optionals as binarystream
    me.readFile = me.getFile;

    me.saveFile = function(){

    };

    me.copyFile = function(file,fromPath,toPath){
        console.log("Copy File",file,fromPath,toPath);
    };

    me.moveFile = function(file,fromPath,toPath){
        return new Promise(async next => {
            console.log("Move File",file,fromPath,toPath);
            var mount = me.getMount(fromPath);
            var targetMount = me.getMount(toPath);
            if (fromPath === "upload"){
                var result = await targetMount.handler.uploadFile(file,toPath);
                next(result);
            }else if (mount.handler){
                // TODO: move accross different volumes
                fromPath = fromPath + '/' + file.name;

                var result = await mount.handler.moveFile(fromPath,toPath);
                next(result);
            }else{
                // can't get file - no handler
                console.warn("can't move file - no handler");
            }
        });






    };

    me.deleteFile = function(){

    };

    me.rename = function(path,newName){
        return new Promise(async next => {
            console.log("Rename",path,newName);
            var mount = me.getMount(path);
            if  (mount.handler){
                var result = await mount.handler.renameFile(path,newName);
                next(result);
            }else{
                // can't get file - no handler
                console.warn("can't rename file - no handler");
            }
        });
    };



   return me;

}();
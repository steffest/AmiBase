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
            volume: volume
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
                    data.directories.forEach(dir => {
                        target.createIcon({
                            type: "drawer",
                            label: dir,
                            path: path + dir + "/"
                        })
                    });
                    for (const file of data.files) {
                        var filetype = await System.detectFileType(file);
                        console.error(filetype);
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


    me.createDirectory = function(){

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

    me.copyFile = function(){

    };

    me.moveFile = function(){

    };

    me.deleteFile = function(){

    };

    me.rename = function(){

    };



   return me;

}();
var Laozi = async function() {
    var me = {};

    var endPoint = "http://www.amibase.com/api/";

    var {default: api} = await import("./api.js");


    me.getDirectory = async function(path,_next){
        return new Promise((resolve,reject) => {
            var next = _next || resolve;
            path = getFilePath(path);
            FetchService.json(endPoint + "file/" + path,function(data){
                next({
                    directories: data.result.directories,
                    files:data.result.files
                });
            });
        });
    };

    me.getFile = function(path,asBinaryStream){
        return new Promise((next) => {
            var url = me.getFileUrl(path);
            console.log("Get File", url);
            if (asBinaryStream){
                FetchService.arrayBuffer(url).then(file => {
                    next(BinaryStream(file,true));
                })
            }else{
                FetchService.get(url).then(file => {
                    next(file);
                })
            }

        });
    };

    me.getFileUrl = function(path){
        path = getFilePath(path);
        return endPoint + "file/" + path;
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

    FileSystem.register("laozi",me);

    return me;

}();
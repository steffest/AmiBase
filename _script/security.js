var Security = function(){
    var me = {};

    var registeredWindows=[];

    /*
    Whenever we launch a new program in a frame, we record the url
    When a program (running inside a frame) wants to access AmiBase related features,
    It has to register itself with he exact same url as launched
     */
    var allowedUrls=[];

    me.registerUrl = function(url,_window){
        if (url.indexOf("://")<0){
            var basePath = window.location.href;
            var p = window.location.href.lastIndexOf("/");
            if (p>=0)  basePath =  basePath.substr(0,p+1);
            url = basePath + url;
        }
        console.log("registering url " + url);
        registeredWindows.unshift({
            id: _window.id,
            url: url,
            window: _window,
            registeredTime: new Date().getTime()
        })
    };

    me.registerWindow = function(url){
       console.log("registering window ", url);
       var w = registeredWindows.find(function(item){return item.url === url});
       if (window){
           return w;
       }else{
           console.error("window for " + url + " not found");
       }
    };

    me.getWindow = function(windowId){
        var w = registeredWindows.find(function(item){return item.id === windowId});
        if (w){
            return w.window;
        }else{
            console.error("window for id " + windowId + " not found");
        }
    };

    me.hasAccess = function(id){

    };

    return me;
};

export default Security();
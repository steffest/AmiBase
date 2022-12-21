let AmiFile = function(config){
    let me = {
        type:"file"
    };

    if (typeof config === "string"){
        let name=config;
        if (name.indexOf("/")>=0) name = name.split("/").pop();
        config = {
            name: name,
            url: config
        };
    }

    me.url = config.url;
    me.name = config.name;
    me.path = config.path;
    me.handler = config.handler;
    me.head = config.head;
    me.filetype= config.filetype;
    me.isAmiFile = true;
    
    if (me.url && me.url.indexOf("://")<0){
        var link = document.createElement("a");
        link.href = me.url;
        me.url = link.href;
    }

    if (!me.path) me.path = me.url;

    return me;
}

export default AmiFile;
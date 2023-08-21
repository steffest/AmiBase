import system from "./system.js";
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

    me.isAmiFile = true;

    if (config.url && config.url.indexOf(":")<0){
        var link = document.createElement("a");
        link.href = config.url;
        config.url = link.href;
    }
    if (!me.path) me.path = config.url;

    me.open = function(){
        system.openFile(me);
    }

    return me;
}

export default AmiFile;
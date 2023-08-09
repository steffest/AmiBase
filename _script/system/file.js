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

    if (!me.path) me.path = me.url;
    
    if (me.url && me.url.indexOf(":")<0){
        var link = document.createElement("a");
        link.href = me.url;
        me.url = link.href;
        // note: this converts the url to lowercase?
    }

    me.open = function(){
        system.openFile(me);
    }

    return me;
}

export default AmiFile;
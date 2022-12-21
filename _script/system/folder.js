var AmiFolder = function(config){
    var me = {
        type:"folder"
    };

    me.name = config.name;
    me.path = config.path;
    me.handler = config.handler;
    me.head = config.head;

    return me;
}

export default AmiFolder;
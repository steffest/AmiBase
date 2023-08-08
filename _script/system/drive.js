var AmiDrive = function(config){
    var me = {
        type:"drive"
    };

    me.name = config.name;
    me.path = config.path;
    me.volume = config.volume;
    me.head = config.head;
    me.data = config.data;

    return me;
}

export default AmiDrive
var BaseFileExtenctions = function(){

    var me = {
        name: "Base File extention mapper",
        version: "0.0.1",
        fileTypes:{
            ADF: {name: "Amiga Disk File", actions:["run"], className:"adf"},
            ADFDOS: {name: "Amiga DOS Disk File", actions:[
                {label: "mount disk", plugin:"adftools"},
                {label: "run in Amiga emulator", plugin:"uae"}
                ], className:"adf"}
        },
        registeredFileExtentions:{
            adf: function(){return FILETYPE.ADF}
        }
    };


    me.detect=function(file){
        if (file.length === 901120){
            var id = file.readString(3,0);
            if (id === "DOS"){
                return FILETYPE.ADFDOS;
            }
        }
    };

    me.handle = function(file,action){
        //console.error("handle",file);
        //return {plugin: "bassoon"};
    };

    if (FileType) FileType.register(me);

    return me;
}();
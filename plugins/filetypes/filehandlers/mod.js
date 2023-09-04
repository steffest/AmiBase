var MUSICMOD = function(){

    var me = {
        name: "mod tracker file",
        version: "0.0.1",
        fileTypes:{
            MOD: {
                name: "Mod Music Module",
                actions:[
                    {label: "Open in Tracker",plugin:"bassoon"},
                    {label: "Play",plugin:"mediaplayer"}
                ],
                classType:"audio",
                className:"mod",
                fileExtensions:["mod"]
            },
            XM: {
                name: "XM Music Module",
                actions:[
                    {label: "Open in Tracker",plugin:"bassoon"},
                    {label: "Play",plugin:"mediaplayer"}
                ],
                classType:"audio",
                className:"mod",
                fileExtensions:["xm"]
            },
            IMPULSETRACKER: {
                name: "Impulse tracker Music Module",
                actions:[{label: "Play",plugin:"mediaplayer"}],
                classType:"audio",className:"mod",
                fileExtensions:["it"]},
            SCREAMTRACKER: {
                name: "ScreamTracker Music Module",
                actions:[{label: "Play",plugin:"mediaplayer"}],
                classType:"audio",
                className:"mod",
                fileExtensions:["s3m"]},
        }
    };


    me.detect=function(file){

        var length = file.length;
		var id;
        if (length>1100){
            id = file.readString(4,1080);
        }

        switch (id){
            case "M.K.":
            case "M!K!":
            case "M&K!":
            case "FLT4":
            case "2CHN":
            case "6CHN":
            case "8CHN":
            case "10CH":
            case "12CH":
            case "14CH":
            case "16CH":
            case "18CH":
            case "20CH":
            case "22CH":
            case "24CH":
            case "26CH":
            case "28CH":
            case "30CH":
            case "32CH":
                return FILETYPE.MOD;
        }
    };

    me.handle = function(file,action){
        console.log("handle mod",file);
        return {plugin: "bassoon"};
    };

    return me;
};

export default MUSICMOD();
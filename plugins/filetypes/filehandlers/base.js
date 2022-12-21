var BaseFileExtensions = function(){

    var me = {
        name: "Base File extention mapper",
        version: "0.0.1",
        fileTypes:{
            ADF: {
                name: "Amiga Disk File",
                actions:[
                    {label: "run", plugin:"uae"},
                ],
                className:"adf",
                fileExtensions:["adf"]
            },
            ADFDOS: {name: "Amiga DOS Disk File", actions:[
                {label: "mount disk", plugin:"adftools"},
                {label: "run in Amiga emulator", plugin:"uae"}
                ], className:"adf",mountFileSystem:{plugin:"AmigaFileSystem",volume:"ADF"}
            },
            HDF: {
                name: "Amiga Harddisk File",
                actions:[{label: "run", plugin:"uae"}],
                className:"hdf"
            },
            PNG: {name: "PNG image", actions:[
                    {label: "view", plugin:"imageviewer"}
                    ],
                className:"png",
                fileExtensions:["png"]
            },
            JPG: {name: "JPG image", actions:[
                    {label: "view", plugin:"imageviewer"}
                ], className:"jpg",
                fileExtensions:["jpg","jpeg"]},
            MP3: {name: "MP3 audio", actions:[
                    {label: "play", plugin:"mediaplayer"}
                ],
                className:"mp3",
                fileExtensions:["mp3"]
            },
            PLS: {name: "Music playlist", actions:[
                    {label: "play", plugin:"mediaplayer"}
                ], className:"pls",
                fileExtensions:["pls"]},
            TXT: {name: "Text File", actions:[
                    {label: "edit", plugin:"notepad"}
                ], className:"txt",
                fileExtensions:["txt"]},
            JS: {name: "JavaScript File", actions:[
                    {label: "edit", plugin:"notepad"}
                ], className:"txt",
                fileExtensions:["js"]},
            JSON: {name: "JSON File", actions:[
                    {label: "edit", plugin:"notepad"}
                ], className:"txt",
                fileExtensions:["json"]},
            HTML: {name: "HTML File", actions:[
                    {label: "edit", plugin:"notepad"}
                ], className:"txt",
                fileExtensions:["htm","html"]},
            CODE: {name: "CODE File", actions:[
                    {label: "edit", plugin:"notepad"}
                ], className:"txt",
                fileExtensions:["c"]},
        }
    };

    /*

    adf: function(){return FILETYPE.ADF},
            png: function(){return FILETYPE.PNG},
            jpg: function(){return FILETYPE.JPG},
            jpeg: function(){return FILETYPE.JPG},
            mp3: function(){return FILETYPE.MP3},
            pls: function(){return FILETYPE.PLS},
            txt: function(){return FILETYPE.TXT}
     */


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

    return me;
};

export default BaseFileExtensions();
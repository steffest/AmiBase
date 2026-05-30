var BaseFileExtensions = function(){

    var me = {
        name: "Base File extention mapper",
        version: "0.0.1",
        fileTypes:{
            ADF: {
                name: "Amiga Disk File",
                actions:[
                    {label: "run", plugin:"uae"},
                    {label: "mount disk", plugin:"filemanager"},
                ],
                classType:"disk",
                className:"adf",
                fileExtensions:["adf"],
                mountFileSystem:{plugin:"AmigaFileSystem",volume:"ADF"}
            },
            ADFDOS: {name: "Amiga DOS Disk File", actions:[
                {label: "mount disk", plugin:"filemanager"},
                {label: "run in Amiga emulator", plugin:"uae"}
                ],
                classType:"disk",
                className:"adf",
                mountFileSystem:{plugin:"AmigaFileSystem",volume:"ADF"}
            },
            HDF: {
                name: "Amiga Harddisk File",
                actions:[
                    {label: "run", plugin:"uae"},
                    {label: "mount disk", plugin:"filemanager"},
                ],
                classType:"disk",
                className:"hdf",
                fileExtensions:["hdf"],
                mountFileSystem:{plugin:"AmigaFileSystem",volume:"HDF"}
            },
            PNG: {name: "PNG image", actions:[
                    {label: "View", plugin:"imageviewer"},
                    {label: "Edit", plugin:"dpaint"}
                ],
                classType:"image",
                className:"png",
                fileExtensions:["png"]
            },
            PDF: {name: "PDF document", actions:[
                    {label: "view", plugin:"iframe"}
                ],
                classType:"image",
                className:"pdf",
                fileExtensions:["pdf"]
            },
            JPG: {name: "JPG image", actions:[
                    {label: "View", plugin:"imageviewer"},
                    {label: "Edit", plugin:"dpaint"}
                ],
                classType:"image",
                className:"jpg",
                fileExtensions:["jpg","jpeg"]},
            GIF: {name: "GIF image", actions:[
                    {label: "View", plugin:"imageviewer"},
                    {label: "Edit", plugin:"dpaint"}
                ],
                classType:"image",
                className:"gif",
                fileExtensions:["gif"]},
            PSD: {name: "Photoshop image", actions:[
                    {label: "Edit", plugin:"dpaint"}
                ],
                classType:"image",
                className:"psd",
                fileExtensions:["psd"]},
            MP3: {name: "MP3 audio", actions:[
                    {label: "Play", plugin:"mediaplayer"},
                    {label: "Edit", plugin:"audiomass"}
                ],
                classType:"audio",
                className:"mp3",
                fileExtensions:["mp3"]
            },
            M4A: {name: "MP4 audio", actions:[
                    {label: "Play", plugin:"mediaplayer"},
                    {label: "Edit", plugin:"audiomass"}
                ],
                classType:"audio",
                className:"m4a",
                fileExtensions:["m4a"]
            },
            MP4: {name: "MP4 video", actions:[
                    {label: "Play", plugin:"videoplayer"}
                ],
                classType:"video",
                className:"mp4",
                fileExtensions:["mp4"]
            },
            PLS: {name: "Music playlist", actions:[
                    {label: "play", plugin:"mediaplayer"}
                ],
                classType:"audio",
                className:"pls",
                fileExtensions:["pls"]},
            DOCX: {name: "Word Document", actions:[
                    {label: "Edit", plugin:"document"}
                ],
                className:"txt",
                fileExtensions:["docx", "doc", "odt"]},
            XLSX: {name: "Excel Spreadsheet", actions:[
                    {label: "Edit", plugin:"document"}
                ],
                className:"txt",
                fileExtensions:["xlsx", "xls", "ods", "csv"]},
            PPTX: {name: "PowerPoint Presentation", actions:[
                    {label: "Edit", plugin:"document"}
                ],
                className:"txt",
                fileExtensions:["pptx", "ppt", "odp"]},
            TXT: {name: "Text File", actions:[
                    {label: "edit", plugin:"notepad"}
                ], className:"txt",
                fileExtensions:["txt"]},
            JS: {name: "JavaScript File", actions:[
                    {label: "edit", plugin:"notepad"}
                ],
                classType:"code",
                className:"txt",
                fileExtensions:["js"]},
            JSON: {name: "JSON File", actions:[
                    {label: "Edit", plugin:"notepad"}
                ],  classType:"code",className:"txt",
                fileExtensions:["json"]},
            HTML: {name: "HTML File", actions:[
                    {label: "Edit", plugin:"monaco"}
                ], className:"txt",
                fileExtensions:["htm","html"]},
            CODE: {name: "CODE File", actions:[
                    {label: "edit", plugin:"monaco"}
                ],  classType:"code",className:"txt",
                fileExtensions:["c"]},
            MARKDOWN: {name: "MarkDown File", actions:[
                    {label: "edit", plugin:"monaco"}
                ],  classType:"code",className:"txt",
                fileExtensions:["md"]},
            LHA:{
                name: "LHA Archive",
                actions:[{label: "Extract",plugin:"filemanager"}],
                classType:"archive",
                className:"lha",
                fileExtensions:["lha"],
                mountFileSystem:{plugin:"Archiver",volume:"ARCHIVE"}
            },
            RAR:{
                name: "RAR Archive",
                actions:[{label: "Extract",plugin:"filemanager"}],
                classType:"archive",
                className:"rar",
                fileExtensions:["rar"],
                mountFileSystem:{plugin:"Archiver",volume:"ARCHIVE"}
            },
            ZIP:{
                name: "ZIP Archive",
                actions:[
                    {label: "mount", plugin:"filemanager"},
                    {label: "Extract", plugin:"filemanager"}
                ],
                classType:"archive",
                className:"zip",
                fileExtensions:["zip"],
                mountFileSystem:{plugin:"ZipFileSystem",volume:"ZIP"}
            }
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
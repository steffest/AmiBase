var adftools_plugin_init = function(window){
    console.error("adftools here");

    Applications.registerApplicationActions("adftools",{
        "openfile":function(attachment){
            console.error("ADF open file");
            var file = attachment.file;
            console.log(file);

            if (file){
                var info = ADF.setDisk(file);
                ADFTOOLS.listFolder(ADF.readRootFolder(),window);
            }

        }
    });

    if (window.onload) window.onload(window);

};

var ADFTOOLS = function(){
    var me={};

    var currentFolder;

    me.listFolder = function(folder,window){

        currentFolder = folder;
        window.clear();

        var path = ADF.getInfo().label;
        if (folder.parent){
            //container.appendChild(createListItem({
            //    sector: folder.parent,
            //    name: "..",
            //    typeString: "DIR"
            //}));
            //path += "/" + folder.name;
        }

        //el("disklabel").innerHTML = path;


        function sortByName(a,b) {
            if (a.name < b.name)
                return -1;
            if (a.name > b.name)
                return 1;
            return 0;
        }
        folder.folders.sort(sortByName);
        folder.files.sort(sortByName);


        folder.folders.forEach(function(f){
            var item = {
                label: f.name,
                type: "drawer",
                onOpen: function(_window){
                    me.listFolder(ADF.readFolderAtSector(f.sector),_window)
                }
            };
            window.createIcon(item);
        });

        folder.files.forEach(function(f){
            var item = {
                label: f.name,
                type: "file",
                onOpen: async function(){
                    console.log("handle ADF file");
                    var file = ADF.readFileAtSector(f.sector,true);
                    var fileInfo = await System.inspectBinary(file.content.buffer,f.name);
                    fileInfo.path = "ADF";
                    console.error(fileInfo);
                    System.openFile(fileInfo);
                },
                getAttachment: async function(next){
                    var file = ADF.readFileAtSector(f.sector,true);
                    var fileInfo = await System.inspectBinary(file.content.buffer,f.name);
                    fileInfo.path = "ADF";
                    if (next){
                        next(fileInfo);
                    }else{
                        return fileInfo;
                    }
                    
                }
            };
            window.createIcon(item);
        });
        window.cleanUp();

        //showInfo(folder);
    };




    return me;
}();


var FileRequester = function(app){
    var me = {};
    var sideBar;
    var mainpanel;
    var parent;
    var container;

    me.open = function(){
        parent = Desktop.createWindow("request File");
        parent.setSize(600,400);
        container = $div("filerequester");
        parent.setContent(container);
        sideBar = undefined;
        mainpanel = undefined;

        listMounts()
        
        /*async function dir(){
            var list = await FileSystem.getDirectory("DH0:");
            console.error(list);
        }

        dir();*/
        
    }

    function listMounts(){
        if (!sideBar){
            sideBar = $div("mountsidebar");
            container.appendChild(sideBar)
        }

        var mounts = FileSystem.getMounts();
        Object.keys(mounts).forEach(key => {
            var mount = mounts[key];
            var btn = $div("listitem","",mount.name + " (" + key + ")");
            btn.onclick = function(){
                listDir(key + ":");
            }
            sideBar.appendChild(btn);
        })
    }

    async function listDir(folder){
        if (typeof folder === "string") folder={path:folder};
        var mount = FileSystem.getMount(folder.path);
        if (!mainpanel){
            mainpanel = $div("filerequestermainpanel");
            container.appendChild(mainpanel)
        }
        mainpanel.innerHTML = "";

        var list = await FileSystem.getDirectory(folder,true,true);
        list.directories.forEach(dir=>{
            var item = $div("listitem dir","",dir.name);
            item.onclick = function(){
                listDir(dir);
            }
            mainpanel.appendChild(item);
        })

        list.files.forEach(file => {
            var item = $div("listitem file","",file.name);
            item.onclick = function(){
                System.openFile(file);
            }
            mainpanel.appendChild(item);
        });
        
        console.error(list);
    }

    return me;
}();


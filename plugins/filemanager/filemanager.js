import $ from "../../../_script/util/dom.js";
import SelectBox from "../../../_script/ui/selectBox.js";

let FileManager = function(){
    var me = {};
    var sideBar;
    var infoBar;
    var mainPanel;
    var amiWindow;
    let amiBase;
    var container;
    let viewMode = "icons";
    let currentFolder;
    let currentFile;

    me.init = function(containerWindow,context){
        amiWindow = containerWindow;
        amiWindow.setSize(600,400);
        let toolBar = $(".panel.toolbar",
            toolButton("file","Show as preview",()=>{}),
            toolButton("icons","Show as icons",()=>{
                currentFolder.viewMode = viewMode = "icons";
                me.openFolder(currentFolder);
            }),
            toolButton("list","Show as list",()=>{
                currentFolder.viewMode = viewMode = "list";
                me.openFolder(currentFolder);
            },8),
            toolButton("info","Show Info Panel",()=>{
                infoBar.classList.toggle("hidden");
                setUI();
                displayFileInfo();
            }),
            toolButton("sidebar","Show Navigation Panel",()=>{
                sideBar.classList.toggle("hidden");
                setUI();
            })
        );


        sideBar=$(".panel.full",{style:{width:"200px", right: "unset"}});
        infoBar=$(".infobar.hidden");
        mainPanel=$(".panel.full.transparent.list.overflow",{
            onClick:()=>{
                containerWindow.getSelectedIcons().forEach(function(item){
                    item.deActivate();
                });
                amiWindow.activate();
            },
            onDrag: (touchData)=>selectBox.update(touchData),
            onUp: ()=>selectBox.remove()
        });
        container = $(".content.panel.full.filemanager",toolBar,sideBar,infoBar,mainPanel);

        toolBar.style.height = '30px';
        toolBar.style.bottom = "unset";

        mainPanel.style.top = toolBar.style.height;
        sideBar.style.top = toolBar.style.height;
        infoBar.style.top = toolBar.style.height;

        let selectBox = SelectBox({
            parent: mainPanel,
            onSelect:(x,y,w,h)=>{
                let icons = containerWindow.getIcons();
                icons.forEach(function(icon){
                    if (icon.left>x && icon.left<x+w && icon.top>y && icon.top<y+h){
                        if (!icon.isActive()){
                            icon.activate(true);
                            icon.moveToTop();
                        }
                    }else{
                        icon.deActivate(true);
                    }
                });
            }
        });

        amiWindow.cleanUp = function(){
            var left= 10 ;
            var top= 20;
            let grid = amiWindow.getGridSize();
            let gridWidth = grid.width;
            let gridHeight = grid.height;

            var w = mainPanel.offsetWidth - gridWidth;

            let icons = amiWindow.getIcons();
            icons.forEach(function(icon){
                if (icon){
                    icon.setPosition(left,top);
                    left += gridWidth;
                    if (left>w){
                        top+=gridHeight;
                        left = 10;
                    }
                }
            })
        }

        amiWindow.setContent(container);
        //amiWindow.enableSelection(mainPanel);
        if (context)amiBase = context;
        setUI();
        listMounts();
    }

    me.openFolder = async function(folder){
        console.error("openFolder",folder);
        if (typeof folder === "string") folder={path:folder};
        currentFolder = folder;

        mainPanel.innerHTML = "";
        amiWindow.clearIcons();
        amiWindow.setCaption(folder.name || folder.path);
        let list = folder.getContent ? await folder.getContent() : await amiBase.getDirectory(folder,true);
        console.error(list);

        viewMode = currentFolder.viewMode || viewMode;
        if (list){
            list.forEach(object => {
                if (viewMode === "icons"){
                    if (object.type === "folder"){
                        amiWindow.createIcon(object,mainPanel);
                    }
                    if (object.type === "file" || object.type === "link"){
                        amiWindow.createIcon(object,mainPanel);
                    }
                }else{
                    let item = $(".listitem." + object.type,{
                        onClick:()=>{
                            if (object.type === "folder"){
                                me.openFolder(object);
                            }else{
                                currentFile = object;
                                displayFileInfo();
                            }
                        },
                        onDoubleClick:()=>{console.error("doubleClick");object.open()},
                        onDragStart:()=>{
                            let pos = item.getBoundingClientRect();
                            return [amiWindow.createDragItem({
                                object:object,
                                label:object.name,
                                icon:object.type,
                                left:pos.left,
                                top:pos.top,
                            })];
                        },
                        globalDrag:true
                    },object.name);
                    mainPanel.appendChild(item);
                }
            })

            if (viewMode === "icons"){
                amiWindow.cleanUp();
            }
        }
    }

    me.dropFile = function(file){
        console.error("dropFile",file);
    }

    me.hideSideBar = function(){
        sideBar.classList.add("hidden");
        setUI();
    }

    function listMounts(){
        var mounts = amiBase.getMounts();
        Object.keys(mounts).forEach(key => {
            var mount = mounts[key];
            sideBar.appendChild($(".button",{onClick:()=>me.openFolder(key + ":")},mount.name + " (" + key + ")"));
        })
    }

    async function displayFileInfo(){
        if (infoBar.classList.contains("hidden") || !currentFile) return;

        infoBar.innerHTML = "";
        let info = await amiBase.getObjectInfo(currentFile);
        console.error(info);
        infoBar.appendChild($("h4",info.name));

        for (let key in info){
            if (key === "name") continue;
            infoBar.appendChild($("div",key + ": " + info[key]));
        }

        infoBar.appendChild($(".button",{onClick:()=>currentFile.open()}, "Open"));

    }


    let toolRight = 1;
    function toolButton(icon,hint,onClick,offset){
        let button = $(".button.tool.light",{
            onClick:onClick,
            style:{
                right:toolRight + "px",
            },
            title:hint
        },$(".icon",{
            style:{
                backgroundImage:"url(plugins/filemanager/icons/"+icon+".png)"
            }
        }));
        toolRight += 22 + (offset || 0);
        return button;
    }

    function setUI(){
        let left = 0;
        if (!sideBar.classList.contains("hidden")){
            left += 200;
        }
        if (!infoBar.classList.contains("hidden")){
            infoBar.style.left = left + "px";
            left += 100;
        }

        mainPanel.style.left = left + "px";
    }

    return me;
};

export default FileManager;


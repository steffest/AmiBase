import $ from "../../_script/util/dom.js";

let LinkEditor = ()=>{
    let me = {};
    let amiBase;
    let panel;
    let currentWindow;
    let currentFile;

    me.init = (amiWindow,host)=>{
        amiWindow.setContent(createUI());
        amiWindow.setCaption("Link Editor");
        if (host) amiBase = host;
        amiWindow.setSize(584,400);
        currentWindow = amiWindow;
    }

    let createUI = function(){
        return $(".content.full",{},
            $(".panel.full",
                {style:{width:"100px", right: "unset"}}
            ),
            $(".panel.full",
                {style:{left:"100px"}},
                $(".panel.full.transparent.overflow.borderbottom",
                    {style:{bottom:"35px"}},
                    panel = $(".form")
                ),
                $(".panel.buttons.bottom",
                    $(".button.inline",{onClick:close}, "Cancel"),
                    $(".button.inline",{onClick:save}, "Save"),
                )
            )
        );
    }

    function renderProperty(name,property,parent,onUpdate,options){
        let value = parent[property] || "";
        let input;
        if (options){
            input = $("select",options.map(option=>$("option",{value:option},option)));
        }else{
            input = $("input",{type: name==="pass"?"password":"text"});
        }
        input.value = value;
        input.oninput = (e)=>{parent[property] = e.target.value;onUpdate()}
        return $(".property.panel",$(".label",name),input);
    }

    async function save(){
        if (currentFile) amiBase.writeFile(currentFile);
        close();
    }
    function close(){
        currentWindow.close();
    }

    me.openFile = async function(file){
        console.log("openFile from LinkEditor",file);
        panel.innerHTML = "";
        currentFile = file;

        let onUpdate = ()=>{
            currentFile = file;
        }

        let editor = $(".form",
            renderProperty("Label","label",file,onUpdate),
            renderProperty("Handler","handler",file,onUpdate),
            renderProperty("URL","url",file,onUpdate),
            renderProperty("icon","icon",file,onUpdate)
        );
        panel.appendChild(editor);
    }

    return me;
}

export default LinkEditor();
import $ from "../../_script/util/dom.js";
let Settings = ()=>{
    let me = {}
    let amiBase;
    let panel;
    let settings = {};

    me.init = (amiWindow,host)=>{
        console.log("init settings",amiWindow,host);
        return new Promise(async (next)=>{
            if (host){
                amiBase = host;
                settings = await amiBase.user.getAmiSettings();
                console.error("settings",settings)
            }

            amiWindow.setContent(createUI());

            var menu = [
                {label: "Settings",items:[
                    {label: "About"},
                    {label: "Save",action:()=>save()}
                ]}
            ];
            amiWindow.setMenu(menu,true);



            amiWindow.setSize(584,400);

            next();
        })

    }

    let createUI = function(){


        let container = $(".settingseditor.content.full",$(".panel.full",{style:{width:"200px", right: "unset"}},
            $(".button.big",{onClick:()=>{showSetting("mounts")}},"Mounts"),
            $(".button.big",{onClick:()=>{showSetting("other")}},"Other"),
            ),$(".panel.full",{style:{left:"200px"}},panel=$(".panel.full.transparent.overflow.borderbottom",{style:{bottom:"35px"}}),
            $(".panel.buttons.bottom",$(".button.inline",{onClick:save}, "Save"))
            ))

        showSetting("mounts");

        //let container = document.createElement("div");
        //container.className = "editor";
        //container.appendChild(edit);
        return container;
    }


    async function save(){
        console.log("save",settings);
        amiBase.user.setAmiSettings(settings);
    }

    function showSetting(setting,values){
        panel.innerHTML = "";
        values = values || settings[setting] || [];

        switch (setting){
            case "mounts":
                panel.appendChild($("h3",setting));
                values.forEach((mount,index)=>{
                     let onUpdate = ()=>{
                         mount.type = "drive";
                         values[index] = mount;
                         settings[setting] = values;
                     }
                    let editor = $(".form",$(".divider.panel"),
                        renderProperty("Label","label",mount,onUpdate),
                        renderProperty("Volume","volume",mount,onUpdate),
                        renderProperty("Handler","handler",mount,onUpdate,["laozi","s3","dropbox","other"]),
                        renderProperty("URL","url",mount,onUpdate),
                        renderProperty("login","login",mount,onUpdate),
                        renderProperty("pass","pass",mount,onUpdate),
                    );
                    panel.appendChild(editor);
                });

                $(".button.inline",{parent:panel,onClick:()=>{values.push({});showSetting(setting,values)}},"Add Mount");
                break;
        }
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

    // example


    /*

    {
  "mount": [
    {
      "type": "filesystem",
      "label": "Home",
      "volume": "DH",
      "handler": "laozi",
      "url": "https://www.stef.be/foto/api"
    }
  ]
}
     */

    return me;
}

export default Settings();
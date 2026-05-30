import $, {uuid} from "../../_script/util/dom.js";
let Settings = ()=>{
    let me = {}
    let amiBase;
    let panel;
    let settings = {};
    let currentWindow;

    me.init = (amiWindow,host)=>{
        console.log("init settings",amiWindow,host);
        return new Promise(async (next)=>{
            if (host){
                amiBase = host;
                settings = await amiBase.user.getAmiSettings();
            }

            amiWindow.setContent(createUI());
            currentWindow = amiWindow;

            var menu = [
                {label: "Settings",items:[
                    {label: "About"},
                    {label: "Save",action:()=>save()}
                ]}
            ];
            amiWindow.setMenu(menu,true);



            amiWindow.setSize(584,400);

            //plugin:wallpaper

            console.error(amiBase);

            next();
        })

    }

    let createUI = function(){


        let container = $(".settingseditor.content.full",
            $(".panel.tabs.transparent.full",
                {style:{width:"200px", right: "unset"}},
                $(".button.active",{onClick:()=>{showSetting("mounts")}},"Mounts"),
                $(".button",{onClick:()=>{showSetting("UI")}},"Desktop"),
                $(".button",{onClick:()=>{amiBase.launchProgram("plugin:wallpaper")}},"Wallpaper"),
                $(".button",{onClick:()=>{showSetting("other")}},"Other"),
            ),
            $(".panel.transparent.full",
                {style:{left:"200px"}},
                panel=$(".panel.full.transparent.overflow.borderbottom",{style:{bottom:"35px"}}),
                $(".panel.buttons.bottom",
                    $(".button.inline",{onClick:save}, "Save")
                )
            )
        )

        showSetting("mounts");

        //let container = document.createElement("div");
        //container.className = "editor";
        //container.appendChild(edit);
        return container;
    }


    async function save(){
        console.log("save",settings);

        if (settings.mounts){

            for (let i=0;i<settings.mounts.length;i++){
                let mount = settings.mounts[i];
                if (mount.handler==="friend"){
                    let pass = mount.pass;
                    if (pass && pass.indexOf("HASHED")!==0){
                        let hash = await amiBase.util.sha256(pass);
                        mount.pass = "HASHED" + hash;
                    }
                }
            }
        }

        amiBase.user.setAmiSettings(settings);
        currentWindow.close();
    }

    function persistUiSettings(){
        amiBase.user.setAmiSettings(settings);
    }

    function setRamDriveVisibility(showRamDrive){
        if (amiBase && amiBase.desktop && amiBase.desktop.refreshRamDriveDisplay){
            amiBase.desktop.refreshRamDriveDisplay(showRamDrive);
        }
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
                    let editor = $(".form",$(".divider.panel",$(".close",{
                        onClick:()=>{
                            values.splice(index,1);
                            showSetting(setting,values)
                        }},"X")),
                        renderProperty("Label","label",mount,onUpdate),
                        renderProperty("Volume","volume",mount,onUpdate),
                        renderProperty("Handler","handler",mount,onUpdate,["laozi","s3","dropbox","friend","local","rad","other"]),
                        renderProperty("URL","url",mount,onUpdate),
                        renderProperty("login","login",mount,onUpdate),
                        renderProperty("pass","pass",mount,onUpdate),
                    );
                    panel.appendChild(editor);
                });

                $(".button.inline",{parent:panel,onClick:()=>{values.push({id:uuid()});showSetting(setting,values)}},"Add Mount");
                break;

            case "UI":
                panel.appendChild($("h3","Desktop"));
                let showRamDrive = settings.displayRamDrive !== false;
                let ramDriveToggle = $("input",{type:"checkbox"});
                ramDriveToggle.checked = showRamDrive;
                ramDriveToggle.onchange = function(e){
                    settings.displayRamDrive = !!e.target.checked;
                    persistUiSettings();
                    setRamDriveVisibility(settings.displayRamDrive);
                }

                panel.appendChild($(".property.panel",
                    $(".label","Display RAM Drive"),
                    ramDriveToggle
                ));
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
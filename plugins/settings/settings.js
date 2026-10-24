import $, {uuid} from "../../_script/util/dom.js";
let Settings = ()=>{
    let me = {}
    let amiBase;
    let panel;
    let settings = {};
    let currentWindow;
    let fileTypes = [];
    let fileAssociationsChanged = false;
    let fileAssociations = {};
    let associationsStatus;

    me.init = (amiWindow,host)=>{
        console.log("init settings",amiWindow,host);
        return new Promise(async (next)=>{
            if (host){
                amiBase = host;
                settings = await amiBase.user.getAmiSettings();
                fileTypes = await amiBase.getFileTypes();
                fileAssociations = structuredClone(settings.fileAssociations || {});
                fileAssociationsChanged = false;
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



            amiWindow.setSize(740,500);

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
                $(".button",{onClick:()=>{showSetting("system")}},"System"),
                $(".button",{onClick:()=>{showSetting("fileAssociations")}},"File associations"),
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

        if (fileAssociationsChanged){
            let associations = fileAssociations;
            for (let actions of Object.values(associations)){
                let labels = new Set();
                for (let action of actions){
                    let label = action.label.trim();
                    if (!label || !action.plugin || labels.has(label.toLowerCase())){
                        showSetting("fileAssociations");
                        associationsStatus.textContent = "Each action needs a unique name and an application. Check your changes before saving.";
                        return;
                    }
                    labels.add(label.toLowerCase());
                    action.label = label;
                }
            }
            await amiBase.setFileAssociations(associations);
            settings.fileAssociations = associations;
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
        panel.classList.remove("association-panel");
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
                        renderCheckbox("System drive (execute s/startup-sequence)","systemDrive",mount,onUpdate),
                    );
                    panel.appendChild(editor);
                });

                $(".button.inline",{parent:panel,onClick:()=>{values.push({id:uuid()});showSetting(setting,values)}},"Add Mount");
                break;

            case "fileAssociations":
                renderFileAssociations();
                break;

            case "UI":
                panel.appendChild($("h3","Desktop"));
                let showRamDrive = settings.displayRamDrive === true;
                let ramDriveCheckbox = $("input",{type:"checkbox"});
                ramDriveCheckbox.checked = showRamDrive;
                ramDriveCheckbox.onchange = function(e){
                    settings.displayRamDrive = !!e.target.checked;
                    persistUiSettings();
                    setRamDriveVisibility(settings.displayRamDrive);
                }
                let ramDriveSlider = $("span.nm-toggle-slider");
                ramDriveSlider.setAttribute("aria-hidden","true");
                panel.appendChild($(".network-row",
                    $("label.nm-toggle",
                        ramDriveCheckbox,
                        ramDriveSlider,
                        $("strong","Display RAM Drive")
                    )
                ));
                break;

            case "system": {
                panel.appendChild($("h3","System"));

                if (!window.electronBridge){
                    panel.appendChild($("p","Keyboard layout and WiFi settings are only available when AmiBase is running inside the Electron kiosk shell."));
                    break;
                }

                panel.appendChild($("h4","Keyboard Layout"));
                const KEYBOARD_LAYOUTS = [
                    {code:"us", label:"English (US)"},
                    {code:"gb", label:"English (UK)"},
                    {code:"fr", label:"French (AZERTY)"},
                    {code:"be", label:"Belgian (AZERTY)"},
                    {code:"de", label:"German (QWERTZ)"},
                    {code:"ch", label:"Swiss German (QWERTZ)"},
                    {code:"es", label:"Spanish"},
                    {code:"it", label:"Italian"},
                    {code:"nl", label:"Dutch"},
                    {code:"se", label:"Swedish"},
                    {code:"no", label:"Norwegian"},
                    {code:"dk", label:"Danish"},
                    {code:"pt", label:"Portuguese"},
                ];
                let keyboardStatus = $("span",{style:{marginLeft:"8px",fontSize:"12px",color:"#888"}});
                let keyboardSelect = $("select",
                    KEYBOARD_LAYOUTS.map(l=>$("option",{value:l.code},l.label))
                );
                keyboardSelect.onchange = async ()=>{
                    keyboardStatus.textContent = "Applying...";
                    let result = await window.electronBridge.setKeyboardLayout(keyboardSelect.value);
                    keyboardStatus.textContent = result.ok ? "Applied" : ("Failed: " + result.reason);
                };
                panel.appendChild($(".property.panel",$(".label","Layout"),keyboardSelect,keyboardStatus));

                panel.appendChild($("h4","Sound"));
                let outputStatus = $("span",{style:{marginLeft:"8px",fontSize:"12px",color:"#888"}});
                let outputSelect = $("select");
                panel.appendChild($(".property.panel",$(".label","Output"),outputSelect,outputStatus));

                let volumeStatus = $("span",{style:{marginLeft:"8px",fontSize:"12px",color:"#888"}});
                let volumeSlider = $("input",{type:"range",min:"0",max:"100",step:"1"});
                let muteButton = $(".button.inline",{onClick:toggleMute}, "Mute");
                panel.appendChild($(".property.panel",$(".label","Volume"),volumeSlider,muteButton,volumeStatus));

                outputSelect.onchange = async ()=>{
                    outputStatus.textContent = "Applying...";
                    let result = await window.electronBridge.setAudioDevice(parseInt(outputSelect.value,10));
                    outputStatus.textContent = result.ok ? "" : ("Failed: " + result.reason);
                    if (result.ok) refreshVolume();
                };

                async function refreshOutputDevices(){
                    let result = await window.electronBridge.getAudioDevice();
                    if (!result.ok){
                        outputStatus.textContent = "Unavailable: " + result.reason;
                        outputSelect.disabled = true;
                        return;
                    }
                    if (!result.devices.length){
                        outputStatus.textContent = "No audio hardware detected";
                        outputSelect.disabled = true;
                        return;
                    }
                    outputSelect.replaceChildren(
                        ...result.devices.map(d=>$("option",{value:d.index},d.name))
                    );
                    outputSelect.value = result.current;
                }
                refreshOutputDevices();

                let volumeDebounce;
                volumeSlider.oninput = ()=>{
                    clearTimeout(volumeDebounce);
                    volumeDebounce = setTimeout(async ()=>{
                        let result = await window.electronBridge.setVolume(parseInt(volumeSlider.value,10));
                        volumeStatus.textContent = result.ok ? "" : ("Failed: " + result.reason);
                        if (result.ok) muteButton.textContent = result.muted ? "Unmute" : "Mute";
                    },150);
                };

                async function toggleMute(){
                    let result = await window.electronBridge.toggleMute();
                    if (!result.ok){
                        volumeStatus.textContent = "Failed: " + result.reason;
                        return;
                    }
                    muteButton.textContent = result.muted ? "Unmute" : "Mute";
                    if (result.volume!==null && result.volume!==undefined) volumeSlider.value = result.volume;
                }

                async function refreshVolume(){
                    let result = await window.electronBridge.getVolume();
                    if (!result.ok){
                        volumeStatus.textContent = "Volume unavailable: " + result.reason;
                        volumeSlider.disabled = true;
                        muteButton.disabled = true;
                        return;
                    }
                    volumeSlider.value = result.volume===null ? 0 : result.volume;
                    muteButton.textContent = result.muted ? "Unmute" : "Mute";
                }
                refreshVolume();

                panel.appendChild($("h4","WiFi"));
                let wifiStatusLine = $("p","");
                let wifiHardwareNotice = $("div",{style:{display:"none"}});
                let wifiList = $("div");
                let scanButton = $(".button.inline",{onClick:scanWifi}, "Scan for Networks");
                panel.appendChild(wifiStatusLine);
                panel.appendChild(wifiHardwareNotice);
                panel.appendChild(scanButton);
                panel.appendChild(wifiList);

                async function refreshWifiStatus(){
                    let result = await window.electronBridge.wifiStatus();
                    if (!result.ok){
                        wifiStatusLine.textContent = "Status unavailable: " + result.reason;
                        return;
                    }
                    let wifiDevice = result.devices.find(d=>d.type==="wifi");
                    wifiStatusLine.textContent = wifiDevice
                        ? ("WiFi: " + wifiDevice.state + (wifiDevice.connection ? " (" + wifiDevice.connection + ")" : ""))
                        : "No WiFi device found";

                    if (wifiDevice){
                        wifiHardwareNotice.style.display = "none";
                    }else{
                        await checkWifiHardware();
                    }
                }
                refreshWifiStatus();

                // Distinguishes "no WiFi hardware at all" from "WiFi chip
                // present but not supported by any driver in this image" --
                // see main.js's KNOWN_UNSUPPORTED_WIFI table, populated from
                // real hardware findings (docs/confirmed-hardware.md).
                async function checkWifiHardware(){
                    let result = await window.electronBridge.checkWifiHardware();
                    if (!result.ok || !result.unsupported){
                        wifiHardwareNotice.style.display = "none";
                        return;
                    }
                    let fixArea = $("textarea",{
                        readOnly:true,
                        style:{width:"100%",height:"90px",fontFamily:"monospace",fontSize:"11px",boxSizing:"border-box"}
                    });
                    fixArea.value = result.fix;
                    wifiHardwareNotice.innerHTML = "";
                    wifiHardwareNotice.appendChild($("p",{style:{fontWeight:"bold"}}, "Known limitation: " + result.name));
                    wifiHardwareNotice.appendChild($("p", result.reason));
                    wifiHardwareNotice.appendChild($("p", "To enable it yourself (installs Broadcom's proprietary driver -- not included by default so this image stays fully open-source):"));
                    wifiHardwareNotice.appendChild(fixArea);
                    wifiHardwareNotice.style.display = "";
                }

                async function scanWifi(){
                    wifiList.innerHTML = "";
                    scanButton.disabled = true;
                    scanButton.textContent = "Scanning...";
                    let result = await window.electronBridge.wifiScan();
                    scanButton.disabled = false;
                    scanButton.textContent = "Scan for Networks";
                    if (!result.ok){
                        wifiList.appendChild($("p","Scan failed: " + result.reason));
                        return;
                    }
                    result.networks.forEach(network=>{
                        let secured = network.security && network.security !== "--";
                        let actionArea = $("span",{style:{marginLeft:"8px"}});
                        wifiList.appendChild($(".property.panel",
                            $(".label",network.ssid + " (" + network.signal + "%)" + (secured ? " (secured)" : "")),
                            actionArea
                        ));
                        actionArea.appendChild($(".button.inline",{onClick:()=>startConnect(network,actionArea,secured)}, "Connect"));
                    });
                }

                // window.prompt() throws "prompt() is not supported" inside
                // Electron (see electron-shell/HANDOVER.md) -- an inline
                // password field replaces it here instead of a native dialog.
                function startConnect(network,actionArea,secured){
                    if (!secured){
                        doConnect(network.ssid,"",actionArea);
                        return;
                    }
                    actionArea.innerHTML = "";
                    let passwordInput = $("input",{type:"password", placeholder:"Password", autocomplete:"off"});
                    let join = ()=>doConnect(network.ssid,passwordInput.value,actionArea);
                    passwordInput.addEventListener("keydown",(e)=>{ if (e.key==="Enter") join(); });
                    actionArea.appendChild(passwordInput);
                    actionArea.appendChild($(".button.inline",{onClick:join}, "Join"));
                    passwordInput.focus();
                }

                async function doConnect(ssid,password,actionArea){
                    actionArea.innerHTML = "";
                    actionArea.appendChild($("span","Connecting..."));
                    let result = await window.electronBridge.wifiConnect(ssid,password);
                    actionArea.innerHTML = "";
                    actionArea.appendChild($("span",result.ok ? "Connected" : ("Failed: " + result.reason)));
                    refreshWifiStatus();
                }

                panel.appendChild($("h4","Host System Info"));
                let infoStatus = $("span",{style:{marginLeft:"8px",fontSize:"12px",color:"#888"}});
                let infoTextarea = $("textarea",{
                    readOnly:true,
                    style:{width:"100%",height:"180px",fontFamily:"monospace",fontSize:"11px",boxSizing:"border-box"}
                });
                let infoRefreshButton = $(".button.inline",{onClick:refreshSystemInfo}, "Refresh");
                panel.appendChild($(".property.panel",infoRefreshButton,infoStatus));
                panel.appendChild(infoTextarea);

                async function refreshSystemInfo(){
                    infoStatus.textContent = "Gathering...";
                    let result = await window.electronBridge.getSystemInfo();
                    if (!result.ok){
                        infoStatus.textContent = "Failed: " + result.reason;
                        return;
                    }
                    infoTextarea.value = result.text;
                    infoStatus.textContent = "";
                }
                refreshSystemInfo();

                break;
            }
        }
    }

    function renderFileAssociations(){
        panel.classList.add("association-panel");
        panel.appendChild($("h3","File associations"));
        panel.appendChild($("p.association-help","Link actions to apps. Select the launch icon for the default action. Save to apply."));
        let search = $("input.association-search",{type:"text",placeholder:"Search format or extension",ariaLabel:"Search file formats"});
        let formats = $("div.association-formats.list",{role:"listbox",ariaLabel:"File format"});
        let selectedFormat;
        let editor = $("div.association-editor");
        associationsStatus = $("p.association-status",{role:"status"});
        panel.append($("div.association-layout.ui-master-detail",
            $("div.association-sidebar.ui-stack",search,formats),
            $("div.association-main",editor,associationsStatus)));
        let applications = amiBase.getRegisteredApplications().filter(app=>app.plugin)
            .sort((a,b)=>a.name.localeCompare(b.name));

        function update(actions){
            fileAssociations[selectedFormat] = actions;
            fileAssociationsChanged = true;
            associationsStatus.textContent = "Unsaved changes";
        }

        function renderActions(){
            editor.replaceChildren();
            let type = fileTypes.find(type=>type.key === selectedFormat);
            if (!type) return;
            let overrides = fileAssociations;
            let actions = (Object.hasOwn(overrides,type.key) ? overrides[type.key] : type.defaultActions).map(action=>({...action}));
            let restore = $("button.association-icon",{type:"button",title:"Restore defaults",ariaLabel:"Restore defaults",onclick:()=>{
                delete fileAssociations[type.key];
                fileAssociationsChanged = true;
                renderActions();
                associationsStatus.textContent = "Defaults restored. Save to apply.";
            }},"↻");
            let add = $("button.association-icon",{type:"button",title:"Add action",ariaLabel:"Add action",onclick:()=>{
                actions.push({label:"",plugin:""}); update(actions); renderActions();
                editor.querySelector(".association-action:last-child input[type=text]").focus();
            }},"+");
            editor.appendChild($("div.association-toolbar.ui-toolbar",$("h4",type.name),restore,add));
            if (!actions.length) editor.appendChild($("p","No actions configured. Add an action to open this format."));
            let defaultGroup = uuid();
            actions.forEach((action,index)=>{
                let label = $("input",{type:"text",value:action.label,placeholder:"View, Edit, Play…",ariaLabel:"Action name"});
                let application = $("select",{ariaLabel:"Application"},$("option",{value:""},"Choose application…"));
                applications.forEach(app=>application.appendChild($("option",{value:app.plugin},app.name)));
                if (action.plugin && !applications.some(app=>app.plugin === action.plugin)){
                    application.appendChild($("option",{value:action.plugin},action.plugin + " (current plugin)"));
                }
                application.value = action.plugin || "";
                label.oninput = ()=>{action.label = label.value; update(actions)};
                application.onchange = ()=>{action.plugin = application.value; update(actions)};
                let defaultInput = $("input",{type:"radio",name:defaultGroup,checked:index===0,ariaLabel:"Use " + (action.label || "action") + " as default",onchange:()=>{
                    actions.unshift(actions.splice(index,1)[0]); update(actions); renderActions();
                    editor.querySelector("input[type=radio]").focus();
                }});
                let makeDefault = $("label.association-default",{title:index===0 ? "Default action" : "Set as default"},defaultInput,$("span","↗"));
                let remove = $("button.association-icon.association-remove",{type:"button",title:"Remove action",ariaLabel:"Remove action",onclick:()=>{
                    actions.splice(index,1); update(actions); renderActions();
                }},"×");
                editor.appendChild($("div.association-action",makeDefault,label,application,remove));
            });
        }

        function selectFormat(key){
            selectedFormat = key;
            Array.from(formats.children).forEach(item=>{
                let selected = item.dataset.key === key;
                item.classList.toggle("selected",selected);
                item.setAttribute("aria-selected",String(selected));
                item.tabIndex = selected ? 0 : -1;
            });
            associationsStatus.textContent = fileAssociationsChanged ? "Unsaved changes" : "";
            renderActions();
        }

        function filterFormats(){
            let query = search.value.trim().toLowerCase();
            let matches = fileTypes.filter(type=>(type.name + " " + type.key + " " + type.fileExtensions.join(" ")).toLowerCase().includes(query));
            formats.replaceChildren(...matches.map(type=>{
                let item = $("button.listitem",{type:"button",role:"option",onclick:()=>selectFormat(type.key)},
                    type.name + (type.fileExtensions.length ? " (." + type.fileExtensions.join(", .") + ")" : ""));
                item.dataset.key = type.key;
                return item;
            }));
            selectFormat(matches.some(type=>type.key === selectedFormat) ? selectedFormat : matches[0]?.key);
            if (!matches.length) editor.appendChild($("p","No matching formats."));
        }
        search.oninput = filterFormats;
        formats.onkeydown = (event)=>{
            let items = Array.from(formats.children);
            let index = items.indexOf(document.activeElement);
            let next;
            if (event.key === "ArrowDown") next = Math.min(index + 1,items.length - 1);
            if (event.key === "ArrowUp") next = Math.max(index - 1,0);
            if (event.key === "Home") next = 0;
            if (event.key === "End") next = items.length - 1;
            if (next === undefined || !items[next]) return;
            event.preventDefault();
            selectFormat(items[next].dataset.key);
            items[next].focus();
        };
        filterFormats();
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

    function renderCheckbox(name,property,parent,onUpdate){
        let input = $("input",{type:"checkbox"});
        input.checked = !!parent[property];
        input.onchange = (e)=>{parent[property] = !!e.target.checked;onUpdate()}
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

import fileSystem from "../../_script/system/filesystem.js";
import $ from "../../_script/util/dom.js";
import desktop from "../../_script/ui/desktop.js";
import {getToken as getGoogleToken} from "../googleDrive/connect.js";

let AddMount = ()=>{
    let me = {};
    let amiBase;
    let poller;

    me.init = (containerWindow,context)=>{
        amiBase = context;
        let w = containerWindow;
        w.setCaption("Add Storage: mount a drive");
        w.setSize(390,300);

        let mountList = [
            {name: "Local Folder",icon: "hdd.svg",action: fileSystem.mountLocalDrive,disabled: !window.showDirectoryPicker},
            {name: "Dropbox",icon: "dropboxb.svg",type:"dropbox",action:connectDropBox},
            {name: "Google Drive",icon: "google-drive.svg",type:"googleDrive",action:connectGoogleDrive,keepOpen:true},
            {name: "Amazon S3",icon: "amazon-s3.svg",type:"s3",fields:[{label:"S3 Bucket name",name:"url",placeholder: "e.g. my-bucket"}],usePass: true},
            {name: "Laozi",icon: "laozi.svg",type:"loazi",usePass: true,fields:[{label:"Laozi API endpoint",name:"url",placeholder: "e.g. https://my.server.com/api/"}]},
            {name: "Friend OS",icon: "friendos.svg",type:"friend",volume:"FRIEND",fields:[{label:"Friend Server url",name:"url",placeholder: "e.g. https://me.friendsky.cloud"}],usePass:true,info:"Your password is not stored, we only store the encrypted hash needed to collect a Friend Access Token."},
            {name: "RAD Drive",icon: "rad.svg",type:"rad",volume:"RAD"},
        ]

        let list = $(".content.full",{
            style:{
                padding: "20px"
            }
        });

        mountList.forEach(program=>{
            list.appendChild($(".button.square.big.transparent",{
                onClick:()=>{

                    if (program.action){
                        program.action(w);
                        if (!program.keepOpen) w.close();
                        return;
                    }
                    let form;
                    let inputs = [];

                    let panel = $(".content.full.addmount",
                        $(".icon.mount",{style:{backgroundImage: "url(../../_img/icons/" + program.icon + ")"}}),
                        form = $(".form"),
                        $(".buttons.panel.bottom",
                            $(".button.inline",{onClick:async()=>{

                                if (program.disabled){
                                    w.close();
                                    return;
                                }

                                let data = {};
                                inputs.forEach(input=>{
                                    data[input.name] = input.value;
                                });

                                data.label = data.label || program.name;
                                data.handler = program.type;
                                data.volume = program.volume || "DH";
                                data.type = "drive";

                                if (data.handler==="friend"){
                                    let pass = data.pass;
                                    if (pass && pass.indexOf("HASHED")!==0){
                                        let hash = await amiBase.util.sha256(pass);
                                        data.pass = "HASHED" + hash;
                                    }
                                }

                                let settings = await amiBase.user.getAmiSettings();
                                settings.mounts = settings.mounts || [];
                                settings.mounts.push(data);

                                console.log(settings);

                                amiBase.desktop.addObject(data);
                                amiBase.desktop.cleanUp();
                                w.close();

                                await amiBase.user.setAmiSettings(settings);

                                }},"Save"),
                            $(".button.inline",{onClick:w.close},"Cancel")
                        )
                    );

                    let fields = [{label:"Mount Name",name:"label",placeholder: "e.g. My Drive"}];

                    if (program.fields) fields = fields.concat(program.fields);

                    if (program.usePass){
                        fields.push({label:"Login",name:"login",placeholder: ""});
                        fields.push({label:"Password",name:"pass",placeholder: "****",type:"password"});
                    }

                    if (program.disabled){
                        fields = [];
                        program.info = "This drive type is currently disabled.";
                    }


                    fields.forEach(field=>{
                        field.type = field.type || "text";
                        let input;
                        form.appendChild($(".property",$("label",field.label),input = $("input",{type: field.type, placeholder: field.placeholder, autocomplete: "off", name: field.name})));
                        inputs.push(input);
                    });

                    if (program.info){
                        form.appendChild($("p",program.info));
                    }


                    w.setContent(panel);

                }},
                $(".icon",{style:{backgroundImage: "url(../../_img/icons/" + program.icon + ")"}}),
                $("label",program.name)
            ));
        });

        w.setContent(list);
    }

    function connectDropBox(){
        let client_id = "ttx9sdz1rbzocgs";
        let redirectUri = "https://www.amibase.com/token/";
        console.error(window.location.href);
        if (window.location.href.indexOf("://localhost")>=0){
            let port = window.location.port;
            redirectUri = "http://localhost:"+ port +"/AmiBase/token/index.html";
        }
        // note: this is using a short lived token as requesting a long lived token requires a server side component to handle the token exchange with the App secret
        let url = "https://www.dropbox.com/oauth2/authorize?client_id=" + client_id + "&response_type=token&redirect_uri=" + redirectUri;

        localStorage.removeItem("exchangeToken");
        localStorage.removeItem("exchangeCode");

        let popup = window.open(url,"auth","popup,width=500,height=600");

        clearInterval(poller);
        poller = setInterval(()=>{
            console.log("polling");
            let token = localStorage.getItem("exchangeToken");
            let code = localStorage.getItem("exchangeCode");
            if (token){
                clearInterval(poller);
                localStorage.removeItem("exchangeToken");
                if (token.indexOf("error")>=0){

                }else{
                    addMount(token);
                }

            }else if (code){
                clearInterval(poller);
                localStorage.removeItem("exchangeCode");

                console.error("code",code);
            }
        },500);

        async function addMount(token){
            let mount = {
                label: "Dropbox",
                handler: "dropbox",
                type: "drive",
                volume: "DH",
                pass: token
            }

            let settings = await amiBase.user.getAmiSettings();
            settings.mounts = settings.mounts || [];
            settings.mounts.push(mount);
            await amiBase.user.setAmiSettings(settings);
            amiBase.desktop.addObject(mount);
            amiBase.desktop.cleanUp();

            popup.close();
        }

    }

    function connectGoogleDrive(w){
        const DEFAULT_CLIENT_ID = "212903246400-03rupf7rrm0tom86ev9oiocb7acdq8iv.apps.googleusercontent.com";

        let labelInput, clientIdInput, statusEl;

        let panel = $(".content.full.addmount",
            $(".icon.mount",{style:{backgroundImage: "url(../../_img/icons/google-drive.svg)"}}),
            $(".form",
                $(".property",
                    $("label","Mount Name"),
                    labelInput = $("input",{type:"text", placeholder:"e.g. My Google Drive", value:"Google Drive", autocomplete:"off", name:"label"})
                ),
                $(".property",
                    $("label","Google Client ID"),
                    clientIdInput = $("input",{type:"text", placeholder:"Amibase Client (default)", value:DEFAULT_CLIENT_ID, autocomplete:"off", name:"login"})
                ),
                $("p",{style:{fontSize:"11px",color:"#888",margin:"4px 0 0"}},"Leave Client ID as-is to use the shared Amibase app. Enter your own for a private Google Cloud project.")
            ),
            statusEl = $("p",{style:{color:"#c44",padding:"0 12px",minHeight:"18px"}}),
            $(".buttons.panel.bottom",
                $(".button.inline",{onClick:async()=>{
                    let clientId = (clientIdInput.value || "").trim() || DEFAULT_CLIENT_ID;
                    let label = (labelInput.value || "").trim() || "Google Drive";
                    statusEl.textContent = "Opening Google authorization…";

                    let token = await getGoogleToken(clientId);
                    if (!token){
                        statusEl.textContent = "Authorization failed or was cancelled.";
                        return;
                    }

                    let mount = {
                        label: label,
                        handler: "googleDrive",
                        type: "drive",
                        volume: "GD",
                        pass: token,
                        login: clientId
                    };

                    let settings = await amiBase.user.getAmiSettings();
                    settings.mounts = settings.mounts || [];
                    settings.mounts.push(mount);
                    await amiBase.user.setAmiSettings(settings);
                    amiBase.desktop.addObject(mount);
                    amiBase.desktop.cleanUp();
                    w.close();
                }},"Connect to Google Drive"),
                $(".button.inline",{onClick:w.close},"Cancel")
            )
        );

        w.setContent(panel);
    }

    return me;
}

export default AddMount;

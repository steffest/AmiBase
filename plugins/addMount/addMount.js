import fileSystem from "../../_script/system/filesystem.js";
import $ from "../../_script/util/dom.js";
import desktop from "../../_script/ui/desktop.js";

let AddMount = ()=>{
    let me = {};
    let amiBase;

    me.init = (containerWindow,context)=>{
        amiBase = context;
        let w = containerWindow;
        w.setCaption("Add Storage: mount a drive");
        w.setSize(390,300);

        let mountList = [
            {name: "Local Folder",icon: "hdd.svg",action: fileSystem.mountLocalDrive,disabled: !window.showDirectoryPicker},
            {name: "Dropbox",icon: "dropboxb.svg",type:"dropbox",disabled: true},
            {name: "Amazon S3",icon: "amazon-s3.svg",type:"s3",fields:[{label:"S3 Bucket name",name:"url",placeholder: "e.g. my-bucket"}],usePass: true},
            {name: "Laozi",icon: "laozi.svg",type:"loazi",usePass: true,fields:[{label:"Laozi API endpoint",name:"url",placeholder: "e.g. https://my.server.com/api/"}]},
            {name: "Friend OS",icon: "friendos.svg",type:"friend",volume:"FRIEND",fields:[{label:"Friend Server url",name:"url",placeholder: "e.g. https://me.friendsky.cloud"}],usePass:true,info:"Your password is not stored, we only store the encrypted hash needed to collect a Friend Access Token."},
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
                        program.action();
                        w.close();
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

    return me;
}

export default AddMount;

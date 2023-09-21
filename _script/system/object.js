import amiDrive from "./drive.js";
import amiFolder from "./folder.js";
import amiFile from "./file.js";
import amiLink from "./link.js";

let objectType={
    drive: amiDrive,
    folder: amiFolder,
    file: amiFile,
    link: amiLink,
}

let AmiObject = function(config){
    if (config.isAmiObject) return config; // already wrapped

    let type = objectType[config.type];

    if (!type){
        console.error("Unknown Ami type: " + config.type);
        type = objectType.file;
    }

    let me = type(config);
    me.isAmiObject = true;

    for (let key in config){
        me[key] = config[key];
    }

    me.icon = config.image;
    me.iconActive = config.image2;
    me.name = me.name || me.label;

    return me;
}


export default AmiObject;

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

let getIcon = function(config){
    return config.image;
    // TODO icons according to file type
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

    me.icon = getIcon(config);
    me.name = me.name || me.label;

    /*me.open = function(){
        switch(me.type){
            case "drive":
                desktop.openDrive(me);
                break;
            case "folder":
                desktop.openFolder(me);
                break;
            case "file":
                system.openFile(me);
                break;
            case "link":
                system.launchProgram(config);
                break;
            case "url":
                console.error("DEPRECATED: url type is deprecated, use link instead");
                desktop.launchUrl(config);
                break;
            default:
                console.error("Unknown Ami type: " + me.type);
        }
    }*/

    return me;
}


export default AmiObject;

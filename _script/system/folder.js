import desktop from "../ui/desktop.js";
import fileSystem from "./filesystem.js";
import file from "./file.js";

var AmiFolder = function(config){
    var me = {
        type:"folder"
    };

    me.open = function(){
        desktop.openFolder(me);
    }

    me.getContent = function(){
        return new Promise(next=>{
            if (me.items){
                next(fileSystem.wrap(me.items));
                return;
            }

            if (me.handler){
                console.error("REWORK");
                next([]);
                //if (typeof me.handler === "string"){
                //    applications.load((me.handler.indexOf(":")<0?"plugin:":"") + me.handler).then(next);
                //}else{
                //    next(me.handler(me));
                //}
            } else {
                fileSystem.getDirectory(me,true).then(next);
            }
        });

    }

    return me;
}

export default AmiFolder;
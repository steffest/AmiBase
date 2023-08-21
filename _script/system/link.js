import desktop from "../ui/desktop.js";
import system from "./system.js";

let amiLink = function(){
    let me = {
        type:"link"
    };

    me.open = function(){
        if (me.handler){
            system.launchProgram(me.handler);
        }else{
            if (me.url && me.url.indexOf("plugin:") === 0){
                system.launchProgram(me.url);
            }else{
                desktop.launchUrl(me);
            }
        }

    }
    return me;
}

export default amiLink;
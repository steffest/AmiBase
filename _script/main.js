import system from "./system/system.js";
import desktop from "./ui/desktop.js";
import input from "./input.js";
import ui from "./ui/ui.js";
import settings from "./settings.js";
import user from "./user.js";
import network from "./system/network.js";

var Main=function(){
    var me = {};
    var initDone;

    me.init = async function(){
        // TODO: wait until userkey is set ...

        setTimeout(async function(){
            await system.loadEnvironment();
            await desktop.loadTheme(await user.getTheme());
            input.init();
            desktop.init();
            ui.init();

            await user.init();
            console.log("user",user);
            network.init();

            desktop.loadContent(settings.initialContent,settings.mounts);

            desktop.cleanUp();
            initDone = true;
        },100);


    };

    window.addEventListener("DOMContentLoaded",me.init);

    return me;
}();
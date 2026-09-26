import system from "./system/system.js";
import desktop from "./ui/desktop.js";
import input from "./input.js";
import ui from "./ui/ui.js";
import settings from "./settings.js";
import user from "./user.js";
import network from "./system/network.js";
import {runStartupSequences} from "./system/boot.js";

var Main=function(){
    var me = {};
    var initDone;

    if (window.location.href.indexOf("amibase")>=0 && window.location.protocol==="http:"){
        window.location.href = window.location.href.replace("http:","https:");
    }

    me.init = async function(){

        let hasEnvironment = await system.loadEnvironment();
        if (!hasEnvironment){
            showSplash();
            return;
        }

        await desktop.loadTheme(await user.getTheme());
        input.init();
        desktop.init();
        ui.init();

        await user.init();
        console.log("user",user);
        // Await loadContent so all mounts (incl. system drives) are registered
        // and their handlers wired before we scan for startup-sequences.
        // Otherwise runStartupSequences could race the content/mounts fetch and
        // intermittently find no system drive to boot.
        await desktop.loadContent(settings.initialContent,settings.mounts,"desktop:");
        desktop.cleanUp();
        await network.init();
        network.connectFromUrlInvite();
        await runStartupSequences();
        initDone = true;
    };

    async function showSplash(){
        try{
            let response = await fetch("splash/index.html");
            if (!response.ok) throw new Error("HTTP " + response.status);
            document.body.innerHTML = await response.text();
        }catch(e){
            console.error("Could not load splash.html",e);
            document.body.innerHTML = "Amibase";
        }
    }

    window.Main = me;
    window.addEventListener("DOMContentLoaded",me.init);

    return me;
}();

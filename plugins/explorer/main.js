import amiIcon from "../../v2/_script/ui/icon.js";
import amiObject from "../../v2/_script/system/object.js";
import mainMenu from "../../v2/_script/ui/mainmenu.js";

let Explorer = ()=>{
    let me = {
        name:"explorer"
    };
    let currentWindow;
    let amiBase;
    let icons = [];

    me.init = function(containerWindow,context){
        currentWindow = containerWindow;
        amiBase = context;
        return new Promise((next)=>{
            var container = containerWindow.getInner();
            container.innerHTML = "zeze"
            next();
        });
    }

    me.onMessage = function(message,data){
        console.error("explorer onMessage",message,data);
        if (message === "setroot"){
            currentWindow.setCaption(data.name);
            showFolder(data.items);
        }
    }

    me.getSelectedIcons = function(){
        let result = [];
        icons.forEach(function(icon){
            if (icon && icon.isActive()) result.push(icon);
        });
        return result;
    }

    me.cleanUp = function(){
        let x = 20;
        let y = 20;
        icons.forEach(function(icon){
            icon.setPosition(x,y);
            y+=70;
        });
    }

    me.deActivateContent = function(){
        icons.forEach(function(icon){
            if (icon) icon.deActivate();
        });
        mainMenu.hideMenu();
    }

    function showFolder(items){
        let container = currentWindow.getInner();
        container.innerHTML = "";
        items.forEach(item=>{
            console.error(item);

            let icon = amiIcon(item);
            icon.parent = me;
            icon.parentWindow = currentWindow;
            icons.push(icon);
            container.appendChild(icon.element);

        });

        me.cleanUp();

    }



    return me;
}

export default Explorer();
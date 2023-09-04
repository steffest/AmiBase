import $, {uuid} from '../util/dom.js';
import desktop from "./desktop.js";
let Notification = function(){
 let me = {};
 let container;
 let notifications = {};

    me.init=function(){

    }


 me.show=function(config){
    if (!container) createUi();
    console.error("show notification");

    if (config.id){
        let notification = notifications[config.id];
        if (notification){
            if (config.label) notification.label.textContent = config.label;
            if (config.text) notification.text.textContent = config.text;
            if (config.progress){
                if (!notification.progress){
                    notification.progress = $(".progress",
                        {parent: notification.element},
                        notification.progressText = $(".text"),
                        $(".bar",notification.bar = $(".inner"))
                    );
                }
                if (config.progressText) notification.progressText.textContent = config.progressText;
                notification.bar.style.width = (config.progress*100) + "%";
            }
        }
    }else{
        let notification = {id:uuid()};
        notification.element = $(".notification",
            {parent:container},
            notification.label = $("label",config.label || ""),
            notification.text=$(".text",config.text || ""));

        notification.timeout = setTimeout(()=>{
            container.classList.add("active");
        },100);

        notifications[notification.id] = notification;
        return notification.id;
    }
 }

 me.hide=function(config){
    if (typeof config === "string") config = {id:config};
     let notification = notifications[config.id];
        if (notification){
            if (notification.timeout) clearTimeout(notification.timeout);
            delete notifications[config.id];
            notification.element.remove();
        }
     if (Object.keys(notifications).length === 0){
         container.classList.remove("active");
     }
 }

 function createUi(){
    container = $(".notificationcontainer",{

    });
    desktop.getScreen().appendChild(container);
 }

 return me;
}();

export default Notification;


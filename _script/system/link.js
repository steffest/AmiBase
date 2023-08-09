import desktop from "../ui/desktop.js";

let amiLink = function(){
    let me = {
        type:"link"
    };

    me.open = function(){
        desktop.launchUrl(me);
    }
    return me;
}

export default amiLink;
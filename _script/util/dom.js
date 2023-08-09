export default function dom(tagName,options){
    let elm;
    let opt = {};
    let index = 1;
    let hasParent = false;
    if (typeof options === "object" && !Array.isArray(options) && !(options instanceof Element)){
        opt = options;
        index++;
    }

    if (tagName instanceof Element){
        elm = tagName;
    }else{
        // allow tag.class and tag#id constructors
        if (tagName.indexOf(".")>=0){
            let classNames = tagName.split(".");
            tagName = classNames.shift();
            opt.className = ((opt.className || "") + " " +  classNames.join(" ")).trim();
        }
        if (tagName.indexOf("#")>=0){
            let p = tagName.split("#");
            tagName = p.shift();
            opt.id = p[0];
        }
        tagName = tagName||"div";
        elm = document.createElement(tagName);
    }


    for (let key in opt) {
        if (key === 'parent'){
            opt[key].appendChild(elm);
            hasParent = true;
            continue;
        }

        // custom amibase stuff
        if (key === 'onClick') addClass(elm,opt,"handle");
        if (key === 'info') addClass(elm,opt,"info");
        // end custom stuff

        elm[key] = opt[key];
    }

    for (; index < arguments.length; index++) {
        append(elm, arguments[index]);
    }

    return elm;
}

export function $div(className,id,content){
    var elm = document.createElement("div");
    if (className) elm.className = className;
    if (id) elm.id = id;
    if (content) {
        if (typeof content === "string"){
            elm.innerHTML = content;
        }else{
            elm.appendChild(content);
        }
    }
    return elm;
}

export function getCursorPosition(elm, event) {
    const rect = elm.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return{x:x,y:y};
}

export function getElementPosition(el) {
    var rect = el.getBoundingClientRect(),
        scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
        scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return { top: rect.top + scrollTop, left: rect.left + scrollLeft }
}


export function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function cleanString(s){
    s=s.split(" ").join("").toLowerCase();
    return s;
}


export function loadCss(src,onload){
    var head  = document.getElementsByTagName('head')[0];
    var link  = document.createElement('link');
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = src;
    if (onload) link.onload = onload;
    head.appendChild(link);
}


let append = (parent, child) => {
    if (child) {
        if (Array.isArray(child)) {
            child.map(sub => append(parent, sub));
        } else {
            if (typeof child === "string") child = document.createTextNode(child);
            parent.appendChild(child);
        }
    }
};

let addClass=(elm,opt,className)=>{
    elm.classList.add(className);
    if (opt.className) opt.className += " " + className;
}

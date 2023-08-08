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

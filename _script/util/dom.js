function $div(className,id,content){
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

function getCursorPosition(elm, event) {
    const rect = elm.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return{x:x,y:y};
}

function getElementPosition(el) {
    var rect = el.getBoundingClientRect(),
        scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
        scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return { top: rect.top + scrollTop, left: rect.left + scrollLeft }
}

// clones an element including any canvas content
function cloneElement(elm){
    var clone = elm.cloneNode(true);

    var canvas = elm.querySelectorAll("canvas");
    var canvasClone = clone.querySelectorAll("canvas");
    for (var i = 0, max = canvas.length; i<max; i++){
        canvasClone[i].getContext("2d").drawImage(canvas[i],0,0);
    }
    return clone;
}


function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

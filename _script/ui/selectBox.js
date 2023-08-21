import $ from "../util/dom.js";
let selectBox = function (config){
    let me = {}
    let isActive = false;
    let elm;
    let parent = config.parent;

    me.init=(touchData)=>{
        let distance = Math.max(Math.abs(touchData.deltaX),Math.abs(touchData.deltaY));
        if (distance>5){
            elm = parent.querySelector(":scope > .selectbox");
            if (!elm){
                elm = $(".selectbox");
                parent.appendChild(elm);
            }
            isActive = true;
        }
    }

    me.update=(touchData)=>{
        if (!isActive) me.init(touchData);
        if (!isActive) return;
        let box = parent.getBoundingClientRect();
        let w = touchData.deltaX;
        let h = touchData.deltaY;
        let x = touchData.startX-box.left;
        let y = touchData.startY-box.top;
        if (w<0){
            w=-w;
            x-=w;
        }
        if (h<0){
            h=-h;
            y-=h;
        }

        elm.style.width = w + "px";
        elm.style.height = h + "px";
        elm.style.left = x + "px";
        elm.style.top = y + "px";
        if (!elm.classList.contains("active")){
            elm.classList.add("active");
            elm.style.zIndex = 100000;
        }

        config.onSelect(x,y,w,h);
    }

    me.remove=()=>{
        if (isActive){
            elm.classList.remove("active");
            isActive = false;
        }
    }

    me.isActive=()=>isActive;

    return me;
}

export default selectBox;
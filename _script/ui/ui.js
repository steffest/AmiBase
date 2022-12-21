import mouse from "./mousepointer.js";
import mainMenu from "./mainmenu.js";
import popupMenu from "./popupMenu.js";
import input from "../input.js";
import {$div} from "../util/dom.js";
import settings from "../settings.js";
import desktop from "./desktop.js";

let UI = function(){

    var me = {};

    var touchData = {};
    touchData.touches = [];
    touchData.mouseWheels = [];
    var UIData = {};
    var currentDragItem;
    var currentDropTarget;
    var globalDragItem;
    var globalDropTimer;
    var currentResizeItem;
    var layout=[];
    var lastUpdateCall;
    var UIChanges=[];
    var dragItems=[];
    var resizeItems=[];
    var isDragging;
    var isResizing;
    var isSelecting;
    var selectingComponent;

    me.init = function(){
        mouse.init();
        mainMenu.init();

        document.body.addEventListener("mousedown",handleTouchDown);
        document.body.addEventListener("mouseup",handleTouchUp);
        document.body.addEventListener("mousemove",handleTouchMove,true);

        document.body.addEventListener("touchstart", handleTouchDown,false);
        document.body.addEventListener("touchmove", handleTouchMove,false);
        document.body.addEventListener("touchend", handleTouchUp,false);

        document.body.addEventListener("dragenter", handleDragenter, false);
        document.body.addEventListener("dragover", handleDragover, false);
        document.body.addEventListener("drop", handleDrop, false);

        document.body.addEventListener('contextmenu', function(event){
            if (input.isCtrlDown) return;
            event.preventDefault();

            if (settings.mainMenu && settings.mainMenu.length){
                popupMenu.show({
                    x: event.clientX,
                    y: event.clientY,
                    items: settings.mainMenu[0].items
                });
            }else{
                popupMenu.hide();
            }
            
        });

        render();


    };

    me.onClick = function(component,handler){
        component.onclick = function(event){
            event.preventDefault();
            handler(event);
        }
        component.addEventListener("touchstart",function(event){
            event.preventDefault();
            handler(event);
        });
    }

    me.onDoubleClick = function(component,handler){
        component.ondblclick = handler;
        component.addEventListener("touchstart",function(event){
            var now = new Date().getTime();
            var lastClick = component.lastClickTime || 0;
            var elapsed = now-lastClick;
            component.lastClickTime = now;
            if (elapsed<400){
                handler(event);
            }
        });
    }

    me.enableDrag = function(component,copy){
        var handle =  component.dragHandle || component.element;
        if (handle){
            handle.addEventListener("mousedown",startDrag);
            handle.addEventListener("touchstart",startDrag);
        }


        function startDrag(event) {
            if (component.activate) component.activate(); // bring to front;
            //if (component.deActivateContent) component.deActivateContent(); // but deactivate inner content


            if (component.type === "icon"){
                dragItems = component.parent.getSelectedIcons();
            }else{
                dragItems.push(component);
            }

            isDragging = true;

            var touch = getTouch(event);

            if (copy){

                clearTimeout(globalDropTimer);
                globalDragItem = document.getElementById("globalDragItem");
                if (globalDragItem) globalDragItem.remove();
                globalDragItem = $div("","globalDragItem");


                dragItems.forEach(function(item){
                    globalDragItem.appendChild(item.clone());
                    if (!settings.useDelayedDrag){
                        item.ghost();
                        globalDragItem.classList.add("visible");
                    }
                });

                globalDragItem.startX = 0;
                globalDragItem.startY = 0;
                globalDragItem.style.transform = "translate(0px,0px)";


                document.body.appendChild(globalDragItem);
                currentDragItem = globalDragItem;
            }

            event.preventDefault();
            event.stopPropagation();
            dragItems.forEach(function(item){
                item.startLeft = item.left;
                item.startTop = item.top;
            });
            UIData.startDragX = touch.clientX;
            UIData.startDragY = touch.clientY;
        }

    };

    me.enableDrop = function(element,onDrop){
        element.classList.add("droptarget");
        element.onDrop = onDrop;
    };

    me.handleGlobalDrag = function(x,y,target){
        if (currentDropTarget && currentDropTarget.classList.contains("droptargetactive")){
            currentDropTarget.classList.remove("droptargetactive");
        }
        currentDropTarget = target.closest(".droptarget");
        if (currentDropTarget){
            currentDropTarget.classList.add("droptargetactive");
        }

        var deltaX =  x + globalDragItem.startX;
        var deltaY =  y + globalDragItem.startY;

        globalDragItem.style.transform = "translate(" + deltaX + "px," + deltaY + "px)";
        globalDragItem.deltaX = deltaX;
        globalDragItem.deltaY = deltaY;

        if (settings.useDelayedDrag){
            if ((Math.abs(deltaX)>5 || Math.abs(deltaY)>5) && !globalDragItem.classList.contains("visible")){
                globalDragItem.classList.add("visible");
                dragItems.forEach(function(item){
                    item.ghost();
                });
            }
        }
    };

    me.handleDrop = function(){
        if (currentDropTarget){
            currentDropTarget.classList.remove("droptargetactive");

            if (currentDropTarget.onDrop){
                currentDropTarget.onDrop(dragItems,globalDragItem.deltaX,globalDragItem.deltaY);
            }
        }

        dragItems.forEach(function(item){
            item.show();
        });

        if (settings.useDelayedDrag){
            globalDragItem.classList.remove("visible");
            globalDropTimer = setTimeout(function(){
                if (globalDragItem){
                    globalDragItem.remove();
                    globalDragItem = undefined;
                }
            },400);
        }else{
            globalDragItem.remove();
            globalDragItem = undefined;
        }

        currentDropTarget = undefined;



    };

    me.enableResize = function(component){
        var handle =  component.resizeHandle || component.element;
        if (handle){
            handle.addEventListener("mousedown",startResize);
            handle.addEventListener("touchstart",startResize);
        }


        function startResize(event) {
            event.preventDefault();

            var touch = getTouch(event);

            resizeItems.push(component);
            isResizing = true;

            component.deActivate();
            component.startHeight = component.element.offsetHeight;
            component.startWidth = component.element.offsetWidth;
            component.startDragX = touch.clientX;
            component.startDragY = touch.clientY;
        }

    };

    me.enableSelection = function(component,element){
        if (element) {
            element.addEventListener("mousedown",startSelection);
            element.addEventListener("mousemove",updateSelection);
            element.addEventListener("touchstart",startSelection);
            element.addEventListener("touchmove",updateSelection);
        }

        function startSelection(event){
           if (event.target === element){

               var touch = getTouch(event);

               isSelecting = true;
               selectingComponent = component;
               component.startSelectX = touch.clientX;
               component.startSelectY = touch.clientY;
           }
        }

        function updateSelection(event){
            if (isSelecting){

                var touch = getTouch(event);

                selectingComponent.selectX = touch.clientX;
                selectingComponent.selectY = touch.clientY;
                var w = selectingComponent.selectX-selectingComponent.startSelectX;
                var h = selectingComponent.selectY-selectingComponent.startSelectY;

                selectingComponent.setSelectBox(selectingComponent.startSelectX,selectingComponent.startSelectY,w,h);
            }

        }
    };

    function getTouch(event){
        var touch = event;
        if (event.touches && event.touches.length>0){
            var touches = event.changedTouches;
            touch = touches[0];
        }
        return touch;
    }

    var getTouchIndex = function (id) {
        for (var i=0; i < touchData.touches.length; i++) {
            if (touchData.touches[i].id === id) {
                return i;
            }
        }
        return -1;
    };

    function handleTouchDown(event){
        if (event.touches && event.touches.length>0){
            var touches = event.changedTouches;
            for (var i=0; i < touches.length; i++) {
                var touch = touches[i];
                initTouch(touch.identifier,touch.pageX,touch.pageY);
            }
        }else{
            var touchIndex = getTouchIndex("notouch");
            if (touchIndex>=0) touchData.touches.splice(touchIndex, 1);
            initTouch("notouch",event.pageX,event.pageY);
        }

        var inpopup = event.target.closest(".popupmenu");
        if (!inpopup){
            popupMenu.hide();
        }

        mouse.isDown = true;
        document.body.classList.add("mousedown");

        function initTouch(id,x,y){

        }
    }

    function handleTouchMove(event){
        var touch = getTouch(event);

        mouse.update(touch);

        if (isDragging){
            event.preventDefault();

            if (globalDragItem){
                var x = touch.clientX - UIData.startDragX;
                var y = touch.clientY - UIData.startDragY;
                me.handleGlobalDrag(x,y,event.target);

                if (currentDropTarget && currentDropTarget.classList.contains("autogrid")){
                    var item = dragItems[0];
                    item.parent.reOrderIcon(item,touch.clientX,touch.clientY);
                }
            }else{
                dragItems.forEach(function(item){
                    var x = touch.clientX - UIData.startDragX;
                    var y = touch.clientY - UIData.startDragY;
                    UIChanges.push({
                        element: item,
                        position:true,
                        left: item.startLeft + x,
                        top: item.startTop + y,
                    });
                });
            }
        }

        if (isResizing){
            event.preventDefault();

            resizeItems.forEach(function(item){
                var x = touch.clientX - item.startDragX;
                var y = touch.clientY - item.startDragY;
                UIChanges.push({
                    element: item,
                    resize:true,
                    width: item.startWidth + x,
                    height: item.startHeight + y,
                });
            });
        }
    }

    function handleTouchUp(event){
        if (event && event.touches){
            var touches = event.changedTouches;

            for (var i=0; i < touches.length; i++) {
                var touch = touches[i];
                endTouch(getTouchIndex(touch.identifier));
            }
        }else{
            endTouch(getTouchIndex("notouch"));
        }

        isDragging = false;
        isResizing = false;
        isSelecting = false;

        resizeItems.forEach(function(item){
            item.activate(true);
        });
        dragItems.forEach(function(item){
            if (item.onStopDrag) item.onStopDrag();
        });

        if (globalDragItem) me.handleDrop();
        if (selectingComponent) selectingComponent.removeSelectBox();

        dragItems=[];
        resizeItems=[];
        mouse.isDown = false;
        document.body.classList.remove("mousedown");

        selectingComponent = undefined;

        function endTouch(touchIndex){
            if (touchIndex>=0){

            }
        }
    }

    function handleDragenter(e) {
        e.stopPropagation();
        e.preventDefault();
    }

    function handleDragover(e) {
        e.stopPropagation();
        e.preventDefault();
    }

    function handleDrop(e) {
        e.stopPropagation();
        e.preventDefault();

        var dt = e.dataTransfer;
        var files = dt.files;

        desktop.handleUpload(files);
    }



    function render(){
        UIChanges.forEach(function(change){
            if (change.position){
                change.element.setPosition(change.left,change.top);
            }
            if (change.resize){
                change.element.setSize(change.width,change.height);
            }
        });

        UIChanges=[];
        requestAnimationFrame(render);
    }

    return me;

};

export default UI();
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
    var UIData = {}; // what's the difference with touchData?
    var currentClickTarget;
    var currentDragItem;
    var currentDropTarget;
    var globalDragItem;
    var globalDropTimer;
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

        document.body.style.touchAction = "none";
        document.body.addEventListener("pointerdown",handleTouchDown);
        document.body.addEventListener("pointerup",handleTouchUp);
        document.body.addEventListener("pointermove",handleTouchMove);

        document.body.addEventListener("dragenter", handleDragenter, false);
        document.body.addEventListener("dragover", handleDragover, false);
        document.body.addEventListener("drop", handleDrop, false);

        document.body.addEventListener('contextmenu', function(event){
            if (input.isCtrlDown) return;
            event.preventDefault();

            let target = event.target.closest(".context");
            if (target && target.onContext){
                target.onContext(event);
            }
        });

        render();


    };

    me.onClick = function(component,handler){
        console.error("DEPRECATED: onClick");
        component.onclick = function(event){
            event.preventDefault();
            handler(event);
        }
        component.addEventListener("touchstart",function(event){
            event.preventDefault();
            handler(event);
        });
    }

    me.enableDrag = function(component,copy){
        console.error("DEPRECATED: enableDrag");
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

            initDrag(event,copy);

        }

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
            if (!touchData.isGlobalDragging && (Math.abs(deltaX)>5 || Math.abs(deltaY)>5)){
                globalDragItem.classList.add("visible");
                touchData.isGlobalDragging = true;
                dragItems.forEach(function(item){
                    if (item.ghost) item.ghost();
                });
            }
        }
    };

    me.handleGlobalDrop = function(){
        console.error("handleGlobalDrop")
        if (touchData.isGlobalDragging){
            if (currentDropTarget){
                currentDropTarget.classList.remove("droptargetactive");

                if (currentDropTarget.onDrop){
                    currentDropTarget.onDrop(dragItems,globalDragItem.deltaX,globalDragItem.deltaY);
                }
            }

            dragItems.forEach(function(item){
                if (item.show) item.show();
            });
        }else{
            // we didn't drag => click
            if (touchData.clickTarget && touchData.clickTarget.onClick){
                touchData.clickTarget.onClick();
            }
        }


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

        touchData.isGlobalDragging = false;
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
        var inpopup = event.target.closest(".popupmenu");
        if (!inpopup) popupMenu.hide();

        mouse.isDown = true;
        document.body.classList.add("mousedown");
        touchData.startX = event.clientX;
        touchData.startY = event.clientY;

        let clickTarget = event.target.closest(".handle");
        let dragTarget = event.target.closest(".draggable");
        let handled = false;

        if (clickTarget && clickTarget.onDoubleClick && !event.button>0){
            event.stopPropagation();
            event.preventDefault();
            var now = new Date().getTime();
            var lastClick = clickTarget.lastClickTime || 0;
            var elapsed = now-lastClick;
            clickTarget.lastClickTime = now;
            if (elapsed<400){
                clickTarget.onDoubleClick();
                handled = true;
            }
        }
        if (clickTarget && clickTarget.classList.contains("preventdefaultdrag")){
            dragTarget=undefined;
        }

        if (!handled && dragTarget){
            dragItems=[dragTarget];

            if (dragTarget.onDragStart){
                dragItems = dragTarget.onDragStart();
            }
            initDrag(event,dragTarget.classList.contains("global"));

            // delay click in case we start dragging;
            if (dragTarget.classList.contains("handle")){
                touchData.clickTarget = clickTarget;
                handled = true;
            }
        }

        if (!handled && clickTarget && clickTarget.onClick) clickTarget.onClick();
        if (clickTarget && clickTarget.onDown) clickTarget.onDown(touchData);
        currentClickTarget = clickTarget;

    }

    function handleTouchMove(event){
        var touch = getTouch(event);
        mouse.update(touch);

        if (isDragging){
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

        if (currentClickTarget && currentClickTarget.onDrag){
            touchData.currentX = touch.clientX;
            touchData.currentY = touch.clientY;
            touchData.deltaX = touch.clientX - touchData.startX;
            touchData.deltaY = touch.clientY - touchData.startY;
            currentClickTarget.onDrag(touchData);
        }



    }

    function handleTouchUp(event){
        isDragging = false;
        isResizing = false;
        isSelecting = false;

        resizeItems.forEach(function(item){
            item.activate(true);
        });
        dragItems.forEach(function(item){
            if (item.onStopDrag) item.onStopDrag();
        });

        if (globalDragItem) me.handleGlobalDrop();
        if (selectingComponent) selectingComponent.removeSelectBox();
        if (currentClickTarget && currentClickTarget.onUp) currentClickTarget.onUp();

        dragItems=[];
        resizeItems=[];
        mouse.isDown = false;
        document.body.classList.remove("mousedown");
        currentClickTarget = undefined;
        selectingComponent = undefined;
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

    function initDrag(event,global){
        isDragging = true;
        let touch = getTouch(event);

        if (global){
            clearTimeout(globalDropTimer);
            globalDragItem = document.getElementById("globalDragItem");
            if (globalDragItem) globalDragItem.remove();
            globalDragItem = $div("","globalDragItem");


            dragItems.forEach(function(item){
                let clone = item.clone? item.clone() : item;
                globalDragItem.appendChild(clone);
                if (!settings.useDelayedDrag){
                    if (item.ghost) item.ghost();
                    touchData.isGlobalDragging = true;
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
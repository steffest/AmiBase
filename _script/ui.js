var UI = function(){

    var me = {};

    var UIData = {};
    var currentDragItem;
    var currentDropTarget;
    var globalDragItem;
    var globalDragSource;
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
        Mouse.init();
        MainMenu.init();

        document.body.addEventListener("mousedown",function(){
            Mouse.isDown = true;
            document.body.classList.add("mousedown");
        });

        document.body.addEventListener("mouseup",function(){
            isDragging = false;
            isResizing = false;
            isSelecting = false;

            resizeItems.forEach(function(item){
                item.activate(true);
            });

            if (globalDragItem) me.handleDrop();
            if (selectingComponent) selectingComponent.removeSelectBox();

            dragItems=[];
            resizeItems=[];
            Mouse.isDown = false;
            document.body.classList.remove("mousedown");

            selectingComponent = undefined;
        });


        document.body.addEventListener("mousemove",function(e){
            e = e || window.event;
            Mouse.update(e);

            if (isDragging){
                e.preventDefault();

                if (globalDragItem){
                    var x = e.clientX - UIData.startDragX;
                    var y = e.clientY - UIData.startDragY;
                    me.handleGlobalDrag(x,y,e.target);
                }else{
                    dragItems.forEach(function(item){
                        var x = e.clientX - UIData.startDragX;
                        var y = e.clientY - UIData.startDragY;
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
                e.preventDefault();

                resizeItems.forEach(function(item){
                    var x = e.clientX - item.startDragX;
                    var y = e.clientY - item.startDragY;
                    UIChanges.push({
                        element: item,
                        resize:true,
                        width: item.startWidth + x,
                        height: item.startHeight + y,
                    });
                });

            }
        });


        render();


    };

    me.enableDrag = function(component,copy){
        var handle =  component.dragHandle || component.element;
        if (handle)  handle.addEventListener("mousedown",startDrag);

        function startDrag(e) {
            if (component.activate) component.activate(); // bring to front;
            if (component.deActivateContent) component.deActivateContent(); // but deactivate inner content


            if (component.type === "icon"){
                dragItems = component.parent.getSelectedIcons();
            }else{
                dragItems.push(component);
            }

            isDragging = true;
            if (copy){

                globalDragItem = document.getElementById("globalDragItem");
                if (globalDragItem) globalDragItem.remove();
                globalDragItem = $div("","globalDragItem");


                dragItems.forEach(function(item){
                    globalDragItem.appendChild(item.clone());
                    if (!Settings.useDelayedDrag){
                        item.ghost();
                        globalDragItem.classList.add("visible");
                    }
                });

                globalDragItem.startX = 0;
                globalDragItem.startY = 0;
                globalDragItem.style.transform = "translate(0px,0px)";


                document.body.appendChild(globalDragItem);
                currentDragItem = globalDragItem;
                //globalDragSource = component;
                //globalDragSource.classList.add("dragsource")
            }

            e = e || window.event;
            e.preventDefault();
            dragItems.forEach(function(item){
                item.startLeft = item.left;
                item.startTop = item.top;
            });
            UIData.startDragX = e.clientX;
            UIData.startDragY = e.clientY;
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

        if (Settings.useDelayedDrag){
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

        if (Settings.useDelayedDrag){
            globalDragItem.classList.remove("visible");
            setTimeout(function(){
                globalDragItem.remove();
                globalDragItem = undefined;
            },400);
        }else{
            globalDragItem.remove();
            globalDragItem = undefined;
        }

        currentDropTarget = undefined;
        globalDragSource = undefined;



    };

    me.enableResize = function(component){
        var handle =  component.resizeHandle || component.element;
        if (handle) handle.onmousedown = startResize;

        function startResize(e) {

            e = e || window.event;
            e.preventDefault();

            resizeItems.push(component);
            isResizing = true;

            component.deActivate();
            component.startHeight = component.element.offsetHeight;
            component.startWidth = component.element.offsetWidth;
            component.startDragX = e.clientX;
            component.startDragY = e.clientY;
        }

    };

    me.enableSelection = function(component,element){
        if (element) {
            element.addEventListener("mousedown",startSelection);
            element.addEventListener("mousemove",updateSelection);
        }

        function startSelection(e){
           if (e.target === element){
               isSelecting = true;
               selectingComponent = component;
               component.startSelectX = e.clientX;
               component.startSelectY = e.clientY;
           }
        }

        function updateSelection(e){
            if (isSelecting){
                selectingComponent.selectX = e.clientX;
                selectingComponent.selectY = e.clientY;
                var w = selectingComponent.selectX-selectingComponent.startSelectX;
                var h = selectingComponent.selectY-selectingComponent.startSelectY;

                selectingComponent.setSelectBox(selectingComponent.startSelectX,selectingComponent.startSelectY,w,h);
            }

        }
    };



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

}();
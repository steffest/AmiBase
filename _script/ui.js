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

            dragItems=[];
            resizeItems=[];

            if (globalDragItem) me.handleDrop();
            Desktop.removeSelectBox();
            Mouse.isDown = false;
            document.body.classList.remove("mousedown");
        });


        document.body.addEventListener("mousemove",function(e){
            e = e || window.event;
            Mouse.update(e);

            if (isDragging){
                e.preventDefault();

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
                dragItems = Desktop.getSelectedIcons();
            }else{
                dragItems.push(component);
            }

            isDragging = true;

            if (copy){
                globalDragItem = document.getElementById("globalDragItem");
                if (globalDragItem) globalDragItem.remove();

                globalDragItem = cloneElement(item);
                globalDragItem.id = "globalDragItem";

                var pos = getElementPosition(item);
                globalDragItem.style.left = pos.left + "px";
                globalDragItem.style.top = pos.top + "px";
                globalDragItem.startX = pos.left;
                globalDragItem.startY = pos.top;

                document.body.appendChild(globalDragItem);
                currentDragItem = globalDragItem;
                globalDragSource = item;
                globalDragSource.classList.add("dragsource")
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

    me.handleDrag = function(e){
        if (currentDropTarget && currentDropTarget.classList.contains("droptargetactive")){
            currentDropTarget.classList.remove("droptargetactive");
        }
        currentDropTarget = e.target;
        if (currentDropTarget.classList.contains("droptarget")){
            currentDropTarget.classList.add("droptargetactive");
        }

        var deltaX =  globalDragItem.offsetLeft - globalDragItem.startX;
        var deltaY =  globalDragItem.offsetTop - globalDragItem.startY;

        if (Math.abs(deltaX)>5 || Math.abs(deltaY)>5){
            globalDragItem.classList.add("visible");
            if (globalDragSource) globalDragSource.classList.add("dragging")
        }

    };

    me.handleDrop = function(){
        var deltaX =  globalDragItem.offsetLeft - globalDragItem.startX;
        var deltaY =  globalDragItem.offsetTop - globalDragItem.startY;

        if (currentDropTarget){
            currentDropTarget.classList.remove("droptargetactive");
            if (globalDragSource){

                if (currentDropTarget.contains(globalDragSource)){
                    // moved in same parent
                    globalDragSource.style.left = (globalDragSource.offsetLeft + deltaX) + "px";
                    globalDragSource.style.top = (globalDragSource.offsetTop + deltaY) + "px";
                }else{
                    // dragged to another parent
                    if (currentDropTarget.ondrop) (currentDropTarget.ondrop(globalDragSource,globalDragItem));
                }
            }

        }


        if (globalDragSource){
            globalDragSource.classList.remove("dragsource");
            globalDragSource.classList.remove("dragging");
        }

        globalDragItem.remove();
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
               component.startSelectX = e.clientX;
               component.startSelectY = e.clientY;
           }
        }

        function updateSelection(e){
            if (isSelecting){
                component.selectX = e.clientX;
                component.selectY = e.clientY;
                var w = component.selectX-component.startSelectX;
                var h = component.selectY-component.startSelectY;

                Desktop.setSelectBox(component.startSelectX,component.startSelectY,w,h);
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
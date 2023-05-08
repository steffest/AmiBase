let ImageViewer = function(){
    console.error("imageviewer here");

    let me = {};
    let currentWindow;

    me.init = (window,context)=>{
        currentWindow = window;
        if (context && context.registerApplicationActions) context.registerApplicationActions("imageviewer",{
            "openfile":async function(file){
                console.error("imageviewer open file",file);

                if (file.binary){
                    console.log("handle binary data");
                    var img;
                    if (file.filetype && file.filetype.handler && file.filetype.handler.parse){
                        img = file.filetype.handler.parse(file.binary,true);
                        if (file.filetype.handler.toCanvas){
                            img = file.filetype.handler.toCanvas(img);
                        }
                    }else{
                        img = new Image();
                        var urlObject = URL.createObjectURL(new Blob([file.binary.buffer]));
                        img.src = urlObject;
                    }
                    img.style.width = "100%";
                    currentWindow.setContent(img);
                }else if(file.url){
                    var img = new Image();
                    img.onload = function(){
                        window.setSize(img.width,img.height+20,true);
                        img.style.maxWidth = "100%";
                    };
                    img.src = file.url;

                    currentWindow.setContent(img);
                    if (file.label) window.setCaption(file.label);
                }else if(file.path){
                    console.warn("TODO: get file from path",file);
                }else{
                    console.warn("unknown structure",file);
                }
            }
        });

        if (currentWindow.onload) currentWindow.onload(currentWindow);
    }


    return me;

};

export default ImageViewer();
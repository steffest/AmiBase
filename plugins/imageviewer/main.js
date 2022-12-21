let ImageViewer = function(){
    console.error("imageviewer here");

    let me = {};

    me.init = (window,context)=>{
        if (context && context.registerApplicationActions) context.registerApplicationActions("imageviewer",{
            "openfile":async function(file){
                console.error("imageviewer open file",file);

                if (file.binary){
                    console.log("handle binary data");
                    var img;
                    if (file.filetype && file.filetype.handler && file.filetype.handler.parse){
                        var img = file.filetype.handler.parse(file.binary,true);
                        if (file.filetype.handler.toCanvas){
                            img = file.filetype.handler.toCanvas(img);
                        }
                    }else{
                        var img = new Image();
                        var urlObject = URL.createObjectURL(new Blob([file.binary.buffer]));
                        img.src = urlObject;
                    }
                    img.style.width = "100%";
                    window.setContent(img);
                }else if(file.url){
                    var img = new Image();
                    img.onload = function(){
                        window.setSize(img.width,img.height+20,true);
                        img.style.maxWidth = "100%";
                    };
                    img.src = file.url;

                    window.setContent(img);
                    if (file.label) window.setCaption(file.label);
                }else if(file.path){
                    console.warn("TODO: get file from path",file);
                }else{
                    console.warn("unknown structure",file);
                }
            }
        });

        if (window.onload) window.onload(window);
    }


    return me;

};

export default ImageViewer();
let ImageViewer = function(){
    let me = {};
    let currentWindow;
    let amiBase;

    me.init = (window,context)=>{
        currentWindow = window;
        if (context) amiBase = context;
    }

    me.openFile=async function(file){
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
                currentWindow.setSize(img.width,img.height+20,true);
                img.style.maxWidth = "100%";
            };
            img.src = file.url;

            currentWindow.setContent(img);
            if (file.label) currentWindow.setCaption(file.label);
        }else if(file.path){
            console.warn("Warn: get file from path, not optimal, please use URL if possible",file);
            amiBase.readFile(file.path,true).then(data=>{
               console.log("got file",data);
                img = new Image();
                var urlObject = URL.createObjectURL(new Blob([data.buffer]));
                img.src = urlObject;
                img.style.width = "100%";
                currentWindow.setContent(img);
            });
        }else{
            console.warn("unknown structure",file);
        }
    }


    return me;

};

export default ImageViewer;
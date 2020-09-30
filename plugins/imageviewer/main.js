var imageviewer_plugin_init = function(window){
    console.error("imageviewer here");

    Applications.registerApplicationActions("imageviewer",{
        "openfile":async function(attachment){
            console.error("imageviewer open file");

            if (attachment.file){
                console.log("handle binary data");
                var img;
                if (attachment.filetype && attachment.filetype.handler && attachment.filetype.handler.parse){
                    var img = attachment.filetype.handler.parse(attachment.file,true);
                    if (attachment.filetype.handler.toCanvas){
                        img = attachment.filetype.handler.toCanvas(img);
                    }
                }else{
                    var img = new Image();
                    var urlObject = URL.createObjectURL(new Blob([attachment.file.buffer]));
                    img.src = urlObject;
                }
                img.style.width = "100%";
                window.setContent(img);
            }else if(attachment.url){
                var img = new Image();
                img.onload = function(){
                    window.setSize(img.width,img.height+20,true);
                    img.style.maxWidth = "100%";
                };
                img.src = attachment.url;

                window.setContent(img);
                if (attachment.label) window.setCaption(attachment.label);
            }else if(attachment.path){
                console.warn("TODO: get file from path",attachment);
            }else{
                console.warn("unknown structure",attachment);
            }
        }
    });

    function arrayBufferToImage(arrayBuffer){
        var arrayBufferView = new Uint8Array( arrayBuffer);
        var blob = new Blob( [ arrayBufferView ], { type: "image/jpeg" } );
        var urlCreator = window.URL || window.webkitURL;
        var imageUrl = urlCreator.createObjectURL( blob );
        //var img = document.querySelector( "#photo" );
        //img.src = imageUrl;
    }

    if (window.onload) window.onload(window);

};
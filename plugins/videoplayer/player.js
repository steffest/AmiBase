
var VideoPlayer = function(){
    var me = {};

    var playerWindow;
    var caption;
    var video;
    var player;
    var titleElm;
    let amiBase;

    me.init = (containerWindow,context)=>{

        console.error("videoplayer here");

        amiBase = context;
        containerWindow.setSize(800,450);
        me.setPlayerWindow(containerWindow);
        if (containerWindow.onload) containerWindow.onload(containerWindow);
    }

    me.setPlayerWindow = function(w){
        playerWindow = w;
    };

    me.openFile = function(file){
        console.log("videoplayer open file");
        if(file.url){
            me.playUrl(file.url);
            //window.setContent(img);
            if (file.label) app.setCaption(file.label);
        }else{
            amiBase.getUrl(file).then(url=>{
                if (url){
                    me.playUrl(url);
                }else{
                    console.warn("unknown structure",file);
                }
            });
        }
    }

    me.playUrl = function(url){
        if (!video) createPlayer();
        playerWindow.setContent(video);


        video.src = url;
        video.play();

        /*player.load(url).then(function() {
            video.play();
        }).catch(function(error){
            console.error('Error code', error.code, 'object', error);
            playerWindow.setCaption("Deze video kan niet worden afgespeeld");
        });*/
    };


    function createPlayer(){
        video = document.createElement("video");
        video.setAttribute('webkit-playsinline', 'webkit-playsinline');
        video.setAttribute('playsinline', 'playsinline');
        video.playsinline = true;
        video.controls = true;

        video.style.width = "100%";
        video.style.height = "100%";
        video.style.backgroundColor = "black";

        video.onclick = function(){
            //window.video = video;
            //video.pause();
        };
        

        /*shaka.polyfill.installAll();
        if (shaka.Player.isBrowserSupported()){
            console.log("Shaka supported");
            player = new shaka.Player(video);
            window.sp = player;
        }else{
            console.log("Shaka not supported ... falling back to default video player")
        }*/
    }

    return me;
};

export default VideoPlayer;
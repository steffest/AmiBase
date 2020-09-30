var videoplayer_plugin_init = function(app){
    console.error("videoplayer here");

    Applications.registerApplicationActions("videoplayer",{
        "openfile": handleFile
    });

    function handleFile(attachment){
        console.log("videoplayer open file");
        if(attachment.url){
            VideoPlayer.playUrl(attachment.url);
            //window.setContent(img);
            if (attachment.label) app.setCaption(attachment.label);
        }else{
            console.warn("unknown structure",attachment);
        }
    }


    app.setSize(800,450);
    VideoPlayer.setPlayerWindow(app);
    if (app.onload) app.onload(app);
};

var VideoPlayer = function(){
    var me = {};

    var playerWindow;
    var caption;
    var video;
    var player;
    var titleElm;

    me.setPlayerWindow = function(w){
        playerWindow = w;
    };

    me.playUrl = function(url){
        if (!video) createPlayer();
        playerWindow.setContent(video);

        player.load(url).then(function() {
            video.play();
        }).catch(function(error){
            console.error('Error code', error.code, 'object', error);
            playerWindow.setCaption("Deze video kan niet worden afgespeeld");
        });
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
            window.video = video;
            //video.pause();
        };
        

        shaka.polyfill.installAll();
        if (shaka.Player.isBrowserSupported()){
            console.log("Shaka supported");
            player = new shaka.Player(video);
            window.sp = player;
        }else{
            console.log("Shaka not supported ... falling back to default video player")
        }
    }

    return me;
}();
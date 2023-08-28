let Bassoon = function(host){
    let me = {};
    let context = host.getContext();

    me.setSrc = function(data,name){
        loadLibrary().then(()=>{
            if (typeof data === "string"){
                BassoonPlayer.load(data,false,function(isMod){
                    me.stop();
                    setTimeout(me.play,100);
                });
            }else{
                BassoonPlayer.processFile(data,name,function(isMod){
                    if (isMod){
                        me.stop();
                        setTimeout(me.play,100);
                    }
                })
            }
        });
    };

    me.play = function(){
        BassoonPlayer.audio.masterVolume.connect(host.getInput());
        BassoonPlayer.playSong();
        timeUpdate();
    };

    me.pause = function(){
        BassoonPlayer.stop();
    };

    me.stop = function(){
        BassoonPlayer.audio.masterVolume.disconnect();
        BassoonPlayer.stop();
    };

    me.setPosition = function(pos){

    };

    me.setVolume = function(vol){
        BassoonPlayer.audio.masterVolume.gain.setValueAtTime(vol,0);
    };
    me.setMute = function(muted){
        BassoonPlayer.audio.masterVolume.gain.setValueAtTime(muted?0:host.getVolume(),0);
    };
    me.getCurrentTime = function(){
        //return BassoonPlayer.getStateAtTime();
    };
    me.getDuration = function(){

    };

    function timeUpdate(){
        if (BassoonPlayer.isPlaying){
            host.onTimeUpdate();
            setTimeout(timeUpdate,200);
        }
    }

    function loadLibrary(){
        return new Promise(next=>{
            if (me.loaded) return next();
            if (!me.loading){
                me.loading = true;
                loadScript("plugins/mediaplayer/players/libraries/bassoonplayer.js").then(()=>{
                    console.log("Bassoon loaded");
                    BassoonPlayer.init({audioContext: context});
                    me.loading = false;
                    me.loaded = true;
                    next();
                });
            }
        });
    }

    function loadScript(url){
        return new Promise(function(next){
            let script = document.createElement("script");
            script.onload = function(){
                next();
            };
            script.src = url;
            document.body.appendChild(script);
        });
    }

    return me;
}

export default Bassoon;
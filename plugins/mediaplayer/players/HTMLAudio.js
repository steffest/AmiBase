let HTMLAudioPlayer = function(host){
    let me = {};

    var initDone;
    let audio = document.createElement("audio");
    audio.crossOrigin = "anonymous";
    host.getContainer().appendChild(audio);
    let source = host.getContext().createMediaElementSource(audio);
    audio.ontimeupdate = host.onTimeUpdate;
    audio.addEventListener('error', function failed(e) {
        // audio playback failed - show a message saying why
        // to get the source of the audio element use $(this).src
        switch (e.target.error.code) {
            case e.target.error.MEDIA_ERR_ABORTED:

                break;
            case e.target.error.MEDIA_ERR_NETWORK:
                console.error("Network Error");
                break;
            case e.target.error.MEDIA_ERR_DECODE:
                console.error('The audio playback was aborted due to a corruption problem or because the video used features your browser did not support.');
                break;
            case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                console.log('Audio source not supported falling back to file player');
                handleDropFile(currentData,true);
                break;
            default:
                console.error('An unknown error occurred.');
                break;
        }
    }, true);

    me.setSrc = function(src){
        audio.src = src;
        source.connect(host.getInput());
    };

    me.play = function(){
        let p = audio.play();
        if (p !== undefined) {
            p.then(_ => {
                // Autoplay started!
            }).catch(error => {
                // Autoplay was prevented.
                // Show a "Play" button so that user can start playback.
                console.error("Could not play audio");
                console.error(error);

                audio.controls = "controls";
                audio.volume = 1;
                audio.style.zIndex = 100;

                //inner.innerHTML="";
                console.error(audio.src);
                //inner.appendChild(audio);

            });
        }
    };
    me.pause = function(){
        audio.pause();
    };
    me.stop = function(){
        source.disconnect();
        audio.pause();
    };
    me.setPosition = function(pos){
        audio.currentTime = pos*audio.duration;
    };
    me.setVolume = function(vol){
        audio.volume = vol;
    };
    me.setMute = function(muted){
        audio.muted = muted;
    };
    me.getCurrentTime = function(){
        return audio.currentTime;
    };
    me.getDuration = function(){
        return audio.duration;
    };

    return me;
}

export default HTMLAudioPlayer;
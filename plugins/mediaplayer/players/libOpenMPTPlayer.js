// somewhat inspired on https://deskjet.github.io/chiptune2.js/
let libOpenMPTPlayer = function(host){
    let me = {};
    let context = host.getContext();
    let player; // current playing node
    window.libopenmpt = { memoryInitializerPrefixURL : "" };

    me.setSrc = function(src){
        loadLibrary().then(()=>{
            load(src).then(buffer=>{
                me.stop();
                let processNode = createLibopenmptNode(buffer);
                if (processNode == null) {
                    console.error("can't create processNode");
                    return;
                }
                player = processNode;
                player.connect(me.masterVolume);
                timeUpdate();
            })
        });
    }

    me.play = function(){
        if (player && !player.isPlaying()) player.unPause()
    }

    me.pause = function(){
        if (player && player.isPlaying()) player.pause()
    }

    me.stop = function(){
        if (player){
            player.stop();
            player = null;
        }
    }

    me.getCurrentTime = function(){
        if (player) return libopenmpt._openmpt_module_get_position_seconds(player.modulePtr);
    }

    me.getDuration = function(){
        if (player) return libopenmpt._openmpt_module_get_duration_seconds(player.modulePtr);
    }
    me.setVolume = function(vol){
        if (me.masterVolume) me.masterVolume.gain.setValueAtTime(vol,0);
    }
    me.getVolume = function(){
        if (me.masterVolume) return me.masterVolume.gain.value;
    }
    me.setMute = function(muted){
        if (me.masterVolume)  me.masterVolume.gain.setValueAtTime(muted?0:host.getVolume(),0);
    };
    me.setPosition = function(pos){
        let targetTime = pos * me.getDuration();
        if (player) libopenmpt._openmpt_module_set_position_seconds(player.modulePtr, targetTime);
    }

    function timeUpdate(){
        if (player && player.isPlaying()){
            host.onTimeUpdate();
            setTimeout(timeUpdate,200);
        }
    }

    function loadLibrary(){
        return new Promise(next=>{
            if (me.loaded) return next();
            if (!me.loading){
                me.loading = true;
                loadScript("plugins/mediaplayer/players/libraries/libopenmpt.js").then(()=>{
                    libopenmpt.onRuntimeInitialized = function() {
                        console.log("libopenmpt.js loaded");
                        me.masterVolume = context.createGain();
                        me.masterVolume.connect(host.getInput());
                        me.loading = false;
                        me.loaded = true;
                        next();
                    }
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

    function load(input){
        return new Promise(function(next){
            if (typeof input === "string"){
                // load from url
                let xhr = new XMLHttpRequest();
                xhr.open('GET', input, true);
                xhr.responseType = 'arraybuffer';
                xhr.onload = function(e) {
                    if (xhr.status === 200) {
                        next(xhr.response);
                    } else {
                        next();
                    }
                };
                xhr.onerror = function(err) {
                    console.error(err);
                };
                xhr.onabort = function() {
                    console.error("Aborted");
                };
                xhr.send();
            }else if (input instanceof File) {
                let reader = new FileReader();
                reader.onload = function() {
                    next(reader.result);
                }.bind(this);
                reader.readAsArrayBuffer(input);
            }else if (input instanceof ArrayBuffer) {
                next(input);
            }
        });
    }

    function createLibopenmptNode(buffer) {
        // TODO error checking in this whole function


        let maxFramesPerChunk = 4096;
        let processNode = context.createScriptProcessor(2048, 0, 2);
        //processNode.config = {};
        //processNode.player = this;
        let byteArray = new Int8Array(buffer);
        let ptrToFile = libopenmpt._malloc(byteArray.byteLength);
        libopenmpt.HEAPU8.set(byteArray, ptrToFile);
        processNode.modulePtr = libopenmpt._openmpt_module_create_from_memory(ptrToFile, byteArray.byteLength, 0, 0, 0);

        let stack = stackSave();
        libopenmpt._openmpt_module_ctl_set(processNode.modulePtr, asciiToStack('render.resampler.emulate_amiga'), asciiToStack('1'));
        libopenmpt._openmpt_module_ctl_set(processNode.modulePtr, asciiToStack('render.resampler.emulate_amiga_type'), asciiToStack('a1200'));
        stackRestore(stack);

        processNode.paused = false;
        processNode.leftBufferPtr  = libopenmpt._malloc(4 * maxFramesPerChunk);
        processNode.rightBufferPtr = libopenmpt._malloc(4 * maxFramesPerChunk);
        processNode.cleanup = function() {
            if (this.modulePtr != 0) {
                libopenmpt._openmpt_module_destroy(this.modulePtr);
                this.modulePtr = 0;
            }
            if (this.leftBufferPtr != 0) {
                libopenmpt._free(this.leftBufferPtr);
                this.leftBufferPtr = 0;
            }
            if (this.rightBufferPtr != 0) {
                libopenmpt._free(this.rightBufferPtr);
                this.rightBufferPtr = 0;
            }
        }
        processNode.stop = function() {
            this.disconnect();
            this.cleanup();
        }
        processNode.pause = function() {
            this.paused = true;
        }
        processNode.unPause = function() {
            this.paused = false;
        }
        processNode.isPlaying = function() {
            return this.modulePtr && !this.paused;
        }
        processNode.onaudioprocess = function(e) {
            var outputL = e.outputBuffer.getChannelData(0);
            var outputR = e.outputBuffer.getChannelData(1);
            var framesToRender = outputL.length;
            if (this.ModulePtr == 0) {
                for (var i = 0; i < framesToRender; ++i) {
                    outputL[i] = 0;
                    outputR[i] = 0;
                }
                this.disconnect();
                this.cleanup();
                return;
            }
            if (this.paused) {
                for (var i = 0; i < framesToRender; ++i) {
                    outputL[i] = 0;
                    outputR[i] = 0;
                }
                return;
            }
            var framesRendered = 0;
            var ended = false;
            var error = false;
            while (framesToRender > 0) {
                var framesPerChunk = Math.min(framesToRender, maxFramesPerChunk);
                var actualFramesPerChunk = libopenmpt._openmpt_module_read_float_stereo(this.modulePtr, this.context.sampleRate, framesPerChunk, this.leftBufferPtr, this.rightBufferPtr);
                if (actualFramesPerChunk == 0) {
                    ended = true;
                    // modulePtr will be 0 on openmpt: error: openmpt_module_read_float_stereo: ERROR: module * not valid or other openmpt error
                    error = !this.modulePtr;
                }
                var rawAudioLeft = libopenmpt.HEAPF32.subarray(this.leftBufferPtr / 4, this.leftBufferPtr / 4 + actualFramesPerChunk);
                var rawAudioRight = libopenmpt.HEAPF32.subarray(this.rightBufferPtr / 4, this.rightBufferPtr / 4 + actualFramesPerChunk);
                for (var i = 0; i < actualFramesPerChunk; ++i) {
                    outputL[framesRendered + i] = rawAudioLeft[i];
                    outputR[framesRendered + i] = rawAudioRight[i];
                }
                for (var i = actualFramesPerChunk; i < framesPerChunk; ++i) {
                    outputL[framesRendered + i] = 0;
                    outputR[framesRendered + i] = 0;
                }
                framesToRender -= framesPerChunk;
                framesRendered += framesPerChunk;
            }
            if (ended) {
                this.disconnect();
                this.cleanup();
                error ? processNode.player.fireEvent('onError', {type: 'openmpt'}) : processNode.player.fireEvent('onEnded');
            }
        };
        return processNode;
    }

    function asciiToStack(str) {
        var stackStr = stackAlloc(str.length + 1);
        writeAsciiToMemory(str, stackStr);
        return stackStr;
    }

    return me;
};

export default libOpenMPTPlayer;
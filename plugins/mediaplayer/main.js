var mediaplayer_plugin_init = function(app){
    console.log("mediaplayer here");

    Applications.registerApplicationActions("mediaplayer",{
        "openfile": handleFile,
        "dropfile": handleDropFile
    });

    var inner = app.getInner();
    var audioContext;
    var dataArray;
    var analyser;
    var analyserMode = "bar";
    var analyserCanvas;
    var analyserPeak = [];
    var analyserConfig;
    var ctx;
    var isPlaying;
    var visActive;
    var progressDrag, volumeDrag;
    inner.innerHTML = "";
    var mediaplayer = $div("mediaplayer");
    inner.appendChild(mediaplayer);
    var skinLoaded;
    var currentData;

    var buttons={};
    setupAudio();
    loadSkin();


    var menu = [
        {label: "MediaPlayer",items:[{label: "about"}]},
        {label: "File",items:[
                {label: "Open" , action:openFile},
                {label: "Open Url",action:openUrl}
            ]},
        {label: "Player",items:[
            {label: "Play",action:function(){Player.play()}},
            {label: "Pause",action:function(){Player.pause()}}
            ]},
        {label: "Radio",items:[
                {label: "Radio XPD",action:function(){
                    Player.playUrl("http://radio.xpd.co.nz:8000/stream.m3u");
                    //http://radio.xpd.co.nz:8000/currentsong
                }},
                {label: "Modules PL",action:function(){
                    //Player.playUrl("https://www.amibase.com/stream2");
                    Player.playUrl("http://radio.modules.pl:8500/;stream/1");
                    //http://radio.modules.pl:8500/currentsong
                }},
                {label: "Ericade",action:function(){
                    Player.playUrl("https://radio.ericade.net/sc/stream/1/");
                    //https://radio.ericade.net/lw/leisa-tern/tracks.htm
                }},
                {label: "Groove Salad",action:function(){Player.playUrl("https://ice6.somafm.com/groovesalad-128-mp3")}},
                {label: "Secret Agent",action:function(){Player.playUrl("https://ice4.somafm.com/secretagent-128-mp3")}},
                {label: "Vuurland",action:function(){Player.playUrl("https://live-radio-cf-vrt.akamaized.net/groupc/live/23384e71-2b6a-43f1-8ad6-02c4ebb8bdf7/live.isml/live-audio=128000.m3u8")}},
                {label: "Random Chip (Krelez)",action:function(){Player.playUrl("http://79.120.11.40:8000/chiptune.ogg")}},
                {label: "HyperRadio",action:function(){Player.playUrl("http://hyperadio.ru:8000/live")}},
                {label: "CVGM.net",action:function(){Player.playUrl("http://69.195.153.34/cvgm192")}},
                {label: "Nectarine",action:function(){Player.playUrl("https://scenestream.io/necta128.ogg")}},
                {label: "CGM UKScene",action:function(){Player.playUrl("http://www.lmp.d2g.com:8003/stream")}},
            ]},
        {label: "Skin",items:[
                {label: "Bassoon",action:function(){loadSkin('Bassoon')}},
                {label: "Winamp 4",action:function(){loadSkin('winamp4')}},
                {label: "Choice",action:function(){loadSkin('choice')}}
            ]},
        {label: "Visualisation",items:[
                {label: "Show",action:function(){showVis()}},
                {label: "Hide",action:function(){hideVis()}}
            ]},
    ];

    app.setMenu(menu,true);


    function handleDropFile(data,useAttachment){
        console.error(data);
        currentData = data;
        if (data.type === "icon"){
            var config = data.getConfig();
            if (config.url && !useAttachment){
                handleFile(config);
            }else{
                data.getAttachment(function(fileInfo){
                    console.error(fileInfo);
                    if (fileInfo.file){
                        Player.playFile(fileInfo.file,fileInfo.filetype);
                    }else{
                        console.warn("Can't play file, no data found");
                    }
                })
            }
        }
    }

    function handleFile(attachment){
        console.log("mediaplayer open file");
        if (attachment.file){
            Player.playFile(attachment.file);
        }else if(attachment.url){
            Player.playUrl(attachment.url);
            //window.setContent(img);
            if (attachment.label) app.setCaption(attachment.label);
        }else{
            console.warn("unknown structure",attachment);
        }
    }

    function loadSkin(name){
        name=name||"winamp4";
        console.log("loading Mediaplayer skin " + name);
        var path = "plugins/mediaplayer/skins/" + name + "/";
        FetchService.json(path + "skin.json",function (config) {
            Object.keys(buttons).forEach(function(button){
                buttons[button].remove();
            });
            buttons={};
            var remove = [];
            mediaplayer.classList.forEach(function(className){
               if (className.indexOf("skin_")===0) remove.push(className);
            });
            remove.forEach(className => mediaplayer.classList.remove(className));
            mediaplayer.classList.add("skin_" + name);

            app.setSize(config.width,config.height);
            loadCss(path + "skin.css");
            config.items.forEach(function(item){
                createButton(item,config.addClassName);
            });

            analyserConfig = config.analyser;
            analyserCanvas.width = config.analyser.width;
            analyserCanvas.height = config.analyser.height;
            analyserCanvas.style.left = config.analyser.left + "px";
            analyserCanvas.style.top = config.analyser.top + "px";

            if (buttons.progress){
                progressDrag = {
                    left: 0,
                    top: 0,
                    element: buttons.progress,
                    setPosition: function(a,b){
                        updateProgressBar(a);
                    },
                    onStopDrag : function(){
                        var min = buttons.progress.config.minLeft || 0;
                        var max = buttons.progress.config.maxLeft || 100;
                        var range = max-min;

                        buttons.progress.isDragging = false;
                        var pos = (progressDrag.left - min)/range;
                        Player.setPosition(pos);
                    }
                };
                UI.enableDrag(progressDrag);
            }
            if (buttons.volume){
                volumeDrag = {
                    left: 0,
                    top: 0,
                    element: buttons.volume,
                    setPosition: function(a,b){

                        var min = buttons.volume.config.minLeft || 0;
                        var max = buttons.volume.config.maxLeft || 100;
                        var range = max-min;

                        updateVolumeBar(a);
                        var pos = (volumeDrag.left - min)/range;
                        Player.setVolume(pos);
                    }
                };
                UI.enableDrag(volumeDrag);
            }
            Player.setVolume(0.7,true);

            skinLoaded = true;
        });
    }

    function showVis(){
        AmpVisualiser.init();
        visActive = true;
    }

    function hideVis(){
        AmpVisualiser.hide();
        visActive = false;
    }

    function updateVis(data,length){
        if (!visActive) return;
        AmpVisualiser.update(data,length);
    }

    function createButton(item,addClassName){
        var button = $div("button");
        if (addClassName){
            button.classList.add(item.name);
        }
        if (item.left || item.top || item.width || item.height){
            button.style.left = item.left + "px";
            button.style.top = item.top + "px";
            button.style.width = item.width + "px";
            button.style.height = item.height + "px";
        }
        if (item.zIndex) button.style.zIndex = item.zIndex;
        button.config = item;

        setBackground(button,"texture");
        if (!button.inActive){
            button.onmouseenter = function(){
                setBackground(button,"hover");
            };
            button.onmouseleave = function(){
                setBackground(button,"texture");
            };
            button.onmousedown = function(){
                handleAction(item.name);
                setBackground(button,"down");
                if (addClassName) button.classList.add("down");
            };
            button.onmouseup = function(){
                setBackground(button,"hover");
                if (addClassName) button.classList.remove("down");
            };
        }
        buttons[item.name] = button;

        mediaplayer.appendChild(button);
    }

    function setBackground(elm,stateName){

        var config = elm.config;
        if (elm.state && config.state && config.state[elm.state]) config = config.state[elm.state];
        var state = config[stateName];
        if (state){
            elm.style.backgroundPosition = "-" + state[0] + "px -" + state[1] + "px";
        }
    }

    function handleAction(action){
        switch (action) {
            case "play":
                Player.play();
                break;
            case "stop":
            case "pause":
                Player.pause();
                break;
            case "mute":
                Player.toggleMute();
                if (buttons.mute){
                    buttons.mute.state = Player.isMuted() ? "active" : "";
                }
                break;
            case "close":
                app.close();
                break;
        }
    }

    function openFile(){
       System.requestFile();
    }

    function openUrl(){
        let url = prompt("Url:","http://radio.xpd.co.nz:8000/stream.m3u");
        if (url){
            Player.playUrl(url);
        }
    }

    function setupAudio(){

        window.AudioContext = window.AudioContext||window.webkitAudioContext;
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.connect(audioContext.destination);
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.6;
        analyser.maxDecibels = -10;
        var bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        analyserCanvas = document.createElement("canvas");
        analyserCanvas.className = "analyser";
        analyserCanvas.width = 71;
        analyserCanvas.height = 24;
        analyserCanvas.onclick = nextAnalyserMode;
        mediaplayer.appendChild(analyserCanvas);
        ctx = analyserCanvas.getContext("2d");
    }

    function nextAnalyserMode(){
        if (analyserMode === "bar"){
            analyserMode = "wave";
        }else{
            analyserMode = "bar";
        }
    }

    function updateAnalyser(){
       if (analyserConfig){
           ctx.clearRect(0,0,analyserCanvas.width,analyserCanvas.height);
           if (analyserMode === "wave"){
               analyser.fftSize = analyserConfig.wave.fftSize;
               var bufferLength = analyser.fftSize;
               var dataArray = new Uint8Array(bufferLength);


               function drawWave(color,lineWidth) {
                   analyser.getByteTimeDomainData(dataArray);

                   ctx.lineWidth = lineWidth;
                   //ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';
                   ctx.strokeStyle = color;
                   ctx.beginPath();
                   var sliceWidth = analyserConfig.width * 1.0 / bufferLength;
                   var wx = 0;

                   for(var i = 0; i < bufferLength; i++) {
                       var v = dataArray[i] / 128.0;
                       var wy = v * analyserConfig.height/2;

                       if(i === 0) {
                           ctx.moveTo(wx, wy);
                       } else {
                           ctx.lineTo(wx, wy);
                       }

                       wx += sliceWidth;
                   }

                   ctx.lineTo(analyserConfig.width, analyserConfig.height/2);
                   ctx.stroke();

                   updateVis(dataArray,bufferLength);

                   //me.parentCtx.drawImage(me.canvas,me.left, me.top);
               }
               if (analyserConfig.wave.color2) drawWave(analyserConfig.wave.color2,6);
               drawWave(analyserConfig.wave.color,2);
               requestAnimationFrame(updateAnalyser);


           }

           if (analyserMode === "bar"){
               analyser.fftSize = analyserConfig.bar.fftSize || 128;
               var bufferLength = analyser.frequencyBinCount;
               dataArray = new Uint8Array(bufferLength);

               analyser.getByteFrequencyData(dataArray);
               var barWidth = analyserConfig.bar.width;
               var barHeight = analyserConfig.height;
               var barGap = analyserConfig.bar.gap;
               var dataOffset = 10;
               var offsetLeft = analyserConfig.bar.offsetLeft || 0;
               var max = analyserConfig.bar.count+dataOffset-1;

               if (isPlaying){
                   for (var i = 0; i<max; i++){
                       var v = Math.ceil((dataArray[i+dataOffset] / 255) * barHeight);
                       var top = barHeight-v;
                       var x = offsetLeft + (i*(barWidth+barGap));
                       ctx.fillStyle = analyserConfig.bar.color;
                       ctx.fillRect(x,top, barWidth, v);

                       if (analyserConfig.bar.colorPeak){
                           var p = Math.max(analyserPeak[i] || 0,v);
                           ctx.fillStyle = analyserConfig.bar.colorPeak;
                           ctx.fillRect(x,barHeight-p, barWidth, 2);
                           analyserPeak[i] = p-0.1;
                       }
                   }
                   updateVis(dataArray,bufferLength);
                   requestAnimationFrame(updateAnalyser);
               }
           }
       }else{
           requestAnimationFrame(updateAnalyser);
       }
    }

    function updateProgressBar(left){
        if (!buttons.progress) return;
        var min = buttons.progress.config.minLeft || 0;
        var max = buttons.progress.config.maxLeft || 100;
        var range = max-min;


        if (typeof left === "undefined"){
            if (buttons.progress.isDragging) return;
            // get position from player;
            var t = Player.getCurrentTime();
            var d = Player.getDuration();
            left = (((t/d)*range)+min);
        }else{
            buttons.progress.isDragging = true;
        }

        if (left<min) left=min;
        if (left>max) left=max;
        buttons.progress.style.left = left + "px";
        progressDrag.left = left;
        buttons.progressHighLight.style.width = (left-min) + "px";
    }

    function updateVolumeBar(left){
        var min = buttons.volume.config.minLeft || 0;
        var max = buttons.volume.config.maxLeft || 100;
        if (left<min) left=min;
        if (left>max) left=max;
        buttons.volume.style.left = left + "px";
        volumeDrag.left = left;
        buttons.volumeHighLight.style.width = (left-min) + "px";
    }

    function setUIState(state){
        if (buttons.play){

        }
    }

    var Player = function(){
        var me = {};
        var player;
        var mute = false;
        var currentVolume = 0.7;

        me.playFile = function(file,type){
            me.stop();
            player = audioContextPlayer;
            if (type && type.name && type.name.indexOf("Music Module")>=0){
                player = audioModPlayer;
            }
            if (type && type.name && type.name.indexOf("laylist")>=0){
                player = undefined;
                return me.playList(file,type)
            }
            player.setSrc(file.buffer.slice(0),file.name,function(success){
                if (success){
                    me.play();
                }else{
                    console.log("Can't decode audio data, detecting file type");
                    (async()=>{
                        type = await System.detectFileType(file);
                        if (type && type.name && type.name.indexOf("laylist")>=0){
                            return me.playList(file,type)
                        }
                    })();

                }
            });

        };

        me.playList = async function(url,type){
            if (url && url.buffer){
                var list = url.toString();
            }else{
                list =  await FileSystem.readFile(url);
            }

            // let's just play the first entry for now
            // TODO: make proper filetype handler
            list = list.split('\n');
            list.forEach(item=>{
               if (item.indexOf("File1=")===0){
                   var url = item.split("=")[1].trim();
                   me.playUrl(url);
               }
            });



        };

        me.playUrl = function(src){
            me.stop();
            player = htmlAudioPlayer;
            //player = libOpenMPTPlayer;
            var extention = src.split(".").pop().toLowerCase();
            if (extention === "m3u8"){
                player = HlsAudioPlayer;
            }
            player.setSrc(src);
            me.play();
        };

        // pos ranges from 0 to 1
        me.setPosition = function(pos){
            player.setPosition(pos);
        };

        me.setVolume = function(vol,andUpdateSlider){
            if (andUpdateSlider){
                var left = Math.round((181 + vol*71));
                updateVolumeBar(left);
                return;
            }
            currentVolume = vol;
            player.setVolume(vol);
        };

        me.getVolume = function(){
            return currentVolume;
        };

        me.play = function(){
            player.play();
            isPlaying = true;
            mediaplayer.classList.add("playing");
            setUIState("playing");
            updateAnalyser();
        };
        me.pause = function(){
            player.pause();
            isPlaying = false;
            mediaplayer.classList.remove("playing");
            setUIState("paused");
        };
        me.stop = function(){
            if (player) player.stop();
            isPlaying = false;
            mediaplayer.classList.remove("playing");
            setUIState("stopped");
        };
        me.toggleMute = function(){
            mute = !mute;
            player.setMute(mute);
        };
        me.isMuted = function(){
            return mute;
        };
        me.getCurrentTime = function(){
            return player.getCurrentTime();
        };
        me.getDuration = function(){
            return player.getDuration();
        };

        return me;
    }();

    var htmlAudioPlayer = function(){
        var me = {};
        var initDone;
        var audio;
        var source;

        me.init = function(){
            if (!initDone){
                audio = document.createElement("audio");
                audio.crossOrigin = "anonymous";
                mediaplayer.appendChild(audio);
                source = audioContext.createMediaElementSource(audio);
                audio.ontimeupdate = function(){
                    updateProgressBar();
                };
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
            }
            initDone = true;
        };

        me.setSrc = function(src){
            if (!initDone) me.init();
            audio.src = src;
            source.connect(analyser);
        };

        me.play = function(){
            audio.play();
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
    }();

    var audioContextPlayer = function(){
        var me = {};
        var source;
        var startTime;
        var pauseTime = 0;
        var currentBuffer;
        var currentDuration;
        var masterVolume;
        var _isPlaying;
        var initDone;

        me.init = function(){
            if (!initDone){
                masterVolume = audioContext.createGain();
            }
            initDone = true;
        };

        me.setSrc = function(data,name,next){
            if (!initDone) me.init();
            audioContext.decodeAudioData(data, function(buffer) {
                masterVolume.gain.setValueAtTime(Player.getVolume(),0);
                masterVolume.connect(analyser);
                currentBuffer = buffer;
                currentDuration = currentBuffer.duration;
                if (next) next(true);
            },function(){
                if (next) next(false);
            });
        };

        me.play = function(){
            var offset = pauseTime;
            if (currentBuffer){
                source = audioContext.createBufferSource();
                source.buffer = currentBuffer;
                source.connect(masterVolume);
            }
            source.start(0, offset);
            pauseTime = 0;
            startTime =  audioContext.currentTime - offset;
            _isPlaying = true;
            timeUpdate();
        };

        me.pause = function(){
            var elapsed = audioContext.currentTime - startTime;
            me.stop();
            pauseTime = elapsed;
        };

        me.stop = function(){
            if (source){
                source.disconnect();
                source.stop(0);
                source = null;
            }
            pauseTime = 0;
            startTime = 0;
            _isPlaying = false;
        };

        me.setPosition = function(pos){
            var targetTime = pos * me.getDuration();
            me.stop();
            pauseTime = targetTime;
            me.play();
        };

        me.setVolume = function(vol){
            masterVolume.gain.setValueAtTime(vol,0);
        };
        me.setMute = function(muted){
            masterVolume.gain.setValueAtTime(muted?0:Player.getVolume(),0);
        };
        me.getCurrentTime = function(){
            return audioContext.currentTime - startTime;
        };
        me.getDuration = function(){
            if (currentBuffer){
                return currentBuffer.duration;
            }
            return currentDuration;
        };

        function timeUpdate(){
            if (_isPlaying){
                updateProgressBar();
                setTimeout(timeUpdate,200);
            }
        }

        return me;
    }();

    var audioModPlayer = function(){
        var me = {};
        var initDone;
        var initLoading;

        me.init = function(next){
            if (initDone){
                next();
            }else{
                if (!initLoading){
                    initLoading = true;
                    loadScript("plugins/mediaplayer/players/bassoonplayer.js",function(){
                        console.error("Bassoon");
                        console.error(BassoonPlayer);
                        BassoonPlayer.init({
                            audioContext: audioContext
                        });
                        initDone = true;
                        next();
                    });
                }
            }

        };

        me.setSrc = function(data,name){
            me.init(function () {
                BassoonPlayer.processFile(data,name,function(isMod){
                    if (isMod){
                        me.stop();
                        setTimeout(me.play,100);
                    }
                })
            });
        };

        me.play = function(){
            BassoonPlayer.audio.masterVolume.connect(analyser);
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
            BassoonPlayer.audio.masterVolume.gain.setValueAtTime(muted?0:Player.getVolume(),0);
        };
        me.getCurrentTime = function(){
            //return BassoonPlayer.getStateAtTime();
        };
        me.getDuration = function(){

        };

        function timeUpdate(){
            if (BassoonPlayer.isPlaying){
                updateProgressBar();
                setTimeout(timeUpdate,200);
            }
        }

        return me;
    }();

    var HlsAudioPlayer = function(){
        var me = {};

        var audio; // which is in fact a video element ...
        var initDone;
        var source;

        var init = function(next){
            if (!initDone){
                loadScript("plugins/mediaplayer/players/hls.js",function(){

                    audio = mediaplayer.querySelector("video");
                    if (!audio){
                        audio = document.createElement("video");
                        mediaplayer.appendChild(audio);
                    }

                    source = audioContext.createMediaElementSource(audio);


                    initDone = true;
                    if (next) next();
                });
            }else{
                if (next) next();
            }
        }

        me.setSrc = function(src){
            init(function(){
                if (Hls.isSupported()) {
                    console.log('HLS is supported');
                    const hls = new Hls({
                        autoStartLoad: true,
                        debug: true,
                        enableWorker: true,
                        enableStreaming: true,
                    });

                    hls.loadSource(src);
                    hls.attachMedia(audio);

                    hls.on(Hls.Events.MANIFEST_PARSED, function () {
                        console.log('manifest parsed');
                        audio.play();
                        source.connect(analyser);
                    });

                    hls.on(Hls.Events.ERROR, function (event, data) {
                        if (data.fatal) {
                            switch(data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    // try to recover network error
                                    console.log("fatal network error encountered, try to recover");
                                    hls.startLoad();
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    console.log("fatal media error encountered, try to recover");
                                    hls.recoverMediaError();
                                    break;
                                default:
                                    // cannot recover
                                    // hls.destroy();
                                    console.error('CAT NOT RECOVER', data.type);
                                    break;
                            }
                        }
                    });



                }else{
                    console.log('HLS not supported');
                }
            });
        }

        me.play = function(){
            if (audio) audio.play();
        };

        me.pause = function(){
            if (audio) audio.pause();
        };

        me.stop = function(){
            if (audio) audio.pause();
            if (source) source.disconnect();
        };

        me.setPosition = function(pos){
            if (audio) audio.currentTime = pos*audio.duration;
        };

        me.setVolume = function(vol){
            if (audio) audio.volume = vol;
        };
        me.setMute = function(muted){
            if (audio) audio.muted = muted;
        };
        me.getCurrentTime = function(){
            return audio?audio.currentTime:0;
        };
        me.getDuration = function(){
            return audio?audio.duration:0;
        };

        return me;


    }();


    var libOpenMPTPlayer = function(){
        var me = {};
        var initDone;
        var player;
        var masterVolume;
        
        me.init = function(next){
            if (initDone){
                next();
            }else{
                masterVolume = audioContext.createGain();
                
                System.loadScripts("plugins/mediaplayer/players/openmpt/",["chiptune2.js","libopenmpt.js"],function(){
                    libopenmpt.onRuntimeInitialized = _ =>
                    {

                        if (player == undefined) {
                            player = new ChiptuneJsPlayer({
                                repeatCount:0,
                                output: analyser,
                                audioContext: audioContext,
                                audioDestination: masterVolume
                            });
                        } else {
                            player.stop();
                            //playPauseButton();
                        }
                        
                        
                        path = "plugins/mediaplayer/players/openmpt/test.mod";
                        player.load(path, function(buffer) {
                            console.error(buffer);
                            //document.getElementById('play').innerHTML = "Pause";
                            player.play(buffer);
                            //setMetadata(path);
                            //pausePauseButton();
                            //updateAutoPlay();
                            //setInterval(progress, 500);
                        });
                    };
                });
            }
        };
        
        me.setSrc=function(){
            me.init();
        };
        
        me.play = function(){
            masterVolume.connect(analyser);
            player.togglePause();
        };
        
        me.pause = function(){
            player.togglePause();
        };
        
        me.stop = function(){
            masterVolume.disconnect();
        };
        
        return me;
    }();

    if (app.onload) app.onload(app);

};
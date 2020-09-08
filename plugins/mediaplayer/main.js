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
    var analyserCanvas;
    var analyserPeak = [];
    var analyserConfig;
    var ctx;
    var isPlaying;
    var progressDrag, volumeDrag;
    inner.innerHTML = "";
    var mediaplayer = $div("mediaplayer");
    inner.appendChild(mediaplayer);
    var skinLoaded;

    var buttons={};
    setupAudio();
    loadSkin();


    var menu = [
        {label: "MediaPlayer",items:[{label: "about"}]},
        {label: "File",items:[{label: "Open"}]},
        {label: "Player",items:[
            {label: "Play",action:function(){Player.play()}},
            {label: "Pause",action:function(){Player.pause()}}
            ]},
        {label: "Skin",items:[
                {label: "Bassoon",action:function(){loadSkin('Bassoon')}},
                {label: "Winamp 4",action:function(){loadSkin('winamp4')}}
            ]},
    ];

    app.setMenu(menu,true);


    function handleDropFile(data){
        console.error(data);
        if (data.type === "icon"){
            var config = data.getConfig();
            if (config.url){
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
        console.error("mediaplayer open file");
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

            app.setSize(config.width,config.height);
            loadCss(path + "skin.css");
            config.items.forEach(function(item){
                createButton(item)
            });

            analyserConfig = config.analyser;
            analyserCanvas.width = config.analyser.width;
            analyserCanvas.height = config.analyser.height;
            analyserCanvas.style.left = config.analyser.left + "px";
            analyserCanvas.style.top = config.analyser.top + "px";

            if (buttons.progress){
                var min = buttons.progress.config.minLeft;
                var max = buttons.progress.config.maxLeft;
                var range = max-min;
                progressDrag = {
                    left: 7,
                    top: 0,
                    element: buttons.progress,
                    setPosition: function(a,b){
                        updateProgressBar(a);
                    },
                    onStopDrag : function(){
                        buttons.progress.isDragging = false;
                        var pos = (progressDrag.left - min)/range;
                        Player.setPosition(pos);
                    }
                };
                UI.enableDrag(progressDrag);
            }
            if (buttons.volume){

                var min = buttons.volume.config.minLeft;
                var max = buttons.volume.config.maxLeft;
                var range = max-min;
                volumeDrag = {
                    left: min,
                    top: 0,
                    element: buttons.volume,
                    setPosition: function(a,b){
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

    function createButton(item){
        var button = $div("button");
        button.style.left = item.left + "px";
        button.style.top = item.top + "px";
        button.style.width = item.width + "px";
        button.style.height = item.height + "px";
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
            };
            button.onmouseup = function(){
                setBackground(button,"hover");
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

    function setupAudio(){
        var fftSize = 128;

        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.connect(audioContext.destination);
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = 0.6;
        analyser.maxDecibels = -10;
        var bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        analyserCanvas = document.createElement("canvas");
        analyserCanvas.className = "analyser";
        analyserCanvas.width = 71;
        analyserCanvas.height = 24;
        mediaplayer.appendChild(analyserCanvas);
        ctx = analyserCanvas.getContext("2d");
    }

    function updateAnalyser(){
       if (analyserConfig){
           analyser.getByteFrequencyData(dataArray);
           ctx.clearRect(0,0,analyserCanvas.width,analyserCanvas.height);

           var barWidth = analyserConfig.bar.width;
           var barHeight = analyserConfig.height;
           var barGap = analyserConfig.bar.gap;
           var offset = 10;
           var max = analyserConfig.bar.count+offset-1;

           if (isPlaying){
               for (var i = 0; i<max; i++){
                   var v = Math.ceil((dataArray[i+offset] / 255) * barHeight);
                   var top = barHeight-v;
                   var x = i*(barWidth+barGap);
                   ctx.fillStyle = analyserConfig.bar.color;
                   ctx.fillRect(x,top, barWidth, v);

                   if (analyserConfig.bar.colorPeak){
                       var p = Math.max(analyserPeak[i] || 0,v);
                       ctx.fillStyle = analyserConfig.bar.colorPeak;
                       ctx.fillRect(x,barHeight-p, barWidth, 2);
                       analyserPeak[i] = p-0.2;
                   }
               }
               requestAnimationFrame(updateAnalyser);
           }
       }else{
           requestAnimationFrame(updateAnalyser);
       }
    }

    function updateProgressBar(left){

        var min = buttons.progress.config.minLeft;
        var max = buttons.progress.config.maxLeft;
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
        buttons.progressHighLight.style.width = (left-3) + "px";
    }

    function updateVolumeBar(left){
        var min = buttons.volume.config.minLeft;
        var max = buttons.volume.config.maxLeft;
        if (left<min) left=min;
        if (left>max) left=max;
        buttons.volume.style.left = left + "px";
        volumeDrag.left = left;
        buttons.volumeHighLight.style.width = (left-179) + "px";
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
            player.setSrc(file.buffer.slice(0),file.name,function(success){
                if (success){
                    me.play();
                }else{
                    console.error("Can't decode audio data");
                }
            });

        };

        me.playUrl = function(src){
            me.stop();
            player = htmlAudioPlayer;
            //player = libOpenMPTPlayer;
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
            setUIState("playing");
            updateAnalyser();
        };
        me.pause = function(){
            player.pause();
            isPlaying = false;
            setUIState("paused");
        };
        me.stop = function(){
            if (player) player.stop();
            isPlaying = false;
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
        me.setMute = function(muted){};
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
        }
        
        return me;
    }();

    if (app.onload) app.onload(app);

};
import $,{loadCss,loadImage} from "../../_script/util/dom.js";
import fetchService from "../../_script/util/fetchService.js";
//import AmpVisualizer from "./vis/main.js";

let MediaPlayer = function(){
    let me = {};

    let PLAYER = {
        HTMLAUDIO: "HTMLAudio.js",
        BASSOON: "bassoon.js",
        OPENMPT: "libOpenMPTPlayer.js", // more accurate but a little heavy on CPU and memory
    }
    let players = {};

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
    var progressDrag = {};
    let volumeDrag = {};
    var skinLoaded;
    let skinConfig;
    let currentTitle;
    var currentData;
    var buttons={};
    var mediaplayer;
    let currentApp;
    let amiBase;
    let AmpVisualiser;
    let titleCanvas;
    let timeCanvas;
    let previoustime;

    /*

    "now playing " for the soma streams: https://somafm.com/songs/groovesalad.json
    https://somafm.com/songs/secretagent.json

     */

    me.init = function (app,context) {
        return new Promise((next)=>{

            if (context) amiBase = context;
            app.removeBorder();
            var inner = app.getInner();
            inner.innerHTML = "";
            currentApp = app;

            if (!mediaplayer) mediaplayer = $(".mediaplayer");
            inner.appendChild(mediaplayer);
            if (!audioContext) setupAudio();
            loadSkin();

            app.setMenu(menu,true);
            next();

        })

    }

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
                {label: "Radio XPD",action:function(){Player.playUrl("http://radio.xpd.co.nz:8000/stream.m3u");}},
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
                //{label: "HyperRadio",action:function(){Player.playUrl("http://hyperadio.ru:8000/live")}},
                {label: "CVGM.net",action:function(){Player.playUrl("http://69.195.153.34/cvgm192")}},
                {label: "Nectarine",action:function(){Player.playUrl("https://scenestream.io/necta128.ogg")}},
                {label: "CGM UKScene",action:function(){Player.playUrl("http://www.lmp.d2g.com:8003/stream")}},
                {label: "Crooze Chillout",action:function(){Player.playUrl("http://streams.crooze.fm:8006/stream128")}},
                {label: "FG Chic",action:function(){Player.playUrl("https://stream.rcs.revma.com/cgvrymb6p98uv")}},
                {label: "FG Zen",action:function(){Player.playUrl("https://stream.rcs.revma.com/ffynknv9n98uv")}},
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


    me.openFile = function(file){
        console.error("mediaplayer open file",file);
        if (file.binary){
            console.log("mediaplayer play file from binary");
            Player.playFile(file);
        }else if(file.url){
            console.log("mediaplayer play file from url");
            Player.playUrl(file.url);
        }else{
            amiBase.getUrl(file).then(url=>{
                console.log("mediaplayer open file",url);
               if (url){
                   Player.playUrl(url);
               }else{
                   if (file.path){
                       console.log("mediaplayer open file from path",file.path);
                       amiBase.readFile(file.path,true).then(data=>{
                           file.binary = data;
                           Player.playFile(file);
                       });
                   }else{
                       console.warn("unknown structure",file);
                   }
               }
            });
        }
    }

    me.dropFile = function(file){
        if (file && file.object) file=file.object;
        me.openFile(file);
    }

    function loadSkin(name){
        name=name||"winamp4";
        console.log("loading Mediaplayer skin " + name);
        var path = "plugins/mediaplayer/skins/" + name + "/";
        fetchService.json(path + "skin.json",function (config) {
            skinConfig = config;
            skinConfig.path = path;
            if (skinConfig.textureUrl) loadImage(skinConfig.path + "/" + skinConfig.textureUrl).then(function(texture){
                skinConfig.texture = texture;
                if (currentTitle) setTitle(currentTitle);
            });
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

            currentApp.setSize(config.width,config.height);
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
                buttons.progress.onDown = function(touchData){
                    touchData.startDragX = progressDrag.left || 0;
                }
                buttons.progress.onDrag = function(touchData){
                    updateProgressBar(touchData.startDragX + touchData.deltaX);
                }
                buttons.progress.onUp = function(touchData){
                    var min = buttons.progress.config.minLeft || 0;
                    var max = buttons.progress.config.maxLeft || 100;
                    var range = max-min;

                    buttons.progress.isDragging = false;
                    var pos = (progressDrag.left - min)/range;
                    Player.setPosition(pos);
                }
            }
            if (buttons.volume){

                buttons.volume.onDown = function(touchData){
                    touchData.startDragX = volumeDrag.left || 0;
                }
                buttons.volume.onDrag = function(touchData){
                    updateVolumeBar(touchData.startDragX + touchData.deltaX);
                    var min = buttons.volume.config.minLeft || 0;
                    var max = buttons.volume.config.maxLeft || 100;
                    var range = max-min;
                    var pos = (volumeDrag.left - min)/range;
                    Player.setVolume(pos);
                }
            }
            Player.setVolume(0.7,true);
            skinLoaded = true;
        });
    }

    async function showVis(){
        let module = await import("./vis/main.js");
        AmpVisualiser = module.default;
        console.error(AmpVisualiser);
        AmpVisualiser.init(amiBase);
        visActive = true;
    }

    function hideVis(){
        if (AmpVisualiser){
            AmpVisualiser.hide();
            visActive = false;
        }
    }

    function updateVis(data,length){
        if (!visActive) return;
        if (AmpVisualiser){
            AmpVisualiser.update(data,length);
        }
    }

    function createButton(item,addClassName){
        var button = $(".button");
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
            button.classList.add("handle");
            button.classList.add("preventdefaultdrag");
            button.onmouseenter = function(){
                setBackground(button,"hover");
            };
            button.onmouseleave = function(){
                setBackground(button,"texture");
            };
            button.onDown = function(){
                handleAction(item.name);
                setBackground(button,"down");
                if (addClassName) button.classList.add("down");
            }
            button.onUp = function(){
                setBackground(button,"hover");
                if (addClassName) button.classList.remove("down");
            }
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
                Player.stop();
                currentApp.close();
                break;
        }
    }

    async function openFile(){
        let file = await amiBase.requestFileOpen();
        if (file) me.openFile(file);
    }

    function openUrl(){
        let url = prompt("Url:","http://radio.xpd.co.nz:8000/stream.m3u");
        if (url) Player.playUrl(url);
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

    async function setTitle(title){
        currentTitle = title;
        if (!skinLoaded) return;
        let font = skinConfig?skinConfig.playingFont:undefined;
        if (!font) return;
        if (!titleCanvas){
            let c = $("canvas",{
                width: font.display.width,
                height: 20,
                parent: mediaplayer,
                style: {
                    position: "absolute",
                    left: font.display.left + "px",
                    top: font.display.top + "px"
                }
            });
            titleCanvas = c.getContext("2d");
        }
        if (!skinConfig.texture) return;
        titleCanvas.clearRect(0,0,titleCanvas.canvas.width,titleCanvas.canvas.height);

        let x = 0;
        title= title.split("/").pop();
        title = title.toUpperCase();
        for (let i = 0; i<title.length; i++){
            let char = title.charCodeAt(i)-33;
            writeChar(char);
        }

        function writeChar(code){
            if (code<0){
                let char = String.fromCharCode(code+33);
                code=0;
            }
            let line = Math.floor(code/font.lineWidth);
            let pos = code-(line*font.lineWidth);
            let left = font.left + (pos * font.width);
            let top = font.top + (line * font.lineHeight);
            let width = font.width;
            let height = font.height;

            //let code = ch.charCodeAt(0);

            titleCanvas.drawImage(skinConfig.texture,left,top,width,height,x,0,width,height);
            x += font.width;
        }
    }

    function updateTime(){
        if (!skinConfig.texture) return;
        let font = skinConfig.timeFont;
        if (!font) return;
        if (!timeCanvas){
            let c = $("canvas",{
                width: font.display.width,
                height: font.height,
                parent: mediaplayer,
                style: {
                    position: "absolute",
                    left: font.display.left + "px",
                    top: font.display.top + "px"
                }
            });
            timeCanvas = c.getContext("2d");
        }

        let t = Player.getCurrentTime();
        let seconds = Math.floor(t%60);
        if (seconds===previoustime) return;
        previoustime = seconds;
        let minutes = Math.floor(t/60);
        let time = (minutes<10?"0":"")+ minutes + ":" + (seconds<10?"0":"") + seconds;

        let x = 0;
        timeCanvas.clearRect(0,0,timeCanvas.canvas.width,timeCanvas.canvas.height)
        for (let i = 0; i<time.length; i++){
            let char = time.charCodeAt(i)-48;
            writeChar(char);
            x+=font.width;
        }

        function writeChar(code){
            let left = code*font.width + font.left;
            let top = font.top;
            let width = font.width;
            let height = font.height;
            if (code===10){
                // :
                left = font.colon.left;
                width = font.colon.width;
                x-=1;
            }
            timeCanvas.drawImage(skinConfig.texture,left,top,width,height,x,0,width,height);
            if (code===10) x-=6;
        }
    }

    function setUIState(state){
        if (buttons.play){

        }
    }

    var Player = function(){
        let me = {
            getContext:()=>audioContext,
            getInput:()=>analyser,
            getContainer:()=>mediaplayer,
            onTimeUpdate:()=>{
                updateProgressBar();
                updateTime();
            }
        };
        let player;
        let playerType;
        let mute = false;
        let currentVolume = 0.7;

        me.playFile = async function(file){
            console.error("playFile",file);
            me.stop();
            playerType = PLAYER.HTMLAUDIO;
            let type = file.filetype;
            if (type && type.name && type.name.indexOf("Music Module")>=0){
                playerType = PLAYER.OPENMPT;
            }
            if (type && type.name && type.name.indexOf("laylist")>=0){
                playerType = undefined;
                return me.playList(file,type)
            }
            player = await getPlayer();
            setTitle(file.name);
            //player.setSrc(file.binary.buffer.slice(0),file.name);

            const blob = new Blob([file.binary.buffer]);
            player.setSrc(window.URL.createObjectURL(blob),file.name);


            me.play();
        };

        me.playList = async function(url,type){
            if (url && url.buffer){
                var list = url.toString();
            }else{
                list =  await amiBase.readFile(url);
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

        me.playUrl = async function(src){
            me.stop();
            player = undefined;
            playerType = PLAYER.HTMLAUDIO;
            let extention = src.split(".").pop().toLowerCase();
            if (extention === "mod" || extention === "xm" || extention === "s3m" || extention === "it" || extention === "mptm" || extention === "med"){
                //playerType = PLAYER.BASSOON;
                playerType = PLAYER.OPENMPT;
            }
            if (extention === "m3u8"){
                //player = HlsAudioPlayer;
            }
            player = await getPlayer();
            console.error("player",player);
            player.setSrc(src);
            me.play();
            setTitle(src);
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
            if (player) player.play();
            isPlaying = true;
            mediaplayer.classList.add("playing");
            setUIState("playing");
            updateAnalyser();
        };
        me.pause = function(){
            if (player) player.pause();
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
            if (player) player.setMute(mute);
        };
        me.isMuted = function(){
            return mute;
        };
        me.getCurrentTime = function(){
            if (player) return player.getCurrentTime();
        };
        me.getDuration = function(){
            if (player) return player.getDuration();
        };

        async function getPlayer(){
            player = players[playerType];
            if (!player){
                let module = await import("./players/" + playerType);
                player = module.default(me);
                players[playerType] = player;
            }
            return player;
        }

        return me;
    }();

    /*var audioContextPlayer = function(){
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
                updateTime();
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
                amiBase.loadScript("plugins/mediaplayer/players/hls.js").then(()=>{
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


    }();*/


    return me;

};

export default MediaPlayer();
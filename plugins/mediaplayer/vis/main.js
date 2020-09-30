var AmpVisualiser = function(){
    var me = {};

    var visWindow;
    var canvas;
    var ctx;

    var count = 0;
    var data,data2;
    var canvas2, ctx2,mixinCanvas2,restoreCanvas2,nextTile;
    var tileCanvas,tileCtx,tileData;
    var prevEffectIndex = 0;


    var imageCount = 6;
    var imageIndex = ((Math.random() * imageCount-1) >> 0) + 1;

    var tileCount = 18;
    var tileIndex = ((Math.random() * tileCount-1) >> 0) + 1;

    var currentEffect;

    var w = 320;
    var h = 240;
    var tileSize = 256;

    var changeEffectDelay = 20000;

    var img,tile;

    var effects = {};

    var effectNames  = [
        "waves",
        "circles",
        "planes",
        "plasma",
        "vortex",
        "trippy2",
        "carrousel",
        "trippy",
        "posterize",
        "glass",
        "wobble",
        "spiral",
        "tunnel",
        "stereo",
        "zoom",
    ];
    var effectIndex = ((Math.random() * effectNames.length-1) >> 0) + 1;

    me.init = function(){
        visWindow = Desktop.createWindow({label: "Visualiser"});
        visWindow.setSize(640,480);
        canvas = document.createElement("canvas");
        canvas2 = document.createElement("canvas");
        tileCanvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas2.width = w;
        canvas2.height = h;
        tileCanvas.width = tileSize;
        tileCanvas.height = tileSize;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        visWindow.setContent(canvas);

        ctx = canvas.getContext("2d");
        ctx2 = canvas2.getContext("2d");
        tileCtx = tileCanvas.getContext("2d");

        img = new Image();
        img.onload = function(){
            ctx.drawImage(img,0,0,w,h);
            ctx2.drawImage(img,0,0);
            data2 = ctx2.getImageData(0, 0, w, h);
        };
        img.src= "plugins/mediaplayer/vis/patterns/p" + imageIndex + ".png";

        tile = new Image();
        loadNextTile();
        me.loadEffect(effectNames[effectIndex],true);

        setInterval(function(){
            effectIndex++;

            if (effectIndex>=effectNames.length) {
                effectIndex=0;
                loadNextPattern();
            }
            me.loadEffect(effectNames[effectIndex],true);
        },changeEffectDelay);
    };

    me.update = function(audioData,bufferLength){
        if (count>10000) count=0;
        data = ctx.getImageData(0, 0, w, h);
        mixinCanvas2 = false;

        if (currentEffect) {
            var effectData = getEffectData();
            effectData.audioData = audioData;
            effectData.bufferLength = bufferLength;
            var conf = currentEffect.render(effectData) || {};
            mixinCanvas2 = !!conf.mixinCanvas2;
            nextTile = !!conf.nextTile;
        }

        //tunnel();
        nextTile = true;

        ctx.putImageData(data, 0, 0);

        if (mixinCanvas2){
            restoreCanvas2 = true;
            ctx2.putImageData(data2, 0, 0);
            ctx.globalAlpha = 0.1;
            ctx.drawImage(canvas2,0,0);
            ctx.globalAlpha = 1;
        }else{
            if (restoreCanvas2){
                ctx2.drawImage(img,0,0);
                data2 = ctx2.getImageData(0, 0, w, h);
                restoreCanvas2 = false;
            }
        }

        if (bufferLength){
            var r = 128 + Math.sin(count/100) * 128;
            var g = 128 + Math.sin(count/150) * 128;
            var b = 128 + Math.sin(count/75) * 128;

            ctx.translate(w/2, h/2);
            ctx.rotate(0.5 * Math.PI / 180);
            ctx.translate(-w/2, -h/2);

            drawWave('rgba('+r/2+','+g/2+','+b/2+',0.5)',4,audioData,bufferLength);
            drawWave('rgb('+r+','+g+','+b+')',2,audioData,bufferLength);

        }

        if(prevEffectIndex!==effectIndex && nextTile){
            prevEffectIndex = effectIndex;
            loadNextTile();
            nextTile = false;
        }

        count += 0.5;
    };

    function loadNextPattern(){
        imageIndex++;
        if (imageIndex>imageCount) imageIndex = 1;

        img.onload = function(){
            ctx2.drawImage(img,0,0);
            data2 = ctx2.getImageData(0, 0, w, h);
        };
        img.src= "plugins/mediaplayer/vis/patterns/p" + imageIndex +".png";

    }

    function loadNextTile(){
        tileIndex++;
        if (tileIndex >tileCount) tileIndex = 1;

        tile.onload = function(){
            tileCtx.drawImage(tile,0,0, tileSize, tileSize);
            tileData = tileCtx.getImageData(0, 0, tileSize, tileSize);
        };
        tile.src= "plugins/mediaplayer/vis/tiles/t" + tileIndex +".png";

    }


    me.loadEffect = async function(name,useAsCurrent){
        console.log("switching effect " + name);
        if (effects[name]){
            // effect is already loaded
            if (useAsCurrent) currentEffect=effects[name];
            return;
        }

        console.log("loading effect " + name);
        var module = await import("./effects/" + name + ".js").catch(error => {
            console.warn("can't load effect: ",error);
        });

        if (module && module.default){
            if (module.default.init) {
                await module.default.init({
                    tileSize: tileSize,
                    blend: blend,
                    rotate: rotate,
                    drawWave: drawWave,
                    width: w,
                    height: h,
                    ctxBackground: ctx2,
                });
            }
            effects[name] = module.default;
            console.log("effect " + name + " loaded");
            if (useAsCurrent) currentEffect=module.default;
            
        }
    };

    function getEffectData(){
        if (!data) return {};
        if (!tileData) return {};
        return {
            counter: count,
            pixelsDataMain: data.data,
            pixelsDataTexture: tileData.data
        }
    }



    // rotate a point around a centerpoint
    function rotate(cx, cy, x, y, angle) {
        var radians = (Math.PI / 180) * angle,
            cos = Math.cos(radians),
            sin = Math.sin(radians),
            nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
            ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
        return [nx, ny];
    }

    function blend(a,b,amount){
        return (a*amount + b*(1-amount))>>0;
    }

    function drawWave(color,lineWidth,dataArray,bufferLength,context) {
        context = context ||ctx;
        context.lineWidth = lineWidth;
        //ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';
        context.strokeStyle = color;
        context.beginPath();
        var sliceWidth = w  / bufferLength;
        var wx = 0;

        for(var i = 0; i < bufferLength; i++) {
            var v = dataArray[i] / 128.0;
            var wy = v * h/4 + 120;

            if(i === 0) {
                context.moveTo(wx, wy);
            } else {
                context.lineTo(wx, wy);
            }

            wx += sliceWidth;
        }

        context.lineTo(w, h/4 + 120);
        context.stroke();

    }

    me.hide = function(){
        visWindow.close();
    };

    return me;
}();
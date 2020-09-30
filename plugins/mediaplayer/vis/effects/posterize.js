var posterize = function(){
    var me = {};
    var width,height,ctx,tileSize,blend;
    var ctxBackground;

    var x, y, u, v, pi = Math.PI;

    var alpha  = 4;

    var centerX;
    var centerY;

    me.init = function(data){
        return new Promise(resolve=>{
            width = data.width;
            height = data.height;
            blend = data.blend;
            centerX = width/2;
            centerY = height/2;
            ctxBackground = data.ctxBackground;
            resolve();
        });
    };

    me.render = function(data){
        if (!ctxBackground) return;
        var src = data.pixelsDataMain;
        var dst = ctxBackground.getImageData(0, 0, width, height).data;
        var c = data.counter;

        for (y = 0; y<height; y++){
            for ( x = 0; x<centerX; x++){

                var wobble1 = Math.sin(c/10)*4;
                var wobble2 = Math.sin(c/15)*3;

                var x_ = ((x + (x/centerX)*wobble1)>>0) + 1;
                var y_ = ((y + + (y/centerX)*wobble2)>>0) + 1;

                var x2 = centerX+x;
                var x2_ = ((x2 - (x2/width)*2)>>0) - 1;

                var p = ((y*width) + x) * 4;
                var p_ = ((y_*width) + x_) * 4;
                var p2 = ((y*width) + x2) * 4;
                var p2_ = ((y_*width) + x2_) * 4;

                src[p] = blend(src[p_],src[p],0.3);
                src[p+1] = blend(src[p_+1],src[p+1],0.7);
                src[p+2] = blend(src[p_+2],src[p+2],0.2);

                src[p2] = blend(src[p2_],src[p2],0.3);
                src[p2+1] = blend(src[p2_+1],src[p2+1],0.7);
                src[p2+2] = blend(src[p2_+2],src[p2+2],0.2);
                
                src[p] = blend(src[p],dst[p], alpha);
                src[p+1] = blend(src[p+1],dst[p+1], alpha);
                src[p+2] = blend(src[p+2],dst[p+2], alpha);

                src[p2] = blend(src[p2],dst[p2], alpha);
                src[p2+1] = blend(src[p2+1],dst[p2+1], alpha);
                src[p2+2] = blend(src[p2+2],dst[p2+2], alpha);
                
            }
        }
    };

    return me;

}();

export default posterize;
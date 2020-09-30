var carrousel = function(){
    var me = {};
    var width,height,ctx,tileSize,blend;
    var ctxBackground;

    var x, y, u, v, r, pi = Math.PI;
    
    var alpha = 0.1;

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
        if (!data.pixelsDataMain) return;
        if (!data.pixelsDataTexture) return;

        var dst = data.pixelsDataMain;
        var src = ctxBackground.getImageData(0, 0, width, height).data;
        var c = data.counter;

        for (y = 0; y<height; y++){
            for ( x = 0; x<width; x++){

                var cx = x-centerX - ((Math.sin(c/50)+1) * 20);
                var cy = y-centerY;

                r = Math.sqrt( cx * cx + cy * cy );
                u = r/4 + c;
                v = -r + height/2;

                var x_ = (x - u)>>0;
                var y_ = (y - v)>>0;

                var x__ = x_ + Math.sin(c/100) * 2;
                var y__ = y_;

                x_ = ( x_ < 0 ) ? width - ( - x_ % width ) : ( x_ >= width ) ? x_ % width : x_;
                y_ = ( y_ < 0 ) ? height - ( - y_ % height ) : ( y_ >= height ) ? y_ % height : y_;





                var p = ((y*width) + x) * 4;
                var p_ = ((y_*width) + x_) * 4;



                dst[p] = blend(src[p_],dst[p],alpha);
                dst[p+1] = blend(src[p_+1],dst[p+1],alpha/2);
                dst[p+2] = blend(src[p_+2],dst[p+2],alpha*2);




            }
        }
    };

    return me;

}();

export default carrousel;
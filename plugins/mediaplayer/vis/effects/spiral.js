var spiral = function(){
    var me = {};
    var width,height,ctx,tileSize,blend,rotate;

    var tw,th;

    var src_index, dst_index,
        x, y, u, v, w_, a, r, pi = Math.PI;

    var centerX;
    var centerY;

    me.init = function(data){
        return new Promise(resolve=>{
            width = data.width;
            height = data.height;
            ctx = data.ctx;
            tileSize = data.tileSize;
            blend = data.blend;
            rotate = data.rotate;

            tw = tileSize;
            th = tileSize;

            centerX = width/2;
            centerY = height/2;
            resolve();
        });
    };

    me.render = function(data){
        if (!data.pixelsDataMain) return;

        var dst = data.pixelsDataMain;
        var src = data.pixelsDataMain;
        var c = data.counter;

        for (y = 0; y<height; y++){
            for ( x = 0; x<width; x++){

                var cx = centerX + Math.sin(c/25) * 20;
                var cy = centerY+ Math.sin(c/25) * 20;

                var angle = (Math.sin(c/100) * 6);
                r = rotate(cx,cy,x,y,angle);
                var x_ = r[0] >> 0;
                var y_ = r[1] >> 0;

                var p = ((y*width) + x) * 4;
                var p_ = ((y_*width) + x_) * 4;

                dst[p] = blend(src[p_],dst[p],(Math.sin(c/50) + 1)/2);
                dst[p+1] = blend(src[p_+1],dst[p+1],0.1);
                dst[p+2] = blend(src[p_+2],dst[p+2],0.1);

            }
        }
    };

    return me;

}();

export default spiral;
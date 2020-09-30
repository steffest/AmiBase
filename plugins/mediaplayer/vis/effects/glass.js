var glass = function(){
    var me = {};

    var width,height,ctx,tileSize,blend,drawWave;
    var ctxBackground;

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
            drawWave = data.drawWave;

            tw = tileSize;
            th = tileSize;

            centerX = width/2;
            centerY = height/2;
            ctxBackground = data.ctxBackground;

            resolve();
        });
    };

    me.render = function(data){
        if (!ctxBackground) return;
        if (!data.pixelsDataMain) return;
        //if (!data.pixelsDataTexture) return;

        var dst = data.pixelsDataMain;
        var src = ctxBackground.getImageData(0, 0, width, height).data;
        //src = data.pixelsDataTexture;
        var c = data.counter;

        for (var y = 0; y < height; y++ ) {
            for ( var x = 0; x < width; x++ ) {

                var cx = x-centerX - ((Math.sin(c/50)+1) * 20);
                var cy = y-centerY + ((Math.sin(c/100)+1) * 30);

                r = Math.sqrt( cx * cx + cy * cy );

                var k = 10 + Math.sin(c/100);
                var m = 30 + Math.sin(c/300);

                u = (cx / Math.cos(r/k)*0.2);
                v = (cy / Math.cos(r/m)*0.2) + c;

                u = ( u < 0 ) ? tw - ( - u % tw ) : ( u >= tw ) ? u % tw : u;
                v = ( v < 0 ) ? th - ( - v % th ) : ( v >= th ) ? v % th : v;

                var x_ = (x - u)>>0;
                var y_ = (y - v)>>0;

                x_ = ( x_ < 0 ) ? width - ( - x_ % width ) : ( x_ >= width ) ? x_ % width : x_;
                y_ = ( y_ < 0 ) ? height - ( - y_ % height ) : ( y_ >= height ) ? y_ % height : y_;

                var p = ((y*width) + x) * 4;
                var p_ = ((y_*width) + x_) * 4;

                var alpha = 0.05;
                dst[p] = blend(src[p_],dst[p],alpha);
                dst[p + 1] = blend(src[p_ + 1 ], dst[p + 1],alpha);
                dst[p + 2] = blend(src[p_ + 2 ],dst[p + 2],alpha);

            }
        }

        var r = 128 + Math.sin(c/100) * 128;
        var g = 128 + Math.sin(c/150) * 128;
        var b = 128 + Math.sin(c/75) * 128;


        drawWave('rgb('+r+','+g+','+b+')',2,data.audioData,data.bufferLength,ctxBackground);

        zoom(dst,c);


    };


    function zoom(dst,c){


        for (y = 0; y<height; y++){
            for ( x = 0; x<width; x++){

                var cx = x-centerX + Math.sin(c/40) * 100;
                var cy = y-centerY + Math.sin(c/50) * 80;

                v = 0.2 * Math.sin(x/100) / Math.PI;

                var x_ = (x - (v*cx)>>0);
                var y_ = (y - (v*cy)>>0);

                var p = ((y*width) + x) * 4;
                var p_ = ((y_*width) + x_) * 4;

                dst[p] = blend(dst[p_],dst[p],0.1);
                dst[p+1] = blend(dst[p_+1],dst[p+1],0.1);
                dst[p+2] = blend(dst[p_+2],dst[p+2],0.1);

            }
        }
    }

    return me;

}();

export default glass;
var zoom = function(){
    var me = {};
    var width,height,ctx,tileSize,blend;

    var x, y, u, v, w_, pi = Math.PI;
    
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

                var cx = x-centerX + Math.sin(c/20) * 100;
                var cy = y-centerY + Math.sin(c/25) * 80;

                v = 0.2 * Math.sin(x/100) / pi;

                var x_ = (x - (v*cx)>>0);
                var y_ = (y - (v*cy)>>0);


                var p = ((y*width) + x) * 4;
                var p_ = ((y_*width) + x_) * 4;

                dst[p] = blend(src[p_],dst[p],alpha);
                dst[p+1] = blend(src[p_+1],dst[p+1],alpha);
                dst[p+2] = blend(src[p_+2],dst[p+2],alpha);

            }
        }
    };

    return me;

}();

export default zoom;
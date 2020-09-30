// based on MrDoob

var tunnel = function(){
    var me = {};

    var width,height,ctx,tileSize,blend;

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

            tw = tileSize;
            th = tileSize;

            centerX = width/2;
            centerY = height/2;

            resolve();
        });
    };

    me.render = function(data){
        console.error("ok");
        if (!data.pixelsDataTexture) return;

        var dst = data.pixelsDataMain;
        var src = data.pixelsDataTexture;

        var c = data.counter;

        for (var yi = 0; yi < height; yi++ ) {
            for ( var xi = 0; xi < width; xi++ ) {

                x = xi - centerX + Math.sin(c/25) * 60;
                y = yi - centerY + Math.sin(c/35) * 50;
                
                a = Math.atan2( y, x );
                r = Math.sqrt( x * x + y * y );

                u = 20 / r;
                v = 0.5 * a / pi;
                w_ = r * 0.01;

                u = u * tw + (-Math.sin(c/100) * 4 * 100);
                v = v * th;

                u = ( u < 0 ) ? tw - ( - u % tw ) : ( u >= tw ) ? u % tw : u;
                v = ( v < 0 ) ? th - ( - v % th ) : ( v >= th ) ? v % th : v;

                src_index = ( ( ( u >> 0 ) + ( v >> 0 ) * tw ) * 4 ) >>> 0;
                dst_index = ( xi + yi * width ) * 4;

            var alpha = 0.1;
                dst[ dst_index ] = blend(src[ src_index] * w_,dst[ dst_index ],alpha);
                dst[ dst_index + 1 ] = blend(src[ src_index + 1 ]* w_, dst[ dst_index + 1 ],alpha);
                dst[ dst_index + 2 ] = blend(src[ src_index + 2 ]* w_,dst[ dst_index + 2 ],alpha);

            }
        }

        return{
            nextTile:true
        }
    };

    return me;

}();

export default tunnel;
// taken from https://towardsdatascience.com/fun-with-html-canvas-lets-make-lava-lamp-plasma-e4b0d89fe778
//https://codesandbox.io/s/crazy-surf-jci4z


var tunnel = function(){
    var me = {};

    var width,height,ctx,tileSize,blend;

    var tw,th;

    var src_index, dst_index,
        x, y, u, v, w_, a, r, pi = Math.PI;

    var centerX;
    var centerY;

    var mapSize;

    const distance = (x, y) => Math.sqrt(x * x + y * y);
    const heightMap1 = [];
    const heightMap2 = [];



    mapSize = 512;
    for (let u = 0; u < mapSize; u++) {
        for (let v = 0; v < mapSize; v++) {
            // index of coordinate in height map array
            const i = u * mapSize + v;

            // u,v are coordinates with origin at upper left corner
            // cx and cy are coordinates with origin at the
            // center of the map
            const cx = u - mapSize / 2;
            const cy = v - mapSize / 2;

            // distance from middle of map
            const d = distance(cx, cy);

            // stretching so we get the desired ripple density on our map
            const stretch = (3 * Math.PI) / (mapSize / 2);

            // wavy height value between -1 and 1
            const ripple = Math.sin(d * stretch);

            // wavy height value normalized to 0..1
            const normalized = (ripple + 1) / 2;

            // height map value 0..128, integer
            heightMap1[i] = Math.floor(normalized * 128);
        }
    }

    for (let u = 0; u < mapSize; u++) {
        for (let v = 0; v < mapSize; v++) {
            const i = u * mapSize + v;
            const cx = u - mapSize / 2;
            const cy = v - mapSize / 2;

            // skewed distance as input to chaos field calculation,
            // scaled for smoothness over map distance
            const d1 = distance(0.8 * cx, 1.3 * cy) * 0.022;
            const d2 = distance(1.35 * cx, 0.45 * cy) * 0.022;

            const s = Math.sin(d1);
            const c = Math.cos(d2);
            // height value between -2 and +2
            const h = s + c;

            // height value between 0..1
            const normalized = (h + 2) / 4;
            // height value between 0..127, integer
            heightMap2[i] = Math.floor(normalized * 127);
        }
    }




    const interpolate = (c1, c2, f) => {
        return {
            r: Math.floor(c1.r + (c2.r - c1.r) * f),
            g: Math.floor(c1.g + (c2.g - c1.g) * f),
            b: Math.floor(c1.b + (c2.b - c1.b) * f)
        };
    };

    // returns a random color
    const randomColor = () => {
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        return { r, g, b };
    };

    // returns a random color palette with 256 color entries
    const makeRandomPalette = () => {
        const c1 = randomColor();
        const c2 = randomColor();
        const c3 = randomColor();
        const c4 = randomColor();
        const c5 = randomColor();

        return makeFiveColorGradient(c1, c2, c3, c4, c5);
    };

    const makeFiveColorGradient = (c1, c2, c3, c4, c5) => {
        const g = [];

        for (let i = 0; i < 64; i++) {
            const f = i / 64;
            g[i] = interpolate(c1, c2, f);
        }

        for (let i = 64; i < 128; i++) {
            const f = (i - 64) / 64;
            g[i] = interpolate(c2, c3, f);
        }

        for (let i = 128; i < 192; i++) {
            const f = (i - 128) / 64;
            g[i] = interpolate(c3, c4, f);
        }

        for (let i = 192; i < 256; i++) {
            const f = (i - 192) / 64;
            g[i] = interpolate(c4, c5, f);
        }

        return g;
    };

    // offsets for moving height maps
    let dx1 = 0;
    let dy1 = 0;

    let dx2 = 0;
    let dy2 = 0;

    // adjust height maps offsets
    const moveHeightMaps = t => {
        dx1 = Math.floor(
            (((Math.cos(t * 0.0002 + 0.4 + Math.PI) + 1) / 2) * mapSize) / 2
        );
        dy1 = Math.floor((((Math.cos(t * 0.0003 - 0.1) + 1) / 2) * mapSize) / 2);
        dx2 = Math.floor((((Math.cos(t * -0.0002 + 1.2) + 1) / 2) * mapSize) / 2);
        dy2 = Math.floor(
            (((Math.cos(t * -0.0003 - 0.8 + Math.PI) + 1) / 2) * mapSize) / 2
        );
    };

    // two palettes we interpolate between
    const palettes = [makeRandomPalette(), makeRandomPalette()];
    console.error(palettes);

    // current palette is established durting animation
    let palette = [];

    // stores whether we're interpolating colors
    // from palette 0 -> 1 (1) or 1 -> 0 (-1)
    let prevDirection = 1;

    const updatePalette = t => {
        const timeScale = 0.0005;
        const x = t * timeScale;

        // normalized value 0..1 used to interpolate palette colors
        const inter = (Math.cos(x) + 1) / 2;

        // did we switch direction, and should ergo pick a new palette
        // random palette to interpolate towards?

        const direction = -Math.sin(x) >= 0 ? 1 : -1;
        if (prevDirection != direction) {
            prevDirection = direction;
            if (direction == -1) {
                palettes[0] = makeRandomPalette();
            } else {
                palettes[1] = makeRandomPalette();
            }
        }

        // create interpolated palette for current frame
        for (let i = 0; i < 256; i++) {
            palette[i] = interpolate(palettes[0][i], palettes[1][i], inter);
        }
    };

    const linearGradient = (c1, c2) => {
        const g = [];

        // interpolate between the colors
        // in the gradient

        for (let i = 0; i < 256; i++) {
            const f = i / 255;
            g[i] = interpolate(c1, c2, f);
        }

        return g;
    };

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

        if (!data.pixelsDataTexture) return;

        var dst = data.pixelsDataMain;
        var src = data.pixelsDataTexture;

        var t = data.counter;

        moveHeightMaps(t*200);
        updatePalette(t*100);

        //console.error( palette);

        for (let u = 0; u < height; u++) {
            for (let v = 0; v < width; v++) {
                // indexes into height maps for pixel
                const i = (u + dy1) * mapSize + (v + dx1);
                const k = (u + dy2) * mapSize + (v + dx2);

                // index for pixel in image data
                // remember it's 4 bytes per pixel
                const j = u * width * 4 + v * 4;

                // height value of 0..255
                let h = heightMap1[i] + heightMap2[k];
                // get color value from current palette


                let c = palette[h];

                // h = heightMap2[i];
                // c = { r: h, g: h, b: h };

                // set pixel data
                var alpha = 0.1;
                dst[j] = blend(c.r,dst[j],alpha);
                dst[j + 1] = blend(c.g,dst[j+1],alpha);
                dst[j + 2] = blend(c.b,dst[j+2],alpha);
            }
        }

    };

    return me;

}();

export default tunnel;
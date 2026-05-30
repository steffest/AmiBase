import eruda from 'https://cdn.jsdelivr.net/npm/eruda@3.4.1/+esm'

let Eruda = () => {
    let me =  {};

    me.init = (amiWindow,context)=>{
        amiWindow.setSize(300,200);
        let container = amiWindow.getInner();
        let elm = document.createElement('div');
        amiWindow.getInner().appendChild(elm);

        eruda.init({
            container: elm,
            useShadowDom: true,
            autoScale: true,
            inline: true
        });
    }

    return me;
}

export default Eruda;
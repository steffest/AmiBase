export default function scriptLoader(list){
    return new Promise((next,reject)=>{
        if (list && list.length){
            var loadCount = 0;
            var loadTarget = list.length;

            if (typeof list[0] === "string"){
                // load all scripts in parallel
                list.forEach(function(src){
                    loadScript(src,function(){
                        loadCount++;
                        if (loadCount>=loadTarget){
                           next();
                        }
                    });
                })
            }else{
                // load scripts in sequential groups;
                function loadNextGroup(){
                    var group = list.shift();
                    var loadCount = 0;
                    var loadTarget = group.length;
                    group.forEach(function(src){
                        loadScript(src,function(){
                            loadCount++;
                            if (loadCount>=loadTarget){
                                if (list.length){
                                    loadNextGroup();
                                }else{
                                    next();
                                }
                            }
                        });
                    })
                }
                loadNextGroup();
            }
        }
    });

    function loadScript(src,onload){
        var script = document.createElement('script');
        script.src = src;
        if (onload) script.onload = onload;
        document.body.appendChild(script);
    }
}



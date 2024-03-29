var FetchService = function() {

	// somewhat Jquery syntax compatible for easy portability

	var me = {};

	var defaultAjaxTimeout = 30000;

	me.get = function(url,_next){
		return new Promise((resolve) => {
			var next = _next || resolve;
			me.ajax({
				url : url,
				success: function(data){next(data)},
				error: function(xhr){next(undefined,xhr)}
			});
		});
	};

	me.post = function(url,data,_next){
		return new Promise(resolve=>{
			let next = _next || resolve;

			var sData = data;
			if (typeof data === "object"){
				sData = "";
				for (var key in data){
					if (data.hasOwnProperty(key)){
						sData += "&" + key + "=" + encodeURIComponent(data[key]);
					}
				}
				if (sData.length) sData = sData.substr(1);
			}
			me.ajax({
				method: "POST",
				url : url,
				data: sData,
				datatype: "form",
				success: function(data){next(data)},
				error: function(xhr){next(undefined,xhr)}
			})

		});
	};

	me.sendBinary = function(url,data,onProgress){
		return new Promise(function(next){
			me.ajax({
				method: "POST",
				url : url,
				data: data,
				datatype: "json",
				success: function(data){next(data)},
				error: function(xhr){next(undefined,xhr)},
				progress: onProgress
			})
		});

	};

	me.json = function(url,callback){
		return new Promise(function(resolve){
			var next = callback || resolve;
			me.ajax({
				url : url,
				cache: false,
				datatype: "json",
				headers: [{key:"Accept", value:"application/json"}],
				success: function(data){next(data)},
				error: function(xhr){next(undefined,xhr)}
			});
		});
	};

	me.html = function(url,callback){
		return new Promise(function(resolve){
			let next = callback || resolve;
			me.ajax({
				url : url,
				cache: false,
				datatype: "html",
				success: function(data){next(data)},
				error: function(xhr){next(undefined,xhr)}
			});
		});
	};

	me.arrayBuffer = function(url,callback){
		return new Promise(function(resolve,reject){
			var next = callback || resolve;
			me.ajax({
				url : url,
				cache: false,
				datatype: "arrayBuffer",
				success: function(data){next(data)},
				error: function(xhr){next(undefined,xhr)}
			});
		});
	};


	me.ajax = function(config){

		var xhr = new XMLHttpRequest();

		config.error = config.error || function(){config.success(false)};

		if (config.datatype === "arrayBuffer"){
			xhr.responseType = "arraybuffer"
		}

		var url = config.url;

		if (typeof config.cache === "boolean" && !config.cache){
			var r = new Date().getTime();
			url += url.indexOf("?")>0 ? "&r=" + r : "?r=" + r;
		}

		var method = config.method || "GET";
		var length = 0;
		if (config.data) length = config.data.length;

		xhr.onreadystatechange = function(){
			if(xhr.readyState < 4) {
				return;
			}
			if(xhr.readyState === 4) {
				if(xhr.status !== 200 && xhr.status !== 201) {
					config.error(xhr);
				}else{
					var result;

					if (config.datatype === "arrayBuffer"){
						result = xhr.response;
					}else{
						result = xhr.responseText;

						if (config.datatype === "json") {
							try {result = JSON.parse(result)} catch (e){}
						}

						if (config.datatype === "html"){
							result = document.createElement("div");
							result.innerHTML = xhr.responseText;
						}

					}

					config.success(result);
				}
			}
		};

		xhr.ontimeout = function (e) {
			console.error(log.error() + "timeout while getting " + url);
		};


		if (config.progress){
			xhr.upload.onprogress = function(e){
				if (config.progress) config.progress({
					loaded: e.loaded,
					total: e.total,
					computable: e.lengthComputable
				});
			}

			xhr.onprogress = function(e){
				if (config.progress) config.progress({
					loaded: e.loaded,
					total: e.total,
					computable: e.lengthComputable
				});
			}
		}


		xhr.open(method, url, true);
		xhr.timeout = config.timeout || defaultAjaxTimeout;

		if (config.headers){
			config.headers.forEach(function(header){
				xhr.setRequestHeader(header.key, header.value);
			})
		}

		var data = config.data || '';
		if (method === "POST" && config.data && config.datatype === "form"){
			xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		}

		xhr.send(data);
	};


	return me;
};

export default FetchService();


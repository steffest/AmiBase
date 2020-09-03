var FILETYPE={
	unknown: {
		id: 0
	}
};

var FileType = function(){
	var me = {};

	var fileTypeCounter = 1;
	var handlers = [];
	var registeredFileExtentions={};

	me.register = function(handler){
		console.log("Registering " + handler.name);
		if (handler.fileTypes){
			for (var key in handler.fileTypes){
				if (handler.fileTypes.hasOwnProperty(key)){
					fileTypeCounter++;
					var type = handler.fileTypes[key];
					FILETYPE[key] = {
						id: fileTypeCounter,
						name: type.name,
						handler: handler,
						actions: type.actions,
						inspect: type.inspect,
						className: type.className
					}
				}
			}
		}
		if (handler.registeredFileExtentions){
			for (var key in handler.registeredFileExtentions){
				if (handler.registeredFileExtentions.hasOwnProperty(key)){
					registeredFileExtentions[key] = handler.registeredFileExtentions[key]();
				}
			}
		}
		handlers.push(handler);
	};

	me.getRegisteredFileExtentions = function(){
		return registeredFileExtentions;
	};

	me.detect = function(fileData,name){
		var file = BinaryStream(fileData.buffer,true);
		var fileFormat;

		for (var i = 0, max = handlers.length;i<max;i++){
			fileFormat = handlers[i].detect(file);
			if (fileFormat) break;
		}

		if (fileFormat){
			fileFormat.file = file;
			if (fileFormat.inspect) fileFormat.info = fileFormat.handler.inspect(file);
		}

		if (!fileFormat){
			fileFormat = detectFromFileExtention(name);
		}

		return fileFormat;
	};

	function detectFromFileExtention(name){
		var extention = name.split(".").pop().toLowerCase();
		return registeredFileExtentions[extention] || FILETYPE.unknown;
	}

	return me;
}();
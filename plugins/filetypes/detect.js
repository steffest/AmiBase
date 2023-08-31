import fileSystem from "../../../_script/system/filesystem.js";

import base from "./filehandlers/base.js";
import mod from "./filehandlers/mod.js";
import iff from "./filehandlers/iff.js";
import icon from "./filehandlers/icon.js";

window.FILETYPE={
	unknown: {
		id: 0,
		actions: [{label: "hex edit", plugin:"hex"}]
	}
};

var FileType = function(){
	var me = {};

	var fileTypeCounter = 1;
	var handlers = [];
	var registeredFileExtensions={};

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
						className: type.className,
						classType: type.classType,
						mountFileSystem: type.mountFileSystem,
						customIcon: type.customIcon
					}

					if (type.fileExtensions){
						type.fileExtensions.forEach(ext=>{
							registeredFileExtensions[ext] = FILETYPE[key];
						})
					}
				}
			}
		}

		/*if (handler.registeredFileExtentions){
			for (var key in handler.registeredFileExtentions){
				if (handler.registeredFileExtentions.hasOwnProperty(key)){
					registeredFileExtentions[key] = handler.registeredFileExtentions[key]();
				}
			}
		}*/

		handlers.push(handler);
	};

	me.getRegisteredFileExtensions = function(){
		return registeredFileExtensions;
	};

	me.detect = async function(file,tryHard,retry){

		var fileType;

		if (typeof file === "string"){
			file = {name: file}
		}
		
		if (file){
			if (file.binary){
				for (var i = 0, max = handlers.length;i<max;i++){
					fileType = handlers[i].detect(file.binary);
					if (fileType) break;
				}
			}else{
				if (!file.name){
					var url = file.url || file.path;
					if (url) file.name = url.split("/").pop();
				}

				// it might be expensive fetching the file content
				// only use when file name is not known
				if (!file.name){
					file.binary =  await fileSystem.readFile(file,true);
					return await me.detect(file,tryHard);
				}
			}
			
		}

		if (fileType){
			if (fileType.inspect) fileType.info = fileType.handler.inspect(file);
		}else{
			fileType = me.detectFromFileExtension(file.name);

			if (fileType.id === FILETYPE.unknown.id && tryHard && !file.binary && !retry){
				// get file content and try again
				file.binary = await fileSystem.readFile(file,true);
				return await me.detect(file,tryHard,true);
			}
		}

		return fileType;
	};

	me.detectFromFileExtension = function(name){
		let extension = name.split(".").pop().toLowerCase();
		return registeredFileExtensions[extension] || FILETYPE.unknown;
	}

	me.register(base);
	me.register(mod);
	me.register(icon);
	me.register(iff);

	return me;
};

export default FileType();
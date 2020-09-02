var IconSet = function(){
	var me = {};
	
	var container;
	var apiBase = "http://localhost:4555/";

	me.init = function(){
		var panel = UI.createPanel("Iconset","","iconset");
		container = $div("inner");
		panel.appendChild(container);
		UI.mainContainer.appendChild(panel);
	};
	
	me.listIconSets = function(next){
		var apiUrl = apiBase +  "list";
		FetchService.json(apiUrl,function(result){
			next(result);
		});
	};
	
	me.loadSet = function(setName){
		var apiUrl = apiBase +  "list" + "/" + setName;
		FetchService.json(apiUrl,function(result){
			if (result && result.data){
				me.renderFolder(container,result.data.folders,result.data.files,setName);
			}
		});
		
	};
	
	me.renderFolder = function(parent,folders,files,path){
		parent.innerHTML = "";

		var col = 0;
		var row = 0;

		var top = parent.classList.contains("innerwindow") ? 0 : 30;
		
		folders.forEach(function(folderName){
			var folder = createFolder(folderName,path);
			folder.style.left = (col*50) + "px";
			folder.style.top = (top + (row*60)) + "px";
			col++;
			if (col>4){
				col = 0;
				row++;
			}
			parent.appendChild(folder);
		});

		files.forEach(function(fileName){
			var ext = fileName.split(".").pop().toLowerCase();
			if (ext === "info"){
				var icon = createIcon(fileName,path);
				icon.style.left = (col*50) + "px";
				icon.style.top = (top + (row*60)) + "px";
				col++;
				if (col>4){
					col = 0;
					row++;
				}
				parent.appendChild(icon);
			}
			//var folder = createFolder(folderName,path);
			//parent.appendChild(folder);
		});
	};
	
	me.openFolder = function(name,path){
		var window = createWindow(name,path);

		var apiUrl = apiBase +  "list" + "/" + path;
		FetchService.json(apiUrl,function(result){
			if (result && result.data && result.data){
				me.renderFolder(window,result.data.folders,result.data.files,path);
			}
		});
		
	};

	me.loadIcon = function(path,next){
		var apiUrl = apiBase +  "get" + "/" + path;
		FetchService.arrayBuffer(apiUrl,function(result,error){
			console.error(result);
			var file = BinaryStream(result,true);
			var icon = Icon.parse(file);
			if (icon && icon.info){
				icon.info.path = path;
				next(icon);
			}else{
				next();
			}
		});

	};
	
	function createFolder(name,path){
		var label = $div("label","",name);
		var folder = $div("folder","",label);
		UI.enableDrag(folder);
		folder.ondblclick = function(){
			me.openFolder(name,path + "/" + name);
		};
		UI.enableDrag(folder);
		return folder;
	}

	function createIcon(name,path){
		var label = $div("label","",name);
		var image = $div("image");
		var iconElm = $div("icon","",image);
		iconElm.appendChild(label);

		var fullPath = path || "";
		if (fullPath) fullPath += "/";
		fullPath += name;
		iconElm.path = fullPath;

		var canvas1, canvas2;

		me.loadIcon(path + "/" + name,function(icon){
			if (icon){
				canvas1 = Icon.getImage(icon,0);
				canvas1.className = "state1";
				canvas2 = Icon.getImage(icon,1);
				canvas2.className = "state2";
				image.appendChild(canvas1);
				image.appendChild(canvas2);
				iconElm.classList.add("loaded");
			}
		});
		UI.enableDrag(iconElm,"",true);

		iconElm.ondblclick = function(){
			IconEditor.editIconDualState(canvas1,canvas2);
			//me.openFolder(name,path + "/" + name);
		};
		return iconElm;
	}
	
	function createWindow(name,path){
		var window = $div("window");
		var windowBar =  $div("bar","",name);
		var inner = $div("inner innerwindow droptarget");
		var sizer = $div("sizer");
		var close = $div("close");
		windowBar.appendChild(close);
		window.appendChild(windowBar);
		window.appendChild(inner);
		window.appendChild(sizer);

		container.appendChild(window);
		UI.enableDrag(window,windowBar);
		UI.enableResize(window,sizer);
		close.onclick = function(){
			window.remove();
		};


		inner.ondrop = function(sourceElement,dragElement){
			console.error(sourceElement);
			console.error(sourceElement.path);

			inner.appendChild(sourceElement);
			var pos = getElementPosition(inner);
			var offsetX = dragElement.offsetLeft - pos.left;
			var offsetY = dragElement.offsetTop - pos.top;
			sourceElement.style.left = offsetX + "px";
			sourceElement.style.top = offsetY + "px";

			console.log("Moving icon " + sourceElement.path + " to " + path);
			me.moveFile(sourceElement.path,path);

		};
		return inner;
	}

	me.moveFile = function(source,target){
		var url = apiBase + "move/" + source + "?to=" + target;
		FetchService.json(url,function(result){
			console.log(result);
		});
	};
	
	
	return me;
}();
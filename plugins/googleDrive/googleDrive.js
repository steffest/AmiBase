import fileSystem from "../../_script/system/filesystem.js";
import BinaryStream from "../binaryStream/binaryStream.js";
import user from "../../_script/user.js";
import {getToken} from "./connect.js";

let GoogleDrive = function(){
    let me = {};
    let activeToken = "";
    let activeMount = "";
    let checkedToken = false;
    let folderCache = {"": "root"};
    let fileCache = {};

    fileSystem.register("googleDrive", me);

    me.isReadOnly = function(file){
        return !activeToken;
    };

    me.getDirectory = async function(path, config){
        let token = await ensureToken(config);
        if (!token) return {directories: [], files: []};

        let folderPath = normalizeFolderPath(path);
        let folderId = await resolveFolderId(folderPath, token);
        if (!folderId) return {directories: [], files: []};

        let entries = await listChildren(folderId, token);
        let directories = [];
        let files = [];

        entries.forEach(entry=>{
            let entryPath = joinPath(folderPath, entry.name, entry.mimeType === FOLDER_MIME);
            fileCache[entryPath] = entry.id;
            if (entry.mimeType === FOLDER_MIME){
                folderCache[entryPath] = entry.id;
                directories.push({name: entry.name});
            }else{
                files.push({name: entry.name});
            }
        });

        return {directories: directories, files: files};
    };

    me.readFile = async function(path, binary, config){
        let token = await ensureToken(config);
        if (!token) return binary ? BinaryStream(new ArrayBuffer(0), true) : "";

        let filePath = normalizeFilePath(path);
        let fileId = await resolveFileId(filePath, token);
        if (!fileId) return binary ? BinaryStream(new ArrayBuffer(0), true) : "";

        let response = await request("GET", "/drive/v3/files/" + encodeURIComponent(fileId) + "?alt=media", token, null, true);
        if (!response) return binary ? BinaryStream(new ArrayBuffer(0), true) : "";

        if (binary){
            let buffer = await response.arrayBuffer();
            return BinaryStream(buffer, true);
        }

        return await response.text();
    };

    me.writeFile = async function(path, content, binary, config){
        let token = await ensureToken(config);
        if (!token) return false;

        let filePath = normalizeFilePath(path);
        let fileName = getLastPart(filePath);
        let parentPath = getParentPath(filePath);
        let parentId = await resolveFolderId(parentPath, token);
        if (!parentId || !fileName) return false;

        let existing = await findChildByName(parentId, fileName, token, false);
        let body = binary ? content.buffer : content;
        if (!binary && typeof body !== "string") body = "" + body;

        if (existing){
            let contentType = binary ? "application/octet-stream" : "text/plain;charset=UTF-8";
            let response = await request("PATCH", "/upload/drive/v3/files/" + encodeURIComponent(existing.id) + "?uploadType=media", token, body, true, {
                "Content-Type": contentType
            });
            return !!response;
        }

        let created = await request("POST", "/drive/v3/files", token, {
            name: fileName,
            parents: [parentId]
        });
        if (!created || !created.id) return false;

        let contentType = binary ? "application/octet-stream" : "text/plain;charset=UTF-8";
        let upload = await request("PATCH", "/upload/drive/v3/files/" + encodeURIComponent(created.id) + "?uploadType=media", token, body, true, {
            "Content-Type": contentType
        });
        if (!upload) return false;

        fileCache[filePath] = created.id;
        return true;
    };

    me.createDirectory = async function(path, newName, config){
        let token = await ensureToken(config);
        if (!token) return false;

        let folderPath = normalizeFolderPath(path);
        let parentId = await resolveFolderId(folderPath, token);
        if (!parentId || !newName) return false;

        let created = await request("POST", "/drive/v3/files", token, {
            name: newName,
            mimeType: FOLDER_MIME,
            parents: [parentId]
        });

        if (created && created.id){
            folderCache[joinPath(folderPath, newName, true)] = created.id;
            return true;
        }
        return false;
    };

    me.deleteFile = async function(path, config){
        return await deleteByPath(path, config);
    };

    me.deleteDirectory = async function(path, config){
        return await deleteByPath(path, config);
    };

    me.renameFile = async function(path, newName, config){
        let token = await ensureToken(config);
        if (!token) return false;

        let filePath = normalizeFilePath(path);
        let fileId = await resolveFileId(filePath, token);
        if (!fileId || !newName) return false;

        let result = await request("PATCH", "/drive/v3/files/" + encodeURIComponent(fileId), token, {name: newName});
        if (!result) return false;

        let parentPath = getParentPath(filePath);
        delete fileCache[filePath];
        fileCache[joinPath(parentPath, newName, false)] = fileId;
        return true;
    };

    me.moveFile = async function(fromPath, toPath, config){
        let token = await ensureToken(config);
        if (!token) return false;

        let sourcePath = normalizeFilePath(fromPath);
        let fileId = await resolveFileId(sourcePath, token);
        if (!fileId) return false;

        let targetFolder = normalizeFolderPath(toPath);
        let targetFolderId = await resolveFolderId(targetFolder, token);
        if (!targetFolderId) return false;

        let info = await request("GET", "/drive/v3/files/" + encodeURIComponent(fileId) + "?fields=parents", token);
        if (!info || !info.parents || !info.parents.length) return false;

        let result = await request(
            "PATCH",
            "/drive/v3/files/" + encodeURIComponent(fileId) + "?addParents=" + encodeURIComponent(targetFolderId) + "&removeParents=" + encodeURIComponent(info.parents.join(",")),
            token,
            null
        );
        return !!result;
    };

    me.copyFile = async function(fromPath, toPath, config){
        let token = await ensureToken(config);
        if (!token) return false;

        let sourcePath = normalizeFilePath(fromPath);
        let fileId = await resolveFileId(sourcePath, token);
        if (!fileId) return false;

        let targetFolder = normalizeFolderPath(toPath);
        let targetFolderId = await resolveFolderId(targetFolder, token);
        if (!targetFolderId) return false;

        let name = getLastPart(sourcePath);
        let result = await request("POST", "/drive/v3/files/" + encodeURIComponent(fileId) + "/copy", token, {
            name: name,
            parents: [targetFolderId]
        });

        return !!(result && result.id);
    };

    me.getUniqueName = async function(path, name, config){
        let token = await ensureToken(config);
        if (!token) return name;

        let folderPath = normalizeFolderPath(path);
        let folderId = await resolveFolderId(folderPath, token);
        if (!folderId) return name;

        let entries = await listChildren(folderId, token);
        let names = entries.map(entry=>entry.name);
        if (names.indexOf(name) < 0) return name;

        let extension = "";
        let dotPos = name.lastIndexOf(".");
        if (dotPos > 0){
            extension = name.substring(dotPos);
            name = name.substring(0, dotPos);
        }

        let i = 2;
        let candidate = name + i + extension;
        while (names.indexOf(candidate) >= 0){
            i++;
            candidate = name + i + extension;
        }
        return candidate;
    };

    me.getUrl = async function(path, config){
        let token = await ensureToken(config);
        if (!token) return "";

        let fileId = await resolveFileId(normalizeFilePath(path), token);
        if (!fileId) return "";

        let info = await request("GET", "/drive/v3/files/" + encodeURIComponent(fileId) + "?fields=webContentLink,webViewLink", token);
        if (info){
            return info.webContentLink || info.webViewLink || ("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?alt=media&access_token=" + encodeURIComponent(token));
        }
        return "";
    };

    const FOLDER_MIME = "application/vnd.google-apps.folder";

    async function deleteByPath(path, config){
        let token = await ensureToken(config);
        if (!token) return false;

        let cleanPath = normalizeFilePath(path);
        let fileId = await resolveFileId(cleanPath, token);
        if (!fileId) return false;

        let result = await request("DELETE", "/drive/v3/files/" + encodeURIComponent(fileId), token, null, true);
        delete folderCache[cleanPath];
        delete fileCache[cleanPath];
        return result !== null;
    }

    async function ensureToken(config){
        config = config || {};
        let mountKey = config.id || config.label || config.login || "googleDrive";

        if (mountKey !== activeMount){
            activeMount = mountKey;
            activeToken = config.pass || "";
            checkedToken = false;
            folderCache = {"": "root"};
            fileCache = {};
        }

        if (!activeToken){
            activeToken = config.pass || "";
        }

        if (!activeToken && config.login){
            activeToken = await getToken(config.login);
            if (activeToken){
                await storeToken(config, activeToken);
            }
        }

        if (!activeToken) return "";
        if (checkedToken) return activeToken;

        let valid = await verifyToken(activeToken);
        if (!valid && config.login){
            activeToken = await getToken(config.login);
            if (activeToken){
                await storeToken(config, activeToken);
                valid = true;
            }
        }

        checkedToken = valid;
        if (!valid) activeToken = "";
        return activeToken;
    }

    async function verifyToken(token){
        let response = await request("GET", "/drive/v3/about?fields=user", token, null, true, {}, true);
        return !!response;
    }

    async function storeToken(config, token){
        config.pass = token;
        let settings = await user.getAmiSettings();
        settings.mounts = settings.mounts || [];
        let mount = settings.mounts.find(item=>{
            if (config.id && item.id) return item.id === config.id;
            return item.handler === "googleDrive" && item.login === config.login;
        });
        if (mount){
            mount.pass = token;
            await user.setAmiSettings(settings);
        }
    }

    async function resolveFolderId(folderPath, token){
        if (!folderPath) return "root";
        if (folderCache[folderPath]) return folderCache[folderPath];

        let parts = folderPath.split("/").filter(Boolean);
        let currentId = "root";
        let currentPath = "";

        for (let i = 0; i < parts.length; i++){
            currentPath = currentPath + parts[i] + "/";
            if (folderCache[currentPath]){
                currentId = folderCache[currentPath];
                continue;
            }

            let child = await findChildByName(currentId, parts[i], token, true);
            if (!child) return "";

            currentId = child.id;
            folderCache[currentPath] = currentId;
        }

        return currentId;
    }

    async function resolveFileId(filePath, token){
        if (!filePath) return "";
        if (fileCache[filePath]) return fileCache[filePath];

        let parentPath = getParentPath(filePath);
        let parentId = await resolveFolderId(parentPath, token);
        if (!parentId) return "";

        let fileName = getLastPart(filePath);
        if (!fileName) return "";

        let child = await findChildByName(parentId, fileName, token, false);
        if (!child) return "";

        fileCache[filePath] = child.id;
        return child.id;
    }

    async function findChildByName(parentId, name, token, foldersOnly){
        let query = "'" + escapeQueryValue(parentId) + "' in parents and trashed=false and name='" + escapeQueryValue(name) + "'";
        if (foldersOnly) query += " and mimeType='" + FOLDER_MIME + "'";

        let result = await request("GET", "/drive/v3/files?q=" + encodeURIComponent(query) + "&fields=files(id,name,mimeType)&pageSize=100", token);
        if (!result || !result.files || !result.files.length) return null;
        return result.files[0];
    }

    async function listChildren(folderId, token){
        let query = "'" + escapeQueryValue(folderId) + "' in parents and trashed=false";
        let result = [];
        let pageToken = "";

        do {
            let url = "/drive/v3/files?q=" + encodeURIComponent(query)
                + "&fields=files(id,name,mimeType),nextPageToken"
                + "&orderBy=folder,name"
                + "&pageSize=1000";
            if (pageToken) url += "&pageToken=" + encodeURIComponent(pageToken);

            let page = await request("GET", url, token);
            if (!page) break;

            if (page.files && page.files.length){
                result = result.concat(page.files);
            }
            pageToken = page.nextPageToken || "";
        } while (pageToken);

        return result;
    }

    async function request(method, endpoint, token, body, rawResponse, extraHeaders, allowUnauthorized){
        let headers = {
            Authorization: "Bearer " + token
        };

        extraHeaders = extraHeaders || {};
        Object.keys(extraHeaders).forEach(key=>{
            headers[key] = extraHeaders[key];
        });

        let payload = body;
        if (body && typeof body === "object" && !(body instanceof ArrayBuffer) && !(body instanceof Blob) && !rawResponse){
            headers["Content-Type"] = "application/json";
            payload = JSON.stringify(body);
        }

        let response;
        try{
            response = await fetch("https://www.googleapis.com" + endpoint, {
                method: method,
                headers: headers,
                body: method === "GET" || method === "DELETE" ? undefined : payload
            });
        }catch (e){
            return null;
        }

        if (response.status === 401){
            checkedToken = false;
            activeToken = "";
            if (allowUnauthorized) return null;
            return null;
        }
        if (!response.ok) return null;

        if (rawResponse){
            return response;
        }

        if (response.status === 204) return {};

        try{
            return await response.json();
        }catch (e){
            return {};
        }
    }

    function getPath(path){
        if (!path) return "";
        let volumePos = path.indexOf(":");
        if (volumePos >= 0) path = path.substring(volumePos + 1);
        if (path.indexOf("/") === 0) path = path.substring(1);
        return path;
    }

    function normalizeFolderPath(path){
        path = getPath(path);
        if (!path) return "";
        if (!path.endsWith("/")) path += "/";
        return path;
    }

    function normalizeFilePath(path){
        path = getPath(path);
        if (!path) return "";
        if (path.endsWith("/")) path = path.substring(0, path.length - 1);
        return path;
    }

    function getParentPath(path){
        if (!path) return "";
        let parts = path.split("/");
        parts.pop();
        if (!parts.length) return "";
        return parts.join("/") + "/";
    }

    function getLastPart(path){
        if (!path) return "";
        let parts = path.split("/").filter(Boolean);
        if (!parts.length) return "";
        return parts[parts.length - 1];
    }

    function joinPath(base, name, isFolder){
        let path = base || "";
        path += name;
        if (isFolder) path += "/";
        return path;
    }

    function escapeQueryValue(value){
        return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    }

    return me;
};

export default GoogleDrive();


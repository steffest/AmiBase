import user from "../../user.js";

export function createRemoteFsHelpers({ fileSystem, base64ToBytes, binaryToBase64 }) {
    const PEER_SHARE_ROOT = "peer-shared";
    let peerFoldersReady = new Set();

    function peerFolderName(peerToken) {
        return `peer-${String(peerToken || "").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    }

    function peerFolderPath(peerToken) {
        return `ram:${PEER_SHARE_ROOT}/${peerFolderName(peerToken)}/`;
    }

    async function ensurePeerFolder(peerToken) {
        if (!peerToken) return peerFolderPath(peerToken);
        const key = peerFolderName(peerToken);
        if (peerFoldersReady.has(key)) return peerFolderPath(peerToken);
        try {
            await fileSystem.createDirectory("ram:", PEER_SHARE_ROOT);
        } catch (_e) {}
        try {
            await fileSystem.createDirectory(`ram:${PEER_SHARE_ROOT}`, key);
        } catch (_e) {}
        peerFoldersReady.add(key);
        return peerFolderPath(peerToken);
    }

    function splitNameAndExt(name) {
        const clean = String(name || "file.bin");
        const index = clean.lastIndexOf(".");
        if (index <= 0 || index === clean.length - 1) return { base: clean, ext: "" };
        return { base: clean.slice(0, index), ext: clean.slice(index) };
    }

    async function makeUniquePeerFileName(peerToken, fileName) {
        const folderPath = peerFolderPath(peerToken);
        const list = await fileSystem.getDirectory(folderPath);
        const existing = new Set((list || []).map((item) => item.name));
        const { base, ext } = splitNameAndExt(fileName || "file.bin");
        let candidate = `${base}${ext}`;
        let n = 2;
        while (existing.has(candidate)) {
            candidate = `${base} (${n})${ext}`;
            n += 1;
        }
        return candidate;
    }

    async function storePeerSharedFileInRam(peerToken, filePayload) {
        if (!peerToken || !filePayload || !filePayload.dataBase64) return null;
        await ensurePeerFolder(peerToken);
        const fileName = await makeUniquePeerFileName(peerToken, filePayload.name || "file.bin");
        const bytes = base64ToBytes(filePayload.dataBase64);
        const targetPath = `${peerFolderPath(peerToken)}${fileName}`;
        await fileSystem.writeFile(targetPath, bytes, true);
        return targetPath;
    }

    function isRemoteNetworkMount(mount) {
        if (!mount) return false;
        if (mount.isRemoteNetworkMount) return true;
        if (typeof mount.handler === "string") return mount.handler === "remoteFileSystemAccess";
        return !!mount.peerToken && !!mount.remoteVolume;
    }

    function normalizeDriveAccess(items) {
        const result = new Map();
        (Array.isArray(items) ? items : []).forEach((item) => {
            const volume = String((item && item.volume) || "").trim().toLowerCase();
            if (!volume) return;
            result.set(volume, {
                read: item ? item.read !== false : true,
                write: item ? item.write !== false : true,
                password: String((item && item.password) || ""),
            });
        });
        return result;
    }

    async function getDriveAccessMap() {
        const config = (await user.getSetting("networkConfig", false)) || {};
        return normalizeDriveAccess(config.driveAccess || []);
    }

    async function getDriveAccess(volume, mount) {
        const key = String(volume || "").toLowerCase();
        const accessMap = await getDriveAccessMap();
        const entry = accessMap.get(key);
        // Drives not explicitly configured in driveAccess are denied by default.
        const access = entry ? { ...entry } : { read: false, write: false, password: "" };
        if (mount && mount.readOnly === true) access.write = false;
        return access;
    }

    async function listLocalShareableDrives() {
        const mounts = fileSystem.getMounts ? fileSystem.getMounts() : {};
        const accessMap = await getDriveAccessMap();
        return Object.keys(mounts)
            .map((key) => ({ key, mount: mounts[key] }))
            .filter((entry) => entry.mount && entry.mount.handler && !isRemoteNetworkMount(entry.mount))
            .map((entry) => {
                // Only expose drives that have been explicitly configured in driveAccess.
                const access = accessMap.get(String(entry.key || "").toLowerCase());
                if (!access) return null;
                return {
                    volume: entry.key,
                    name: entry.mount.label || entry.mount.name || entry.key.toUpperCase(),
                    read: access.read !== false,
                    write: access.write !== false && entry.mount.readOnly !== true,
                    readOnly: access.write === false || entry.mount.readOnly === true,
                    password: access.password || "",
                };
            })
            .filter((entry) => entry && (entry.read || entry.write));
    }

    function resolveSharedMount(volume) {
        const mounts = fileSystem.getMounts ? fileSystem.getMounts() : {};
        const key = String(volume || "").toLowerCase();
        const mount = mounts[key];
        if (!mount || !mount.handler) return null;
        if (isRemoteNetworkMount(mount)) return null;
        return mount;
    }

    function buildMountedPath(volume, subPath) {
        const cleanVolume = String(volume || "").toLowerCase();
        let cleanPath = typeof subPath === "string" ? subPath : "";
        cleanPath = cleanPath.replace(/^\/+/, "");
        return `${cleanVolume}:${cleanPath}`;
    }

    async function renameDirectoryOnMount(fs, fullPath, newName, mount) {
        if (fs.renameDirectory) return fs.renameDirectory(fullPath, newName, mount);
        if (fs.renameFolder) return fs.renameFolder(fullPath, newName, mount);
        if (fs.renameFile) {
            try {
                return await fs.renameFile(fullPath, newName, mount);
            } catch (_e) {
                if (fullPath.endsWith("/")) {
                    return fs.renameFile(fullPath.slice(0, -1), newName, mount);
                }
                return fs.renameFile(`${fullPath}/`, newName, mount);
            }
        }
        throw new Error("remote_operation_not_supported:renameDirectory");
    }

    async function executeRemoteFsOperation(operation, payload) {
        const op = String(operation || "");
        if (op === "listDrives") {
            return { drives: await listLocalShareableDrives() };
        }

        const volume = payload && payload.volume ? String(payload.volume).toLowerCase() : "";
        const mount = resolveSharedMount(volume);
        if (!mount || !mount.handler) throw new Error("remote_volume_not_found");

        const fs = mount.handler;
        const subPath = payload && typeof payload.path === "string" ? payload.path : "";
        const fullPath = buildMountedPath(volume, subPath);
        const access = await getDriveAccess(volume, mount);
        const password = String((payload && payload.password) || "");
        const passwordRequired = !!access.password;
        if (passwordRequired && password !== access.password) {
            throw new Error("remote_drive_password_required");
        }

        const needsRead = ["getDirectory", "readFile", "getUniqueName", "getInfo"].includes(op);
        const needsWrite = ["writeFile", "createDirectory", "deleteFile", "deleteDirectory", "renameFile", "renameDirectory", "moveFile"].includes(op);
        if (needsRead && !access.read) throw new Error("remote_drive_read_disabled");
        if (needsWrite && !access.write) throw new Error("remote_drive_write_disabled");

        if (op === "getDirectory") {
            const result = await fs.getDirectory(fullPath, mount);
            return {
                directories: (result && result.directories) || [],
                files: (result && result.files) || [],
            };
        }

        if (op === "readFile") {
            const binary = !!(payload && payload.binary);
            const content = await fs.readFile(fullPath, binary, mount);
            if (binary) return { dataBase64: binaryToBase64(content) };
            return { text: typeof content === "string" ? content : "" };
        }

        if (op === "writeFile") {
            const binary = !!(payload && payload.binary);
            const content = binary ? base64ToBytes((payload && payload.dataBase64) || "") : (payload && payload.text) || "";
            const ok = await fs.writeFile(fullPath, content, binary, mount);
            return { ok: !!ok };
        }

        if (op === "createDirectory") {
            const name = (payload && payload.name) || "";
            await fs.createDirectory(fullPath, name, mount);
            return { ok: true };
        }

        if (op === "deleteFile") {
            const ok = await fs.deleteFile(fullPath, mount);
            return { ok: typeof ok === "undefined" ? true : !!ok };
        }

        if (op === "deleteDirectory") {
            const handler = fs.deleteDirectory || fs.deleteFolder;
            if (!handler) throw new Error("remote_operation_not_supported:deleteDirectory");
            const ok = await handler(fullPath, mount);
            return { ok: typeof ok === "undefined" ? true : !!ok };
        }

        if (op === "renameFile") {
            const newName = (payload && payload.newName) || "";
            const ok = await fs.renameFile(fullPath, newName, mount);
            return { ok: typeof ok === "undefined" ? true : !!ok };
        }

        if (op === "renameDirectory") {
            const newName = (payload && payload.newName) || "";
            const ok = await renameDirectoryOnMount(fs, fullPath, newName, mount);
            return { ok: typeof ok === "undefined" ? true : !!ok };
        }

        if (op === "moveFile") {
            const targetPath = buildMountedPath(volume, (payload && payload.toPath) || "");
            const ok = await fs.moveFile(fullPath, targetPath, mount);
            return { ok: typeof ok === "undefined" ? true : !!ok };
        }

        if (op === "getUniqueName") {
            const name = (payload && payload.name) || "";
            const uniqueName = await fs.getUniqueName(fullPath, name, mount);
            return { name: uniqueName || name };
        }

        if (op === "getInfo") {
            const info = fs.getInfo ? await fs.getInfo(fullPath, mount) : {};
            return { info: info || {} };
        }

        throw new Error(`remote_operation_not_supported:${op}`);
    }

    return {
        peerFolderPath,
        ensurePeerFolder,
        storePeerSharedFileInRam,
        isRemoteNetworkMount,
        executeRemoteFsOperation,
    };
}


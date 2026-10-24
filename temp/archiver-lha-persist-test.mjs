import {encodeLhaFromMap} from "../plugins/archiver/lha/lhaWriter.js";
import {extractAll} from "../plugins/archiver/libArchive/archive.mjs";
import fileSystem from "../_script/system/filesystem.js";
import archiver from "../plugins/archiver/archiver.js";

let writtenBuffer = null;
const originalReadFile = fileSystem.readFile;
const originalWriteFile = fileSystem.writeFile;

try {
    const sourceArchive = encodeLhaFromMap({
        "existing.txt": "before"
    });

    fileSystem.readFile = async () => ({buffer: sourceArchive});
    fileSystem.writeFile = async (path, content) => {
        if (content instanceof ArrayBuffer) {
            writtenBuffer = content;
        } else if (content && content.buffer instanceof ArrayBuffer) {
            writtenBuffer = content.buffer;
        } else {
            throw new Error("Unexpected write payload type");
        }
        return true;
    };

    const mount = {
        name: "sample.lha",
        url: "ram:sample.lha"
    };

    await archiver.writeFile("archive:new.txt", "persisted", false, mount);

    if (!writtenBuffer) {
        throw new Error("Archiver did not persist updated .lha bytes");
    }

    const entries = extractAll(new Uint8Array(writtenBuffer));
    const names = entries.map(entry => entry.path);
    if (!names.includes("new.txt")) {
        throw new Error("Persisted .lha does not contain new.txt");
    }

    const textEntry = entries.find(entry => entry.path === "new.txt");
    const text = new TextDecoder().decode(textEntry.data);
    if (text !== "persisted") {
        throw new Error("Unexpected new.txt content: " + text);
    }

    console.log("archiver .lha persistence test passed");
} finally {
    fileSystem.readFile = originalReadFile;
    fileSystem.writeFile = originalWriteFile;
}


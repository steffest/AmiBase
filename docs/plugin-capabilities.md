# Plugin capabilities

AmiBase plugins can declare runtime contract metadata in `plugins/<plugin>/config.json`.

## Schema

```json
{
  "apiVersion": 1,
  "capabilities": [
    "net.fetch",
    "fs.read"
  ]
}
```

Fields:

- `apiVersion` (number): plugin contract version. Current core version is `1`.
- `capabilities` (string[]): requested bridge permissions.

If `capabilities` is omitted, AmiBase treats the plugin as legacy and grants full access (`["*"]`) for backward compatibility.

## Known capabilities

- `net.fetch`: use `bridge.fetch`
- `fs.read`: use `bridge.readFile`, `bridge.getDirectory`, `bridge.getMounts`, `bridge.isReadOnly`, `bridge.getUrl`
- `fs.write`: use `bridge.writeFile`, `bridge.copyFile`, `bridge.moveFile`, `bridge.deleteFile`, `bridge.deleteDirectory`, `bridge.rename`, `bridge.createDirectory`, `bridge.uploadFile`, `bridge.getUniqueName`
- `fs.dialog`: use `bridge.requestFileOpen`, `bridge.requestFileSave`
- `system.inspect`: use `bridge.getObjectInfo`, `bridge.detectFileType`
- `system.loadScript`: use `bridge.loadScript`
- `system.user`: use `bridge.user`
- `system.settings`: use `bridge.settings`
- `ui.desktop`: use `bridge.desktop`
- `crypto.sha256`: use `bridge.util.sha256`

## Example

```json
{
  "module": "main.js",
  "apiVersion": 1,
  "capabilities": ["fs.read", "fs.write", "fs.dialog"]
}
```


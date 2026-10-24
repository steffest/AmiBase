import settings from '../../_script/settings.js';
import fileSystem from '../../_script/system/filesystem.js';
import { createFileTypeAdapter } from './adapter.js';

// Deploy independently by default; hosts may supply an external ESM URL.
const library = await import(settings.filetypesUrl || './vendor/index.js');
export default createFileTypeAdapter({ library, settings, readFile: (...args) => fileSystem.readFile(...args), global: window });

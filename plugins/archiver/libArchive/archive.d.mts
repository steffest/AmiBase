/*!
 * archive-wasm - LibArchive compiled to WASM with a idiomatic JS API
 * Copyright (C) 2023 Spacedrive Technology Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Extract an archive and iterate through all its entries.
 *
 * > Using the {@link ExtractOpts.baseDir} or {@link ExtractOpts.stripComponents} option results
 *   in the entry’s path being normalized.
 *
 * > The {@link ExtractOpts.stripComponents}, {@link ExtractOpts.include}, and {@link ExtractOpts.exclude}
 *   options are always processed with a normalized version of the entry’s path, so there is no need
 *   to worry about edge cases. Also, they are applied before the {@link ExtractOpts.baseDir} option,
 *   so the base directory will not be affected by them.
 *
 * > Using {@link ExtractOpts.recursive} can severely impact performance on large archives. It allows
 *   extracting nested archives (common in GitHub Action releases) but is limited to 16 levels of
 *   recursion. Formats such as `ar`, `empty`, `mtree`, and `cab` are disabled for inner extraction
 *   since they can treat nearly any file as an archive.
 * @param {ArrayBufferView | ArrayBufferLike} data The archive’s data.
 * @param {string | ExtractOpts} [opts] Extract options; a string value is interpreted as a password.
 * @yields {Entry}
 * @returns {Generator.<Entry, void, void>} A generator that iterates through all the archive’s entries.
 */
export function extract(
  data: ArrayBufferView | ArrayBufferLike,
  opts?: string | ExtractOpts
): Generator<Entry, void, void>

/**
 * Extracts all entries from an archive.
 *
 * > This function is recommended over {@link extract} if you need to retrieve and process the data
 *   from all entries within the archive and memory usage is not a concern. It improves performance
 *   by skipping certain workarounds required for random access to an entry’s data in LibArchive’s
 *   streaming model. If your use case involves accessing all entries and their content, choose
 *   {@link extractAll} for optimal performance.
 * @param {ArrayBufferView | ArrayBufferLike} data The archive’s data.
 * @param {string | ExtractAllOpts} [opts] Extraction options, or a string interpreted as a password.
 * @returns {Entry[]} A list of entries from the archive.
 */
export function extractAll(
  data: ArrayBufferView | ArrayBufferLike,
  opts?: string | ExtractAllOpts
): Entry[]
export { disableWarning } from './wasm/bridge.mjs'
export { EntryTypeName } from './wasm/enums.mjs'
/**
 * Options for {@link extract}
 */
export interface ExtractOpts {
  /**
   * Specifies a base directory to prepend to each extracted entry's path.
   */
  baseDir?: string | undefined
  /**
   * The encoding used to parse entry metadata. Defaults to 'utf8'.
   */
  encoding?: string | undefined
  /**
   * Passphrase for decrypting password-protected ZIP archives.
   */
  passphrase?: string | undefined
  /**
   * The number of leading path components to skip when extracting entries. Has no effect on absolute paths. The default is 0.
   */
  stripComponents?: number | undefined
  /**
   * Indicates whether to normalize extracted paths. Defaults to true.
   */
  normalize?: boolean | undefined
  /**
   * Indicates whether to recursively extract archives within archives. Defaults to false.
   */
  recursive?: boolean | undefined
  /**
   * Indicates whether to ignore entries for '.' directories. Defaults to true.
   */
  ignoreDotDir?: boolean | undefined
  /**
   * A list of RegExp patterns to filter entries that should be extracted. An empty list means all entries are NOT included.
   */
  include?: RegExp[] | undefined
  /**
   * A list of RegExp patterns to filter entries that should be ignored.
   */
  exclude?: RegExp[] | undefined
}
/**
 * A compressed data entry within an archive.
 */
export interface Entry {
  /**
   * The size of the entry in bytes.
   */
  size: bigint
  /**
   * A bit field describing the file type and mode.
   */
  perm: number
  /**
   * The path of the entry within the archive.
   */
  path: string | null
  /**
   * Indicates if the entry is a file, directory, or another type.
   */
  type: import('./wasm/enums.mjs').EntryTypeName | null
  /**
   * The path to the actual resource if this is a symlink or hardlink.
   */
  link: string | null
  /**
   * The timestamp indicating the last time this file was accessed, expressed in nanoseconds since the POSIX Epoch.
   */
  atime: bigint
  /**
   * The timestamp indicating the last time the file status was changed, expressed in nanoseconds since the POSIX Epoch.
   */
  ctime: bigint
  /**
   * The timestamp indicating the last time this file was modified, expressed in nanoseconds since the POSIX Epoch.
   */
  mtime: bigint
  /**
   * The timestamp indicating this file’s creation time, expressed in nanoseconds since the POSIX Epoch.
   */
  birthtime: bigint
  /**
   * An ArrayBuffer containing the entry’s data.
   */
  data: ArrayBuffer
}
/**
 * Exclusive options for {@link extractAll}
 */
export interface ExtractAllExclusiveOpts {
  /**
   * Limits the total byte size of data to avoid memory exhaustion. Null means no limit (default: 128MB).
   */
  sizeLimit?: bigint | null | undefined
}
/**
 * Options for {@link extractAll}
 */
export type ExtractAllOpts = ExtractOpts & ExtractAllExclusiveOpts
export {
  ArchiveError,
  NullError,
  RetryError,
  FatalError,
  FailedError,
  FileReadError,
  PassphraseError,
  ExceedSizeLimitError,
  ExceedRecursionLimitError,
} from './wasm/errors.mjs'

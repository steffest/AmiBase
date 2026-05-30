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
 * Extracts all supported archive entries to the specified directory.
 *
 * > Only files, directories, symlinks, and hardlinks are supported.
 * Any unsupported or invalid entries in the archive are skipped, with a warning printed to the
 * console. If {@link ExtractToOpts.overwrite} is disabled, this function will throws if it
 * attempts to overwrite an existing file.
 * @param {ArrayBufferView | ArrayBufferLike} data The archive data.
 * @param {string} out The path where the archive entries will be extracted.
 * @param {string | ExtractToOpts} [opts] Extraction options. A string value is interpreted as the password.
 */
export function extractTo(
  data: ArrayBufferView | ArrayBufferLike,
  out: string,
  opts?: string | ExtractToOpts
): Promise<void>
/**
 * Exclusive options for {@link extractTo}.
 */
export interface ExtractToExclusiveOpts {
  /**
   * Permission flag that is AND’ed with all extracted entries permissions (the opposite of umask).
   */
  chmod?: number | undefined
  /**
   * Whether to allow overwriting existing files. The default is false.
   */
  overwrite?: boolean | undefined
}
/**
 * Options for {@link extractTo}.
 */
export type ExtractToOpts = Exclude<import('./archive.mjs').ExtractAllOpts, 'ignoreDotDir'> &
  ExtractToExclusiveOpts

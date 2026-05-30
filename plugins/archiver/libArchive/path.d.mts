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
 * Resolves one or more paths into an absolute path.
 * @param {...string} args Path segments to resolve.
 * @returns {string} Resolved absolute path.
 */
export function resolve(...args: string[]): string
/**
 * Normalizes the given path, resolving '.' and '..' segments.
 * @param {string} path The path to normalize.
 * @returns {string} Normalized path.
 */
export function normalize(path: string): string
/**
 * Checks if a path is absolute.
 * @param {string} path The path to check.
 * @returns {boolean} True if the path is absolute, otherwise false.
 */
export function isAbsolute(path: string): boolean
/**
 * Calculates the relative path from one path to another.
 * @param {string} from The base path.
 * @param {string} to The target path.
 * @returns {string} The relative path from 'from' to 'to'.
 */
export function relative(from: string, to: string): string
/**
 * Returns the directory name of a path.
 * @param {string} path The path to evaluate.
 * @returns {string} The path to the directory.
 */
export function dirname(path: string): string
declare namespace _default {
  export { resolve }
  export { normalize }
  export { isAbsolute }
  export { relative }
  export { dirname }
}
export default _default

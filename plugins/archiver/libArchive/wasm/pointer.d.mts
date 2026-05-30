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

/** @private */
export class Pointer {
  static NIL: Pointer
  static NULL: number
  /**
   * Free raw pointer
   * @param {number} pointer Raw C pointer
   */
  static free(pointer: number): void
  /**
   * High level representation of a WASM memory pointer
   * @param {number} [size] Pointer size, 0 means that pointer is managed
   * @param {number} [pointer] Raw C pointer
   */
  constructor(size?: number, pointer?: number)
  /**
   * Get underlining raw pointer
   * @returns {number} Raw C pointer
   */
  get raw(): number
  /**
   * Get possible allocated size for pointer
   *
   * > This can be null if pointer is externally managed
   *
   * > This will be zero when pointer is NULL
   * @returns {number?} Allocated pointer size
   */
  get size(): number | null
  /**
   * Fill memory with data
   *
   * > When grow is false, this method throws when trying to fill a Pointer.NULL pointer,
   *   otherwise it will realloc the Pointer so it can fit the given data
   * @param {bigint | number | string | ArrayLike.<number> | ArrayBufferView | ArrayBufferLike} data to copy to memory
   * @param {boolean} [grow] Wheter to alloc more data to make sure data fits inside {@link Pointer}
   * @returns {Pointer} This pointer
   */
  fill(
    data: bigint | number | string | ArrayLike<number> | ArrayBufferView | ArrayBufferLike,
    grow?: boolean
  ): Pointer
  /**
   * Copy data from WASM memory and return it
   * @param {number} [size] How much to read from memory
   * @returns {ArrayBuffer} Memory view
   */
  read(size?: number): ArrayBuffer
  /**
   * Copy data from WASM memory and decode it as a string
   * @param {string} [encoding] Decoder label
   * @returns {string} String representation
   */
  readString(encoding?: string): string
  /**
   * Free internal pointer
   */
  free(): void
  isNull(): boolean
  /**
   * Change pointer size
   * @param {number} size New pointer size, 0 frees the pointer
   * @param {boolean} avoidShrinking Don't reallocate when size is less then current allocated size
   * @returns {Pointer} This pointer
   */
  realloc(size: number, avoidShrinking?: boolean): Pointer
  isManaged(): boolean
  #private
}
/**
 * void * malloc(size_t size);
 */
export type MallocCB = (size: number) => number
/**
 * void free(void *ptr);
 */
export type FreeCB = (pointer: number) => unknown

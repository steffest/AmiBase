// Modified version of @types/emscripten to match only what our WASM build exports
// Original definitions: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/77922c3/types/emscripten/index.d.ts

declare namespace Emscripten {
  type JSType = 'number' | 'string' | 'array' | 'boolean'

  interface CCallOpts {
    async?: boolean | undefined
  }
}

// https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html
type StringToType<R> = R extends Emscripten.JSType
  ? {
      number: number | bigint
      string: string
      array: number[] | string[] | boolean[] | Uint8Array | Int8Array
      boolean: boolean
      null: null
    }[R]
  : never

type ArgsToType<T extends (Emscripten.JSType | null)[]> = Extract<
  {
    [P in keyof T]: StringToType<T[P]>
  },
  unknown[]
>

type ReturnToType<R extends Emscripten.JSType | null> = R extends null
  ? null
  : StringToType<Exclude<R, null>>

export const wasm: {
  HEAP8: Int8Array
  HEAP_DATA_VIEW: DataView<ArrayBuffer>

  calledRun: boolean
  thisProgram: string

  cwrap<I extends (Emscripten.JSType | null)[] | [], R extends Emscripten.JSType | null>(
    ident: string,
    returnType: R,
    argTypes: I,
    opts?: Emscripten.CCallOpts
  ): (...arg: ArgsToType<I>) => ReturnToType<R>
  ccall<I extends (Emscripten.JSType | null)[] | [], R extends Emscripten.JSType | null>(
    ident: string,
    returnType: R,
    argTypes: I,
    args: ArgsToType<I>,
    opts?: Emscripten.CCallOpts
  ): ReturnToType<R>
  locateFile(url: string, scriptDirectory: string): string
}

import { ChildProcess, IOType } from 'child_process'
import child_process from 'child_process'
import Stream, { Pipe, Readable, Writable } from 'stream'

type StdioElement = IOType | Stream | number | null | undefined

type StdioOptions =
  | IOType
  | [StdioElement, StdioElement, StdioElement, ...Array<StdioElement | 'ipc'>]
  | Array<StdioElement | 'ipc'>

interface IOOptions {
  silent?: boolean
  stdio?: StdioOptions
  encoding?: BufferEncoding | 'buffer' | null
  maxBuffer?: number
}

type ChunkTypeHelper<MaxBuffer, Encoding> =
  MaxBuffer extends number ?
    Encoding extends BufferEncoding ?
      string
    : Buffer
  : Encoding extends BufferEncoding ? string
  : Encoding extends 'buffer' ? Buffer
  : undefined

type ChunkType<Options extends IOOptions> = ChunkTypeHelper<
  'maxBuffer' extends keyof Options ? Options['maxBuffer'] : undefined,
  'encoding' extends keyof Options ? Options['encoding'] : undefined
>

type IsPipeHelper<Stdio, Silent, Fd extends 0 | 1 | 2> =
  Stdio extends unknown[] ?
    Stdio[Fd] extends infer Value ?
      Value extends 'pipe' | 'overlapped' ?
        true
      : false
    : false
  : Stdio extends null | undefined | 'pipe' | 'overlapped' ? true
  : Stdio extends null | undefined ?
    Silent extends true ?
      false
    : true
  : false

type IsPipe<Options extends IOOptions, Fd extends 0 | 1 | 2> = IsPipeHelper<
  'stdio' extends keyof Options ? Options['stdio'] : undefined,
  'silent' extends keyof Options ? Options['silent'] : undefined,
  Fd
>

type Contains<A, T> =
  A extends [infer Head, ...infer Tail] ?
    Head extends T ?
      true
    : Contains<Tail, T>
  : false

export interface ChildProcessResult<Options extends IOOptions> {
  stdout: IsPipe<Options, 1> extends true ? ChunkType<Options> : undefined
  stderr: IsPipe<Options, 2> extends true ? ChunkType<Options> : undefined
  code: number | null
  signal: string | null
  killed: boolean
}

type StdioStreams<Stdio> = {
  [K in keyof Stdio]: Stdio[K] extends 'pipe' | 'overlapped' ?
    K extends 0 | '0' ?
      Writable
    : Readable
  : null
}

export interface ChildProcessPromise<Options extends IOOptions>
  extends ChildProcess, Promise<ChildProcessResult<Options>> {
  stdin: IsPipe<Options, 0> extends true ? Writable : null
  stdout: IsPipe<Options, 1> extends true ? Readable : null
  stderr: IsPipe<Options, 2> extends true ? Readable : null
  readonly channel: Options['stdio'] extends infer Stdio ?
    Contains<Stdio, 'ipc'> extends true ?
      Pipe
    : undefined
  : undefined
  readonly stdio: Options['stdio'] extends infer Stdio ?
    Stdio extends unknown[] ? StdioStreams<Stdio>
    : Stdio extends null | undefined | 'pipe' | 'overlapped' ?
      [Writable, Readable, Readable, undefined, undefined]
    : [null, null, null, undefined, undefined]
  : [null, null, null, undefined, undefined]
}

interface PromisifyChildProcessBaseOptions extends IOOptions {
  killSignal?: NodeJS.Signals | number
}

function joinChunks(
  chunks: Buffer[] | undefined,
  encoding: BufferEncoding | 'buffer' | null | undefined
): string | Buffer | undefined {
  if (!chunks) return undefined
  const buffer = Buffer.concat(chunks)
  return encoding && encoding !== 'buffer' ? buffer.toString(encoding) : buffer
}

export function promisifyChildProcess<
  Options extends PromisifyChildProcessBaseOptions,
>(child: ChildProcess, options?: Options): ChildProcessPromise<Options> {
  const promise = new Promise<ChildProcessResult<Options>>(
    (resolve, reject) => {
      const encoding = options?.encoding
      const killSignal = options?.killSignal
      const captureStdio = encoding != null || options?.maxBuffer != null
      const maxBuffer = options?.maxBuffer ?? 1024 * 1024
      let bufferSize = 0
      let error: Error | undefined
      const stdoutChunks: Buffer[] | undefined =
        captureStdio && child.stdout ? [] : undefined
      const stderrChunks: Buffer[] | undefined =
        captureStdio && child.stderr ? [] : undefined
      const capture = (chunks: Buffer[]) => (data: string | Buffer) => {
        if (typeof data === 'string') data = Buffer.from(data)
        const remaining = Math.max(0, maxBuffer - bufferSize)
        bufferSize += Math.min(remaining, data.length)
        if (data.length > remaining) {
          error = new Error('maxBuffer exceeded')
          child.kill(killSignal ?? 'SIGTERM')
          data = data.subarray(0, remaining)
        }
        chunks.push(data)
      }
      const captureStdout = stdoutChunks ? capture(stdoutChunks) : undefined
      const captureStderr = stderrChunks ? capture(stderrChunks) : undefined
      if (captureStdout) child.stdout?.on('data', captureStdout)
      if (captureStderr) child.stderr?.on('data', captureStderr)
      function onError(err: Error) {
        error = err
        done()
      }
      child.on('error', onError)
      function done(code: number | null = null, signal: string | null = null) {
        child.removeListener('error', onError)
        child.removeListener('close', done)
        if (captureStdout) child.stdout?.removeListener('data', captureStdout)
        if (captureStderr) child.stderr?.removeListener('data', captureStderr)

        const stdout = joinChunks(
          stdoutChunks,
          encoding
        ) as ChildProcessResult<Options>['stdout']
        const stderr = joinChunks(
          stderrChunks,
          encoding
        ) as ChildProcessResult<Options>['stderr']

        if (error || (code != null && code != 0) || signal != null) {
          reject(
            Object.assign(
              error ||
                new Error(
                  signal != null ?
                    `Process was killed with ${signal}`
                  : `Process exited with code ${code}`
                ),
              {
                code,
                signal,
                killed: signal != null,
                stdout,
                stderr,
              }
            )
          )
        } else {
          resolve({ stderr, stdout, code, signal, killed: false })
        }
      }
      child.on('close', done)
    }
  )
  return Object.create(child, {
    then: { value: promise.then.bind(promise) },
    catch: { value: promise.catch.bind(promise) },
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    finally: { value: promise.finally?.bind(promise) },
  })
}

export interface SpawnOptions extends child_process.SpawnOptions {
  stdio?: StdioOptions
  encoding?: BufferEncoding
  maxBuffer?: number
}

function isArray(t: unknown): t is unknown[] | readonly unknown[] {
  return Array.isArray(t)
}

export function spawn<Options extends SpawnOptions>(
  command: string,
  args: readonly string[],
  options?: Options
): ChildProcessPromise<Options>
export function spawn<Options extends SpawnOptions>(
  command: string,
  options?: Options
): ChildProcessPromise<Options>
export function spawn<Options extends SpawnOptions>(
  command: string,
  args?: readonly string[] | Options,
  options?: Options
): ChildProcessPromise<Options> {
  if (!isArray(args)) {
    options = args
    args = []
  }
  return promisifyChildProcess(
    child_process.spawn(command, args, options as child_process.SpawnOptions),
    options
  )
}

export interface ForkOptions extends child_process.ForkOptions {
  stdio?: StdioOptions
  encoding?: BufferEncoding
  maxBuffer?: number
}

export function fork<Options extends ForkOptions>(
  module: string,
  args: Array<string>,
  options?: Options
): ChildProcessPromise<Options>
export function fork<Options extends ForkOptions>(
  module: string,
  options?: Options
): ChildProcessPromise<Options>
export function fork<Options extends ForkOptions>(
  module: string,
  args?: Array<string> | Options,
  options?: Options
): ChildProcessPromise<Options> {
  if (!isArray(args)) {
    options = args
    args = []
  }
  return promisifyChildProcess(
    child_process.fork(module, args, options),
    options
  )
}
function promisifyExecMethod(method: (...args: any[]) => ChildProcess) {
  return (...args: any[]): ChildProcessPromise<any> => {
    let child: ChildProcess | undefined
    const promise = new Promise<ChildProcessResult<any>>((resolve, reject) => {
      child = method(
        ...args,
        (
          err: Error | null,
          stdout: string | Buffer,
          stderr: string | Buffer
        ) => {
          if (err) {
            reject(Object.assign(err, { stdout, stderr }))
          } else {
            resolve({
              code: 0,
              signal: null,
              killed: false,
              stdout: stdout as any,
              stderr: stderr as any,
            })
          }
        }
      )
    })
    if (!child) {
      throw new Error('unexpected error: child has not been initialized')
    }
    return Object.create(child, {
      then: { value: promise.then.bind(promise) },
      catch: { value: promise.catch.bind(promise) },
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      finally: { value: promise.finally?.bind(promise) },
    })
  }
}

export interface ExecOptions extends child_process.ExecOptions {
  encoding?: BufferEncoding | 'buffer'
}

export const exec: <Options extends ExecOptions>(
  command: string,
  options?: Options
) => ChildProcessPromise<Options> = promisifyExecMethod(child_process.exec)

export interface ExecFileOptions extends child_process.ExecFileOptions {
  encoding?: BufferEncoding | 'buffer'
}

export const execFile: {
  <Options extends ExecFileOptions>(
    file: string,
    args: readonly string[],
    options?: Options
  ): ChildProcessPromise<Options>
  <Options extends ExecFileOptions>(
    file: string,
    options?: Options
  ): ChildProcessPromise<Options>
} = promisifyExecMethod(child_process.execFile)

export function isChildProcessError(error: unknown): error is Error & {
  code: number | null
  signal: NodeJS.Signals | null
  killed: boolean
  stdout?: string | Buffer
  stderr?: string | Buffer
} {
  return error instanceof Error && 'code' in error && 'signal' in error
}

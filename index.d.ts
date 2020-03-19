import {
  ChildProcess,
  SpawnOptions,
  ExecOptions,
  ExecFileOptions,
  ForkOptions,
} from 'child_process'

interface Output {
  stdout?: string | Buffer | null | undefined
  stderr?: string | Buffer | null | undefined
}

interface ExitReason {
  code?: number
  signal?: string
}

type ErrorWithOutput = Error & Output & ExitReason

type ChildProcessPromise = ChildProcess & Promise<Output>

interface PromisifyChildProcessOptions {
  encoding?: string
  killSignal?: string
  maxBuffer?: number
}

type PromisifySpawnOptions = SpawnOptions & PromisifyChildProcessOptions

type PromisifyForkOptions = ForkOptions & PromisifyChildProcessOptions

export function promisifyChildProcess(
  child: ChildProcess,
  options?: PromisifyChildProcessOptions
): ChildProcessPromise

export function spawn(
  command: string,
  args: Array<string>,
  options?: PromisifySpawnOptions
): ChildProcessPromise
export function spawn(
  command: string,
  options?: PromisifySpawnOptions
): ChildProcessPromise

export function fork(
  module: string,
  args: Array<string>,
  options?: PromisifyForkOptions
): ChildProcessPromise
export function fork(
  module: string,
  options?: PromisifyForkOptions
): ChildProcessPromise

export function exec(
  command: string,
  options?: ExecOptions
): ChildProcessPromise

export function execFile(
  file: string,
  args: Array<string>,
  options?: ExecFileOptions
): ChildProcessPromise
export function execFile(
  file: string,
  options?: ExecFileOptions
): ChildProcessPromise

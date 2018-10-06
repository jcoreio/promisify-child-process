// @flow

import type {ChildProcess} from 'child_process'
import child_process from 'child_process'

type Output = {
  stdout?: ?(string | Buffer),
  stderr?: ?(string | Buffer),
}

type ErrorWithOutput = Error & Output & {
  code?: number,
  signal?: string,
}

type ChildProcessPromise = ChildProcess & Promise<Output>

function joinChunks(chunks: $ReadOnlyArray<string | Buffer>, encoding: ?string): string | Buffer {
  if (chunks[0] instanceof Buffer) {
    const buffer = Buffer.concat((chunks: any))
    if (encoding) return buffer.toString((encoding: any))
    return buffer
  }
  return chunks.join('')
}

export function promisifyChildProcess(child: ChildProcess, options: {encoding?: string} = {}): ChildProcessPromise {
  const _promise = new Promise((resolve: (result: Output) => void, reject: (error: ErrorWithOutput) => void) => {
    const stdoutChunks: Array<string | Buffer> = []
    const stderrChunks: Array<string | Buffer> = []
    if (child.stdout) child.stdout.on('data', data => stdoutChunks.push(data))
    if (child.stderr) child.stderr.on('data', data => stderrChunks.push(data))

    child.on('error', reject)
    function done(code: ?number, signal: ?string) {
      let error: ?ErrorWithOutput
      if (code != null && code !== 0) error = new Error(`Process exited with code ${code}`)
      else if (signal != null) error = new Error(`Process was killed with ${signal}`)
      const output: Output = {}
      if (child.stdout) output.stdout = joinChunks(stdoutChunks, options.encoding)
      if (child.stderr) output.stderr = joinChunks(stderrChunks, options.encoding)
      if (error) {
        if (code != null) error.code = code
        if (signal != null) error.signal = signal
        if (output.stdout) error.stdout = output.stdout
        if (output.stderr) error.stderr = output.stderr
        reject(error)
      } else {
        resolve(output)
      }
    }
    child.on('close', done)
    child.on('exit', done)
  })
  return (Object.create(child, {
    then: { value: _promise.then.bind(_promise) },
    catch: { value: _promise.catch.bind(_promise) },
  }): any)
}

export function spawn(
  command: string,
  args?: Array<string> | child_process$spawnOpts,
  options?: child_process$spawnOpts
): ChildProcessPromise {
  return promisifyChildProcess(child_process.spawn(command, args, options), ((Array.isArray(args) ? options : args): any))
}

export function fork(
  module: string,
  args?: Array<string> | child_process$forkOpts,
  options?: child_process$forkOpts
): ChildProcessPromise {
  return promisifyChildProcess(child_process.fork(module, args, options), ((Array.isArray(args) ? options : args): any))
}

function promisifyExecMethod(method: any): any {
  return (...args: Array<any>): ChildProcessPromise => {
    let child: ?ChildProcess
    const _promise = new Promise((resolve: (output: Output) => void, reject: (error: ErrorWithOutput) => void) => {
      child = method(...args, (err: ?ErrorWithOutput, stdout: ?(Buffer | string), stderr: ?(Buffer | string)) => {
        if (err) {
          err.stdout = stdout
          err.stderr = stderr
          reject(err)
        } else {
          resolve({stdout, stderr})
        }
      })
    })
    if (!child) throw new Error("unexpected error: child has not been initialized")
    return (Object.create((child: any), {
      then: { value: _promise.then.bind(_promise) },
      catch: { value: _promise.catch.bind(_promise) },
    }): any)
  }
}

export const exec: (
  command: string,
  options?: child_process$execOpts
) => ChildProcessPromise = promisifyExecMethod(child_process.exec)

export const execFile: (
  file: string,
  args?: Array<string> | child_process$execFileOpts,
  options?: child_process$execOpts
) => ChildProcessPromise = promisifyExecMethod(child_process.execFile)

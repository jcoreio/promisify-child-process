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

export function promisifyChildProcess(child: ChildProcess, options: {encoding?: string} = {}): ChildProcessPromise {
  const _promise = new Promise((resolve: (result: Output) => void, reject: (error: ErrorWithOutput) => void) => {
    let stdout, stderr
    if (options.encoding && options.encoding !== 'buffer') {
      stdout = child.stdout ? '' : null,
      stderr = child.stderr ? '' : null
      if (stdout != null) child.stdout.on('data', (data) => stdout += data)
      if (stderr != null) child.stderr.on('data', (data) => stderr += data)
    } else {
      stdout = child.stdout ? Buffer.alloc(0) : null,
      stderr = child.stderr ? Buffer.alloc(0) : null
      if (stdout != null) child.stdout.on('data', (data) => stdout = Buffer.concat([ (stdout: any), data ]))
      if (stderr != null) child.stderr.on('data', (data) => stderr = Buffer.concat([ (stderr: any), data ]))
    }
    child.on('error', reject)
    function done(code: ?number, signal: ?string) {
      let error: ?ErrorWithOutput
      if (code != null && code !== 0) error = new Error(`Process exited with code ${code}`)
      else if (signal != null) error = new Error(`Process was killed with ${signal}`)
      if (error) {
        if (code != null) error.code = code
        if (signal != null) error.signal = signal
        error.stdout = stdout
        error.stderr = stderr
        reject(error)
      } else {
        resolve({stdout, stderr})
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


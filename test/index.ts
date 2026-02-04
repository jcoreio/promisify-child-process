/* eslint-disable @typescript-eslint/no-empty-object-type */
import {
  spawn,
  fork,
  exec,
  execFile,
  isChildProcessError,
  ChildProcessResult,
  ChildProcessPromise,
} from '../src/index'
import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import path from 'path'
import fs from 'fs-extra'
import { dirname } from './dirname'
import { resolve } from './resolve'
import { Pipe, Readable, Writable } from 'stream'

const delay = (wait: number) => new Promise<void>((r) => setTimeout(r, wait))

const ext = process.env.JCOREIO_TOOLCHAIN_CJS ? 'cjs' : 'js'

before(async () => {
  await Promise.all([
    fs.writeFile(
      path.resolve(dirname, `resolvesWithProcessOutput.${ext}`),
      `#!${process.execPath}
process.stdout.write('hello')
process.stderr.write('world')
      `,
      {
        encoding: 'utf8',
        mode: 0o755,
      }
    ),
    fs.writeFile(
      path.resolve(dirname, `rejectsWithExitCode.${ext}`),
      `#!${process.execPath}
process.stdout.write('hello')
process.stderr.write('world')
process.exit(2)
      `,
      {
        encoding: 'utf8',
        mode: 0o755,
      }
    ),
    fs.writeFile(
      path.resolve(dirname, `rejectsWithSignal.${ext}`),
      `#!${process.execPath}
process.stdout.write('hello')
process.stderr.write('world')

setTimeout(function() {}, 5000)
      `,
      {
        encoding: 'utf8',
        mode: 0o755,
      }
    ),
  ])
})
after(() =>
  Promise.all([
    fs.unlink(path.resolve(dirname, `resolvesWithProcessOutput.${ext}`)),
    fs.unlink(path.resolve(dirname, `rejectsWithExitCode.${ext}`)),
    fs.unlink(path.resolve(dirname, `rejectsWithSignal.${ext}`)),
  ])
)
describe('spawn', function () {
  this.timeout(30000)
  it('resolves with process output', async () => {
    let finallyDone = false
    const { code, signal, stdout, stderr } = await spawn(
      process.execPath,
      [resolve(`./resolvesWithProcessOutput.${ext}`)],
      { maxBuffer: 200 * 1024 }
    ).finally(async () => {
      await delay(50)
      finallyDone = true
    })
    expect(finallyDone, 'finally handler finished').to.equal(true)
    expect(code, 'code').to.equal(0)
    expect(signal, 'signal').to.equal(null)
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
  })
  it(`doesn't capture output when neither encoding nor maxBuffer is given`, async () => {
    const { stdout, stderr } = await spawn(process.execPath, [
      resolve(`./resolvesWithProcessOutput.${ext}`),
    ])
    expect(stdout).to.equal(undefined)
    expect(stderr).to.equal(undefined)
  })
  it(`kills child when maxBuffer is exceeded`, async () => {
    let error: unknown
    await spawn(
      process.execPath,
      [resolve(`./resolvesWithProcessOutput.${ext}`)],
      {
        maxBuffer: 1,
      }
    ).catch((err: unknown) => (error = err))
    if (error == null) throw new Error('missing error')
    if (!isChildProcessError(error))
      throw new Error(`error is not a child process error`)
    const { code, signal, stdout, stderr } = error
    if (!process.env.JCOREIO_TOOLCHAIN_COVERAGE)
      expect(code, 'code').to.equal(null)
    if (!process.env.JCOREIO_TOOLCHAIN_COVERAGE)
      expect(signal, 'signal').to.equal('SIGTERM')
    expect(stdout?.toString('utf8')).to.equal('h')
    expect(stderr?.toString('utf8')).to.equal('')
  })
  it('resolves with process output as string when encoding is not buffer', async () => {
    const { stdout, stderr } = await spawn(
      'node',
      [resolve(`./resolvesWithProcessOutput.${ext}`)],
      { encoding: 'utf8' }
    )
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with exit code', async () => {
    let finallyDone = false
    let error: unknown
    await spawn(process.execPath, [resolve(`./rejectsWithExitCode.${ext}`)], {
      maxBuffer: 200 * 1024,
    })
      .finally(async () => {
        await delay(50)
        finallyDone = true
      })
      .catch((err: unknown) => (error = err))
    expect(finallyDone, 'finally handler finished').to.equal(true)
    if (error == null) throw new Error('missing error')
    if (!isChildProcessError(error))
      throw new Error('error is not a child process error')
    const { code, signal, message, stdout, stderr } = error
    expect(message).to.equal('Process exited with code 2')
    expect(code, 'code').to.equal(2)
    expect(signal, 'signal').to.equal(null)
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
  })
  it('rejects with signal', async () => {
    let error: unknown
    const child = spawn(
      process.execPath,
      [resolve(`./rejectsWithSignal.${ext}`)],
      {
        maxBuffer: 200 * 1024,
      }
    )
    let gotStdout = false,
      gotStderr = false
    function killWhenReady() {
      if (gotStdout && gotStderr) child.kill('SIGINT')
    }
    child.stdout.on('data', () => {
      gotStdout = true
      killWhenReady()
    })
    child.stderr.on('data', () => {
      gotStderr = true
      killWhenReady()
    })
    await child.catch((err: unknown) => (error = err))
    if (error == null) throw new Error('missing error')
    if (!isChildProcessError(error))
      throw new Error('error is not a child process error')
    const { code, signal, message, stdout, stderr } = error
    expect(message).to.equal('Process was killed with SIGINT')
    expect(code, 'code').to.equal(null)
    expect(signal, 'signal').to.equal('SIGINT')
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
  })
  it('works with stdio: inherit', async () => {
    const { stdout, stderr } = await spawn(
      'node',
      [resolve(`./resolvesWithProcessOutput.${ext}`)],
      {
        stdio: 'inherit',
      }
    )
    expect(stdout).to.equal(undefined)
    expect(stderr).to.equal(undefined)
  })
})
describe('fork', function () {
  this.timeout(30000)
  it('resolves with process output', async () => {
    let finallyDone = false
    const { code, signal, stdout, stderr } = await fork(
      resolve(`./resolvesWithProcessOutput.${ext}`),
      {
        silent: true,
        maxBuffer: 200 * 1024,
      }
    ).finally(async () => {
      await delay(50)
      finallyDone = true
    })
    expect(code, 'code').to.equal(0)
    expect(signal, 'signal').to.equal(null)
    expect(finallyDone, 'finally handler finished').to.equal(true)
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
  })
  it(`doesn't capture output if neither encoding nor maxBuffer is given`, async function (): Promise<undefined> {
    const { stdout, stderr } = await fork(
      resolve(`./resolvesWithProcessOutput.${ext}`),
      {
        silent: true,
      }
    )
    expect(stdout).to.equal(undefined)
    expect(stderr).to.equal(undefined)
  })
  it(`kills child when maxBuffer is exceeded`, async () => {
    let error: unknown
    await fork(resolve(`./resolvesWithProcessOutput.${ext}`), {
      silent: true,
      maxBuffer: 1,
    }).catch((err: unknown) => (error = err))
    if (error == null) throw new Error('missing error')
    if (!isChildProcessError(error))
      throw new Error('error is not a child process error')
    const { code, signal, stdout, stderr } = error
    if (!process.env.JCOREIO_TOOLCHAIN_COVERAGE)
      expect(code, 'code').to.equal(null)
    if (!process.env.JCOREIO_TOOLCHAIN_COVERAGE)
      expect(signal, 'signal').to.equal('SIGTERM')
    expect(stdout?.toString('utf8')).to.equal('h')
    expect(stderr?.toString('utf8')).to.equal('')
  })
  it('resolves with process output as string when encoding is not buffer', async () => {
    const { stdout, stderr } = await fork(
      resolve(`./resolvesWithProcessOutput.${ext}`),
      {
        silent: true,
        encoding: 'utf8',
      }
    )
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with exit code', async () => {
    let finallyDone = false
    let error: unknown
    await fork(resolve(`./rejectsWithExitCode.${ext}`), {
      silent: true,
      maxBuffer: 200 * 1024,
    })
      .finally(async () => {
        await delay(50)
        finallyDone = true
      })
      .catch((err: unknown) => (error = err))
    expect(finallyDone, 'finally handler finished').to.equal(true)
    if (error == null) throw new Error('missing error')
    if (!isChildProcessError(error))
      throw new Error('error is not a child process error')
    const { code, signal, message, stdout, stderr } = error
    expect(message).to.equal('Process exited with code 2')
    expect(code, 'code').to.equal(2)
    expect(signal, 'signal').to.equal(null)
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
  })
  it('rejects with signal', async () => {
    let error: unknown
    const child = fork(resolve(`./rejectsWithSignal.${ext}`), {
      silent: true,
      maxBuffer: 200 * 1024,
    })
    let gotStdout = false,
      gotStderr = false
    function killWhenReady() {
      if (gotStdout && gotStderr) child.kill('SIGINT')
    }
    child.stdout.on('data', () => {
      gotStdout = true
      killWhenReady()
    })
    child.stderr.on('data', () => {
      gotStderr = true
      killWhenReady()
    })
    await child.catch((err: unknown) => (error = err))
    if (error == null) throw new Error('missing error')
    if (!isChildProcessError(error))
      throw new Error('error is not a child process error')
    const { code, signal, message, stdout, stderr } = error
    expect(message).to.equal('Process was killed with SIGINT')
    expect(code, 'code').to.equal(null)
    expect(signal, 'signal').to.equal('SIGINT')
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
  })
  it('works without silent: true', async () => {
    const { stdout, stderr } = await fork(
      resolve(`./resolvesWithProcessOutput.${ext}`)
    )
    expect(stdout).to.equal(undefined)
    expect(stderr).to.equal(undefined)
  })
})
describe('exec', function () {
  this.timeout(30000)
  it('resolves with process output', async () => {
    const { code, signal, stdout, stderr } = await exec(
      `${process.execPath} ${resolve(`./resolvesWithProcessOutput.${ext}`)}`
    )
    if (stdout == null || stderr == null) throw new Error('missing output')
    expect(code, 'code').to.equal(0)
    expect(signal, 'signal').to.equal(null)
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with exit code', async () => {
    let error: unknown
    await exec(
      `${process.execPath} ${resolve(`./rejectsWithExitCode.${ext}`)}`
    ).catch((err: unknown) => (error = err))
    if (error == null) throw new Error('missing error')
    if (!isChildProcessError(error))
      throw new Error('error is not a child process error')
    const { code, signal, stdout, stderr } = error
    expect(code, 'code').to.equal(2)
    expect(signal, 'signal').to.equal(null)
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with signal', async () => {
    let error: unknown
    const child = exec(
      `${process.execPath} ${resolve(`./rejectsWithSignal.${ext}`)}`
    )
    let gotStdout = false,
      gotStderr = false
    function killWhenReady() {
      if (gotStdout && gotStderr) child.kill('SIGINT')
    }
    child.stdout.on('data', () => {
      gotStdout = true
      killWhenReady()
    })
    child.stderr.on('data', () => {
      gotStderr = true
      killWhenReady()
    })
    await child.catch((err: unknown) => (error = err))
    if (error == null) throw new Error('missing error')
    if (!isChildProcessError(error))
      throw new Error('error is not a child process error')
    const { code, signal, stdout, stderr } = error
    expect(code, 'code').to.equal(null)
    expect(signal, 'signal').to.equal('SIGINT')
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
})
describe('execFile', function () {
  this.timeout(30000)
  it('resolves with process output', async () => {
    const { code, signal, stdout, stderr } = await execFile(
      resolve(`./resolvesWithProcessOutput.${ext}`)
    )
    if (stdout == null || stderr == null) throw new Error('missing output')
    expect(code, 'code').to.equal(0)
    expect(signal, 'signal').to.equal(null)
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with exit code', async () => {
    let error: unknown
    await execFile(resolve(`./rejectsWithExitCode.${ext}`)).catch(
      (err: unknown) => (error = err)
    )
    if (error == null) throw new Error('missing error')
    if (!isChildProcessError(error))
      throw new Error('error is not a child process error')
    const { code, signal, stdout, stderr } = error
    expect(code, 'code').to.equal(2)
    expect(signal, 'signal').to.equal(null)
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with signal', async () => {
    let error: unknown
    const child = execFile(resolve(`./rejectsWithSignal.${ext}`))
    let gotStdout = false,
      gotStderr = false
    function killWhenReady() {
      if (gotStdout && gotStderr) child.kill('SIGINT')
    }
    child.stdout.on('data', () => {
      gotStdout = true
      killWhenReady()
    })
    child.stderr.on('data', () => {
      gotStderr = true
      killWhenReady()
    })
    await child.catch((err: unknown) => (error = err))
    if (error == null) throw new Error('missing error')
    if (!isChildProcessError(error))
      throw new Error('error is not a child process error')
    const { code, signal, stdout, stderr } = error
    expect(code, 'code').to.equal(null)
    expect(signal, 'signal').to.equal('SIGINT')
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function typeTests() {
  type AssertEqual<T, U> =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    (<V>() => V extends T ? 1 : 2) extends <V>() => V extends U ? 1 : 2 ? true
    : false

  const assertEqual = <A, B>(val: AssertEqual<A, B>) => val

  assertEqual<ChildProcessResult<{ maxBuffer: 1024 }>['stdout'], Buffer>(true)
  assertEqual<ChildProcessResult<{ silent: true }>['stdout'], undefined>(true)
  assertEqual<ChildProcessResult<{ stdio: 'pipe' }>['stdout'], undefined>(true)
  assertEqual<ChildProcessResult<{}>['stdout'], undefined>(true)
  assertEqual<ChildProcessResult<{ encoding: 'utf8' }>['stdout'], string>(true)

  assertEqual<
    ChildProcessResult<{ stdio: 'inherit'; encoding: 'utf8' }>['stdout'],
    undefined
  >(true)
  assertEqual<
    ChildProcessResult<{ stdio: 'pipe'; encoding: 'utf8' }>['stdout'],
    string
  >(true)
  assertEqual<
    ChildProcessResult<{ stdio: 'pipe'; encoding: 'buffer' }>['stdout'],
    Buffer
  >(true)
  assertEqual<
    ChildProcessResult<{
      stdio: ['inherit', 'pipe', 'inherit']
      encoding: 'utf8'
    }>['stdout'],
    string
  >(true)
  assertEqual<
    ChildProcessResult<{
      stdio: ['pipe', 'inherit', 'pipe']
      encoding: 'utf8'
    }>['stdout'],
    undefined
  >(true)
  assertEqual<
    ChildProcessResult<{
      stdio: ['pipe', 'inherit', 'pipe']
      encoding: 'utf8'
    }>['stderr'],
    string
  >(true)
  assertEqual<
    ChildProcessResult<{
      stdio: ['inherit', 'pipe', 'inherit']
      encoding: 'utf8'
    }>['stderr'],
    undefined
  >(true)

  assertEqual<ChildProcessPromise<{}>['stdin'], Writable>(true)
  assertEqual<ChildProcessPromise<{}>['stdout'], Readable>(true)
  assertEqual<ChildProcessPromise<{}>['stderr'], Readable>(true)
  assertEqual<ChildProcessPromise<{}>['channel'], undefined>(true)

  assertEqual<ChildProcessPromise<{ stdio: 'pipe' }>['stdin'], Writable>(true)
  assertEqual<ChildProcessPromise<{ stdio: 'pipe' }>['stdout'], Readable>(true)
  assertEqual<ChildProcessPromise<{ stdio: 'pipe' }>['stderr'], Readable>(true)
  assertEqual<ChildProcessPromise<{ stdio: 'pipe' }>['channel'], undefined>(
    true
  )

  assertEqual<ChildProcessPromise<{ stdio: 'inherit' }>['stdin'], null>(true)
  assertEqual<ChildProcessPromise<{ stdio: 'inherit' }>['stdout'], null>(true)
  assertEqual<ChildProcessPromise<{ stdio: 'inherit' }>['stderr'], null>(true)
  assertEqual<ChildProcessPromise<{ stdio: 'inherit' }>['channel'], undefined>(
    true
  )

  {
    type Options = { stdio: ['pipe', 'inherit', 'pipe'] }
    assertEqual<ChildProcessPromise<Options>['stdin'], Writable>(true)
    assertEqual<ChildProcessPromise<Options>['stdout'], null>(true)
    assertEqual<ChildProcessPromise<Options>['stderr'], Readable>(true)
    assertEqual<ChildProcessPromise<Options>['channel'], undefined>(true)
    assertEqual<
      ChildProcessPromise<Options>['stdio'],
      [Writable, null, Readable]
    >(true)
  }
  {
    type Options = { stdio: ['pipe', 'inherit', 'pipe', 'pipe', 'ipc'] }
    assertEqual<ChildProcessPromise<Options>['stdin'], Writable>(true)
    assertEqual<ChildProcessPromise<Options>['stdout'], null>(true)
    assertEqual<ChildProcessPromise<Options>['stderr'], Readable>(true)
    assertEqual<ChildProcessPromise<Options>['channel'], Pipe>(true)
    assertEqual<
      ChildProcessPromise<Options>['stdio'],
      [Writable, null, Readable, Readable, null]
    >(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const child = spawn('foo', { stdio: ['pipe', 'inherit', 'pipe', 'ipc'] })
  assertEqual<(typeof child)['stdin'], Writable>(true)
  assertEqual<(typeof child)['stdout'], null>(true)
  assertEqual<(typeof child)['stderr'], Readable>(true)
  assertEqual<(typeof child)['channel'], Pipe>(true)
}

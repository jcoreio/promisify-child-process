// @flow

import { spawn, fork, exec, execFile } from '../src'
import { describe, it, before } from 'mocha'
import { expect } from 'chai'
import path from 'path'
import fs from 'fs-extra'

describe('spawn', function() {
  this.timeout(30000)

  before(async () =>
    Promise.all([
      fs.writeFile(
        path.resolve(__dirname, 'resolvesWithProcessOutput.js'),
        `#!${process.execPath}
process.stdout.write('hello')
process.stderr.write('world')
      `,
        { encoding: 'utf8', mode: 0o755 }
      ),
      fs.writeFile(
        path.resolve(__dirname, 'rejectsWithExitCode.js'),
        `#!${process.execPath}
process.stdout.write('hello')
process.stderr.write('world')
process.exit(2)
      `,
        { encoding: 'utf8', mode: 0o755 }
      ),
      fs.writeFile(
        path.resolve(__dirname, 'rejectsWithSignal.js'),
        `#!${process.execPath}
process.stdout.write('hello')
process.stderr.write('world')

setTimeout(function() {}, 5000)
      `,
        { encoding: 'utf8', mode: 0o755 }
      ),
    ])
  )

  it('resolves with process output', async () => {
    const { stdout, stderr } = await spawn(
      process.execPath,
      [require.resolve('./resolvesWithProcessOutput')],
      { maxBuffer: 200 * 1024 }
    )
    if (stdout == null || stderr == null) throw new Error('missing output')
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
  })
  it(`doesn't capture output when neither encoding nor maxBuffer is given`, async () => {
    const { stdout, stderr } = await spawn(process.execPath, [
      require.resolve('./resolvesWithProcessOutput'),
    ])
    expect()
    expect(stdout).not.to.exist
    expect(stderr).not.to.exist
  })
  it(`kills child when maxBuffer is exceeded`, async () => {
    let error
    await spawn(
      process.execPath,
      [require.resolve('./resolvesWithProcessOutput')],
      { maxBuffer: 1 }
    ).catch(err => (error = err))
    if (error == null) throw new Error('missing error')
    const { stdout, stderr } = error
    expect(stdout.toString('utf8')).to.equal('h')
    expect(stderr.toString('utf8')).to.equal('')
  })
  it('resolves with process output as string when encoding is not buffer', async () => {
    const { stdout, stderr } = await spawn(
      'node',
      [require.resolve('./resolvesWithProcessOutput')],
      { encoding: 'utf8' }
    )
    if (stdout == null || stderr == null) throw new Error('missing output')
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with exit code', async () => {
    let error
    await spawn(process.execPath, [require.resolve('./rejectsWithExitCode')], {
      maxBuffer: 200 * 1024,
    }).catch(err => (error = err))
    if (error == null) throw new Error('missing error')
    const { code, message, stdout, stderr } = error
    expect(message).to.equal('Process exited with code 2')
    expect(code).to.equal(2)
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
  })
  it('rejects with signal', async () => {
    let error
    const child = spawn(
      process.execPath,
      [require.resolve('./rejectsWithSignal')],
      {
        maxBuffer: 200 * 1024,
      }
    )
    let gotStdout, gotStderr
    function killWhenReady() {
      if (gotStdout && gotStderr) process.kill(child.pid, 'SIGINT')
    }
    child.stdout.on('data', () => {
      gotStdout = true
      killWhenReady()
    })
    child.stderr.on('data', () => {
      gotStderr = true
      killWhenReady()
    })
    await child.catch(err => (error = err))
    if (error == null) throw new Error('missing error')
    const { signal, message, stdout, stderr } = error
    expect(message).to.equal('Process was killed with SIGINT')
    expect(signal).to.equal('SIGINT')
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
      [require.resolve('./resolvesWithProcessOutput')],
      { stdio: 'inherit' }
    )
    expect(stdout).not.to.exist
    expect(stderr).not.to.exist
  })
})

describe('fork', function() {
  this.timeout(30000)

  it('resolves with process output', async () => {
    const { stdout, stderr } = await fork(
      require.resolve('./resolvesWithProcessOutput'),
      { silent: true, maxBuffer: 200 * 1024 }
    )
    if (stdout == null || stderr == null) throw new Error('missing output')
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
  })
  it(`doesn't capture output if neither encoding nor maxBuffer is given`, async function(): Promise<void> {
    const { stdout, stderr } = await fork(
      require.resolve('./resolvesWithProcessOutput'),
      { silent: true }
    )
    expect(stdout).not.to.exist
    expect(stderr).not.to.exist
  })
  it(`kills child when maxBuffer is exceeded`, async () => {
    let error
    await fork(require.resolve('./resolvesWithProcessOutput'), {
      silent: true,
      maxBuffer: 1,
    }).catch(err => (error = err))
    if (error == null) throw new Error('missing error')
    const { stdout, stderr } = error
    expect(stdout.toString('utf8')).to.equal('h')
    expect(stderr.toString('utf8')).to.equal('')
  })
  it('resolves with process output as string when encoding is not buffer', async () => {
    const { stdout, stderr } = await fork(
      require.resolve('./resolvesWithProcessOutput'),
      { silent: true, encoding: 'utf8' }
    )
    if (stdout == null || stderr == null) throw new Error('missing output')
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with exit code', async () => {
    let error
    await fork(require.resolve('./rejectsWithExitCode'), {
      silent: true,
      maxBuffer: 200 * 1024,
    }).catch(err => (error = err))
    if (error == null) throw new Error('missing error')
    const { code, message, stdout, stderr } = error
    expect(message).to.equal('Process exited with code 2')
    expect(code).to.equal(2)
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
  })
  it('rejects with signal', async () => {
    let error
    const child = fork(require.resolve('./rejectsWithSignal'), {
      silent: true,
      maxBuffer: 200 * 1024,
    })
    let gotStdout, gotStderr
    function killWhenReady() {
      if (gotStdout && gotStderr) process.kill(child.pid, 'SIGINT')
    }
    child.stdout.on('data', () => {
      gotStdout = true
      killWhenReady()
    })
    child.stderr.on('data', () => {
      gotStderr = true
      killWhenReady()
    })
    await child.catch(err => (error = err))
    if (error == null) throw new Error('missing error')
    const { signal, message, stdout, stderr } = error
    expect(message).to.equal('Process was killed with SIGINT')
    expect(signal).to.equal('SIGINT')
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
  })
  it('works without silent: true', async () => {
    const { stdout, stderr } = await fork(
      require.resolve('./resolvesWithProcessOutput')
    )
    expect(stdout).not.to.exist
    expect(stderr).not.to.exist
  })
})
describe('exec', function() {
  this.timeout(30000)

  it('resolves with process output', async () => {
    const { stdout, stderr } = await exec(
      `${process.execPath} ${require.resolve('./resolvesWithProcessOutput')}`
    )
    if (stdout == null || stderr == null) throw new Error('missing output')
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with exit code', async () => {
    let error
    await exec(
      `${process.execPath} ${require.resolve('./rejectsWithExitCode')}`
    ).catch(err => (error = err))
    if (error == null) throw new Error('missing error')
    const { code, stdout, stderr } = error
    expect(code).to.equal(2)
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with signal', async () => {
    let error
    const child = exec(
      `${process.execPath} ${require.resolve('./rejectsWithSignal')}`
    )
    let gotStdout, gotStderr
    function killWhenReady() {
      if (gotStdout && gotStderr) process.kill(child.pid, 'SIGINT')
    }
    child.stdout.on('data', () => {
      gotStdout = true
      killWhenReady()
    })
    child.stderr.on('data', () => {
      gotStderr = true
      killWhenReady()
    })
    await child.catch(err => (error = err))
    if (error == null) throw new Error('missing error')
    const { signal, stdout, stderr } = error
    expect(signal).to.equal('SIGINT')
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
})

describe('execFile', function() {
  this.timeout(30000)

  it('resolves with process output', async () => {
    const { stdout, stderr } = await execFile(
      require.resolve('./resolvesWithProcessOutput')
    )
    if (stdout == null || stderr == null) throw new Error('missing output')
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with exit code', async () => {
    let error
    await execFile(require.resolve('./rejectsWithExitCode')).catch(
      err => (error = err)
    )
    if (error == null) throw new Error('missing error')
    const { code, stdout, stderr } = error
    expect(code).to.equal(2)
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with signal', async () => {
    let error
    const child = execFile(require.resolve('./rejectsWithSignal'))
    let gotStdout, gotStderr
    function killWhenReady() {
      if (gotStdout && gotStderr) process.kill(child.pid, 'SIGINT')
    }
    child.stdout.on('data', () => {
      gotStdout = true
      killWhenReady()
    })
    child.stderr.on('data', () => {
      gotStderr = true
      killWhenReady()
    })
    await child.catch(err => (error = err))
    if (error == null) throw new Error('missing error')
    const { signal, stdout, stderr } = error
    expect(signal).to.equal('SIGINT')
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
})

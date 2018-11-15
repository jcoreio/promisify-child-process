// @flow

import { spawn, fork, exec, execFile } from '../src'
import { describe, it } from 'mocha'
import { expect } from 'chai'

describe('spawn', function() {
  this.timeout(30000)

  it('resolves with process output', async () => {
    const { stdout, stderr } = await spawn('node', [
      require.resolve('./resolvesWithProcessOutput'),
    ])
    if (stdout == null || stderr == null) throw new Error('missing output')
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
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
    await spawn('node', [require.resolve('./rejectsWithExitCode')]).catch(
      err => (error = err)
    )
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
    const child = spawn('node', [require.resolve('./rejectsWithSignal')])
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
  it('works with stdio: inherit and encoding: utf8', async () => {
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
      { silent: true }
    )
    if (stdout == null || stderr == null) throw new Error('missing output')
    if (!(stdout instanceof Buffer))
      throw new Error('expected stdout to be a buffer')
    if (!(stderr instanceof Buffer))
      throw new Error('expected stderr to be a buffer')
    expect(stdout.toString('utf8')).to.equal('hello')
    expect(stderr.toString('utf8')).to.equal('world')
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
    const child = fork(require.resolve('./rejectsWithSignal'), { silent: true })
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
  it('works without silent: true and encoding: utf8', async () => {
    const { stdout, stderr } = await fork(
      require.resolve('./resolvesWithProcessOutput'),
      { encoding: 'utf8' }
    )
    expect(stdout).not.to.exist
    expect(stderr).not.to.exist
  })
})
describe('exec', function() {
  this.timeout(30000)

  it('resolves with process output', async () => {
    const { stdout, stderr } = await exec(
      `node ${require.resolve('./resolvesWithProcessOutput')}`
    )
    if (stdout == null || stderr == null) throw new Error('missing output')
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  it('rejects with exit code', async () => {
    let error
    await exec(`node ${require.resolve('./rejectsWithExitCode')}`).catch(
      err => (error = err)
    )
    if (error == null) throw new Error('missing error')
    const { code, stdout, stderr } = error
    expect(code).to.equal(2)
    expect(stdout).to.equal('hello')
    expect(stderr).to.equal('world')
  })
  // for some reason, the following doesn't work on Travis CI :(
  if (!process.env.CI) {
    it('rejects with signal', async () => {
      let error
      const child = exec(`node ${require.resolve('./rejectsWithSignal')}`)
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
  }
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

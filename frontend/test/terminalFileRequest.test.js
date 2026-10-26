import test from 'node:test'
import assert from 'node:assert/strict'
import { createTerminalFileRequest, consumeTerminalFileRequest, clearCursorTargetAfterFailure } from '../src/components/terminalFileRequest.js'

test('assigns distinct identities to consecutive terminal file requests', () => {
  const first = createTerminalFileRequest({ path: 'src/first.js', line: 3, column: 2 }, 'New')
  const second = createTerminalFileRequest({ path: 'src/second.js', line: 9, column: 4 }, 'New')

  assert.notEqual(first.id, second.id)
  assert.deepEqual(second, {
    path: 'src/second.js',
    line: 9,
    column: 4,
    project: 'New',
    id: second.id,
  })
})

test('consumes a matching request once without discarding another project request', () => {
  const request = createTerminalFileRequest({ path: 'src/first.js', line: 3, column: 2 }, 'New')
  const otherProjectRequest = createTerminalFileRequest({ path: 'src/other.js', line: 8 }, 'Other')

  assert.deepEqual(consumeTerminalFileRequest(request, 'New', null), { shouldConsume: true, consumedId: request.id })
  assert.deepEqual(consumeTerminalFileRequest(request, 'New', request.id), { shouldConsume: false, consumedId: request.id })
  assert.deepEqual(consumeTerminalFileRequest(otherProjectRequest, 'New', request.id), { shouldConsume: false, consumedId: request.id })
})

test('clears only the failed terminal cursor target', () => {
  const failedTarget = { project: 'New', path: 'src/first.js', line: 3, requestId: 1 }
  const newerTarget = { project: 'New', path: 'src/first.js', line: 9, requestId: 2 }

  assert.equal(clearCursorTargetAfterFailure(failedTarget, failedTarget), null)
  assert.deepEqual(clearCursorTargetAfterFailure(newerTarget, failedTarget), newerTarget)
  assert.deepEqual(clearCursorTargetAfterFailure({ project: 'New', path: 'src/first.js', line: 3 }, failedTarget), { project: 'New', path: 'src/first.js', line: 3 })
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { createAutosaveController, newestRestorableDraft } from './autosave.mjs'

function memoryStorage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

test('debounces autosave until typing has stopped', async () => {
  const timers = new Map(); let timerId = 0; const calls = []
  const controller = createAutosaveController({ save: async draft => { calls.push(draft); return { accepted: true } }, storage: memoryStorage(), key: 'draft', onStatus() {}, setTimer: fn => { timers.set(++timerId, fn); return timerId }, clearTimer: id => timers.delete(id), now: () => 100 })
  controller.schedule({ title: 'a' }); controller.schedule({ title: 'ab' }); controller.schedule({ title: 'abc' })
  assert.equal(timers.size, 1); assert.equal(calls.length, 0)
  await [...timers.values()][0](); await Promise.resolve()
  assert.equal(calls.length, 1); assert.equal(calls[0].title, 'abc')
})

test('keeps the latest draft locally while offline and retries later', async () => {
  const storage = memoryStorage(); const statuses = []; const calls = []; let connected = false
  const controller = createAutosaveController({ save: async draft => { calls.push(draft); return { accepted: true } }, storage, key: 'draft', onStatus: value => statuses.push(value), online: () => connected, now: () => 200 })
  controller.schedule({ title: 'offline copy' }); await controller.flush()
  assert.equal(calls.length, 0); assert.equal(JSON.parse(storage.getItem('draft')).title, 'offline copy'); assert.equal(statuses.at(-1), 'offline')
  connected = true; controller.retry(); await Promise.resolve(); await Promise.resolve()
  assert.equal(calls.length, 1); assert.equal(storage.getItem('draft'), null); assert.equal(statuses.at(-1), 'saved')
})

test('restore flow selects only the newest draft newer than the saved post', () => {
  const server = { title: 'server', updated_at: '2026-01-03T00:00:00Z' }
  const local = { title: 'local', updated_at: '2026-01-04T00:00:00Z' }
  assert.equal(newestRestorableDraft(server, local, '2026-01-02T00:00:00Z').title, 'local')
  assert.equal(newestRestorableDraft(server, local, '2026-01-05T00:00:00Z'), null)
})

test('an older request resolving last cannot mark a newer draft as saved', async () => {
  const resolvers = []; const statuses = []
  const controller = createAutosaveController({ save: draft => new Promise(resolve => resolvers.push({ sequence:draft.sequence,resolve })), storage: memoryStorage(), key:'draft', onStatus:value=>statuses.push(value), now:(()=>{let value=300;return()=>++value})() })
  controller.schedule({ title:'first' }); const first=controller.flush()
  controller.schedule({ title:'second' }); const second=controller.flush()
  resolvers[1].resolve({ accepted:true }); await second
  resolvers[0].resolve({ accepted:true }); await first
  assert.equal(statuses.filter(value=>value==='saved').length,1)
})

export const AUTOSAVE_DELAY = 1800

export function localDraftKey(postId) {
  return `lumina-autosave-${postId || 'new'}`
}

export function readLocalDraft(storage, key) {
  try { return JSON.parse(storage.getItem(key) || 'null') }
  catch { return null }
}

export function newestRestorableDraft(serverDraft, localDraft, publishedAt) {
  const candidates = [serverDraft, localDraft].filter(Boolean)
  const newest = candidates.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
  return newest && new Date(newest.updated_at).getTime() > new Date(publishedAt || 0).getTime() ? newest : null
}

export function createAutosaveController({ save, storage, key, onStatus, delay = AUTOSAVE_DELAY, online = () => true, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, now = () => Date.now() }) {
  let timer
  let latestPayload
  let latestSent = 0
  let dirty = false
  const pending = new Set()

  const persist = (payload, sequence) => storage.setItem(key, JSON.stringify({ ...payload, sequence, updated_at: new Date(now()).toISOString() }))

  async function flush() {
    if (!latestPayload || !dirty) return
    if (!online()) { onStatus('offline'); return }
    const sequence = Math.max(now(), latestSent + 1)
    latestSent = sequence
    const payload = { ...latestPayload, sequence, updated_at: new Date(now()).toISOString() }
    persist(latestPayload, sequence)
    onStatus('saving')
    const operation = save(payload)
    pending.add(operation)
    try {
      const result = await operation
      if (sequence !== latestSent || !result?.accepted) return
      dirty = false
      storage.removeItem(key)
      onStatus('saved')
    } catch {
      if (sequence === latestSent) onStatus('offline')
    } finally { pending.delete(operation) }
  }

  function schedule(payload) {
    latestPayload = payload
    dirty = true
    persist(payload, Math.max(now(), latestSent + 1))
    if (timer) clearTimer(timer)
    timer = setTimer(() => { timer = undefined; void flush() }, delay)
  }

  function retry() { if (dirty) void flush() }
  function clear() { if (timer) clearTimer(timer); timer = undefined; dirty = false; storage.removeItem(key); onStatus('saved') }
  function dispose() { if (timer) clearTimer(timer); timer = undefined }
  async function waitForIdle() { await Promise.allSettled([...pending]) }
  return { schedule, flush, retry, clear, dispose, waitForIdle, isDirty: () => dirty }
}

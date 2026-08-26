import type { PostDraft, PostInput } from './types/index'
export const AUTOSAVE_DELAY: number
export function localDraftKey(postId?: string): string
export function readLocalDraft(storage: Storage, key: string): PostDraft | null
export function newestRestorableDraft(serverDraft: PostDraft | null | undefined, localDraft: PostDraft | null | undefined, publishedAt?: string): PostDraft | null
export function createAutosaveController(options: {
  save: (draft: PostDraft) => Promise<{ accepted: boolean }>
  storage: Storage
  key: string
  onStatus: (status: 'saving' | 'saved' | 'offline') => void
  delay?: number
  online?: () => boolean
  setTimer?: typeof setTimeout
  clearTimer?: typeof clearTimeout
  now?: () => number
}): { schedule(payload: PostInput): void; flush(): Promise<void>; retry(): void; clear(): void; dispose(): void; waitForIdle(): Promise<void>; isDirty(): boolean }

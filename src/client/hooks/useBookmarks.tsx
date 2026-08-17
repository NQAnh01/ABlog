import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'

type BookmarkValue = {
  bookmarks: string[]
  isBookmarked: (postId: string) => boolean
  toggleBookmark: (postId: string) => 'added' | 'removed' | 'login_required'
}

const BookmarkContext = createContext<BookmarkValue | null>(null)

function storageKey(userId: string) { return `lumina-bookmarks-${userId}` }

function loadBookmarks(userId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveBookmarks(userId: string, ids: string[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(ids))
}

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [bookmarks, setBookmarks] = useState<string[]>([])

  useEffect(() => {
    if (user) {
      setBookmarks(loadBookmarks(user.id))
    } else {
      setBookmarks([])
    }
  }, [user])

  const isBookmarked = useCallback((postId: string) => bookmarks.includes(postId), [bookmarks])

  const toggleBookmark = useCallback((postId: string): 'added' | 'removed' | 'login_required' => {
    if (!user) return 'login_required'
    setBookmarks(current => {
      const next = current.includes(postId)
        ? current.filter(id => id !== postId)
        : [...current, postId]
      saveBookmarks(user.id, next)
      return next
    })
    return bookmarks.includes(postId) ? 'removed' : 'added'
  }, [user, bookmarks])

  return <BookmarkContext.Provider value={{ bookmarks, isBookmarked, toggleBookmark }}>{children}</BookmarkContext.Provider>
}

export function useBookmarks() {
  const value = useContext(BookmarkContext)
  if (!value) throw new Error('useBookmarks requires BookmarkProvider')
  return value
}

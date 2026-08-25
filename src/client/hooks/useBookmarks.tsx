import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { api } from '../services/api'

type BookmarkValue = {
  bookmarks: string[]
  isBookmarked: (postId: string) => boolean
  toggleBookmark: (postId: string) => Promise<'added' | 'removed' | 'login_required'>
}

const BookmarkContext = createContext<BookmarkValue | null>(null)

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const toast = useToast()
  const [bookmarks, setBookmarks] = useState<string[]>([])

  useEffect(() => {
    if (user) api.bookmarks().then(async value => {
      const serverIds=value.post_ids??[]
      try { const key=`lumina-bookmarks-${user.id}`;const legacy=JSON.parse(localStorage.getItem(key)??'[]') as string[];const missing=legacy.filter(id=>!serverIds.includes(id));await Promise.all(missing.map(id=>api.addBookmark(id)));if(missing.length)setBookmarks([...new Set([...serverIds,...missing])]);else setBookmarks(serverIds);localStorage.removeItem(key) } catch { setBookmarks(serverIds) }
    }).catch(() => setBookmarks([]))
    else setBookmarks([])
  }, [user])

  const isBookmarked = useCallback((postId: string) => bookmarks.includes(postId), [bookmarks])

  const toggleBookmark = useCallback(async (postId: string): Promise<'added' | 'removed' | 'login_required'> => {
    if (!user) { toast('Sign in to save stories.', 'info'); return 'login_required' }
    const result = bookmarks.includes(postId) ? 'removed' : 'added'
    try {
      if (result === 'added') await api.addBookmark(postId); else await api.removeBookmark(postId)
      setBookmarks(current => result === 'added' ? [...new Set([...current, postId])] : current.filter(id => id !== postId))
      toast(result === 'added' ? 'Story added to your reading list.' : 'Story removed from your reading list.', 'info')
      return result
    } catch { toast('Unable to update your reading list.', 'error'); return result === 'added' ? 'removed' : 'added' }
  }, [user, bookmarks, toast])

  return <BookmarkContext.Provider value={{ bookmarks, isBookmarked, toggleBookmark }}>{children}</BookmarkContext.Provider>
}

export function useBookmarks() {
  const value = useContext(BookmarkContext)
  if (!value) throw new Error('useBookmarks requires BookmarkProvider')
  return value
}

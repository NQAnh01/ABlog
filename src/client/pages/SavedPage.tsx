import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BlogCard } from '../components/BlogCard'
import { EmptyState, ErrorState, Layout, Loading } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useBookmarks } from '../hooks/useBookmarks'
import { api } from '../services/api'
import type { Post } from '../types'

export function SavedPage() {
  const { user, loading: authLoading } = useAuth()
  const { bookmarks } = useBookmarks()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) { setLoading(false); return }
    if (bookmarks.length === 0) { setPosts([]); setLoading(false); return }
    setLoading(true)
    // Fetch all public posts and filter to only bookmarked ones
    api.posts('?limit=100').then(result => {
      const saved = (result.items ?? []).filter(p => bookmarks.includes(p.id))
      setPosts(saved)
    }).catch(err => setError(err instanceof Error ? err.message : 'Unable to load saved stories'))
      .finally(() => setLoading(false))
  }, [user, bookmarks])

  if (authLoading) return <Layout dark><Loading /></Layout>
  if (!user) return <Navigate to="/login" replace />

  return <Layout dark><section className="listing saved-stories container"><header className="listing-head">
    <div><span className="eyebrow">YOUR READING LIST</span><h1>Saved Stories <sup>{posts.length}</sup></h1><p>Stories you've bookmarked for later reading.</p></div>
  </header>
    {error ? <ErrorState message={error} /> : loading ? <Loading /> : posts.length === 0
      ? <EmptyState title="No saved stories yet" text="Bookmark stories you love and they'll appear here." />
      : <div className="post-grid">{posts.map(p => <BlogCard key={p.id} post={p} />)}</div>}
  </section></Layout>
}

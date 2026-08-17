import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { EmptyState, Layout, Loading, Pagination } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import type { Post } from '../types'

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [changingStatus, setChangingStatus] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    api.myPosts(`?page=${page}`).then(result => { setPosts(result.items ?? []); setTotal(result.total) }).catch(err => setError(err instanceof Error ? err.message : 'Unable to load your stories')).finally(() => setLoading(false))
  }, [user, page])

  async function toggleVisibility(post: Post) {
    if (changingStatus) return
    setChangingStatus(post.id); setError('')
    const status = post.status === 'public' ? 'private' : 'public'
    try {
      const saved = await api.updatePost(post.id, { title: post.title, slug: post.slug, excerpt: post.excerpt ?? '', content: post.content, status, thumbnail: post.thumbnail, category_ids: post.category_ids ?? [], tag_ids: post.tag_ids ?? [] })
      setPosts(current => current.map(item => item.id === saved.id ? saved : item))
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to change visibility') }
    finally { setChangingStatus('') }
  }
  if (authLoading) return <Layout dark><Loading /></Layout>
  if (!user) return <Navigate to="/login" replace />
  return <Layout dark><section className="listing profile-stories container"><header className="listing-head"><div><span className="eyebrow">{user.role === 'admin' ? 'EDITORIAL LIBRARY' : 'YOUR WRITING'}</span><h1>{user.role === 'admin' ? 'All Stories' : 'My Stories'} <sup>{total}</sup></h1><p>Keep a story private for yourself or make it public for everyone.</p></div></header>
    {error && <div className="admin-alert">{error}<button onClick={() => setError('')}>×</button></div>}{loading ? <Loading /> : posts.length === 0 ? <EmptyState title="Your first story starts here" text="Create a story and choose who can see it." /> : <div className="profile-story-grid">{posts.map(post => <article key={post.id} role="link" tabIndex={0} aria-label={`View ${post.title}`} onClick={() => navigate(`/stories/${post.id}/preview`)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/stories/${post.id}/preview`) } }}>{post.thumbnail?.url ? <img src={post.thumbnail.url} alt="" /> : <div className="profile-cover-placeholder">L</div>}<div><button type="button" className={`profile-status ${post.status}`} disabled={changingStatus === post.id} title={`Change to ${post.status === 'public' ? 'private' : 'public'}`} onClick={event => { event.stopPropagation(); void toggleVisibility(post) }}>{changingStatus === post.id ? 'Saving…' : post.status}</button><h2>{post.title}</h2><p>{post.excerpt || 'No excerpt has been written yet.'}</p><footer><span>Click card to view</span><Link to={`/admin/posts/${post.id}/edit`} onClick={event => event.stopPropagation()}>Edit story →</Link></footer></div></article>)}</div>}
    <Pagination page={page} total={total} onPage={setPage} />
  </section></Layout>
}

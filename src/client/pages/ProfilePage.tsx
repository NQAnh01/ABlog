import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { EmptyState, Layout, Loading, Pagination } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import type { Post } from '../types'
import { useToast } from '../hooks/useToast'
import { ViewToggle } from '../components/ViewToggle'
import { confirmAction } from '../components/ConfirmModal'

export function ProfilePage() {
  const toast = useToast()
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
    const status = post.status === 'public' ? 'private' : 'public'
    if(!await confirmAction({title:`Make this story ${status}?`,message:`“${post.title}” will become ${status}.`,confirmLabel:`Make ${status}`}))return
    setChangingStatus(post.id); setError('')
    try {
      const saved = await api.updatePost(post.id, { title: post.title, slug: post.slug, excerpt: post.excerpt ?? '', content: post.content, status, thumbnail: post.thumbnail, category_ids: post.category_ids ?? [], tag_ids: post.tag_ids ?? [] })
      setPosts(current => current.map(item => item.id === saved.id ? saved : item))
      toast(`Story is now ${saved.status}.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to change visibility') }
    finally { setChangingStatus('') }
  }
  if (authLoading) return <Layout dark><Loading /></Layout>
  if (!user) return <Navigate to="/login" replace />
  const publicCount = posts.filter(post => post.status === 'public').length
  const scheduledCount = posts.filter(post => post.status === 'scheduled').length
  const privateCount = posts.filter(post => post.status === 'private').length
  return <Layout dark><section className="listing profile-stories container"><header className="profile-stories-hero"><div><span className="eyebrow">{user.role === 'admin' ? 'EDITORIAL LIBRARY' : 'YOUR WRITING'}</span><h1>{user.role === 'admin' ? 'All Stories' : 'My Stories'} <sup>{total}</sup></h1><p>Keep a story private for yourself or make it public for everyone.</p><div className="profile-summary" aria-label="Story summary"><span><i className="all"/>{total} total</span><span><i className="public"/>{publicCount} public</span>{scheduledCount > 0 && <span><i className="scheduled"/>{scheduledCount} scheduled</span>}<span><i className="private"/>{privateCount} private</span></div></div><div className="profile-heading-actions"><ViewToggle targetId="profile-stories-view" storageKey="profile-stories"/><Link className="button profile-create" to="/admin/posts/create"><span aria-hidden="true">＋</span> Create story</Link></div></header>
    {error && <div className="admin-alert">{error}<button onClick={() => setError('')}>×</button></div>}{loading ? <Loading /> : posts.length === 0 ? <EmptyState title="Your first story starts here" text="Create a story and choose who can see it." /> : <div className="profile-story-grid" id="profile-stories-view">{posts.map((post,index) => <article style={{'--story-index':index} as React.CSSProperties} key={post.id} role="link" tabIndex={0} aria-label={`View ${post.title}`} onClick={() => navigate(`/stories/${post.id}/preview`)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/stories/${post.id}/preview`) } }}><div className="profile-story-cover">{post.thumbnail?.url ? <img src={post.thumbnail.url} alt="" /> : <div className="profile-cover-placeholder">L</div>}<span>Preview <b>↗</b></span></div><div className="profile-story-content"><button type="button" className={`profile-status ${post.status}`} disabled={changingStatus === post.id} title={post.status === 'scheduled' ? `Scheduled for ${post.published_at ? new Date(post.published_at).toLocaleString() : ''}. Click to publish now.` : `Change to ${post.status === 'public' ? 'private' : 'public'}`} onClick={event => { event.stopPropagation(); void toggleVisibility(post) }}>{changingStatus === post.id ? 'Saving…' : post.status}</button><h2>{post.title}</h2><p>{post.excerpt || 'No excerpt has been written yet.'}</p><footer><time>{post.updated_at ? `Updated ${new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(new Date(post.updated_at))}` : 'Ready to edit'}</time><Link to={`/admin/posts/${post.id}/edit`} onClick={event => event.stopPropagation()}>Edit story <span>→</span></Link></footer></div></article>)}</div>}
    <Pagination page={page} total={total} onPage={setPage} />
  </section></Layout>
}

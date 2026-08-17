import { Link, useNavigate } from 'react-router-dom'
import { useBookmarks } from '../hooks/useBookmarks'
import type { Post } from '../types'

function readingTime(content: string) {
  const words = content.trim().split(/\s+/).length
  const minutes = Math.max(1, Math.ceil(words / 200))
  return `${minutes} min read`
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

export function BlogCard({ post }: { post: Post }) {
  const navigate = useNavigate()
  const { isBookmarked, toggleBookmark } = useBookmarks()
  const saved = isBookmarked(post.id)

  function handleBookmark(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    const result = toggleBookmark(post.id)
    if (result === 'login_required') {
      navigate('/login')
    }
  }

  const published = timeAgo(post.published_at ?? post.created_at)

  return <article className="blog-card"><Link to={`/blog/${post.slug}`}>
    {post.thumbnail && <div className="card-image"><img src={post.thumbnail.url} alt=""/></div>}
    <div className="card-meta"><span>{post.author?.name ?? 'Lumina'}</span><i/><span>{readingTime(post.content)}</span>{published && <><i/><span>{published}</span></>}</div>
    <h2>{post.title}</h2><p>{post.excerpt}</p>
  </Link><button className={`bookmark-btn${saved ? ' bookmarked' : ''}`} type="button" onClick={handleBookmark} aria-label={saved ? 'Remove from saved' : 'Save story'} title={saved ? 'Remove from saved' : 'Save story'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></article>
}

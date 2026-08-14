import { Link } from 'react-router-dom'
import type { Post } from '../types'
export function BlogCard({ post }: { post: Post }) { return <article className="blog-card"><Link to={`/blog/${post.slug}`}>
  {post.thumbnail && <div className="card-image"><img src={post.thumbnail.url} alt=""/></div>}
  <div className="card-meta"><span>{post.author?.name ?? 'Lumina'}</span><i/> <span>8 min read</span></div>
  <h2>{post.title}</h2><p>{post.excerpt}</p>
</Link></article> }

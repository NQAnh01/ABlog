import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { BlogCard } from '../components/BlogCard'
import { MarkdownView } from '../components/MarkdownEditor'
import { EmptyState, ErrorState, Layout, Loading } from '../components/ui'
import { api } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type { Comment, Post } from '../types'

export function BlogListPage({ title = 'Explore Stories' }: { title?: string }) {
 const [query]=useSearchParams(); const [posts,setPosts]=useState<Post[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const term=query.get('q')??''
 useEffect(()=>{const search=term?`?q=${encodeURIComponent(term)}`:'';setLoading(true);api.posts(search).then(result=>setPosts(result.items??[])).catch(err=>setError(err instanceof Error?err.message:'Unable to load stories')).finally(()=>setLoading(false))},[term])
 return <Layout dark><section className="listing container"><header className="listing-head"><div><span className="eyebrow">CURATED READING</span><h1>{title}</h1><p>Ideas, perspectives, and quiet observations for thoughtful minds.</p></div><form action="/search"><input name="q" defaultValue={term} placeholder="Search stories…"/></form></header>{error?<ErrorState message={error}/>:loading?<Loading/>:<><div className="post-grid">{posts.map(p=><BlogCard key={p.id} post={p}/>)}</div>{!posts.length&&<EmptyState title="No stories found" text="Try a different search phrase."/>}</>}</section></Layout>
}
export function ArticlePage() {
 const {slug=''}=useParams(); const [post,setPost]=useState<Post|null>(null); const [comments,setComments]=useState<Comment[]>([]); const [loading,setLoading]=useState(true);const[error,setError]=useState('')
 useEffect(()=>{Promise.all([api.post(slug),api.comments(slug)]).then(([p,c])=>{setPost(p);setComments(c??[])}).catch(err=>setError(err instanceof Error?err.message:'Story not found')).finally(()=>setLoading(false))},[slug])
 useEffect(()=>{if(!post)return;document.title=`${post.title} — Lumina`;document.querySelector('meta[name="description"]')?.setAttribute('content',post.excerpt)},[post])
 if(loading)return <Layout dark><Loading/></Layout>; if(error||!post)return <Layout dark><ErrorState message={error||"Story not found"}/></Layout>
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=e.currentTarget;const value=new FormData(f).get('content');if(!value||!post)return;try{const c=await api.comment(post.slug,String(value));setComments([...comments,c]);f.reset()}catch{/* authentication can be completed from the header */}}
 return <Layout dark><article className="article"><header><span className="eyebrow">LUMINA JOURNAL</span><h1>{post.title}</h1><p className="dek">{post.excerpt}</p><div className="author-line"><span className="avatar">{post.author?.name?.[0]??'L'}</span><div><strong>{post.author?.name??'Lumina Author'}</strong><small>{post.published_at?new Date(post.published_at).toLocaleDateString():''}</small></div></div></header>{post.thumbnail&&<img className="article-hero" src={post.thumbnail.url} alt={post.title}/>}<div className="article-body"><MarkdownView>{post.content}</MarkdownView></div><section className="comments"><h2>Conversation <sup>{comments.length}</sup></h2><form onSubmit={submit}><textarea name="content" placeholder="Share a thoughtful response…" required/><button className="button">Publish response</button></form>{comments.map(c=><div className="comment" key={c.id}><span className="avatar">{c.user?.name?.[0]??'R'}</span><div><strong>{c.user?.name??'Reader'}</strong><p>{c.content}</p></div></div>)}</section></article></Layout>
}

export function StoryPreviewPage() {
 const {id=''}=useParams(); const {user,loading:authLoading}=useAuth(); const [post,setPost]=useState<Post|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('')
 useEffect(()=>{if(!user){setLoading(false);return}api.myPost(id).then(setPost).catch(err=>setError(err instanceof Error?err.message:'Story not found')).finally(()=>setLoading(false))},[id,user])
 if(authLoading)return <Layout dark><Loading/></Layout>;if(!user)return <Navigate to="/login" replace/>;if(loading)return <Layout dark><Loading/></Layout>;if(error||!post)return <Layout dark><ErrorState message={error||'Story not found'}/></Layout>
 return <Layout dark><article className="article story-preview"><nav className="preview-actions"><Link to="/profile">← My Stories</Link><span className={`profile-status ${post.status}`}>{post.status}</span><Link to={`/admin/posts/${post.id}/edit`}>Edit story →</Link></nav><header><span className="eyebrow">STORY PREVIEW</span><h1>{post.title}</h1><p className="dek">{post.excerpt}</p></header>{post.thumbnail&&<img className="article-hero" src={post.thumbnail.url} alt={post.title}/>}<div className="article-body"><MarkdownView>{post.content}</MarkdownView></div></article></Layout>
}

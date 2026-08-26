import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Layout, StoryGridSkeleton } from '../components/ui'
import { api } from '../services/api'
import type { Category, Post, Series, User } from '../types'
import { useAuth } from '../hooks/useAuth'
import { recentPostIds } from '../recent-reading'
import { BlogCard } from '../components/BlogCard'

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat('en', { month:'long',day:'numeric',year:'numeric' }).format(new Date(value)) : ''
}

function EditorialImage({ post, eager=false }: { post:Post; eager?:boolean }) {
  const [loaded,setLoaded]=useState(false)
  return <div className={`editorial-image${loaded?' loaded':''}`}>{post.thumbnail?.url?<img src={post.thumbnail.url} alt="" loading={eager?'eager':'lazy'} decoding="async" fetchPriority={eager?'high':'auto'} onLoad={()=>setLoaded(true)}/>:<span aria-hidden="true">L</span>}</div>
}

function StoryMeta({ post }: { post:Post }) {
  return <div className="editorial-meta"><span>{post.author?.name??'Lumina'}</span><i/><time>{formatDate(post.published_at??post.created_at)}</time></div>
}

function CompactStory({ post, index }: { post:Post; index?:number }) {
  return <article className="editorial-compact"><Link to={`/blog/${post.slug}`}><span className="compact-number">{String((index??0)+1).padStart(2,'0')}</span><div><StoryMeta post={post}/><h3>{post.title}</h3></div><span className="compact-arrow">↗</span></Link></article>
}

export function HomePage() {
  const {user}=useAuth()
  const [featured,setFeatured]=useState<Post|null>(null)
  const [posts,setPosts]=useState<Post[]>([])
  const [trending,setTrending]=useState<Post[]>([])
  const [categories,setCategories]=useState<Category[]>([])
  const [featuredSeries,setFeaturedSeries]=useState<Series[]>([])
  const [forYou,setForYou]=useState<Post[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [subscribed,setSubscribed]=useState(false)

  useEffect(()=>{
    let active=true
    const from=new Date(Date.now()-7*24*60*60*1000).toISOString().slice(0,10)
    Promise.all([api.posts('?featured=true&limit=1'),api.posts('?limit=100'),api.posts(`?from=${from}&limit=5`),api.categories(),api.series(true)]).then(([featuredPage,recentPage,trendingPage,categoryData,seriesData])=>{
      if(!active)return
      const recent=recentPage.items??[]
      setFeatured(featuredPage.items?.[0]??recent[0]??null);setPosts(recent);setTrending(trendingPage.items??[]);setCategories(categoryData??[]);setFeaturedSeries(seriesData??[])
    }).catch(err=>{if(active)setError(err instanceof Error?err.message:'Unable to load the journal')}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[])
  useEffect(()=>{if(!user){setForYou([]);return};let active=true;api.personalRecommendations(recentPostIds()).then(values=>{if(active)setForYou(values)}).catch(()=>null);return()=>{active=false}},[user])

  const picks=posts.filter(post=>post.id!==featured?.id).slice(0,3)
  const categorySections=useMemo(()=>categories.map(category=>({category,posts:posts.filter(post=>post.category_ids?.includes(category.id)).slice(0,4)})).filter(section=>section.posts.length>=3).slice(0,3),[categories,posts])
  const authors=useMemo(()=>{
    const values=new Map<string,{author:User;count:number;categoryIds:string[]}>()
    for(const post of posts){if(!post.author?.id)continue;const current=values.get(post.author.id)??{author:post.author,count:0,categoryIds:[]};current.count++;current.categoryIds.push(...(post.category_ids??[]));values.set(post.author.id,current)}
    return [...values.values()].sort((a,b)=>b.count-a.count).slice(0,3).map(value=>{const topics=[...new Set(value.categoryIds)].map(id=>categories.find(category=>category.id===id)?.name).filter(Boolean).slice(0,2);return{...value,bio:topics.length?`Writing about ${topics.join(' and ')}.`:'A thoughtful voice in the Lumina community.'}})
  },[posts,categories])
  function subscribe(event:FormEvent<HTMLFormElement>){event.preventDefault();event.currentTarget.reset();setSubscribed(true)}

  return <Layout dark><div className="editorial-home">{loading?<div className="home-loading"><StoryGridSkeleton count={6}/></div>:error?<section className="home-error"><h1>The journal is taking a quiet moment.</h1><p>{error}</p><button onClick={()=>window.location.reload()}>Try again</button></section>:<>
    {featured&&<section className="magazine-hero"><div className="magazine-hero-copy"><span className="magazine-kicker">Featured story</span><h1><Link to={`/blog/${featured.slug}`}>{featured.title}</Link></h1><p>{featured.excerpt}</p><StoryMeta post={featured}/><Link className="magazine-read" to={`/blog/${featured.slug}`}>Read the story <span>→</span></Link></div><Link className="magazine-hero-media" to={`/blog/${featured.slug}`} aria-label={`Read ${featured.title}`}><EditorialImage post={featured} eager/></Link><span className="magazine-issue">LUMINA · JOURNAL</span></section>}
    {picks.length>=2&&<section className="editors-picks home-section"><header><div><span className="magazine-kicker">Selected by Lumina</span><h2>Editor's Picks</h2></div><Link to="/blog">Explore all stories <span>↗</span></Link></header><div className="picks-layout">{picks.map((post,index)=><article className={`pick-card pick-${index+1}`} key={post.id}><Link to={`/blog/${post.slug}`}><EditorialImage post={post}/><div><span className="pick-index">0{index+1}</span><StoryMeta post={post}/><h3>{post.title}</h3><p>{post.excerpt}</p></div></Link></article>)}</div></section>}
    {user&&forYou.length>0&&<section className="for-you home-section"><header><div><span className="magazine-kicker">PERSONALIZED FOR {user.name}</span><h2>Dành cho bạn</h2></div><Link to="/blog">Khám phá thêm <span>↗</span></Link></header><div>{forYou.map(post=><BlogCard post={post} key={post.id}/>)}</div></section>}
    {categorySections.map(({category,posts:categoryPosts})=><section className="category-edition home-section" key={category.id}><header><div><span className="magazine-kicker">Filed under</span><h2>{category.name}</h2></div><Link to={`/categories/${category.slug}`}>View all <span>→</span></Link></header><div><article className="category-lead"><Link to={`/blog/${categoryPosts[0].slug}`}><EditorialImage post={categoryPosts[0]}/><div><StoryMeta post={categoryPosts[0]}/><h3>{categoryPosts[0].title}</h3><p>{categoryPosts[0].excerpt}</p></div></Link></article><div className="category-list">{categoryPosts.slice(1).map((post,index)=><CompactStory post={post} index={index} key={post.id}/>)}</div></div></section>)}
    {featuredSeries.length>0&&<section className="featured-collections home-section"><header><div><span className="magazine-kicker">Read with intention</span><h2>Featured Collections</h2></div></header><div>{featuredSeries.slice(0,3).map((value,index)=><article key={value.id}><Link to={`/series/${value.slug}`}><div className="collection-cover">{value.cover_image?<img src={value.cover_image.url} alt="" loading="lazy"/>:<span>{String(index+1).padStart(2,'0')}</span>}</div><div><small>{value.posts?.length??0} parts · Curated by {value.author?.name??'Lumina'}</small><h3>{value.title}</h3><p>{value.description}</p><b>Explore the series →</b></div></Link></article>)}</div></section>}
    {trending.length>0&&<section className="trending-week home-section"><header><div><span className="magazine-kicker">Published in the last 7 days</span><h2>Trending this week</h2></div></header><div>{trending.slice(0,5).map((post,index)=><CompactStory post={post} index={index} key={post.id}/>)}</div></section>}
    {authors.length>0&&<section className="featured-authors home-section"><header><div><span className="magazine-kicker">Meet the voices</span><h2>Featured Authors</h2></div></header><div>{authors.map(({author,count,bio})=><article key={author.id}><span className="author-portrait">{author.avatar?<img src={author.avatar} alt="" loading="lazy"/>:author.name?.[0]?.toUpperCase()??'L'}</span><div><h3>{author.username?<Link to={`/author/${author.username}`}>{author.name}</Link>:author.name}</h3><p>{author.bio||bio}</p><small>{count} {count===1?'story':'stories'} published</small></div></article>)}</div></section>}
    <section className="newsletter-cta"><div><span className="magazine-kicker">The Sunday Edition</span><h2>A quieter way to stay curious.</h2><p>One thoughtful collection of stories, delivered occasionally. No noise, no algorithms.</p></div>{subscribed?<div className="newsletter-success"><span>✓</span><strong>You're on the list.</strong><small>Look out for the next edition.</small></div>:<form onSubmit={subscribe}><label><span>Email address</span><input type="email" placeholder="reader@example.com" required/></label><button>Join the journal <span>→</span></button><small>Placeholder signup · newsletter delivery coming soon.</small></form>}</section>
  </>}</div></Layout>
}

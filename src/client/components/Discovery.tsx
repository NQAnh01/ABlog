import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bookmark, Check, Clock3, Search, X } from 'lucide-react'
import { useBookmarks } from '../hooks/useBookmarks'
import { localizedContent, useI18n } from '../i18n'
import { api } from '../services/api'
import type { Category, Post } from '../types'

export function DiscoverySearch({ value = '', onSearch }: { value?: string; onSearch: (term: string) => void }) {
  const { locale } = useI18n()
  const vi = locale === 'vi'
  const [term, setTerm] = useState(value)
  function submit(event: FormEvent) {
    event.preventDefault()
    onSearch(term.trim())
  }
  return <form className="discover-search" role="search" autoComplete="off" onSubmit={submit}>
    <Search aria-hidden="true" />
    <input type="search" autoComplete="off" aria-label={vi ? 'Tìm bài viết' : 'Search stories'} placeholder={vi ? 'Tìm câu chuyện, chủ đề, ý tưởng…' : 'Search stories, topics, ideas…'} value={term} onChange={event => setTerm(event.target.value)} />
    {term && <button type="button" className="discover-icon-button" aria-label={vi ? 'Xóa từ khóa' : 'Clear search text'} onClick={() => { setTerm(''); onSearch('') }}><X aria-hidden="true" /></button>}
    <button className="discover-button" type="submit">{vi ? 'Tìm kiếm' : 'Search'}<ArrowRight aria-hidden="true" /></button>
  </form>
}

export function DiscoveryTopics({ categories, active = '', href, allHref = '/blog' }: { categories: Category[]; active?: string; href?: (category: Category) => string; allHref?: string }) {
  const { locale } = useI18n()
  return <nav className="discover-topics" aria-label={locale === 'vi' ? 'Khám phá theo chủ đề' : 'Explore by topic'}>
    <Link className={!active ? 'is-active' : ''} to={allHref} aria-current={!active ? 'page' : undefined}>{locale === 'vi' ? 'Tất cả chủ đề' : 'All topics'}</Link>
    {categories.map(category => <Link key={category.id} className={active === category.id ? 'is-active' : ''} aria-current={active === category.id ? 'page' : undefined} to={href ? href(category) : `/categories/${category.slug}`}>{localizedContent(category.name, locale)}</Link>)}
  </nav>
}

export function DiscoveryImage({ post, eager = false }: { post: Post; eager?: boolean }) {
  const [failed, setFailed] = useState(false)
  return <div className={`discover-image${!post.thumbnail?.url || failed ? ' is-placeholder' : ''}`}>
    {post.thumbnail?.url && !failed ? <img src={post.thumbnail.url} alt="" loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async" onError={() => setFailed(true)} /> : <><span aria-hidden="true">L.</span><small>LUMINA JOURNAL</small></>}
  </div>
}

export function DiscoveryMeta({ post }: { post: Post }) {
  const { locale, formatDate } = useI18n()
  const date = post.published_at ?? post.created_at
  return <div className="discover-meta">
    <span className="discover-avatar" aria-hidden="true">{post.author?.avatar ? <img src={post.author.avatar} alt="" loading="lazy" /> : (post.author?.name ?? 'L')[0]}</span>
    <span>{post.author?.name ?? 'Lumina'}</span>
    {date && Number.isFinite(Date.parse(date)) && <><span aria-hidden="true">·</span><time dateTime={date}>{formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' })}</time></>}
    {!post.author && <span className="sr-only">{locale === 'vi' ? 'Tác giả' : 'Author'}</span>}
  </div>
}

export function DiscoveryCard({ post, categories = [] }: { post: Post; categories?: Category[] }) {
  const { locale } = useI18n()
  const vi = locale === 'vi'
  const navigate = useNavigate()
  const { isBookmarked, toggleBookmark } = useBookmarks()
  const [busy, setBusy] = useState(false)
  const saved = isBookmarked(post.id)
  const category = post.categories?.[0] ?? categories.find(item => post.category_ids?.includes(item.id))
  const minutes = post.content?.trim() ? Math.max(1, Math.ceil(post.content.trim().split(/\s+/).length / 220)) : null
  const saveLabel = saved ? (vi ? 'Bỏ lưu bài viết' : 'Remove saved story') : (vi ? 'Lưu để đọc sau' : 'Save for later')
  async function bookmark() {
    setBusy(true)
    try { if (await toggleBookmark(post.id) === 'login_required') navigate('/login') }
    finally { setBusy(false) }
  }
  return <article className="discover-card">
    <Link className="discover-card-cover" to={`/blog/${post.slug}`} tabIndex={-1} aria-hidden="true" onPointerEnter={() => api.prefetchPost(post.slug)}><DiscoveryImage key={post.thumbnail?.url} post={post} /></Link>
    <div className="discover-card-body">
      <div className="discover-card-topline">{category ? <Link className="discover-category" to={`/categories/${category.slug}`}>{localizedContent(category.name, locale)}</Link> : <span className="discover-category">{vi ? 'Góc nhìn' : 'Perspectives'}</span>}{post.is_featured && <span className="discover-featured-dot">{vi ? 'Nổi bật' : 'Featured'}</span>}</div>
      <h3><Link to={`/blog/${post.slug}`} onFocus={() => api.prefetchPost(post.slug)}>{post.title}</Link></h3>
      {post.excerpt && <p>{post.excerpt}</p>}
      <DiscoveryMeta post={post} />
      <footer>{minutes ? <span><Clock3 aria-hidden="true" />{vi ? `${minutes} phút đọc` : `${minutes} min read`}</span> : <span>{vi ? 'Đọc câu chuyện' : 'Read the story'}<ArrowRight aria-hidden="true" /></span>}
        <button type="button" className={`discover-save${saved ? ' is-saved' : ''}`} onClick={() => void bookmark()} disabled={busy} aria-pressed={saved} aria-label={`${saveLabel}: ${post.title}`} title={saveLabel}>{saved ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}</button>
      </footer>
    </div>
  </article>
}

export function DiscoverySkeleton({ count = 6 }: { count?: number }) {
  const { locale } = useI18n()
  return <div className="discover-grid discover-skeleton" role="status" aria-label={locale === 'vi' ? 'Đang tải bài viết' : 'Loading stories'}>
    {Array.from({ length: count }, (_, index) => <div className="discover-skeleton-card" aria-hidden="true" key={index}><div /><span /><span /><span /></div>)}
  </div>
}

export function DiscoveryState({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return <div className="discover-state"><span className="discover-state-icon" aria-hidden="true">{icon}</span><h2>{title}</h2><p>{text}</p>{children}</div>
}

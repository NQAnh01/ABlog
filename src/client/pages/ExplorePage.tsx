import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Grid2X2, List, RotateCcw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { DiscoveryCard, DiscoverySearch, DiscoverySkeleton, DiscoveryState, DiscoveryTopics } from '../components/Discovery'
import { Layout } from '../components/ui'
import { useSeo } from '../components/Seo'
import { useAuth } from '../hooks/useAuth'
import { localizedContent, useI18n } from '../i18n'
import { api } from '../services/api'
import type { Category, Post, Tag } from '../types'

const PAGE_SIZE = 12
type Filters = { from: string; to: string; tag: string; category: string }

function AdvancedFilters({ values, categories, tags, pinned, onApply, onClose }: {
  values: Filters; categories: Category[]; tags: Tag[]; pinned: string;
  onApply: (values: Filters) => void; onClose: () => void;
}) {
  const { locale } = useI18n()
  const vi = locale === 'vi'
  const [dates, setDates] = useState({ from: values.from, to: values.to })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onApply({ ...dates, tag: pinned === 'tag' ? values.tag : String(data.get('tag') ?? ''), category: pinned === 'category' ? values.category : String(data.get('category') ?? '') })
  }
  return <form id="discover-filters" className="discover-filters" aria-label={vi ? 'Bộ lọc bài viết' : 'Story filters'} onSubmit={submit} onKeyDown={event => { if (event.key === 'Escape') onClose() }}>
    <div className="discover-filter-fields">
      <label><span>{vi ? 'Từ ngày' : 'From date'}</span><input type="date" value={dates.from} max={dates.to || undefined} onChange={event => setDates(current => ({ ...current, from: event.target.value }))} /></label>
      <label><span>{vi ? 'Đến ngày' : 'To date'}</span><input type="date" value={dates.to} min={dates.from || undefined} onChange={event => setDates(current => ({ ...current, to: event.target.value }))} /></label>
      <label><span>{vi ? 'Chủ đề' : 'Topic'}</span><select name="category" defaultValue={values.category} disabled={pinned === 'category'}>
        <option value="">{vi ? 'Tất cả chủ đề' : 'All topics'}</option>
        {values.category.includes(',') && <option value={values.category}>{vi ? 'Các chủ đề đã chọn' : 'Selected topics'}</option>}
        {categories.map(item => <option value={item.id} key={item.id}>{localizedContent(item.name, locale)}</option>)}
      </select></label>
      <label><span>{vi ? 'Thẻ' : 'Tag'}</span><select name="tag" defaultValue={values.tag} disabled={pinned === 'tag'}><option value="">{vi ? 'Tất cả thẻ' : 'All tags'}</option>{tags.map(item => <option value={item.id} key={item.id}>#{item.name}</option>)}</select></label>
    </div>
    <footer><span>{vi ? 'Kết hợp bộ lọc để tìm đúng bài bạn cần.' : 'Combine filters to find your next good read.'}</span><button type="button" className="discover-text-button" onClick={onClose}>{vi ? 'Hủy' : 'Cancel'}</button><button className="discover-button" type="submit">{vi ? 'Áp dụng bộ lọc' : 'Apply filters'}<ArrowRight aria-hidden="true" /></button></footer>
  </form>
}

export function BlogListPage() {
  const { locale } = useI18n()
  const vi = locale === 'vi'
  const { user } = useAuth()
  const { slug = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useSearchParams()
  const routeKind = location.pathname.startsWith('/tags/') ? 'tag' : location.pathname.startsWith('/categories/') ? 'category' : ''
  const isSearch = location.pathname === '/search'
  const routeKey = `${routeKind}/${slug}`
  const [taxonomy, setTaxonomy] = useState<{ key: string; value?: Category | Tag; error?: string }>({ key: '' })
  const routeReady = !routeKind || (taxonomy.key === routeKey && !!taxonomy.value)
  const routeValue = taxonomy.key === routeKey ? taxonomy.value : undefined
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem('lumina-view-blog-stories')
    return saved === 'list' || saved === 'grid' ? saved : window.matchMedia('(max-width: 620px)').matches ? 'list' : 'grid'
  })
  const filterButton = useRef<HTMLButtonElement>(null)
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const term = query.get('q') ?? ''
  const from = query.get('from') ?? ''
  const to = query.get('to') ?? ''
  const tag = routeKind === 'tag' ? routeValue?.id ?? '' : query.get('tag') ?? ''
  const category = routeKind === 'category' ? routeValue?.id ?? '' : query.get('category') ?? ''
  const rawPage = Number(query.get('page') ?? 1)
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const requestParams = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  for (const [key, value] of Object.entries({ q: term, from, to, tag, category })) if (value) requestParams.set(key, value)
  const requestQuery = requestParams.toString()

  useEffect(() => {
    let active = true
    Promise.allSettled([api.categories(), api.tags()]).then(([nextCategories, nextTags]) => {
      if (!active) return
      if (nextCategories.status === 'fulfilled') setCategories(nextCategories.value ?? [])
      if (nextTags.status === 'fulfilled') setTags(nextTags.value ?? [])
    })
    return () => { active = false }
  }, [retry])

  useEffect(() => {
    if (!routeKind) return
    let active = true
    ;(routeKind === 'tag' ? api.tag(slug) : api.category(slug)).then(value => {
      if (active) setTaxonomy({ key: routeKey, value })
    }).catch(() => { if (active) setTaxonomy({ key: routeKey, error: 'not-found' }) })
    return () => { active = false }
  }, [routeKind, slug, routeKey, retry])

  useEffect(() => {
    if (!routeReady) return
    let active = true
    setLoading(true)
    setError('')
    api.posts(`?${requestQuery}`).then(result => {
      if (active) { setPosts(result.items ?? []); setTotal(result.total) }
    }).catch(() => { if (active) setError('load-failed') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [requestQuery, routeReady, retry])

  useEffect(() => { localStorage.setItem('lumina-view-blog-stories', view) }, [view])
  useEffect(() => { setFilterOpen(false) }, [location.pathname, location.search])

  function updateFilters(values: Record<string, string>) {
    const next = new URLSearchParams(query)
    next.delete('page')
    for (const [key, value] of Object.entries(values)) value ? next.set(key, value) : next.delete(key)
    setQuery(next)
  }
  function clearAll() { navigate(isSearch ? '/search' : '/blog') }
  function closeFilters() { setFilterOpen(false); filterButton.current?.focus() }
  function applyFilters(values: Filters) {
    updateFilters({ ...values, ...(routeKind ? { [routeKind]: '' } : {}) })
    closeFilters()
  }
  function removeFilter(key: string, id?: string) {
    if (key === routeKind) {
      const next = new URLSearchParams(query)
      next.delete('page'); next.delete(key)
      navigate(`/blog${next.size ? `?${next}` : ''}`)
    } else updateFilters({ [key]: key === 'category' && id ? category.split(',').filter(value => value !== id).join(',') : '' })
  }
  function topicHref(id: string) {
    const next = new URLSearchParams(query)
    next.delete('page')
    id ? next.set('category', id) : next.delete('category')
    const path = routeKind === 'category' ? '/blog' : location.pathname
    return `${path}${next.size ? `?${next}` : ''}`
  }
  function changePage(nextPage: number) {
    const next = new URLSearchParams(query)
    nextPage > 1 ? next.set('page', String(nextPage)) : next.delete('page')
    setQuery(next)
    resultsHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    resultsHeading.current?.focus({ preventScroll: true })
  }

  const filterChips = [
    ...(term ? [{ key: 'q', label: `“${term}”` }] : []),
    ...(from ? [{ key: 'from', label: `${vi ? 'Từ' : 'From'} ${from}` }] : []),
    ...(to ? [{ key: 'to', label: `${vi ? 'Đến' : 'To'} ${to}` }] : []),
    ...(tag ? [{ key: 'tag', label: `#${(routeKind === 'tag' ? routeValue?.name : tags.find(item => item.id === tag)?.name) ?? (vi ? 'Thẻ đã chọn' : 'Selected tag')}` }] : []),
    ...category.split(',').filter(Boolean).map(id => ({ key: 'category', id, label: localizedContent(categories.find(item => item.id === id)?.name ?? (routeKind === 'category' ? routeValue?.name : undefined) ?? (vi ? 'Chủ đề đã chọn' : 'Selected topic'), locale) })),
  ]
  const title = routeValue ? `${routeKind === 'tag' ? '#' : ''}${localizedContent(routeValue.name, locale)}` : isSearch ? (vi ? 'Tìm ý tưởng tiếp theo.' : 'Find your next idea.') : (vi ? 'Một góc nhìn mới, mỗi ngày.' : 'A fresh perspective, every day.')
  const description = routeValue && 'description' in routeValue && typeof routeValue.description === 'string' && routeValue.description ? routeValue.description : vi ? 'Những câu chuyện đáng đọc, từ những người có điều muốn kể.' : 'Stories worth your time, from people with something to share.'
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const taxonomyError = routeKind && taxonomy.key === routeKey && taxonomy.error
  const busy = loading || !routeReady
  const interests = user?.interest_category_ids?.join(',') ?? ''
  useSeo({ title: routeValue ? title : isSearch ? (vi ? 'Tìm kiếm bài viết' : 'Search stories') : (vi ? 'Khám phá bài viết' : 'Explore stories'), description, path: location.pathname, noIndex: isSearch || !!(term || from || to || taxonomyError), jsonLd: routeValue ? { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: window.location.origin + location.pathname } : undefined })

  return <Layout dark><div className="discovery-page discovery-explore">
    <header className="discover-intro">
      <div><Link className="discover-back" to="/">{vi ? 'Trang chủ' : 'Home'}</Link><span className="discover-breadcrumb" aria-hidden="true"> / </span><span>{vi ? 'Khám phá' : 'Explore'}</span></div>
      <span className="discover-eyebrow">{routeKind === 'category' ? (vi ? 'THEO CHỦ ĐỀ' : 'IN THIS TOPIC') : routeKind === 'tag' ? (vi ? 'THEO THẺ' : 'TAGGED STORIES') : 'THE LUMINA JOURNAL'}</span>
      <h1>{title}</h1><p>{description}</p>
      <DiscoverySearch key={`${location.pathname}?${term}`} value={term} onSearch={value => updateFilters({ q: value })} />
    </header>
    <DiscoveryTopics categories={categories} active={category} allHref={topicHref('')} href={item => topicHref(item.id)} />
    <section className="discover-browse" aria-label={vi ? 'Danh sách bài viết' : 'Browse stories'}>
      <div className="discover-toolbar">
        <div className="discover-feed-options"><span><BookOpen aria-hidden="true" />{vi ? 'Bài viết' : 'Stories'}</span>{interests && !routeKind && <button type="button" className={category === interests ? 'is-active' : ''} aria-pressed={category === interests} onClick={() => updateFilters({ category: category === interests ? '' : interests })}><Sparkles aria-hidden="true" />{vi ? 'Sở thích của tôi' : 'My interests'}</button>}</div>
        <div className="discover-tools">
          <button ref={filterButton} className={`discover-filter-toggle${filterOpen ? ' is-active' : ''}`} type="button" aria-expanded={filterOpen} aria-controls="discover-filters" onClick={() => setFilterOpen(value => !value)}><SlidersHorizontal aria-hidden="true" />{vi ? 'Bộ lọc' : 'Filters'}{filterChips.length > 0 && <b>{filterChips.length}</b>}<ChevronDown aria-hidden="true" /></button>
          <div className="discover-view" role="group" aria-label={vi ? 'Kiểu hiển thị' : 'Display style'}>{(['grid', 'list'] as const).map(mode => <button type="button" key={mode} aria-label={mode === 'grid' ? (vi ? 'Dạng lưới' : 'Grid view') : (vi ? 'Dạng danh sách' : 'List view')} title={mode === 'grid' ? (vi ? 'Dạng lưới' : 'Grid view') : (vi ? 'Dạng danh sách' : 'List view')} aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === 'grid' ? <Grid2X2 aria-hidden="true" /> : <List aria-hidden="true" />}</button>)}</div>
        </div>
      </div>
      {filterOpen && <AdvancedFilters key={`${location.pathname}?${query}`} values={{ from, to, tag, category }} categories={categories} tags={tags} pinned={routeKind} onApply={applyFilters} onClose={closeFilters} />}
      {filterChips.length > 0 && <div className="discover-active-filters" aria-label={vi ? 'Bộ lọc đang áp dụng' : 'Applied filters'}>{filterChips.map(chip => <button type="button" key={`${chip.key}-${'id' in chip ? chip.id : ''}`} onClick={() => removeFilter(chip.key, 'id' in chip ? chip.id : undefined)} aria-label={`${vi ? 'Bỏ lọc' : 'Remove filter'}: ${chip.label}`}>{chip.label}<X aria-hidden="true" /></button>)}<button type="button" className="discover-clear" onClick={clearAll}>{vi ? 'Xóa tất cả' : 'Clear all'}</button></div>}
      <div className="discover-results-heading"><h2 ref={resultsHeading} tabIndex={-1}>{term ? (vi ? 'Kết quả tìm kiếm' : 'Search results') : (vi ? 'Dành thời gian cho một bài hay' : 'Make time for a good story')}</h2><span role="status">{busy && !taxonomyError ? (vi ? 'Đang tải…' : 'Loading…') : !error && !taxonomyError ? (vi ? `${total} bài viết` : `${total} ${total === 1 ? 'story' : 'stories'}`) : ''}</span></div>
      {error || taxonomyError ? <DiscoveryState icon={<BookOpen />} title={vi ? 'Chưa thể tải nội dung' : 'Stories are taking a moment'} text={taxonomyError ? (vi ? 'Chủ đề hoặc thẻ này không còn tồn tại, hoặc kết nối đang gián đoạn.' : 'This topic or tag may no longer exist, or the connection was interrupted.') : (vi ? 'Hãy kiểm tra kết nối và thử lại.' : 'Check your connection and try again.')}><button type="button" className="discover-button" onClick={() => { setTaxonomy(current => ({ ...current, error: undefined })); setRetry(value => value + 1) }}><RotateCcw aria-hidden="true" />{vi ? 'Thử lại' : 'Try again'}</button>{taxonomyError && <Link className="discover-text-button" to="/blog">{vi ? 'Tất cả bài viết' : 'All stories'}</Link>}</DiscoveryState> : busy ? <DiscoverySkeleton /> : posts.length ? <div className={`discover-grid${view === 'list' ? ' discover-list' : ''}`}>{posts.map(post => <DiscoveryCard post={post} categories={categories} key={post.id} />)}</div> : <DiscoveryState icon={<Search />} title={vi ? 'Chưa tìm thấy bài phù hợp' : 'No stories found just yet'} text={vi ? 'Thử từ khóa ngắn hơn hoặc bỏ bớt bộ lọc để khám phá thêm.' : 'Try a shorter search or remove a filter to broaden your reading.'}><button type="button" className="discover-button" onClick={page > 1 ? () => changePage(1) : clearAll}>{page > 1 ? (vi ? 'Về trang đầu' : 'Back to first page') : (vi ? 'Xem tất cả bài viết' : 'Explore all stories')}<ArrowRight aria-hidden="true" /></button></DiscoveryState>}
      {!busy && !error && !taxonomyError && total > PAGE_SIZE && <nav className="discover-pagination" aria-label={vi ? 'Phân trang bài viết' : 'Story pagination'}><button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}><ArrowLeft aria-hidden="true" /><span>{vi ? 'Trang trước' : 'Previous'}</span></button><span>{vi ? `Trang ${page} / ${pages}` : `Page ${page} of ${pages}`}</span><button type="button" disabled={page >= pages} onClick={() => changePage(page + 1)}><span>{vi ? 'Trang sau' : 'Next'}</span><ArrowRight aria-hidden="true" /></button></nav>}
    </section>
    {tags.length > 0 && <aside className="discover-more-topics"><div><span className="discover-eyebrow">{vi ? 'THEO DÒNG TÒ MÒ' : 'FOLLOW YOUR CURIOSITY'}</span><h2>{vi ? 'Còn nhiều điều để khám phá.' : 'There’s more to explore.'}</h2></div><div>{tags.slice(0, 12).map(item => <Link key={item.id} to={`/tags/${item.slug}`}>#{item.name}<ArrowRight aria-hidden="true" /></Link>)}</div></aside>}
  </div></Layout>
}

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BookOpen, Layers3, RotateCcw, Sparkles } from 'lucide-react'
import { DiscoveryCard, DiscoveryImage, DiscoveryMeta, DiscoverySearch, DiscoverySkeleton, DiscoveryState, DiscoveryTopics } from '../components/Discovery'
import { Layout } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { localizedContent, useI18n } from '../i18n'
import { recentPostIds } from '../recent-reading'
import { api } from '../services/api'
import type { Category, Post, PublicUser, Series } from '../types'

export function HomePage() {
  const { user } = useAuth()
  const { locale } = useI18n()
  const vi = locale === 'vi'
  const navigate = useNavigate()
  const [featured, setFeatured] = useState<Post | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [forYou, setForYou] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [feed, setFeed] = useState<'latest' | 'personal'>('latest')

  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    Promise.all([
      api.posts('?featured=true&limit=1').catch(() => null),
      api.posts('?limit=12'),
      api.categories().catch(() => []),
      api.series(true).catch(() => []),
    ]).then(([featuredPage, recentPage, nextCategories, nextSeries]) => {
      if (!active) return
      setFeatured(featuredPage?.items?.[0] ?? recentPage.items?.[0] ?? null)
      setPosts(recentPage.items ?? []); setCategories(nextCategories ?? []); setSeries(nextSeries ?? [])
    }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])

  useEffect(() => {
    setForYou([]); setFeed('latest')
    if (!user) return
    let active = true
    api.personalRecommendations(recentPostIds()).then(values => { if (active) setForYou(values ?? []) }).catch(() => undefined)
    return () => { active = false }
  }, [user])

  const authors = useMemo(() => {
    const unique = new Map<string, PublicUser>()
    posts.forEach(post => { if (post.author?.id && post.author.username) unique.set(post.author.id, post.author) })
    return [...unique.values()].slice(0, 3)
  }, [posts])
  const latest = posts.filter(post => post.id !== featured?.id)
  const featuredCategory = featured?.categories?.[0] ?? categories.find(item => featured?.category_ids?.includes(item.id))
  const feedPosts = feed === 'personal' && user ? forYou : posts

  return <Layout dark><div className="discovery-page discovery-home">
    <header className="discover-welcome">
      <div><span className="discover-eyebrow"><span className="discover-live-dot" />THE LUMINA JOURNAL</span><h1>{vi ? 'Một chút tò mò.' : 'Stay curious.'}<br /><em>{vi ? 'Một góc nhìn mới.' : 'Find a new perspective.'}</em></h1></div>
      <div><p>{vi ? 'Đọc một câu chuyện hay. Khám phá một ý tưởng mới. Dành một khoảng lặng cho chính mình.' : 'A good story. A new idea. A little room to think. Find something that stays with you.'}</p><DiscoverySearch onSearch={term => navigate(`/search${term ? `?q=${encodeURIComponent(term)}` : ''}`)} /></div>
    </header>
    <DiscoveryTopics categories={categories} />
    {loading ? <DiscoverySkeleton /> : error ? <DiscoveryState icon={<BookOpen />} title={vi ? 'Chưa thể mở trang đọc' : 'The journal is taking a moment'} text={vi ? 'Kiểm tra kết nối của bạn rồi thử lại nhé.' : 'Check your connection, then give it another try.'}><button className="discover-button" onClick={() => setRetry(value => value + 1)}><RotateCcw aria-hidden="true" />{vi ? 'Thử lại' : 'Try again'}</button></DiscoveryState> : <>
      {featured ? <section className="discover-lead-grid" aria-label={vi ? 'Điểm đọc hôm nay' : 'Today in the journal'}>
        <article className="discover-feature">
          <Link className="discover-feature-cover" to={`/blog/${featured.slug}`} tabIndex={-1} aria-hidden="true"><DiscoveryImage key={featured.thumbnail?.url} post={featured} eager /></Link>
          <div className="discover-feature-body"><span className="discover-eyebrow"><Sparkles aria-hidden="true" />{featured.is_featured ? (vi ? 'BÀI VIẾT NỔI BẬT' : 'IN THE SPOTLIGHT') : (vi ? 'BẮT ĐẦU TỪ ĐÂY' : 'START READING')}</span>
            {featuredCategory && <Link className="discover-category" to={`/categories/${featuredCategory.slug}`}>{localizedContent(featuredCategory.name, locale)}</Link>}
            <h2><Link to={`/blog/${featured.slug}`}>{featured.title}</Link></h2>
            <p>{featured.excerpt}</p><DiscoveryMeta post={featured} />
            <Link className="discover-feature-cta" to={`/blog/${featured.slug}`}>{vi ? 'Đọc câu chuyện' : 'Read the story'}<span><ArrowUpRight aria-hidden="true" /></span></Link>
          </div>
        </article>
        {latest.length > 0 && <aside className="discover-reading-next"><header><span className="discover-eyebrow">{vi ? 'TRÊN KỆ ĐỌC' : 'ON THE READING LIST'}</span><h2>{vi ? 'Mới lên trang' : 'Fresh off the press'}</h2></header><ol>{latest.slice(0, 3).map((post, index) => <li key={post.id}><span className="discover-story-number">0{index + 1}</span><div><span>{post.author?.name ?? 'Lumina'}</span><h3><Link to={`/blog/${post.slug}`}>{post.title}</Link></h3></div></li>)}</ol><Link className="discover-text-link" to="/blog">{vi ? 'Khám phá tất cả' : 'Explore all stories'}<ArrowRight aria-hidden="true" /></Link></aside>}
      </section> : <DiscoveryState icon={<BookOpen />} title={vi ? 'Những câu chuyện đang chờ được viết' : 'Every good story starts somewhere'} text={vi ? 'Chia sẻ góc nhìn của bạn và mở đầu cuộc trò chuyện trên Lumina.' : 'Share your perspective and start a conversation on Lumina.'}><Link className="discover-button" to={user ? '/blog/new' : '/register'}>{vi ? 'Viết bài đầu tiên' : 'Write a story'}<ArrowRight aria-hidden="true" /></Link></DiscoveryState>}

      {posts.length > 0 && <section className="discover-section" aria-labelledby="home-feed-title"><header className="discover-section-heading"><div><span className="discover-eyebrow">{vi ? 'DÀNH CHO GIỜ ĐỌC CỦA BẠN' : 'YOUR NEXT GOOD READ'}</span><h2 id="home-feed-title">{vi ? 'Đọc chậm. Nghĩ sâu.' : 'Read a little. Think a little.'}</h2></div><Link className="discover-text-link" to="/blog">{vi ? 'Tất cả bài viết' : 'View all stories'}<ArrowUpRight aria-hidden="true" /></Link></header>
        {user && forYou.length > 0 && <div className="discover-feed-tabs" role="group" aria-label={vi ? 'Chọn nguồn bài viết' : 'Choose your feed'}><button type="button" aria-pressed={feed === 'latest'} onClick={() => setFeed('latest')}>{vi ? 'Mới nhất' : 'Latest stories'}</button><button type="button" aria-pressed={feed === 'personal'} onClick={() => setFeed('personal')}><Sparkles aria-hidden="true" />{vi ? 'Dành cho bạn' : 'For you'}</button></div>}
        <div className="discover-grid">{feedPosts.slice(0, 6).map(post => <DiscoveryCard key={post.id} post={post} categories={categories} />)}</div>
        <div className="discover-feed-end"><span>{vi ? 'Vẫn còn nhiều câu chuyện đang chờ.' : 'There’s always another perspective.'}</span><Link className="discover-button discover-button-outline" to="/blog">{vi ? 'Tiếp tục khám phá' : 'Keep exploring'}<ArrowRight aria-hidden="true" /></Link></div>
      </section>}

      {series.length > 0 && <section className="discover-section discover-collections" aria-labelledby="home-series-title"><header className="discover-section-heading"><div><span className="discover-eyebrow"><Layers3 aria-hidden="true" />{vi ? 'ĐI SÂU HƠN MỘT BÀI VIẾT' : 'GO A LITTLE DEEPER'}</span><h2 id="home-series-title">{vi ? 'Một chủ đề, nhiều chương.' : 'One idea. Many chapters.'}</h2></div><p>{vi ? 'Theo dòng câu chuyện qua những bộ bài được tuyển chọn.' : 'Follow a thread through our featured collections.'}</p></header><div className="discover-series-grid">{series.slice(0, 3).map((item, index) => <Link className="discover-series-card" to={`/series/${item.slug}`} key={item.id}><div className="discover-series-cover">{item.cover_image?.url ? <img src={item.cover_image.url} alt="" loading="lazy" /> : <span>0{index + 1}</span>}<Layers3 aria-hidden="true" /></div><div><small>{vi ? `${item.posts?.length ?? 0} phần` : `${item.posts?.length ?? 0} chapters`} · {item.author?.name ?? 'Lumina'}</small><h3>{item.title}</h3><p>{item.description}</p><span className="discover-text-link">{vi ? 'Đọc bộ bài' : 'Explore collection'}<ArrowUpRight aria-hidden="true" /></span></div></Link>)}</div></section>}

      {authors.length > 0 && <section className="discover-section discover-authors" aria-labelledby="home-authors-title"><header className="discover-section-heading"><div><span className="discover-eyebrow">{vi ? 'CON NGƯỜI SAU NHỮNG CON CHỮ' : 'BEHIND THE WORDS'}</span><h2 id="home-authors-title">{vi ? 'Gặp những người kể chuyện.' : 'Meet the storytellers.'}</h2></div></header><div>{authors.map(author => <Link className="discover-author" to={`/author/${author.username}`} key={author.id}><span className="discover-author-avatar">{author.avatar ? <img src={author.avatar} alt="" loading="lazy" /> : author.name[0]}</span><div><h3>{author.name}</h3><p>{author.bio || (vi ? 'Khám phá bài viết và góc nhìn của tác giả.' : 'Explore their stories and perspectives.')}</p></div><ArrowUpRight aria-hidden="true" /></Link>)}</div></section>}
      <section className="discover-invitation"><div><span className="discover-eyebrow">{vi ? 'CÂU CHUYỆN CỦA BẠN CŨNG ĐÁNG ĐƯỢC KỂ' : 'YOUR PERSPECTIVE BELONGS HERE'}</span><h2>{vi ? 'Bạn đang nghĩ về điều gì?' : 'What’s on your mind?'}</h2><p>{vi ? 'Một trải nghiệm, một bài học, một ý tưởng nhỏ. Bắt đầu từ điều bạn muốn chia sẻ.' : 'An experience, a lesson, a small idea. Start with something you want to share.'}</p></div><Link className="discover-button" to={user ? '/blog/new' : '/register'}>{vi ? 'Viết câu chuyện của bạn' : 'Write your story'}<ArrowUpRight aria-hidden="true" /></Link></section>
    </>}
  </div></Layout>
}

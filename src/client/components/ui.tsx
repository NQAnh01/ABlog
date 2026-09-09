import { Link, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { CommandPalette } from './CommandPalette'
import { usePWA } from '../hooks/usePWA'
import { useToast } from '../hooks/useToast'
import { accentPreviewEvent, isAccentTheme, savedAccent, type AccentTheme } from '../theme'
import { ArrowUp, Bookmark, ChevronDown, Compass, Download, Gauge, Home, LogIn, LogOut, Moon, PenLine, Plus, Search, Settings, Sun, X } from 'lucide-react'


export function Logo() { return <Link className="logo" to="/"><span className="logo-mark">L</span><strong>Lumina</strong></Link> }
export function Header({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { user, logout } = useAuth()

  const location = useLocation()
  const [accountOpen, setAccountOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const displayName = user ? (user.name.length > 15 ? `${user.name.slice(0, 15)}...` : user.name) : 'Login'

  const isEditorPage = location.pathname === '/admin/posts/create' || /^\/admin\/posts\/[^/]+\/edit$/.test(location.pathname)

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', mobileOpen)
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false) }
    if (mobileOpen) document.addEventListener('keydown', close)
    return () => { document.body.classList.remove('mobile-nav-open'); document.removeEventListener('keydown', close) }
  }, [mobileOpen])

  useEffect(() => {
    const headerElement = document.querySelector<HTMLElement>('.site-header')
    if (!headerElement) return
    const header = headerElement
    let frame = 0
    function updateHeader() {
      const currentY = window.scrollY
      header.classList.toggle('header-scrolled', currentY > 24)
      frame = 0
    }
    function onScroll() {
      if (!frame) frame = window.requestAnimationFrame(updateHeader)
    }
    updateHeader()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (frame) window.cancelAnimationFrame(frame) }
  }, [])

  async function signOut() {
    setAccountOpen(false)
    await logout()
  }

  const tooltipText = dark ? 'Switch to Light mode' : 'Switch to Dark mode'

  const openSearch = () => { setMobileOpen(false); window.dispatchEvent(new CustomEvent('lumina:open-command-palette')) }

  return <><header className="site-header"><div className="nav-shell"><Logo/><nav className="desktop-nav">
    <NavLink to="/" end>Home</NavLink><NavLink to="/blog">Explore</NavLink><NavLink to="/discussions">Discussions</NavLink><NavLink to="/profile">My Stories</NavLink>
    {user?.role === 'admin' && <NavLink className="admin-nav-button" to="/admin/dashboard"><Gauge aria-hidden="true"/><span>Dashboard</span></NavLink>}
    {!user && <NavLink to="/register">Sign Up</NavLink>}
  </nav><div className="nav-actions">{!isEditorPage && user && <Link className="button compact" to="/admin/posts/create">New Post</Link>}<button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={tooltipText} title={tooltipText} data-tooltip={tooltipText}>{dark ? <Sun aria-hidden="true"/> : <Moon aria-hidden="true"/>}</button><span className="nav-rule"/><div className="account-menu" ref={accountRef}>{user ? <><button className="account-trigger" type="button" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}><span className="avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.name?.[0]?.toUpperCase() ?? 'L'}</span><span className="account-name" title={user.name}>{displayName}</span><ChevronDown className="account-chevron" aria-hidden="true"/></button>{accountOpen && <div className="account-popup" role="menu"><div className="account-popup-profile"><span className="avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.name?.[0]?.toUpperCase() ?? 'L'}</span><div><strong title={user.name}>{displayName}</strong><small>{user.email}</small></div></div><Link role="menuitem" to="/saved" onClick={() => setAccountOpen(false)}>Saved stories</Link><Link role="menuitem" to="/todos" onClick={() => setAccountOpen(false)}>Targets &amp; todos</Link><Link role="menuitem" to="/profile/settings" onClick={() => setAccountOpen(false)}>Account settings</Link><button role="menuitem" type="button" onClick={() => void signOut()}>Sign out</button></div>}</> : <Link className="account-trigger" to="/login"><span className="avatar">L</span><span className="account-name">Login</span></Link>}</div><button className="mobile-menu-toggle" type="button" aria-label={mobileOpen?'Close navigation':'Open navigation'} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={()=>setMobileOpen(value=>!value)}><span/><span/><span/></button></div></div></header>
  <div className={`mobile-nav-layer${mobileOpen?' open':''}`} aria-hidden={!mobileOpen} onMouseDown={event=>{if(event.target===event.currentTarget)setMobileOpen(false)}}><aside id="mobile-navigation" className="mobile-nav-drawer" aria-label="Mobile navigation"><header><div>{user?<><span className="avatar">{user.avatar?<img src={user.avatar} alt=""/>:user.name?.[0]?.toUpperCase()??'L'}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></>:<><span className="logo-mark">L</span><span><strong>Explore Lumina</strong><small>Stories worth your time</small></span></>}</div><button type="button" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}><X aria-hidden="true"/></button></header><button className="mobile-nav-search" type="button" onClick={openSearch}><span><Search aria-hidden="true"/></span><strong>Search Lumina</strong><kbd>⌘K</kbd></button><nav><NavLink to="/" end><span><Home aria-hidden="true"/></span>Home</NavLink><NavLink to="/blog"><span><Compass aria-hidden="true"/></span>Explore</NavLink><NavLink to="/discussions"><span><Compass aria-hidden="true"/></span>Discussions</NavLink><NavLink to="/profile"><span><PenLine aria-hidden="true"/></span>My Stories</NavLink>{user?.role==='admin'&&<NavLink to="/admin/dashboard"><span><Gauge aria-hidden="true"/></span>Dashboard</NavLink>}{user&&<NavLink to="/saved"><span><Bookmark aria-hidden="true"/></span>Reading List</NavLink>}{!user&&<NavLink to="/register"><span><Plus aria-hidden="true"/></span>Sign Up</NavLink>}</nav><footer>{user&&<Link className="mobile-new-post" to="/admin/posts/create"><Plus aria-hidden="true"/> Create new story</Link>}<button type="button" onClick={onToggleTheme}><span>{dark?<Sun aria-hidden="true"/>:<Moon aria-hidden="true"/>}</span>Switch to {dark?'light':'dark'} theme</button>{user?<><Link to="/todos"><span><Bookmark aria-hidden="true"/></span>Targets &amp; todos</Link><Link to="/profile/settings"><span><Settings aria-hidden="true"/></span>Account settings</Link><button type="button" onClick={()=>void signOut()}><span><LogOut aria-hidden="true"/></span>Sign out</button></>:<Link to="/login"><span><LogIn aria-hidden="true"/></span>Sign in</Link>}</footer></aside></div></>
}

export function Footer() {
  const { canInstall, install } = usePWA()
  const toast = useToast()
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsletterEmail.trim() || !newsletterEmail.includes('@')) {
      toast('Please enter a valid email address')
      return
    }
    setNewsletterSubscribed(true)
    toast('Thank you for subscribing to Lumina Dispatch!')
    setNewsletterEmail('')
  }

  return (
    <footer className="site-footer">
      <div className="container footer-content">
        <div className="footer-grid">
          <div className="footer-col footer-brand">
            <Logo />
            <p className="footer-description">
              A modern publishing collective dedicated to craft, thoughtful long-form essays, and independent perspectives.
            </p>
          </div>

          <div className="footer-col">
            <h4 className="footer-heading">Discover</h4>
            <nav className="footer-nav-list">
              <Link to="/blog">Explore Stories</Link>
              <Link to="/discussions">Discussions Exchange</Link>
              <Link to="/saved">Reading List</Link>
              <Link to="/todos">Targets &amp; Todos</Link>
            </nav>
          </div>

          <div className="footer-col">
            <h4 className="footer-heading">Lumina</h4>
            <nav className="footer-nav-list">
              <Link to="/about">About Us</Link>
              <Link to="/privacy">Privacy Policy</Link>
              <a href="/sitemap.xml" target="_blank" rel="noreferrer">Sitemap</a>
            </nav>
          </div>

          <div className="footer-col footer-newsletter">
            <h4 className="footer-heading">Lumina Dispatch</h4>
            <p className="footer-newsletter-text">Hand-curated essays, creative ideas, and commentary delivered weekly.</p>
            {newsletterSubscribed ? (
              <div className="footer-newsletter-success" role="status">
                <span>✓ Subscribed to dispatch</span>
              </div>
            ) : (
              <form className="footer-newsletter-form" onSubmit={handleSubscribe}>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={newsletterEmail}
                  onChange={e => setNewsletterEmail(e.target.value)}
                  required
                />
                <button type="submit" className="button compact">Join</button>
              </form>
            )}
            <small className="footer-newsletter-note">Curated editions every Sunday. No spam.</small>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 Lumina Publishing Group. All rights reserved.</p>
          <div className="footer-bottom-actions">
            {canInstall && (
              <button className="pwa-install" type="button" onClick={() => void install()}>
                <Download aria-hidden="true" /> Install app
              </button>
            )}
            <span className="footer-badge">● Systems Operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
function ScrollFeedback() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const update = () => {
      setVisible(window.scrollY > 420)
      const distance = document.documentElement.scrollHeight - window.innerHeight
      setProgress(distance > 0 ? Math.min(100, window.scrollY / distance * 100) : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return <><span className="reading-progress" aria-hidden="true" style={{ transform: `scaleX(${progress / 100})` }}/><button className={`scroll-top${visible ? ' visible' : ''}`} type="button" aria-label="Scroll to top" title="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
    <ArrowUp aria-hidden="true"/>
  </button></>
}
export function Layout({ children, dark: darkDefault = false }: { children: ReactNode; dark?: boolean }) {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('lumina-theme')
    return saved ? saved === 'dark' : darkDefault
  })
  const [accent, setAccent] = useState<AccentTheme>(savedAccent)
  useEffect(() => {
    const preview = (event: Event) => {
      const value = (event as CustomEvent<AccentTheme>).detail
      if (isAccentTheme(value)) setAccent(value)
    }
    window.addEventListener(accentPreviewEvent, preview)
    return () => window.removeEventListener(accentPreviewEvent, preview)
  }, [])
  useEffect(() => {
    localStorage.setItem('lumina-theme', dark ? 'dark' : 'light')
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])
  const toggleTheme = () => setDark(value => !value)
  return <div className={dark ? 'theme-dark app-shell' : 'theme-light app-shell'} data-accent={accent}><Header dark={dark} onToggleTheme={toggleTheme}/><main>{children}</main><Footer/><ScrollFeedback/><CommandPalette dark={dark} onToggleTheme={toggleTheme}/></div>
}
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} className={`button ${props.className ?? ''}`}/> }
export function Input({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) { return <label className="field"><span>{label}</span><input {...props}/>{error && <small>{error}</small>}</label> }
export function Loading() { return <div className="state"><span className="spinner"/>Loading…</div> }
export function StoryGridSkeleton({ count = 6 }: { count?: number }) { return <div className="story-skeleton-grid" aria-label="Loading stories" aria-busy="true">{Array.from({ length: count }, (_, index) => <div className="story-skeleton" key={index}><span/><div><i/><b/><b/><em/></div></div>)}</div> }
export function EmptyState({ title = 'Nothing here yet', text = 'New stories will appear here.' }: { title?: string; text?: string }) { return <div className="state"><h2>{title}</h2><p>{text}</p></div> }
export function ErrorState({ message }: { message: string }) { return <div className="state error"><h2>Something went wrong</h2><p>{message}</p></div> }
export function Pagination({ page, total, limit = 20, onPage }: { page: number; total: number; limit?: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages <= 1) return null
  return <nav className="pagination" aria-label="Pagination"><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button></nav>
}

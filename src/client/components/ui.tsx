import { Link, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'


export function Logo() { return <Link className="logo" to="/"><span className="logo-mark">L</span><strong>Lumina</strong></Link> }
export function Header({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { user, logout } = useAuth()

  const location = useLocation()
  const [accountOpen, setAccountOpen] = useState(false)
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

  async function signOut() {
    setAccountOpen(false)
    await logout()
  }

  const tooltipText = dark ? 'Switch to Light mode' : 'Switch to Dark mode'

  return <header className="site-header"><div className="nav-shell"><Logo/><nav className="desktop-nav">
    <NavLink to="/" end>Home</NavLink><NavLink to="/blog">Explore</NavLink><NavLink to="/profile">My Stories</NavLink>
    {user?.role === 'admin' && <NavLink className="admin-nav-button" to="/admin/dashboard"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg><span>Dashboard</span></NavLink>}
    {user && <NavLink to="/saved">Reading List</NavLink>}
    {!user && <NavLink to="/register">Sign Up</NavLink>}
  </nav><div className="nav-actions">{!isEditorPage && user && <Link className="button compact" to="/admin/posts/create">New Post</Link>}<button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={tooltipText} title={tooltipText} data-tooltip={tooltipText}>{dark ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/></svg>}</button><span className="nav-rule"/><div className="account-menu" ref={accountRef}>{user ? <><button className="account-trigger" type="button" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}><span className="avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.name?.[0]?.toUpperCase() ?? 'L'}</span><span className="account-name" title={user.name}>{displayName}</span><svg className="account-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button>{accountOpen && <div className="account-popup" role="menu"><div className="account-popup-profile"><span className="avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.name?.[0]?.toUpperCase() ?? 'L'}</span><div><strong title={user.name}>{displayName}</strong><small>{user.email}</small></div></div><Link role="menuitem" to="/saved" onClick={() => setAccountOpen(false)}>Saved stories</Link><Link role="menuitem" to="/profile/settings" onClick={() => setAccountOpen(false)}>Account settings</Link><button role="menuitem" type="button" onClick={() => void signOut()}>Sign out</button></div>}</> : <Link className="account-trigger" to="/login"><span className="avatar">L</span><span className="account-name">Login</span></Link>}</div></div></div></header>
}

export function Footer() { return <footer className="site-footer"><div className="container footer-inner"><div><Logo/><p>© 2026 Lumina Publishing Group.</p></div><nav><Link to="/about">About</Link><Link to="/privacy">Privacy</Link><Link to="/socials">Socials</Link></nav></div></footer> }
export function Layout({ children, dark: darkDefault = false }: { children: ReactNode; dark?: boolean }) {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('lumina-theme')
    return saved ? saved === 'dark' : darkDefault
  })
  useEffect(() => {
    localStorage.setItem('lumina-theme', dark ? 'dark' : 'light')
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])
  return <div className={dark ? 'theme-dark app-shell' : 'theme-light app-shell'}><Header dark={dark} onToggleTheme={() => setDark(value => !value)}/><main>{children}</main><Footer/></div>
}
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} className={`button ${props.className ?? ''}`}/> }
export function Input({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) { return <label className="field"><span>{label}</span><input {...props}/>{error && <small>{error}</small>}</label> }
export function Loading() { return <div className="state"><span className="spinner"/>Loading…</div> }
export function EmptyState({ title = 'Nothing here yet', text = 'New stories will appear here.' }: { title?: string; text?: string }) { return <div className="state"><h2>{title}</h2><p>{text}</p></div> }
export function ErrorState({ message }: { message: string }) { return <div className="state error"><h2>Something went wrong</h2><p>{message}</p></div> }
export function Pagination({ page, total, limit = 20, onPage }: { page: number; total: number; limit?: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages <= 1) return null
  return <nav className="pagination" aria-label="Pagination"><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button></nav>
}

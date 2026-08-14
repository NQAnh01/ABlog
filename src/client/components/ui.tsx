import { Link, NavLink } from 'react-router-dom'
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

export function Logo() { return <Link className="logo" to="/"><span className="logo-mark">L</span><strong>Lumina</strong></Link> }
export function Header() {
  const { user, logout } = useAuth()
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const displayName = user ? (user.name.length > 15 ? `${user.name.slice(0, 15)}...` : user.name) : 'Login'

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

  return <header className="site-header"><div className="nav-shell"><Logo/><nav className="desktop-nav">
    <NavLink to="/">Home</NavLink><NavLink to="/blog">Explore</NavLink><NavLink to="/profile">My Stories</NavLink>
    {!user && <NavLink to="/register">Sign Up</NavLink>}
  </nav><div className="nav-actions">{user && <Link className="button compact" to="/admin/posts/create">New Post</Link>}<span className="nav-rule"/><div className="account-menu" ref={accountRef}>{user ? <><button className="account-trigger" type="button" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}><span className="avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.name?.[0]?.toUpperCase() ?? 'L'}</span><span className="account-name" title={user.name}>{displayName}</span><span className="account-chevron" aria-hidden="true">⌄</span></button>{accountOpen && <div className="account-popup" role="menu"><div className="account-popup-profile"><span className="avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.name?.[0]?.toUpperCase() ?? 'L'}</span><div><strong title={user.name}>{displayName}</strong><small>{user.email}</small></div></div><Link role="menuitem" to="/profile/settings" onClick={() => setAccountOpen(false)}>Account settings</Link><button role="menuitem" type="button" onClick={() => void signOut()}>Sign out</button></div>}</> : <Link className="account-trigger" to="/login"><span className="avatar">L</span><span className="account-name">Login</span></Link>}</div></div></div></header>
}
export function Footer() { return <footer className="site-footer"><div className="container footer-inner"><div><Logo/><p>© 2026 Lumina Publishing Group.</p></div><nav><a href="#about">About</a><a href="#privacy">Privacy</a><a href="#socials">Socials</a></nav></div></footer> }
export function Layout({ children, dark = false }: { children: ReactNode; dark?: boolean }) { return <div className={dark ? 'theme-dark app-shell' : 'app-shell'}><Header/><main>{children}</main><Footer/></div> }
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} className={`button ${props.className ?? ''}`}/> }
export function Input({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) { return <label className="field"><span>{label}</span><input {...props}/>{error && <small>{error}</small>}</label> }
export function Loading() { return <div className="state"><span className="spinner"/>Loading…</div> }
export function EmptyState({ title = 'Nothing here yet', text = 'New stories will appear here.' }: { title?: string; text?: string }) { return <div className="state"><h2>{title}</h2><p>{text}</p></div> }
export function ErrorState({ message }: { message: string }) { return <div className="state error"><h2>Something went wrong</h2><p>{message}</p></div> }

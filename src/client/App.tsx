import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { ArticlePage, BlogListPage, InfoPage, StoryPreviewPage } from './pages/BlogPages'
import { ProfilePage } from './pages/ProfilePage'
import { UserSettingsPage } from './pages/UserSettingsPage'
import { AdminDashboardPage, AdminPostsPage, PlaceholderPage, PostEditorPage, PostVersionsPage } from './pages/AdminPages'
import { SavedPage } from './pages/SavedPage'

export default function App() {
  const location = useLocation()
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  useEffect(() => {
    const update = () => setShowScrollTop(window.scrollY > 420)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return <>
    <div className="page-transition" key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<BlogListPage title="Latest Stories"/>}/>
        <Route path="/blog" element={<BlogListPage/>}/>
        <Route path="/blog/:slug" element={<ArticlePage/>}/>
        <Route path="/stories/:id/preview" element={<StoryPreviewPage/>}/>
        <Route path="/categories/:slug" element={<BlogListPage title="Category"/>}/>
        <Route path="/tags/:slug" element={<BlogListPage title="Tagged Stories"/>}/>
        <Route path="/search" element={<BlogListPage title="Search"/>}/>
        <Route path="/about" element={<InfoPage page="about"/>}/>
        <Route path="/privacy" element={<InfoPage page="privacy"/>}/>
        <Route path="/socials" element={<InfoPage page="socials"/>}/>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/register" element={<RegisterPage/>}/>
        <Route path="/profile" element={<ProfilePage/>}/>
        <Route path="/profile/settings" element={<UserSettingsPage/>}/>
        <Route path="/saved" element={<SavedPage/>}/>
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace/>}/>
        <Route path="/admin/dashboard" element={<AdminDashboardPage/>}/>
        <Route path="/admin/posts" element={<AdminPostsPage/>}/>
        <Route path="/admin/posts/create" element={<PostEditorPage/>}/>
        <Route path="/admin/posts/:id/edit" element={<PostEditorPage/>}/>
        <Route path="/admin/posts/:id/versions" element={<PostVersionsPage/>}/>
        <Route path="/admin/comments" element={<PlaceholderPage title="Moderate comments"/>}/>
        <Route path="*" element={<PlaceholderPage title="Page not found"/>}/>
      </Routes>
    </div>
    <button className={`scroll-top${showScrollTop ? ' visible' : ''}`} type="button" aria-label="Scroll to top" title="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg>
    </button>
  </>
}

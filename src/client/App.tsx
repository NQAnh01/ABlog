import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages'
import { ArticlePage, BlogListPage, InfoPage, StoryPreviewPage } from './pages/BlogPages'
import { ProfilePage } from './pages/ProfilePage'
import { UserSettingsPage } from './pages/UserSettingsPage'
import { AdminCommentsPage, AdminDashboardPage, AdminPostsPage, PostEditorPage, PostVersionsPage } from './pages/AdminPages'
import { NotFoundPage } from './pages/NotFoundPage'
import { SavedPage } from './pages/SavedPage'
import { HomePage } from './pages/HomePage'
import { SeriesManagerPage, SeriesPage } from './pages/SeriesPages'
import { AuthorPage } from './pages/AuthorPage'
import { OfflinePage } from './pages/OfflinePage'

export default function App() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  return <>
    <div className="page-transition">
      <Routes location={location}>
        <Route path="/" element={<HomePage/>}/>
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
        <Route path="/forgot-password" element={<ForgotPasswordPage/>}/>
        <Route path="/reset-password" element={<ResetPasswordPage/>}/>
        <Route path="/profile" element={<ProfilePage/>}/>
        <Route path="/profile/settings" element={<UserSettingsPage/>}/>
        <Route path="/saved" element={<SavedPage/>}/>
        <Route path="/offline" element={<OfflinePage/>}/>
        <Route path="/series/:slug" element={<SeriesPage/>}/>
        <Route path="/author/:username" element={<AuthorPage/>}/>
        <Route path="/admin/series" element={<SeriesManagerPage/>}/>
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace/>}/>
        <Route path="/admin/dashboard" element={<AdminDashboardPage/>}/>
        <Route path="/admin/posts" element={<AdminPostsPage/>}/>
        <Route path="/admin/posts/create" element={<PostEditorPage/>}/>
        <Route path="/admin/posts/:id/edit" element={<PostEditorPage/>}/>
        <Route path="/admin/posts/:id/versions" element={<PostVersionsPage/>}/>
        <Route path="/admin/comments" element={<AdminCommentsPage/>}/>
        <Route path="*" element={<NotFoundPage/>}/>
      </Routes>
    </div>
  </>
}

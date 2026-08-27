import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

const LoginPage=lazy(()=>import('./pages/AuthPages').then(module=>({default:module.LoginPage})))
const RegisterPage=lazy(()=>import('./pages/AuthPages').then(module=>({default:module.RegisterPage})))
const ForgotPasswordPage=lazy(()=>import('./pages/AuthPages').then(module=>({default:module.ForgotPasswordPage})))
const ResetPasswordPage=lazy(()=>import('./pages/AuthPages').then(module=>({default:module.ResetPasswordPage})))
const BlogListPage=lazy(()=>import('./pages/BlogPages').then(module=>({default:module.BlogListPage})))
const ArticlePage=lazy(()=>import('./pages/BlogPages').then(module=>({default:module.ArticlePage})))
const StoryPreviewPage=lazy(()=>import('./pages/BlogPages').then(module=>({default:module.StoryPreviewPage})))
const InfoPage=lazy(()=>import('./pages/BlogPages').then(module=>({default:module.InfoPage})))
const ProfilePage=lazy(()=>import('./pages/ProfilePage').then(module=>({default:module.ProfilePage})))
const UserSettingsPage=lazy(()=>import('./pages/UserSettingsPage').then(module=>({default:module.UserSettingsPage})))
const AdminDashboardPage=lazy(()=>import('./pages/AdminPages').then(module=>({default:module.AdminDashboardPage})))
const AdminPostsPage=lazy(()=>import('./pages/AdminPages').then(module=>({default:module.AdminPostsPage})))
const PostEditorPage=lazy(()=>import('./pages/AdminPages').then(module=>({default:module.PostEditorPage})))
const PostVersionsPage=lazy(()=>import('./pages/AdminPages').then(module=>({default:module.PostVersionsPage})))
const AdminCommentsPage=lazy(()=>import('./pages/AdminPages').then(module=>({default:module.AdminCommentsPage})))
const NotFoundPage=lazy(()=>import('./pages/NotFoundPage').then(module=>({default:module.NotFoundPage})))
const SavedPage=lazy(()=>import('./pages/SavedPage').then(module=>({default:module.SavedPage})))
const HomePage=lazy(()=>import('./pages/HomePage').then(module=>({default:module.HomePage})))
const SeriesPage=lazy(()=>import('./pages/SeriesPages').then(module=>({default:module.SeriesPage})))
const SeriesManagerPage=lazy(()=>import('./pages/SeriesPages').then(module=>({default:module.SeriesManagerPage})))
const AuthorPage=lazy(()=>import('./pages/AuthorPage').then(module=>({default:module.AuthorPage})))
const OfflinePage=lazy(()=>import('./pages/OfflinePage').then(module=>({default:module.OfflinePage})))

function RouteFallback(){return <div className="route-loading" role="status" aria-live="polite"><span className="spinner"/><span>Loading page…</span></div>}

export default function App() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  return <>
    <div className="page-transition">
      <Suspense fallback={<RouteFallback/>}><Routes location={location}>
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
      </Routes></Suspense>
    </div>
  </>
}

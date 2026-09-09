import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { seoDefaults,useSeo } from './components/Seo'

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
const AdminUsersPage=lazy(()=>import('./pages/AdminPages').then(module=>({default:module.AdminUsersPage})))
const AdminUserDetailPage=lazy(()=>import('./pages/AdminPages').then(module=>({default:module.AdminUserDetailPage})))
const NotFoundPage=lazy(()=>import('./pages/NotFoundPage').then(module=>({default:module.NotFoundPage})))
const SavedPage=lazy(()=>import('./pages/SavedPage').then(module=>({default:module.SavedPage})))
const HomePage=lazy(()=>import('./pages/HomePage').then(module=>({default:module.HomePage})))
const SeriesPage=lazy(()=>import('./pages/SeriesPages').then(module=>({default:module.SeriesPage})))
const SeriesManagerPage=lazy(()=>import('./pages/SeriesPages').then(module=>({default:module.SeriesManagerPage})))
const AuthorPage=lazy(()=>import('./pages/AuthorPage').then(module=>({default:module.AuthorPage})))
const TodoPage=lazy(()=>import('./pages/TodoPage').then(module=>({default:module.TodoPage})))
const DiscussionsPage=lazy(()=>import('./pages/DiscussionPages').then(module=>({default:module.DiscussionsPage})))
const DiscussionPage=lazy(()=>import('./pages/DiscussionPages').then(module=>({default:module.DiscussionPage})))

function RouteFallback(){return <div className="route-loading" role="status" aria-live="polite"><span className="spinner"/><span>Loading page…</span></div>}

export default function App() {
  const location = useLocation()

  const routeSeo:Record<string,{title:string;description:string;noIndex?:boolean}>={
    '/':{title:'',description:seoDefaults.description},
    '/blog':{title:'Explore stories',description:'Discover thoughtful stories, useful ideas, and fresh perspectives from independent writers on Lumina.'},
    '/search':{title:'Search stories',description:'Search stories, topics, and ideas published on Lumina.',noIndex:true},
    '/about':{title:'About',description:'Learn about Lumina, a thoughtful publishing community for independent writers and curious readers.'},
    '/privacy':{title:'Privacy policy',description:'Read how Lumina handles account information, published content, and reader privacy.'},
    '/socials':{title:'Connect with Lumina',description:'Find Lumina across the web and stay connected with our writing community.'},
    '/discussions':{title:'Community discussions',description:'Join thoughtful conversations, ask questions, and exchange ideas with the Lumina community.'},
    '/login':{title:'Sign in',description:'Sign in to your Lumina account.',noIndex:true},
    '/register':{title:'Create account',description:'Create your Lumina writing and reading account.',noIndex:true},
    '/forgot-password':{title:'Reset password',description:'Request a password reset for your Lumina account.',noIndex:true},
    '/reset-password':{title:'Choose a new password',description:'Choose a new password for your Lumina account.',noIndex:true},
    '/profile':{title:'My stories',description:'Manage your Lumina stories.',noIndex:true},
    '/profile/settings':{title:'Account settings',description:'Manage your Lumina account and public author profile.',noIndex:true},
    '/saved':{title:'Reading list',description:'Your private Lumina reading list.',noIndex:true},
    '/todos':{title:'Targets and todos',description:'Your private targets and todo lists.',noIndex:true},
    '/offline':{title:'Offline library',description:'Stories saved for offline reading.',noIndex:true},
    '/admin/dashboard':{title:'Dashboard',description:'Lumina editorial dashboard.',noIndex:true},
    '/admin/posts':{title:'Manage stories',description:'Manage Lumina stories.',noIndex:true},
    '/admin/posts/create':{title:'Create story',description:'Create a new Lumina story.',noIndex:true},
    '/admin/comments':{title:'Moderate comments',description:'Moderate Lumina comments.',noIndex:true},
    '/admin/users':{title:'User administration',description:'Manage Lumina user accounts.',noIndex:true},
    '/admin/series':{title:'Series studio',description:'Manage Lumina story series.',noIndex:true},
  }
  const privateRoute=/^\/(admin|profile|saved|todos|stories)(\/|$)/.test(location.pathname)||['/forgot-password','/reset-password','/offline'].includes(location.pathname)
  const fallback=location.pathname.startsWith('/categories/')?{title:'Stories by category',description:'Browse stories in this category on Lumina.'}:location.pathname.startsWith('/tags/')?{title:'Tagged stories',description:'Browse stories with this tag on Lumina.'}:location.pathname.startsWith('/series/')?{title:'Story series',description:'Read a curated story series on Lumina.'}:location.pathname.startsWith('/author/')?{title:'Lumina author',description:'Read stories from an independent writer on Lumina.'}:location.pathname.startsWith('/blog/')?{title:'Lumina story',description:seoDefaults.description}:location.pathname.startsWith('/discussions/')?{title:'Community discussion',description:'Read and join this discussion on Lumina.'}:{title:'Page not found',description:'The requested page could not be found on Lumina.',noIndex:true}
  const current=routeSeo[location.pathname]??fallback
  useSeo({...current,path:location.pathname,noIndex:privateRoute||current.noIndex||location.pathname==='/search',jsonLd:location.pathname==='/'?[{'@context':'https://schema.org','@type':'WebSite',name:'Lumina',url:window.location.origin,potentialAction:{'@type':'SearchAction',target:`${window.location.origin}/search?q={search_term_string}`,'query-input':'required name=search_term_string'}},{'@context':'https://schema.org','@type':'Organization',name:'Lumina',url:window.location.origin,logo:`${window.location.origin}/icons/icon-512.png`}]:undefined})

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
        <Route path="/todos" element={<TodoPage/>}/>
        <Route path="/discussions" element={<DiscussionsPage/>}/>
        <Route path="/discussions/:id" element={<DiscussionPage/>}/>
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
        <Route path="/admin/users" element={<AdminUsersPage/>}/>
        <Route path="/admin/users/:id" element={<AdminUserDetailPage/>}/>
        <Route path="*" element={<NotFoundPage/>}/>
      </Routes></Suspense>
    </div>
  </>
}

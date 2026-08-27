import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import type { Category, Post, Tag } from '../types'
import { Bookmark, Compass, Gauge, Hash, Library, LogIn, Moon, PenLine, Plus, Search, Sun } from 'lucide-react'

type PaletteItem = { id: string; group: 'Actions' | 'Stories' | 'Categories' | 'Tags'; title: string; detail?: string; icon: ReactNode; run: () => void }

function normalized(value: string) {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function fuzzyScore(value: string, query: string) {
  const text = normalized(value), needle = normalized(query)
  if (!needle) return 1
  if (text === needle) return 100
  if (text.startsWith(needle)) return 80
  const direct = text.indexOf(needle)
  if (direct >= 0) return 60 - Math.min(direct, 20)
  let position = 0, gaps = 0
  for (const character of needle) {
    const found = text.indexOf(character, position)
    if (found < 0) return 0
    gaps += found - position
    position = found + 1
  }
  return Math.max(1, 35 - gaps)
}

export function CommandPalette({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [serverPosts, setServerPosts] = useState<Post[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(value => !value) }
    }
    const openPalette = () => setOpen(true)
    window.addEventListener('keydown', shortcut);window.addEventListener('lumina:open-command-palette',openPalette)
    return () => {window.removeEventListener('keydown', shortcut);window.removeEventListener('lumina:open-command-palette',openPalette)}
  }, [])

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    document.body.classList.add('palette-open')
    window.requestAnimationFrame(() => inputRef.current?.focus())
    void Promise.all([api.posts('?limit=100'), api.categories(), api.tags()]).then(([postPage, categoryData, tagData]) => {
      setPosts(postPage.items ?? []); setCategories(categoryData ?? []); setTags(tagData ?? [])
    })
    return () => { document.body.classList.remove('palette-open'); previous?.focus() }
  }, [open])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let active = true
    if (!open || !debounced) { setServerPosts([]); setLoading(false); return }
    setLoading(true)
    api.posts(`?q=${encodeURIComponent(debounced)}&limit=12`).then(result => { if (active) setServerPosts(result.items ?? []) }).catch(() => { if (active) setServerPosts([]) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, debounced])

  const closeAnd = (run: () => void) => () => { setOpen(false); setQuery(''); run() }
  const items = useMemo(() => {
    const actions: PaletteItem[] = [
      ...(user ? [{ id:'new',group:'Actions' as const,title:'Create a new story',detail:'Open the editor',icon:<Plus aria-hidden="true"/>,run:closeAnd(()=>navigate('/admin/posts/create')) }] : []),
      ...(user?.role==='admin' ? [{ id:'dashboard',group:'Actions' as const,title:'Open Dashboard',detail:'Editorial overview',icon:<Gauge aria-hidden="true"/>,run:closeAnd(()=>navigate('/admin/dashboard')) }] : []),
      ...(user ? [{ id:'saved',group:'Actions' as const,title:'Saved stories',detail:'Your reading list',icon:<Bookmark aria-hidden="true"/>,run:closeAnd(()=>navigate('/saved')) }] : []),
      ...(user ? [{ id:'series',group:'Actions' as const,title:'Manage series',detail:'Curate a reading journey',icon:<Library aria-hidden="true"/>,run:closeAnd(()=>navigate('/admin/series')) }] : []),
      { id:'theme',group:'Actions' as const,title:`Switch to ${dark?'light':'dark'} theme`,detail:'Change appearance',icon:dark?<Sun aria-hidden="true"/>:<Moon aria-hidden="true"/>,run:closeAnd(onToggleTheme) },
      ...(!user ? [{ id:'login',group:'Actions' as const,title:'Sign in',detail:'Access writing tools',icon:<LogIn aria-hidden="true"/>,run:closeAnd(()=>navigate('/login')) }] : []),
    ]
    if (!debounced) return actions
    const mergedPosts = [...new Map([...serverPosts,...posts].map(post=>[post.id,post])).values()]
    const storyItems = mergedPosts.map(post => ({ post, score:Math.max(fuzzyScore(post.title,debounced),fuzzyScore(post.author?.name??'',debounced)) })).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,8).map(({post})=>({id:`post-${post.id}`,group:'Stories' as const,title:post.title,detail:`By ${post.author?.name??'Lumina'}`,icon:<PenLine aria-hidden="true"/>,run:closeAnd(()=>navigate(`/blog/${post.slug}`))}))
    const categoryItems = categories.map(category=>({category,score:fuzzyScore(category.name,debounced)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,5).map(({category})=>({id:`category-${category.id}`,group:'Categories' as const,title:category.name,detail:'Category',icon:<Compass aria-hidden="true"/>,run:closeAnd(()=>navigate(`/categories/${category.slug}`))}))
    const tagItems = tags.map(tag=>({tag,score:fuzzyScore(tag.name,debounced)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,5).map(({tag})=>({id:`tag-${tag.id}`,group:'Tags' as const,title:`#${tag.name}`,detail:'Tag',icon:<Hash aria-hidden="true"/>,run:closeAnd(()=>navigate(`/tags/${tag.slug}`))}))
    const actionItems = actions.filter(action=>Math.max(fuzzyScore(action.title,debounced),fuzzyScore(action.detail??'',debounced))>0)
    return [...actionItems,...storyItems,...categoryItems,...tagItems]
  }, [user,dark,debounced,serverPosts,posts,categories,tags,navigate,onToggleTheme])

  useEffect(() => { setSelected(0) }, [query, items.length])
  if (!open) return null
  const groups = ['Actions','Stories','Categories','Tags'] as const
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key==='Escape') { event.preventDefault(); setOpen(false) }
    if (event.key==='ArrowDown') { event.preventDefault(); setSelected(value=>(value+1)%Math.max(items.length,1)) }
    if (event.key==='ArrowUp') { event.preventDefault(); setSelected(value=>(value-1+Math.max(items.length,1))%Math.max(items.length,1)) }
    if (event.key==='Enter'&&items[selected]) { event.preventDefault(); items[selected].run() }
  }
  return <div className="command-palette-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
    <header><span aria-hidden="true"><Search/></span><input ref={inputRef} role="combobox" aria-controls="command-results" aria-expanded="true" aria-activedescendant={items[selected]?.id} value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder="Search stories, authors, categories, or tags…"/><kbd>Esc</kbd></header>
    <div className="command-results" id="command-results" role="listbox" aria-busy={loading}>{loading&&<span className="command-loading"/>}{items.length?groups.map(group=>{const grouped=items.filter(item=>item.group===group);if(!grouped.length)return null;return <section className="command-group" key={group}><h2>{group}</h2>{grouped.map(item=>{const index=items.indexOf(item);return <button id={item.id} type="button" role="option" aria-selected={index===selected} className={index===selected?'selected':''} key={item.id} onMouseEnter={()=>setSelected(index)} onClick={item.run}><i>{item.icon}</i><span><strong>{item.title}</strong>{item.detail&&<small>{item.detail}</small>}</span><b>↵</b></button>})}</section>}):<div className="command-empty"><span><Search aria-hidden="true"/></span><strong>No results found</strong><small>Try another title, author, category, or tag.</small></div>}</div>
    <footer><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>Esc</kbd> Close</span></footer>
  </section></div>
}

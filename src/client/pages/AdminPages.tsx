import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { LoaderCircle, Search } from 'lucide-react'
import { EmptyState, ErrorState, Layout, Loading, Pagination } from '../components/ui'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import { useToast } from '../hooks/useToast'
import { createAutosaveController, localDraftKey, newestRestorableDraft, readLocalDraft } from '../autosave.mjs'
import type { AdminPasswordReset, Category, Comment, Dashboard, Media, Post, PostDraft, PostInput, PostVersion, Tag, User, UserRole } from '../types'
import { ViewToggle } from '../components/ViewToggle'
import { confirmAction } from '../components/ConfirmModal'

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Layout><Loading /></Layout>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function formatDate(value?: string) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export function AdminPostsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const status = params.get('status') ?? ''
  const query = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  useEffect(() => {
    const search = new URLSearchParams()
    search.set('page', String(page))
    if (status) search.set('status', status)
    if (query) search.set('q', query)
    setLoading(true)
    api.myPosts(`?${search}`).then(result => { setPosts(result.items ?? []); setTotal(result.total) }).catch(err => setError(err instanceof Error ? err.message : 'Unable to load stories')).finally(() => setLoading(false))
  }, [status, query, page])

  const allSelected = posts.length > 0 && posts.every(p => selected.includes(p.id))
  function toggleAll() {
    if (allSelected) {
      setSelected([])
    } else {
      setSelected(posts.map(p => p.id))
    }
  }
  function toggleOne(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  async function handleBulkAction(action: 'publish' | 'unpublish' | 'delete') {
    if (selected.length === 0 || bulkBusy) return
    if (action === 'delete') {
      const ok = await confirmAction({
        title: `Delete ${selected.length} ${selected.length === 1 ? 'story' : 'stories'}?`,
        message: `Permanently delete the selected ${selected.length} stories? This action cannot be undone.`,
        confirmLabel: 'Delete stories',
        danger: true,
      })
      if (!ok) return
    }
    setBulkBusy(true)
    try {
      const res = await api.bulkPosts(action, selected)
      toast(`${res.affected} ${res.affected === 1 ? 'story' : 'stories'} ${action === 'delete' ? 'deleted' : action === 'publish' ? 'published' : 'moved to private'}.`)
      if (action === 'delete') {
        setPosts(current => current.filter(item => !selected.includes(item.id)))
        setTotal(val => Math.max(0, val - res.affected))
      } else {
        const nextStatus = action === 'publish' ? 'public' : 'private'
        setPosts(current => current.map(item => selected.includes(item.id) ? { ...item, status: nextStatus } : item))
      }
      setSelected([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed')
    } finally {
      setBulkBusy(false)
    }
  }

  async function remove(post: Post) {
    if (!await confirmAction({title:'Delete story?',message:`“${post.title}” will be permanently deleted. This action cannot be undone.`,confirmLabel:'Delete story',danger:true})) return
    try { await api.deletePost(post.id); setPosts(current => current.filter(item => item.id !== post.id)); setTotal(value => value - 1); setSelected(prev => prev.filter(id => id !== post.id)); toast('Story deleted successfully.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete story') }
  }

  const isStaff = user?.role === 'admin' || user?.role === 'editor'

  return <AdminGuard><Layout><section className="admin admin-dashboard container">
    <header className="admin-heading"><div><span className="eyebrow">{isStaff ? 'EDITORIAL DESK' : 'YOUR WRITING DESK'}</span><h1>{isStaff ? 'All stories' : 'Your stories'}</h1><p>Write freely, then choose who can see each story.</p></div><Link className="button" to="/admin/posts/create">Create story&nbsp; +</Link></header>
    <div className="admin-toolbar"><form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = new URLSearchParams(params); const value = String(data.get('q') ?? '').trim(); value ? next.set('q', value) : next.delete('q'); setParams(next) }}><span>⌕</span><input name="q" defaultValue={query} placeholder="Search your stories" /></form><div className="status-tabs">{[['','All'],['public','Public'],['scheduled','Scheduled'],['private','Private']].map(([value,label]) => <button className={status === value ? 'active' : ''} key={value} onClick={() => { const next = new URLSearchParams(params); value ? next.set('status', value) : next.delete('status'); setParams(next) }}>{label}</button>)}</div><ViewToggle targetId="admin-stories-view" storageKey="admin-stories"/><span className="story-count">{total} {total === 1 ? 'story' : 'stories'}</span></div>
    {error && <div className="admin-alert">{error}<button onClick={() => setError('')}>×</button></div>}
    {loading ? <Loading /> : posts.length === 0 ? <EmptyState title="No stories here yet" text="Create a story and choose its visibility." /> : <div className="story-table" id="admin-stories-view"><div className="story-row story-table-head"><label className="bulk-checkbox-cell" title="Select all stories on this page"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all stories" /></label><span>Story</span><span>Visibility</span><span>Last updated</span><span>Actions</span></div>{posts.map(post => <article className={`story-row ${selected.includes(post.id) ? 'selected-row' : ''}`} key={post.id}><label className="bulk-checkbox-cell" title={`Select "${post.title}"`}><input type="checkbox" checked={selected.includes(post.id)} onChange={() => toggleOne(post.id)} aria-label={`Select ${post.title}`} /></label><div className="story-identity">{post.thumbnail?.url ? <img src={post.thumbnail.url} alt="" /> : <span className="story-placeholder">L</span>}<div><Link to={`/admin/posts/${post.id}/edit`}>{post.title}</Link><small>/{post.slug}</small></div></div><span className="story-visibility-cell"><i className={`status-dot ${post.status}`} />{post.status}{post.status === 'scheduled' && post.published_at ? <small className="scheduled-pill">{formatDate(post.published_at)}</small> : null}</span><time>{formatDate(post.updated_at ?? post.created_at)}</time><div className="row-actions">{post.status === 'public' ? <Link title="View story" to={`/blog/${post.slug}`}>↗</Link> : <Link title="Preview story" to={`/stories/${post.id}/preview`}>Preview ↗</Link>}<Link title="Edit story" to={`/admin/posts/${post.id}/edit`}>Edit</Link><button title="Delete story" onClick={() => void remove(post)}>Delete</button></div></article>)}</div>}
    <Pagination page={page} total={total} onPage={next => { const value = new URLSearchParams(params); next > 1 ? value.set('page', String(next)) : value.delete('page'); setParams(value) }} />
    {selected.length > 0 && (
      <aside className="bulk-action-bar" role="toolbar" aria-label="Bulk post actions">
        <span className="bulk-selection-count">
          <strong>{selected.length}</strong> {selected.length === 1 ? 'story' : 'stories'} selected
        </span>
        <div className="bulk-action-buttons">
          <button type="button" disabled={bulkBusy} onClick={() => void handleBulkAction('publish')} className="bulk-btn publish">
            ✓ Publish
          </button>
          <button type="button" disabled={bulkBusy} onClick={() => void handleBulkAction('unpublish')} className="bulk-btn unpublish">
            ⚑ Move to private
          </button>
          <button type="button" disabled={bulkBusy} onClick={() => void handleBulkAction('delete')} className="bulk-btn delete">
            🗑 Delete
          </button>
          <button type="button" disabled={bulkBusy} onClick={() => setSelected([])} className="bulk-btn cancel">
            Clear
          </button>
        </div>
      </aside>
    )}
  </section></Layout></AdminGuard>
}

const emptyPost: PostInput = { title: '', slug: '', excerpt: '', content: '', status: 'private', category_ids: [], tag_ids: [], is_featured: false, is_pinned_on_profile:false, published_at: undefined }
function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function makeSlug(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }

function TagSelector({ tags, selected, onTagsChange, onSelectedChange, onError }: { tags: Tag[]; selected: string[]; onTagsChange: (tags: Tag[]) => void; onSelectedChange: (ids: string[]) => void; onError: (message: string) => void }) {
  const toast = useToast()
  const combobox = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const normalized = query.trim().toLocaleLowerCase()
  const available = tags.filter(tag => !selected.includes(tag.id) && (!normalized || tag.name.toLocaleLowerCase().includes(normalized)))
  const exactMatch = tags.some(tag => tag.name.toLocaleLowerCase() === normalized)

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (!combobox.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    return () => document.removeEventListener('mousedown', closeOnOutside)
  }, [])

  function select(id: string) { onSelectedChange([...selected, id]); setQuery(''); setOpen(true) }
  async function create() {
    const name = query.trim()
    if (!name || exactMatch || busy) return
    setBusy(true); setCreating(true); onError('')
    try {
      const saved = await api.createTag({ name, slug: makeSlug(name) })
      onTagsChange([...tags, saved]); onSelectedChange([...selected, saved.id]); setQuery(''); setOpen(true); toast('Tag created successfully.')
    } catch (err) { onError(err instanceof Error ? err.message : 'Unable to create tag') }
    finally { setBusy(false); setCreating(false) }
  }
  async function saveTag(tag: Tag) {
    const name = editName.trim()
    if (name.length < 2 || busy) return
    if(!await confirmAction({title:'Rename tag?',message:`“${tag.name}” will be renamed to “${name}”.`,confirmLabel:'Rename tag'}))return
    setBusy(true); onError('')
    try {
      const saved = await api.updateTag(tag.id, { name, slug: makeSlug(name) })
      onTagsChange(tags.map(item => item.id === saved.id ? saved : item)); setEditing(null); setEditName(''); toast('Tag updated successfully.')
    } catch (err) { onError(err instanceof Error ? err.message : 'Unable to update tag') }
    finally { setBusy(false) }
  }
  async function removeTag(tag: Tag) {
    if (!await confirmAction({title:'Delete tag?',message:`“${tag.name}” will be permanently removed from the tag library.`,confirmLabel:'Delete tag',danger:true})) return
    setBusy(true); onError('')
    try {
      await api.deleteTag(tag.id); onTagsChange(tags.filter(item => item.id !== tag.id)); onSelectedChange(selected.filter(id => id !== tag.id)); if (editing === tag.id) setEditing(null); toast('Tag deleted successfully.')
    } catch (err) { onError(err instanceof Error ? err.message : 'Unable to delete tag') }
    finally { setBusy(false) }
  }

  return <section className={`tag-section${open ? ' dropdown-open' : ''}`} aria-busy={creating}><div className="sidebar-heading"><span>Tags</span><button className="manage-tags-button" type="button" disabled={busy} onClick={() => setManaging(value => !value)}>{managing ? 'Done' : 'Manage'}</button></div><div className="selected-tags">{selected.map(id => { const tag = tags.find(item => item.id === id); return tag ? <span className="taxonomy-tooltip" data-tooltip={`#${tag.name}`} key={id}>#{tag.name}<button type="button" disabled={busy} aria-label={`Remove ${tag.name}`} onClick={() => onSelectedChange(selected.filter(value => value !== id))}>×</button></span> : null })}{!selected.length && <small>No tags selected</small>}</div><div className="tag-combobox" ref={combobox}><input value={query} disabled={busy} placeholder="Search or create a tag…" onMouseDown={event => { if (open) { event.preventDefault(); setOpen(false) } }} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (available.length && exactMatch) select(available[0].id); else void create() } if (event.key === 'Escape') setOpen(false) }} /><span className={`tag-search-icon${creating ? ' loading' : ''}`} aria-hidden="true">{creating ? <LoaderCircle /> : <Search />}</span>{open && <div className="tag-dropdown">{available.slice(0, 20).map(tag => <button className="taxonomy-tooltip" data-tooltip={`#${tag.name}`} type="button" disabled={busy} key={tag.id} onMouseDown={event => event.preventDefault()} onClick={() => select(tag.id)}>#{tag.name}</button>)}{normalized && !exactMatch && <button className="create-tag-option" type="button" disabled={busy} onMouseDown={event => event.preventDefault()} onClick={() => void create()}>{creating ? <span className="creating-tag"><LoaderCircle aria-hidden="true" />Creating “{query.trim()}”…</span> : <><span>Create “{query.trim()}”</span><small>Press Enter</small></>}</button>}{!available.length && (!normalized || exactMatch) && <p>{normalized ? 'This tag is already selected.' : 'Type to find a tag.'}</p>}</div>}</div>{managing && <div className="tag-manager"><p>Rename or permanently delete tags from your library.</p>{tags.map(tag => <div className="tag-manager-row" key={tag.id}>{editing === tag.id ? <><input autoFocus value={editName} disabled={busy} onChange={event => setEditName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveTag(tag) } if (event.key === 'Escape') setEditing(null) }} /><button type="button" disabled={busy} onClick={() => void saveTag(tag)}>Save</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></> : <><span className="taxonomy-tooltip" data-tooltip={`#${tag.name}`}>#{tag.name}</span><button type="button" disabled={busy} onClick={() => { setEditing(tag.id); setEditName(tag.name) }}>Edit</button><button className="delete-tag" type="button" disabled={busy} onClick={() => void removeTag(tag)}>Delete</button></>}</div>)}</div>}</section>
}

export function PostEditorPage() {
  const toast = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)
  const [form, setForm] = useState<PostInput>(emptyPost)
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState<'saving' | 'saved' | 'offline'>('saved')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [addingTaxonomy, setAddingTaxonomy] = useState<'category' | 'tag' | null>(null)
  const [taxonomyName, setTaxonomyName] = useState('')
  const [taxonomyBusy, setTaxonomyBusy] = useState(false)
  const autosave = useRef<ReturnType<typeof createAutosaveController> | null>(null)
  const editorReady = useRef(false)
  const baseline = useRef('')
  const draftKey = localDraftKey(id)
  const words = useMemo(() => form.content.trim() ? form.content.trim().split(/\s+/).length : 0, [form.content])

  useEffect(() => {
    Promise.all([api.categories(), api.tags(), ...(id ? [api.myPost(id), api.postDraft(id)] : [])]).then(([categoryData, tagData, post, serverDraft]) => {
      setCategories((categoryData as Category[]) ?? []); setTags((tagData as Tag[]) ?? [])
      const saved = post ? (() => { const value=post as Post; return { title:value.title,slug:value.slug,excerpt:value.excerpt??'',content:value.content,status:value.status,thumbnail:value.thumbnail,category_ids:value.category_ids??[],tag_ids:value.tag_ids??[],is_featured:value.is_featured??false,is_pinned_on_profile:value.is_pinned_on_profile??false,published_at:value.published_at } as PostInput })() : emptyPost
      const localDraft = readLocalDraft(localStorage, draftKey)
      const remoteDraft = (serverDraft as { draft?: PostDraft } | undefined)?.draft
      const restore = newestRestorableDraft(remoteDraft, localDraft, (post as Post | undefined)?.updated_at)
      let initial = saved
      if (restore && window.confirm('A newer autosaved draft was found. Restore it?')) initial = { title:restore.title,slug:restore.slug,excerpt:restore.excerpt,content:restore.content,status:restore.status,thumbnail:restore.thumbnail,category_ids:restore.category_ids??[],tag_ids:restore.tag_ids??[],is_featured:restore.is_featured??false,is_pinned_on_profile:restore.is_pinned_on_profile??false,published_at:restore.published_at }
      else if (restore) { localStorage.removeItem(draftKey); if(id)void api.deletePostDraft(id) }
      setForm(initial); baseline.current=JSON.stringify(initial); setSlugTouched(Boolean(post)); editorReady.current=true
    }).catch(err => setError(err instanceof Error ? err.message : 'Unable to prepare the editor')).finally(() => setLoading(false))
  }, [id, draftKey])

  useEffect(() => {
    const storage = id ? localStorage : { getItem:(key:string)=>localStorage.getItem(key),setItem:(key:string,value:string)=>localStorage.setItem(key,value),removeItem:()=>{} } as unknown as Storage
    autosave.current = createAutosaveController({ save: (draft:PostDraft) => id ? api.savePostDraft(id, draft) : Promise.resolve({ accepted:true }), storage, key:draftKey, onStatus:setAutosaveStatus, online:()=>id ? navigator.onLine : true })
    const retry = () => autosave.current?.retry()
    const warn = (event: BeforeUnloadEvent) => { if(autosave.current?.isDirty()){event.preventDefault();event.returnValue=''} }
    window.addEventListener('online',retry);window.addEventListener('beforeunload',warn)
    return()=>{autosave.current?.dispose();window.removeEventListener('online',retry);window.removeEventListener('beforeunload',warn)}
  }, [id,draftKey])

  useEffect(() => {
    if(!editorReady.current)return
    const serialized=JSON.stringify(form)
    if(serialized===baseline.current)return
    autosave.current?.schedule(form)
  }, [form])

  function set<K extends keyof PostInput>(key: K, value: PostInput[K]) { setForm(current => ({ ...current, [key]: value })) }
  function toggle(key: 'category_ids' | 'tag_ids', value: string) { setForm(current => ({ ...current, [key]: current[key].includes(value) ? current[key].filter(id => id !== value) : [...current[key], value] })) }

  async function upload(file?: File) {
    if (!file) return
    setUploading(true); setError('')
    try { const media: Media = await api.uploadImage(file); set('thumbnail', media); toast('Image uploaded successfully.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to upload image') }
    finally { setUploading(false) }
  }

  async function save() {
    if (form.status === 'scheduled') {
      if (!form.published_at) {
        setError('Please select a date and time for scheduled publishing.')
        return
      }
      if (new Date(form.published_at).getTime() <= Date.now()) {
        setError('Scheduled publish date must be in the future.')
        return
      }
    }
    if(id&&!await confirmAction({title:'Save story changes?',message:'The current story will be updated with your latest changes.',confirmLabel:'Save story'}))return
    setSaving(true); setError('')
    try {
      await autosave.current?.flush()
      await autosave.current?.waitForIdle()
      const payload = { ...form, slug: form.slug || makeSlug(form.title) }
      const saved = id ? await api.updatePost(id, payload) : await api.createPost(payload)
      autosave.current?.clear(); localStorage.removeItem(draftKey); if(id)await api.deletePostDraft(id)
      toast(saved.status === 'scheduled' ? 'Story scheduled successfully.' : id ? 'Story updated successfully.' : 'Story saved successfully.')
      navigate(saved.status === 'public' ? `/blog/${saved.slug}` : `/stories/${saved.id}/preview`, { replace: true })
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save story') }
    finally { setSaving(false) }
  }

  async function createTaxonomy(kind: 'category' | 'tag') {
    const name = taxonomyName.trim()
    if (!name || taxonomyBusy) return
    setTaxonomyBusy(true); setError('')
    try {
      if (kind === 'category') {
        const saved = await api.createCategory({ name, slug: makeSlug(name), description: '' })
        setCategories(current => [...current, saved])
        setForm(current => ({ ...current, category_ids: [...current.category_ids, saved.id] }))
        toast('Category created successfully.')
      } else {
        const saved = await api.createTag({ name, slug: makeSlug(name) })
        setTags(current => [...current, saved])
        setForm(current => ({ ...current, tag_ids: [...current.tag_ids, saved.id] }))
        toast('Tag created successfully.')
      }
      setTaxonomyName(''); setAddingTaxonomy(null)
    } catch (err) { setError(err instanceof Error ? err.message : `Unable to create ${kind}`) }
    finally { setTaxonomyBusy(false) }
  }

  function taxonomyKeyDown(event: KeyboardEvent<HTMLInputElement>, kind: 'category' | 'tag') {
    if (event.key === 'Enter') { event.preventDefault(); void createTaxonomy(kind) }
    if (event.key === 'Escape') { setAddingTaxonomy(null); setTaxonomyName('') }
  }

  function submit(event: FormEvent) { event.preventDefault(); void save() }
  if (loading) return <AdminGuard><Layout><Loading /></Layout></AdminGuard>

  return <AdminGuard><Layout><><section className="post-editor-page container"><header className="editor-topbar"><div><Link to="/admin/posts">← &nbsp;All stories</Link><span>{editing ? 'EDITING STORY' : 'NEW STORY'}</span></div><div>{id&&<Link className="history-link" to={`/admin/posts/${id}/versions`}>Version history</Link>}<label className="featured-toggle" title="Pin this story on your public author page"><input type="checkbox" checked={form.is_pinned_on_profile??false} onChange={event=>set('is_pinned_on_profile',event.target.checked)}/><span>Profile pin</span></label><label className="featured-toggle" title="Show this story in the homepage hero"><input type="checkbox" checked={form.is_featured??false} onChange={event=>set('is_featured',event.target.checked)}/><span>Featured</span></label><span className={`autosave-state ${autosaveStatus}`}><i/>{autosaveStatus==='saving'?'Saving…':autosaveStatus==='offline'?'Offline':'Saved'}</span><span className="save-state">{saving ? 'Saving…' : `${words} words`}</span><button className="button" disabled={saving} onClick={() => void save()}>Save story</button></div></header>
    {error && <div className="admin-alert">{error}<button onClick={() => setError('')}>×</button></div>}
    <form className="post-editor" onSubmit={submit}><div className="editor-main"><label className="editor-title"><span>Story title <small>{form.title.length}/80</small></span><textarea value={form.title} maxLength={80} onChange={event => { const title = event.target.value; set('title', title); if (!slugTouched) set('slug', makeSlug(title)) }} placeholder="Give your story a thoughtful title" required /></label><label className="editor-slug"><span>lumina.blog/blog/</span><input value={form.slug} onChange={event => { setSlugTouched(true); set('slug', makeSlug(event.target.value)) }} placeholder="story-slug" /></label><label className="editor-excerpt"><span>Excerpt <small>{form.excerpt.length}/320</small></span><textarea value={form.excerpt} maxLength={320} onChange={event => set('excerpt', event.target.value)} placeholder="A concise invitation into the story…" /></label><div className="editor-content"><span>Story</span><MarkdownEditor value={form.content} onChange={value => set('content', value)} onError={setError} /></div></div>
      <aside className="editor-sidebar"><section><div className="sidebar-heading"><span>Cover image</span>{form.thumbnail && <button type="button" onClick={() => set('thumbnail', undefined)}>Remove</button>}</div><label className={`cover-upload ${form.thumbnail ? 'has-image' : ''}`}>{form.thumbnail ? <img src={form.thumbnail.url} alt="Story cover preview" /> : <><b>{uploading ? 'Uploading…' : '＋'}</b><strong>Upload a cover</strong><small>JPEG, PNG or WebP · max 5 MB</small></>}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={event => void upload(event.target.files?.[0])} /></label></section><section><div className="sidebar-heading"><span>Category</span><button type="button" aria-label="Add category" onClick={() => { setAddingTaxonomy('category'); setTaxonomyName('') }}>＋</button></div>{addingTaxonomy === 'category' && <input className="inline-taxonomy-input" autoFocus value={taxonomyName} disabled={taxonomyBusy} onChange={event => setTaxonomyName(event.target.value)} onKeyDown={event => taxonomyKeyDown(event, 'category')} onBlur={() => !taxonomyBusy && !taxonomyName.trim() && setAddingTaxonomy(null)} placeholder="Name, then press Enter" />}<div className="editor-options category-options">{categories.map(category => <label className="taxonomy-tooltip" data-tooltip={category.name} key={category.id}><input type="checkbox" checked={form.category_ids.includes(category.id)} onChange={() => toggle('category_ids', category.id)} /><span>{category.name}</span></label>)}</div></section><TagSelector tags={tags} selected={form.tag_ids} onTagsChange={setTags} onSelectedChange={ids => set('tag_ids', ids)} onError={setError}/><section className="publish-note"><span>Visibility</span><div className="editor-options"><label><input type="radio" name="visibility" checked={form.status === 'private'} onChange={() => set('status', 'private')} /><span>Private — only you can see it</span></label><label><input type="radio" name="visibility" checked={form.status === 'public'} onChange={() => set('status', 'public')} /><span>Public — everyone can see it</span></label><label><input type="radio" name="visibility" checked={form.status === 'scheduled'} onChange={() => { set('status', 'scheduled'); if (!form.published_at || new Date(form.published_at).getTime() <= Date.now()) { const tomorrow = new Date(Date.now() + 24 * 3600 * 1000); tomorrow.setMinutes(0, 0, 0); set('published_at', tomorrow.toISOString()) } }} /><span>Scheduled — publish at future date</span></label></div>{form.status === 'scheduled' && <div className="schedule-picker"><label><span className="schedule-picker-label">Publish at</span><input type="datetime-local" className="schedule-datetime-input" value={form.published_at ? toLocalDatetimeString(new Date(form.published_at)) : ''} min={toLocalDatetimeString(new Date())} onChange={event => { if (event.target.value) { set('published_at', new Date(event.target.value).toISOString()) } }} required /></label><small>The story will become public automatically when this time arrives.</small></div>}</section></aside>
    </form></section></></Layout></AdminGuard>
}

type DiffRow = { left?: string; right?: string; kind: 'same' | 'removed' | 'added' }
function lineDiff(before: string, after: string): DiffRow[] {
  const left = before.split('\n'), right = after.split('\n')
  const table = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0) as number[])
  for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--) table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  const rows: DiffRow[] = []; let i = 0, j = 0
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) { rows.push({ left: left[i++], right: right[j++], kind: 'same' }) }
    else if (j < right.length && (i === left.length || table[i][j + 1] >= table[i + 1][j])) rows.push({ right: right[j++], kind: 'added' })
    else rows.push({ left: left[i++], kind: 'removed' })
  }
  return rows
}

export function PostVersionsPage() {
  const { id = '' } = useParams(); const [post, setPost] = useState<Post | null>(null); const [versions, setVersions] = useState<PostVersion[]>([]); const [selected, setSelected] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { Promise.all([api.myPost(id), api.postVersions(id)]).then(([current, history]) => { setPost(current); setVersions(history ?? []); if (history?.length) setSelected(history[0].id) }).catch(err => setError(err instanceof Error ? err.message : 'Unable to load version history')).finally(() => setLoading(false)) }, [id])
  if (loading) return <AdminGuard><Layout><Loading /></Layout></AdminGuard>
  if (error || !post) return <AdminGuard><Layout><ErrorState message={error || 'Story not found'} /></Layout></AdminGuard>
  const version = versions.find(item => item.id === selected)
  const fields = version ? [{ label: 'Title', old: version.snapshot.title, current: post.title }, { label: 'Excerpt', old: version.snapshot.excerpt, current: post.excerpt }, { label: 'Content', old: version.snapshot.content, current: post.content }] : []
  return <AdminGuard><Layout><section className="version-page container"><header><div><Link to={`/admin/posts/${post.id}/edit`}>← Back to editor</Link><span className="eyebrow">REVISION HISTORY</span><h1>{post.title}</h1></div>{versions.length>0&&<label>Compare version<select className="app-native-select" value={selected} onChange={event=>setSelected(event.target.value)}>{versions.map(item=><option key={item.id} value={item.id}>Version {item.number} · {formatDate(item.created_at)}</option>)}</select></label>}</header>{!versions.length?<EmptyState title="No saved versions yet" text="A snapshot is created before every edit. Save a change to start the history."/>:<>{fields.map(field=><section className="diff-section" key={field.label}><h2>{field.label}</h2><div className="diff-head"><span>Version {version?.number} — before</span><span>Current version — after</span></div><div className="diff-grid">{lineDiff(field.old,field.current).map((row,index)=><div className={`diff-row ${row.kind}`} key={`${field.label}-${index}`}><pre>{row.left??''}</pre><pre>{row.right??''}</pre></div>)}</div></section>)}</>}</section></Layout></AdminGuard>
}

export function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth(); const [data, setData] = useState<Dashboard | null>(null); const [error, setError] = useState('')
  useEffect(() => { if (user?.role === 'admin' || user?.role === 'editor') api.dashboard().then(setData).catch(err => setError(err instanceof Error ? err.message : 'Unable to load dashboard')) }, [user])
  if (authLoading) return <Layout><Loading /></Layout>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin' && user.role !== 'editor') return <Navigate to="/admin/posts" replace />
  if (!data) return <Layout><section className="analytics-dashboard container"><header className="admin-heading"><div><span className="eyebrow">EDITORIAL OVERVIEW</span><h1>Dashboard</h1><p>A quick view of publishing activity across Lumina.</p></div></header>{error?<ErrorState message={error}/>:<Loading/>}</section></Layout>
  const publishedRate = data.posts ? Math.round(data.published / data.posts * 100) : 0
  const stats = [
    { label: 'Total stories', value: data.posts, note: 'All editorial content', tone: 'violet', icon: 'document' },
    { label: 'Published', value: data.published, note: `${publishedRate}% of all stories`, tone: 'emerald', icon: 'check' },
    { label: 'Scheduled', value: data.scheduled ?? 0, note: 'Upcoming publications', tone: 'cyan', icon: 'clock' },
    { label: 'Private', value: data.private, note: 'Drafts and private work', tone: 'amber', icon: 'lock' },
    { label: 'Comments', value: data.comments, note: 'Reader conversations', tone: 'blue', icon: 'comment' },
    { label: 'Categories', value: data.categories, note: 'Content collections', tone: 'rose', icon: 'grid' },
  ]
  const chartMax = Math.max(...stats.map(item => item.value), 1)
  return <Layout><section className="analytics-dashboard container">
    <header className="dashboard-hero"><div><span className="eyebrow">EDITORIAL OVERVIEW</span><h1>Good to see you, {user.name.split(' ')[0]}.</h1><p>Here’s what’s happening across your publication today.</p></div><div className="dashboard-actions"><span className="dashboard-live"><i/>Live overview</span>{user.role === 'admin' && <Link className="button" to="/admin/users">Manage users <span>→</span></Link>}<Link className="button" to="/admin/posts">Manage stories <span>→</span></Link></div></header>
    <div className="dashboard-stat-grid">{stats.map((item,index)=><article className={`dashboard-stat ${item.tone}`} style={{'--stat-index':index} as React.CSSProperties} key={item.label}><header><span className="dashboard-stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24">{item.icon==='document'?<><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>:item.icon==='check'?<><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>:item.icon==='clock'?<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>:item.icon==='lock'?<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>:item.icon==='comment'?<><path d="M20 15a3 3 0 0 1-3 3H9l-5 3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z"/><path d="M8 9h8M8 13h5"/></>:item.icon==='grid'?<><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>:<><path d="M20 13 11 22l-9-9V4h9z"/><circle cx="7" cy="9" r="1.5"/></>}</svg></span><span className="dashboard-stat-label">{item.label}</span></header><strong>{item.value.toLocaleString()}</strong><footer><span>{item.note}</span><i style={{'--meter':`${Math.max(8,item.value/chartMax*100)}%`} as React.CSSProperties}/></footer></article>)}</div>
    <div className="dashboard-content-grid"><section className="overview-panel"><header><div><span className="panel-kicker">CONTENT MIX</span><h2>Publication overview</h2></div><span className="panel-period">All time</span></header><div className="overview-chart"><div className="donut-wrap"><div className="donut-chart" style={{'--published':`${publishedRate * 3.6}deg`} as React.CSSProperties}><div><strong>{publishedRate}%</strong><span>published</span></div></div><div className="donut-legend"><span><i className="published"/>Published <strong>{data.published}</strong></span><span><i className="scheduled"/>Scheduled <strong>{data.scheduled ?? 0}</strong></span><span><i className="private"/>Private <strong>{data.private}</strong></span></div></div><div className="metric-bars">{stats.slice(3).map((item,index)=><div key={item.label}><header><span>{item.label}</span><strong>{item.value}</strong></header><i><b style={{'--bar-size':`${Math.max(5,item.value/chartMax*100)}%`,'--bar-index':index} as React.CSSProperties}/></i></div>)}</div></div></section>
    <section className="recent-panel modern"><header><div><span className="panel-kicker">LATEST ACTIVITY</span><h2>Recently updated</h2></div><Link to="/admin/posts">View all <span>→</span></Link></header>{data.recent_posts.length?<div className="activity-list">{data.recent_posts.map((post,index)=><article style={{'--activity-index':index} as React.CSSProperties} key={post.id}><span className="activity-marker" aria-hidden="true">{post.title.charAt(0)}</span><div><strong>{post.title}</strong><small>Updated {formatDate(post.updated_at)}</small></div><span className={`profile-status ${post.status}`}>{post.status}</span><Link aria-label={`Edit ${post.title}`} to={`/admin/posts/${post.id}/edit`}>↗</Link></article>)}</div>:<EmptyState title="No stories yet" text="Create the first story to populate the dashboard."/>}</section></div>
  </section></Layout>
}

export function AdminUsersPage() {
  const {user,loading:authLoading}=useAuth(); const toast=useToast()
  const [users,setUsers]=useState<User[]>([]); const [requests,setRequests]=useState<AdminPasswordReset[]>([])
  const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [busy,setBusy]=useState('')
  const load=()=>Promise.all([api.adminUsers(),api.adminPasswordResets()]).then(([all,resetRequests])=>{setUsers(all);setRequests(resetRequests)})
  useEffect(()=>{if(user?.role==='admin')load().catch(err=>setError(err instanceof Error?err.message:'Unable to load users')).finally(()=>setLoading(false))},[user])
  if(authLoading)return <Layout><Loading/></Layout>; if(!user)return <Navigate to="/login" replace/>; if(user.role!=='admin')return <Navigate to="/profile" replace/>
  async function resetAccount(account:User){if(!await confirmAction({title:'Reset this password?',message:`${account.name} will be signed out everywhere. Their new temporary password will be Lumina@123.`,confirmLabel:'Reset password',danger:true}))return;setBusy(account.id);setError('');try{await api.adminResetUserPassword(account.id);setRequests(current=>current.filter(item=>item.user.id!==account.id));toast(`Password reset for ${account.name}. Temporary password: Lumina@123`)}catch(err){setError(err instanceof Error?err.message:'Unable to reset password')}finally{setBusy('')}}
  const requested=new Set(requests.map(item=>item.user.id))
  return <Layout><section className="admin admin-dashboard container"><header className="admin-heading"><div><span className="eyebrow">ACCOUNT ADMINISTRATION</span><h1>Users & password requests</h1><p>Click a user to view their account information.</p></div><Link to="/admin/dashboard">← Dashboard</Link></header>{error&&<div className="admin-alert">{error}</div>}{loading?<Loading/>:<section className="comment-queue"><header><h2>All users <small>({users.length})</small></h2></header>{users.length?<div className="story-table"><div className="story-row story-table-head"><span>User</span><span>Phone</span><span>Role</span><span>Action</span></div>{users.map(account=><article className="story-row" key={account.id}><div className="story-identity">{account.avatar?<img src={account.avatar} alt=""/>:<span className="story-placeholder">{account.name[0]?.toUpperCase()??'L'}</span>}<div><Link to={`/admin/users/${account.id}`}>{account.name}</Link><small>{account.email}{account.username?` · @${account.username}`:''}</small></div></div><span>{account.phone||'—'}</span><span>{account.role}</span><div className="row-actions"><Link to={`/admin/users/${account.id}`}>View</Link><button disabled={busy===account.id} onClick={()=>void resetAccount(account)}>{busy===account.id?'Resetting…':requested.has(account.id)?'Reset request':'Reset password'}</button></div></article>)}</div>:<EmptyState title="No users found"/>}</section>}</section></Layout>
}

export function AdminUserDetailPage() {
  const { id = '' } = useParams()
  const { user, loading: authLoading } = useAuth()
  const [account, setAccount] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState('')
  const [website, setWebsite] = useState('')
  const [x, setX] = useState('')
  const [linkedin, setLinkedin] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const populateForm = (data: User) => {
    setName(data.name || '')
    setEmail(data.email || '')
    setUsername(data.username ? data.username.replace(/^@/, '') : '')
    setPhone(data.phone || '')
    setRole(data.role || 'user')
    setBio(data.bio || '')
    setAvatar(data.avatar || '')
    setWebsite(data.social_links?.website || '')
    setX(data.social_links?.x || '')
    setLinkedin(data.social_links?.linkedin || '')
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      setLoading(true)
      api.adminUser(id)
        .then(data => {
          setAccount(data)
          populateForm(data)
        })
        .catch(err => setError(err instanceof Error ? err.message : 'Unable to load user'))
        .finally(() => setLoading(false))
    }
  }, [user, id])

  if (authLoading) return <Layout><Loading /></Layout>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/profile" replace />

  if (loading) return <Layout><Loading /></Layout>
  if (error && !account) return (
    <Layout>
      <section className="admin admin-user-detail container">
        <Link to="/admin/users" className="admin-back-link">← Back to all users</Link>
        <ErrorState message={error} />
      </section>
    </Layout>
  )
  if (!account) return null

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setError('')
    try {
      const media = await api.uploadImage(file)
      setAvatar(media.url)
      toast('Avatar image uploaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('A valid email address is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: Partial<User> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim().replace(/^@/, '').toLowerCase(),
        phone: phone.trim(),
        role,
        bio: bio.trim(),
        avatar: avatar.trim(),
        social_links: {
          website: website.trim(),
          x: x.trim(),
          linkedin: linkedin.trim(),
          links: account.social_links?.links || []
        }
      }
      const updated = await api.adminUpdateUser(id, payload)
      setAccount(updated)
      populateForm(updated)
      toast(`User ${updated.name} updated successfully!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (!await confirmAction({
      title: 'Reset user password?',
      message: `${account.name} will be signed out everywhere. Their new temporary password will be Lumina@123.`,
      confirmLabel: 'Reset password',
      danger: true
    })) return
    setResettingPassword(true)
    setError('')
    try {
      await api.adminResetUserPassword(account.id)
      toast(`Password reset for ${account.name}. New password: Lumina@123`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password')
    } finally {
      setResettingPassword(false)
    }
  }

  const handleDiscard = () => {
    if (account) {
      populateForm(account)
      setError('')
      toast('Changes discarded')
    }
  }

  const formattedJoined = account.created_at
    ? new Intl.DateTimeFormat('en', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(account.created_at))
    : 'Unknown'
  const formattedUpdated = account.updated_at
    ? new Intl.DateTimeFormat('en', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(account.updated_at))
    : 'Never'

  return (
    <Layout>
      <section className="admin admin-user-detail container">
        <header className="admin-heading user-detail-header">
          <div>
            <div className="admin-header-breadcrumbs">
              <Link to="/admin/dashboard">Dashboard</Link>
              <span>/</span>
              <Link to="/admin/users">Users</Link>
              <span>/</span>
              <span>Edit user</span>
            </div>
            <h1>Edit user: {account.name}</h1>
            <p>Admin control center to manage account profile, permissions, and credentials.</p>
          </div>
          <div className="admin-header-actions">
            <Link to="/admin/users" className="button compact secondary">← All users</Link>
            {account.username && (
              <Link to={`/authors/${account.username}`} target="_blank" className="button compact secondary">
                View author page ↗
              </Link>
            )}
            <button
              type="button"
              className="button compact danger"
              disabled={resettingPassword}
              onClick={handleResetPassword}
            >
              {resettingPassword ? 'Resetting…' : 'Reset password'}
            </button>
          </div>
        </header>

        {error && <div className="admin-alert">{error}</div>}

        <form onSubmit={handleSave} className="admin-user-edit-form">
          {/* Top Hero: Avatar & Name on top */}
          <div className="admin-user-top-hero">
            <div className="admin-user-avatar-wrap">
              <div className="admin-avatar-preview">
                {avatar ? (
                  <img src={avatar} alt={name || 'User avatar'} />
                ) : (
                  <span className="admin-avatar-initial">{(name || account.name || 'U')[0]?.toUpperCase()}</span>
                )}
                <label className="admin-avatar-upload-overlay" title="Upload avatar image">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    style={{ display: 'none' }}
                  />
                  <span>{uploadingAvatar ? '…' : '📷 Change'}</span>
                </label>
              </div>
            </div>

            <div className="admin-user-hero-identity">
              <div className="admin-user-hero-title-row">
                <input
                  type="text"
                  className="admin-user-hero-name-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  required
                />
                <span className={`admin-role-badge ${role}`}>{role}</span>
              </div>
              <div className="admin-user-hero-meta">
                <span>@{username || 'no-username'}</span>
                <span>·</span>
                <span>{email}</span>
                {account.created_at && (
                  <>
                    <span>·</span>
                    <span>Joined {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(account.created_at))}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Form Sections Below Avatar & Name */}
          <div className="admin-user-edit-grid">
            {/* Column 1: Core Credentials & Identity */}
            <div className="admin-user-edit-panel">
              <h3>Account Credentials & Identity</h3>
              <p className="panel-desc">Primary login and contact identifiers.</p>

              <label className="admin-form-field">
                <span>Full Name <em>*</em></span>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Eleanor Vance"
                  maxLength={100}
                  required
                />
              </label>

              <label className="admin-form-field">
                <span>Email Address <em>*</em></span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="reader@example.com"
                  required
                />
              </label>

              <div className="admin-form-row">
                <label className="admin-form-field">
                  <span>Username</span>
                  <div className="input-with-prefix">
                    <span>@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                      placeholder="username"
                      maxLength={30}
                    />
                  </div>
                </label>

                <label className="admin-form-field">
                  <span>Phone</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+84 901 234 567"
                  />
                </label>
              </div>

              <div className="admin-form-field">
                <span>Account Role</span>
                <div className="admin-role-selector">
                  <label className={`role-pill-option ${role === 'user' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={role === 'user'}
                      onChange={() => setRole('user')}
                    />
                    <strong>User</strong>
                    <small>Standard reader & author</small>
                  </label>
                  <label className={`role-pill-option ${role === 'editor' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value="editor"
                      checked={role === 'editor'}
                      onChange={() => setRole('editor')}
                    />
                    <strong>Editor</strong>
                    <small>Editorial & moderation control</small>
                  </label>
                  <label className={`role-pill-option ${role === 'admin' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={role === 'admin'}
                      onChange={() => setRole('admin')}
                    />
                    <strong>Admin</strong>
                    <small>Full administrative control</small>
                  </label>
                </div>
              </div>
            </div>

            {/* Column 2: Profile & Socials */}
            <div className="admin-user-edit-panel">
              <h3>Author Profile & Bio</h3>
              <p className="panel-desc">Public biography, avatar URL, and web links.</p>

              <label className="admin-form-field">
                <span>Biography</span>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Write a short summary about this author..."
                  maxLength={1000}
                />
                <small className="field-hint">{bio.length}/1000 characters</small>
              </label>

              <label className="admin-form-field">
                <span>Avatar Image URL</span>
                <div className="input-with-action">
                  <input
                    type="url"
                    value={avatar}
                    onChange={e => setAvatar(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                  />
                  <button
                    type="button"
                    className="button compact secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? 'Uploading…' : 'Upload file'}
                  </button>
                </div>
              </label>

              <div className="admin-social-fields">
                <label className="admin-form-field">
                  <span>Website</span>
                  <input
                    type="url"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    placeholder="https://author.me"
                  />
                </label>

                <div className="admin-form-row">
                  <label className="admin-form-field">
                    <span>X (Twitter)</span>
                    <input
                      type="url"
                      value={x}
                      onChange={e => setX(e.target.value)}
                      placeholder="https://x.com/author"
                    />
                  </label>

                  <label className="admin-form-field">
                    <span>LinkedIn</span>
                    <input
                      type="url"
                      value={linkedin}
                      onChange={e => setLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/author"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* System Metadata Panel */}
          <div className="admin-user-metadata-panel">
            <div>
              <span className="meta-label">User ID</span>
              <code className="meta-val">{account.id}</code>
            </div>
            <div>
              <span className="meta-label">Member Since</span>
              <span className="meta-val">{formattedJoined}</span>
            </div>
            <div>
              <span className="meta-label">Last Updated</span>
              <span className="meta-val">{formattedUpdated}</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="admin-user-form-actions">
            <div className="left-actions">
              <Link to="/admin/users" className="button secondary">Cancel</Link>
              <button type="button" onClick={handleDiscard} className="button secondary">Discard changes</button>
            </div>
            <div className="right-actions">
              <button type="submit" className="button primary" disabled={saving}>
                {saving ? 'Saving changes…' : 'Save all changes'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </Layout>
  )
}

export function AdminCommentsPage() {
  const {user,loading:authLoading}=useAuth();const[comments,setComments]=useState<Comment[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const[filter,setFilter]=useState('all');const[busy,setBusy]=useState('');const toast=useToast()
  useEffect(()=>{if(user?.role==='admin')api.adminComments().then(setComments).catch(err=>setError(err instanceof Error?err.message:'Unable to load comments')).finally(()=>setLoading(false))},[user])
  if(authLoading)return <Layout><Loading/></Layout>;if(!user)return <Navigate to="/login" replace/>;if(user.role!=='admin')return <Navigate to="/profile" replace/>
  async function status(comment:Comment,next:string){if(!await confirmAction({title:`${next==='approved'?'Approve':'Reject'} comment?`,message:`This comment will be marked as ${next}.`,confirmLabel:next==='approved'?'Approve':'Reject'}))return;setBusy(comment.id);setError('');try{await api.updateCommentStatus(comment.id,next);setComments(current=>current.map(item=>item.id===comment.id?{...item,status:next}:item));toast(`Comment marked ${next}.`)}catch(err){setError(err instanceof Error?err.message:'Unable to update comment')}finally{setBusy('')}}
  async function remove(comment:Comment){if(!await confirmAction({title:'Delete comment?',message:'This comment will be permanently deleted.',confirmLabel:'Delete comment',danger:true}))return;setBusy(comment.id);try{await api.deleteAdminComment(comment.id);setComments(current=>current.filter(item=>item.id!==comment.id));toast('Comment deleted.')}catch(err){setError(err instanceof Error?err.message:'Unable to delete comment')}finally{setBusy('')}}
  const visible=filter==='all'?comments:comments.filter(comment=>comment.status===filter)
  return <Layout><section className="admin comment-moderation container"><header className="admin-heading"><div><span className="eyebrow">COMMUNITY</span><h1>Moderate comments</h1><p>Review responses before they become part of the conversation.</p></div><Link to="/admin/dashboard">← Dashboard</Link></header><div className="status-tabs">{['all','pending','approved','rejected'].map(value=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{value} ({value==='all'?comments.length:comments.filter(item=>item.status===value).length})</button>)}</div><div className="comment-view-tools"><ViewToggle targetId="comments-view" storageKey="comments"/></div>{error&&<div className="admin-alert">{error}</div>}{loading?<Loading/>:!visible.length?<EmptyState title="No comments in this queue" text="Try another moderation status."/>:<div className="comment-queue" id="comments-view">{visible.map(comment=><article key={comment.id}><header><strong>{comment.user?.name??'Reader'}</strong><span className={`profile-status ${comment.status}`}>{comment.status}</span><time>{formatDate(comment.created_at)}</time></header><p>{comment.content}</p><footer><button disabled={busy===comment.id} onClick={()=>void status(comment,'approved')}>Approve</button><button disabled={busy===comment.id} onClick={()=>void status(comment,'rejected')}>Reject</button><button className="danger" disabled={busy===comment.id} onClick={()=>void remove(comment)}>Delete</button></footer></article>)}</div>}</section></Layout>
}

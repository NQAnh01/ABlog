import type { AdminPasswordReset, AuthorPageData, Category, Comment, Dashboard, Discussion, DiscussionComment, FeatureFlag, FeatureFlags, FollowState, Media, Page, Post, PostDraft, PostDraftResponse, PostInput, PostVersion, Reaction, ReactionType, Series, SeriesInput, SocialLinks, Tag, Target, Todo, User } from '../types'

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? (import.meta.env.DEV ? 'http://localhost:8088' : '')
const API = `${API_ORIGIN}/api`
let accessToken = ''
let refreshRequest: Promise<boolean> | null = null
const MAX_CACHE_ENTRIES = 150
type CacheEntry = { expires: number; staleUntil: number; accessed: number; value?: unknown; pending?: Promise<unknown> }
const getCache = new Map<string, CacheEntry>()

type Envelope<T> = { data: T; message: string }
async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' })
  if (response.status === 401 && retry && path !== '/auth/refresh') {
    refreshRequest ??= fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' }).then(async refreshed => {
      if (!refreshed.ok) return false
      const value = await refreshed.json() as Envelope<{ access_token: string }>
      accessToken = value.data.access_token
      return true
    }).finally(() => { refreshRequest = null })
    if (await refreshRequest) {
      return request<T>(path, options, false)
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: { message: 'Something went wrong' } }))
    throw new Error(body.error?.message ?? 'Something went wrong')
  }
  if (response.status === 204) return undefined as T
  return ((await response.json()) as Envelope<T>).data
}

function trimCache() {
  if (getCache.size <= MAX_CACHE_ENTRIES) return
  const oldest = [...getCache.entries()].filter(([, entry]) => !entry.pending).sort((a, b) => a[1].accessed - b[1].accessed)
  for (const [key] of oldest.slice(0, getCache.size - MAX_CACHE_ENTRIES)) getCache.delete(key)
}

function revalidate<T>(path: string, ttl: number, staleTtl: number, previous?: CacheEntry): Promise<T> {
  const pending = request<T>(path).then(value => {
    const now = Date.now()
    getCache.set(path, { value, expires: now + ttl, staleUntil: now + ttl + staleTtl, accessed: now })
    trimCache()
    return value
  }).catch(error => {
    if (previous?.value !== undefined && previous.staleUntil > Date.now()) {
      getCache.set(path, { ...previous, pending: undefined })
    } else getCache.delete(path)
    throw error
  })
  getCache.set(path, { ...previous, expires: previous?.expires ?? 0, staleUntil: previous?.staleUntil ?? 0, accessed: Date.now(), pending })
  trimCache()
  return pending
}

function cachedGet<T>(path: string, ttl = 30_000, staleTtl = ttl * 4): Promise<T> {
  const now = Date.now()
  const cached = getCache.get(path)
  if (cached?.value !== undefined && cached.expires > now) {
    cached.accessed = now
    return Promise.resolve(cached.value as T)
  }
  if (cached?.pending) return cached.pending as Promise<T>
  if (cached?.value !== undefined && cached.staleUntil > now) {
    cached.accessed = now
    void revalidate<T>(path, ttl, staleTtl, cached).catch(() => undefined)
    return Promise.resolve(cached.value as T)
  }
  return revalidate<T>(path, ttl, staleTtl, cached)
}

function invalidateWhere(matches: (key: string) => boolean) {
  for (const key of getCache.keys()) if (matches(key)) getCache.delete(key)
}
const invalidatePublicPosts = () => invalidateWhere(key => key === '/posts' || key.startsWith('/posts?') || key.startsWith('/posts/'))
const invalidateTaxonomy = () => invalidateWhere(key => key === '/categories' || key.startsWith('/categories/') || key === '/tags' || key.startsWith('/tags/'))
const invalidateSeries = () => invalidateWhere(key => key === '/series' || key.startsWith('/series?') || key.startsWith('/series/') || key.startsWith('/posts/') && key.endsWith('/series'))
const invalidateAuthors = () => invalidateWhere(key => key.startsWith('/authors/'))

export const api = {
  setToken(value: string) { accessToken = value },
  login: (email: string, password: string) => request<{ access_token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string, interestCategoryIds: string[]) => request<{ access_token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, interest_category_ids: interestCategoryIds }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) => request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string, confirmPassword: string) => request<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password, confirm_password: confirmPassword }) }),
  me: () => request<User>('/auth/me'),
  updateProfile: (name: string, phone: string, interestCategoryIds: string[]) => request<User>('/me/profile', { method: 'PUT', body: JSON.stringify({ name, phone, interest_category_ids: interestCategoryIds }) }).then(value => { invalidateAuthors(); invalidatePublicPosts(); invalidateSeries(); return value }),
  uploadAvatar: (file: File) => { const form = new FormData(); form.append('file', file); return request<User>('/me/avatar', { method: 'POST', body: form }).then(value => { invalidateAuthors(); invalidatePublicPosts(); invalidateSeries(); return value }) },
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => request<void>('/me/password', { method: 'PUT', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }) }),
  posts: (query = '') => cachedGet<Page<Post>>(`/posts${query}`),
  post: (slug: string) => cachedGet<Post>(`/posts/${slug}`),
  prefetchPost: (slug: string) => { void cachedGet<Post>(`/posts/${slug}`, 60_000) },
  comments: (slug: string) => request<Comment[]>(`/posts/${slug}/comments`),
  comment: (slug: string, content: string, parentId = '', mentionIds: string[] = []) => request<Comment>(`/posts/${slug}/comments`, { method: 'POST', body: JSON.stringify({ content, parent_id: parentId, mention_ids: mentionIds }) }),
  reactToPost: (slug: string, type: ReactionType) => request<Reaction[]>(`/posts/${slug}/reaction`, { method:'PUT', body:JSON.stringify({type}) }).then(value=>{getCache.delete(`/posts/${slug}`);return value}),
  reactToComment: (id: string, type: ReactionType) => request<Reaction[]>(`/comments/${id}/reaction`, { method:'PUT', body:JSON.stringify({type}) }),
  pinComment: (id: string, pinned: boolean) => request<{id:string;is_pinned:boolean}>(`/comments/${id}/pin`, { method:'PUT', body:JSON.stringify({pinned}) }),
  categories: () => cachedGet<Category[]>('/categories', 300_000),
  tags: () => cachedGet<Tag[]>('/tags', 300_000),
  category: (slug: string) => cachedGet<Category>(`/categories/${slug}`, 300_000),
  tag: (slug: string) => cachedGet<Tag>(`/tags/${slug}`, 300_000),
  createCategory: (input: Pick<Category, 'name' | 'slug' | 'description'>) => request<Category>('/me/categories', { method: 'POST', body: JSON.stringify(input) }).then(value => { invalidateTaxonomy(); return value }),
  updateCategory: (id: string, input: Pick<Category, 'name' | 'slug' | 'description'>) => request<Category>(`/me/categories/${id}`, { method: 'PUT', body: JSON.stringify(input) }).then(value => { invalidateTaxonomy(); invalidatePublicPosts(); return value }),
  createTag: (input: Pick<Tag, 'name' | 'slug'>) => request<Tag>('/me/tags', { method: 'POST', body: JSON.stringify(input) }).then(value => { invalidateTaxonomy(); return value }),
  updateTag: (id: string, input: Pick<Tag, 'name' | 'slug'>) => request<Tag>(`/me/tags/${id}`, { method: 'PUT', body: JSON.stringify(input) }).then(value => { invalidateTaxonomy(); invalidatePublicPosts(); return value }),
  deleteTag: (id: string) => request<void>(`/me/tags/${id}`, { method: 'DELETE' }).then(value => { invalidateTaxonomy(); invalidatePublicPosts(); return value }),
  myPosts: (query = '') => request<Page<Post>>(`/me/posts${query}`),
  myPost: (id: string) => request<Post>(`/me/posts/${id}`),
  postVersions: (id: string) => request<PostVersion[]>(`/me/posts/${id}/versions`),
  postDraft: (id: string) => request<PostDraftResponse | undefined>(`/me/posts/${id}/draft`),
  savePostDraft: (id: string, draft: PostDraft) => request<{ accepted: boolean; sequence: number; updated_at: string }>(`/me/posts/${id}/draft`, { method: 'PUT', body: JSON.stringify(draft) }),
  deletePostDraft: (id: string) => request<void>(`/me/posts/${id}/draft`, { method: 'DELETE' }),
  createPost: (input: PostInput) => request<Post>('/me/posts', { method: 'POST', body: JSON.stringify(input) }).then(value => { invalidatePublicPosts(); invalidateAuthors(); invalidateSeries(); return value }),
  updatePost: (id: string, input: PostInput) => request<Post>(`/me/posts/${id}`, { method: 'PUT', body: JSON.stringify(input) }).then(value => { invalidatePublicPosts(); invalidateAuthors(); invalidateSeries(); return value }),
  deletePost: (id: string) => request<void>(`/me/posts/${id}`, { method: 'DELETE' }).then(value => { invalidatePublicPosts(); invalidateAuthors(); invalidateSeries(); return value }),
  bulkPosts: (action: 'publish' | 'unpublish' | 'delete', ids: string[]) => request<{ affected: number; action: string }>('/me/posts/bulk', { method: 'POST', body: JSON.stringify({ action, ids }) }).then(value => { invalidatePublicPosts(); invalidateAuthors(); invalidateSeries(); return value }),
  exportData: async () => {
    const headers = new Headers()
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    const res = await fetch(`${API}/me/export`, { headers, credentials: 'include' })
    if (!res.ok) throw new Error('Failed to export account data')
    const blob = await res.blob()
    const contentDisposition = res.headers.get('Content-Disposition')
    let filename = 'lumina-data-export.json'
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";]+)"?/)
      if (match?.[1]) filename = match[1]
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
  featureFlags: () => cachedGet<FeatureFlags>('/features', 30_000),
  adminFeatureFlags: () => request<FeatureFlag[]>('/admin/features'),
  adminUpdateFeatureFlag: (key: string, enabled: boolean) => request<FeatureFlag>(`/admin/features/${key}`, { method: 'PUT', body: JSON.stringify({ enabled }) }).then(value => { getCache.delete('/features'); return value }),
  uploadImage: (file: File) => { const form = new FormData(); form.append('file', file); return request<Media>('/me/uploads', { method: 'POST', body: form }) },
  dashboard: () => request<Dashboard>('/admin/dashboard'),
  adminUsers: () => request<User[]>('/admin/users'),
  adminUser: (id: string) => request<User>(`/admin/users/${id}`),
  adminUpdateUser: (id: string, data: Partial<User>) => request<User>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminPasswordResets: () => request<AdminPasswordReset[]>('/admin/password-resets'),
  adminResetUserPassword: (id:string) => request<{password:string}>(`/admin/users/${id}/reset-password`, { method:'PUT' }),
  adminComments: () => request<Comment[]>('/admin/comments'),
  updateCommentStatus: (id: string, status: string) => request<{ id: string; status: string }>(`/admin/comments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteAdminComment: (id: string) => request<void>(`/admin/comments/${id}`, { method: 'DELETE' }),
  bookmarks: () => request<{ post_ids: string[]; posts: Post[] }>('/me/bookmarks'),
  addBookmark: (postId: string) => request<void>(`/me/bookmarks/${postId}`, { method: 'PUT' }),
  removeBookmark: (postId: string) => request<void>(`/me/bookmarks/${postId}`, { method: 'DELETE' }),
  series: (featured=false) => cachedGet<Series[]>(`/series${featured?'?featured=true':''}`,60_000),
  seriesBySlug: (slug:string) => cachedGet<Series>(`/series/${slug}`,60_000),
  postSeries: (slug:string) => request<Series|undefined>(`/posts/${slug}/series`),
  mySeries: () => request<Series[]>('/me/series'),
  mySeriesById: (id:string) => request<Series>(`/me/series/${id}`),
  saveSeries: (input:SeriesInput,id='') => request<Series>(`/me/series${id?`/${id}`:''}`,{method:id?'PUT':'POST',body:JSON.stringify(input)}).then(value=>{invalidateSeries();invalidateAuthors();return value}),
  deleteSeries: (id:string) => request<void>(`/me/series/${id}`,{method:'DELETE'}).then(value=>{invalidateSeries();invalidateAuthors();return value}),
  setSeriesPosts: (id:string,postIds:string[]) => request<void>(`/me/series/${id}/posts`,{method:'PUT',body:JSON.stringify({post_ids:postIds})}).then(value=>{invalidateSeries();invalidateAuthors();return value}),
  author: (username:string) => cachedGet<AuthorPageData>(`/authors/${encodeURIComponent(username)}`,30_000),
  authorFollow: (username:string) => request<FollowState>(`/authors/${encodeURIComponent(username)}/follow`),
  followAuthor: (authorId:string) => request<FollowState>(`/me/authors/${authorId}/follow`,{method:'PUT'}).then(value=>{invalidateAuthors();return value}),
  unfollowAuthor: (authorId:string) => request<FollowState>(`/me/authors/${authorId}/follow`,{method:'DELETE'}).then(value=>{invalidateAuthors();return value}),
  updateAuthorProfile: (bio:string,socialLinks:SocialLinks) => request<User>('/me/author-profile',{method:'PUT',body:JSON.stringify({bio,social_links:socialLinks})}).then(value=>{invalidateAuthors();invalidatePublicPosts();return value}),
  recommendations: (postSlug:string,recent:string[]) => request<Post[]>(`/recommendations?post=${encodeURIComponent(postSlug)}&exclude=${encodeURIComponent(recent.join(','))}`),
  personalRecommendations: (recent:string[]) => request<Post[]>(`/me/recommendations?exclude=${encodeURIComponent(recent.join(','))}`),
  todos: (query='') => request<Page<Todo>>(`/me/todos${query}`),
  targets: (query='') => request<Target[]>(`/me/targets${query}`),
  createTarget: (title:string,description:string,dueDate:string) => request<Target>('/me/targets',{method:'POST',body:JSON.stringify({title,description,due_date:dueDate})}),
  updateTarget: (target:Pick<Target,'id'|'title'|'description'|'due_date'>) => request<void>(`/me/targets/${target.id}`,{method:'PUT',body:JSON.stringify(target)}),
  shareTarget: (id:string,email:string) => request<{shared:boolean}>(`/me/targets/${id}/share`,{method:'POST',body:JSON.stringify({email})}),
  deleteTarget: (id:string) => request<void>(`/me/targets/${id}`,{method:'DELETE'}),
  createTargetTodo: (targetId:string,title:string,notes:string) => request<Todo>(`/me/targets/${targetId}/todos`,{method:'POST',body:JSON.stringify({title,notes})}),
  createTodo: (title:string,notes:string) => request<Todo>('/me/todos',{method:'POST',body:JSON.stringify({title,notes})}),
  updateTodo: (todo:Pick<Todo,'id'|'title'|'notes'|'completed'>) => request<Todo>(`/me/todos/${todo.id}`,{method:'PUT',body:JSON.stringify(todo)}),
  checkTodo: (id:string,completed:boolean) => request<Todo>(`/me/todos/${id}/check`,{method:'PUT',body:JSON.stringify({completed})}),
  deleteTodo: (id:string) => request<void>(`/me/todos/${id}`,{method:'DELETE'}),
  discussions: (query='') => request<Page<Discussion>>(`/discussions${query}`),
  discussion: (id:string) => request<Discussion>(`/discussions/${id}`),
  createDiscussion: (title:string,content:string) => request<Discussion>('/discussions',{method:'POST',body:JSON.stringify({title,content})}),
  commentDiscussion: (id:string,content:string) => request<DiscussionComment>(`/discussions/${id}/comments`,{method:'POST',body:JSON.stringify({content})}),
  toggleDiscussionInterest: (id:string) => request<{interested:boolean;interest_count:number}>(`/discussions/${id}/interested`,{method:'PUT'}),
}

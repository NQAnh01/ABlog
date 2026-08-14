import type { Category, Comment, Media, Page, Post, PostInput, Tag, User } from '../types'

const API = '/api'
let accessToken = ''

type Envelope<T> = { data: T; message: string }
async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' })
  if (response.status === 401 && retry && path !== '/auth/refresh') {
    const refreshed = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
    if (refreshed.ok) {
      const value = await refreshed.json() as Envelope<{ access_token: string }>
      accessToken = value.data.access_token
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

export const api = {
  setToken(value: string) { accessToken = value },
  login: (email: string, password: string) => request<{ access_token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => request<{ access_token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<User>('/auth/me'),
  updateProfile: (name: string, phone: string) => request<User>('/me/profile', { method: 'PUT', body: JSON.stringify({ name, phone }) }),
  uploadAvatar: (file: File) => { const form = new FormData(); form.append('file', file); return request<User>('/me/avatar', { method: 'POST', body: form }) },
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => request<void>('/me/password', { method: 'PUT', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }) }),
  posts: (query = '') => request<Page<Post>>(`/posts${query}`),
  post: (slug: string) => request<Post>(`/posts/${slug}`),
  comments: (slug: string) => request<Comment[]>(`/posts/${slug}/comments`),
  comment: (slug: string, content: string) => request<Comment>(`/posts/${slug}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  categories: () => request<Category[]>('/categories'),
  tags: () => request<Tag[]>('/tags'),
  createCategory: (input: Pick<Category, 'name' | 'slug' | 'description'>) => request<Category>('/me/categories', { method: 'POST', body: JSON.stringify(input) }),
  updateCategory: (id: string, input: Pick<Category, 'name' | 'slug' | 'description'>) => request<Category>(`/me/categories/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  createTag: (input: Pick<Tag, 'name' | 'slug'>) => request<Tag>('/me/tags', { method: 'POST', body: JSON.stringify(input) }),
  updateTag: (id: string, input: Pick<Tag, 'name' | 'slug'>) => request<Tag>(`/me/tags/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  myPosts: (query = '') => request<Page<Post>>(`/me/posts${query}`),
  myPost: (id: string) => request<Post>(`/me/posts/${id}`),
  createPost: (input: PostInput) => request<Post>('/me/posts', { method: 'POST', body: JSON.stringify(input) }),
  updatePost: (id: string, input: PostInput) => request<Post>(`/me/posts/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deletePost: (id: string) => request<void>(`/me/posts/${id}`, { method: 'DELETE' }),
  uploadImage: (file: File) => { const form = new FormData(); form.append('file', file); return request<Media>('/me/uploads', { method: 'POST', body: form }) },
}

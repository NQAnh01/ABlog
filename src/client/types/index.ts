export type User = { id: string; email: string; name: string; avatar?: string; phone?: string; role: 'user' | 'admin' }
export type Media = { key: string; url: string }
export type Category = { id: string; name: string; slug: string; description?: string }
export type Tag = { id: string; name: string; slug: string }
export type Post = {
  id: string; title: string; slug: string; excerpt: string; content: string; thumbnail?: Media;
  author_id?: string; category_ids?: string[]; tag_ids?: string[]; author?: User; categories?: Category[]; tags?: Tag[];
  status: 'private' | 'public'; published_at?: string; created_at?: string; updated_at?: string;
}
export type PostInput = Pick<Post, 'title' | 'slug' | 'excerpt' | 'content' | 'status'> & {
  thumbnail?: Media; category_ids: string[]; tag_ids: string[]
}
export type Comment = { id: string; content: string; status: string; user?: User; created_at: string }
export type Page<T> = { items: T[]; page: number; limit: number; total: number }
export type PostVersion = { id: string; post_id: string; number: number; snapshot: Post; created_at: string }
export type Dashboard = { posts: number; published: number; private: number; comments: number; categories: number; tags: number; recent_posts: Post[] }

export type SocialLinks = { website?:string; x?:string; linkedin?:string }
export type User = { id: string; email: string; name: string; avatar?: string; phone?: string; username?:string; bio?:string; social_links?:SocialLinks; role: 'user' | 'admin' }
export type Media = { key: string; url: string }
export type Category = { id: string; name: string; slug: string; description?: string }
export type Tag = { id: string; name: string; slug: string }
export type Post = {
  id: string; title: string; slug: string; excerpt: string; content: string; thumbnail?: Media;
  author_id?: string; category_ids?: string[]; tag_ids?: string[]; author?: User; categories?: Category[]; tags?: Tag[];
  status: 'private' | 'public'; is_featured?: boolean; is_pinned_on_profile?:boolean; reactions?: Reaction[]; published_at?: string; created_at?: string; updated_at?: string;
}
export type PostInput = Pick<Post, 'title' | 'slug' | 'excerpt' | 'content' | 'status'> & {
  thumbnail?: Media; category_ids: string[]; tag_ids: string[]; is_featured?: boolean; is_pinned_on_profile?:boolean
}
export type ReactionType = 'insightful' | 'beautiful' | 'useful'
export type Reaction = { user_id: string; type: ReactionType }
export type Comment = { id: string; post_id?: string; user_id?: string; content: string; status: string; user?: User; created_at: string; parent_id?: string; mention_ids?: string[]; reactions?: Reaction[]; is_pinned?: boolean }
export type Page<T> = { items: T[]; page: number; limit: number; total: number }
export type PostVersion = { id: string; post_id: string; number: number; snapshot: Post; created_at: string }
export type PostDraft = PostInput & { sequence: number; updated_at: string }
export type PostDraftResponse = { draft: PostDraft; newer: boolean }
export type Dashboard = { posts: number; published: number; private: number; comments: number; categories: number; tags: number; recent_posts: Post[] }
export type Series = { id:string;title:string;slug:string;description:string;cover_image?:Media;author_id:string;author?:User;status:'draft'|'published';is_featured?:boolean;created_at:string;updated_at?:string;posts?:Post[] }
export type SeriesInput = Pick<Series,'title'|'description'|'cover_image'|'status'|'is_featured'>
export type AuthorPageData = { author:User;posts:Post[];series:Series[];post_count:number;follower_count:number }
export type FollowState = { following:boolean;follower_count:number }

export type SocialLink = { name:string;url:string }
export type SocialLinks = { website?:string;x?:string;linkedin?:string;links?:SocialLink[] }
export type PublicUser = { id:string;username?:string;name:string;avatar?:string;bio?:string;social_links?:SocialLinks }
export type UserRole = 'user' | 'editor' | 'admin'
export type User = PublicUser & { email:string;phone?:string;role:UserRole;interest_category_ids?:string[];created_at?:string;updated_at?:string }
export type FeatureFlag = { key: string; enabled: boolean; description: string; updated_at?: string }
export type FeatureFlags = Record<string, boolean>
export type Media = { key: string; url: string }
export type Category = { id: string; name: string; slug: string; description?: string }
export type Tag = { id: string; name: string; slug: string }
export type Post = {
  id: string; title: string; slug: string; excerpt: string; content: string; thumbnail?: Media;
  author_id?: string; category_ids?: string[]; tag_ids?: string[]; author?: PublicUser; categories?: Category[]; tags?: Tag[];
  status: 'private' | 'public' | 'scheduled'; is_featured?: boolean; is_pinned_on_profile?:boolean; reactions?: Reaction[]; published_at?: string; created_at?: string; updated_at?: string;
}
export type PostInput = Pick<Post, 'title' | 'slug' | 'excerpt' | 'content' | 'status' | 'published_at'> & {
  thumbnail?: Media; category_ids: string[]; tag_ids: string[]; is_featured?: boolean; is_pinned_on_profile?:boolean
}
export type ReactionType = 'insightful' | 'beautiful' | 'useful'
export type Reaction = { user_id: string; type: ReactionType }
export type Comment = { id: string; post_id?: string; user_id?: string; content: string; status: string; user?: PublicUser; created_at: string; parent_id?: string; mention_ids?: string[]; reactions?: Reaction[]; is_pinned?: boolean }
export type Page<T> = { items: T[]; page: number; limit: number; total: number }
export type PostVersion = { id: string; post_id: string; number: number; snapshot: Post; created_at: string }
export type PostDraft = PostInput & { sequence: number; updated_at: string }
export type PostDraftResponse = { draft: PostDraft; newer: boolean }
export type Dashboard = { posts: number; published: number; private: number; scheduled?: number; comments: number; categories: number; tags: number; recent_posts: Post[] }
export type AdminPasswordReset = { id:string; user:User; created_at:string; expires_at:string }
export type Series = { id:string;title:string;slug:string;description:string;cover_image?:Media;author_id:string;author?:PublicUser;status:'draft'|'published';is_featured?:boolean;created_at:string;updated_at?:string;posts?:Post[] }
export type SeriesInput = Pick<Series,'title'|'description'|'cover_image'|'status'|'is_featured'>
export type AuthorPageData = { author:PublicUser;posts:Post[];series:Series[];post_count:number;follower_count:number }
export type FollowState = { following:boolean;follower_count:number }
export type Todo = { id:string;target_id?:string;title:string;notes?:string;completed:boolean;created_at:string;updated_at:string }
export type Target = { id:string;title:string;description?:string;due_date:string;created_at:string;updated_at:string;todos:Todo[];can_edit:boolean;is_shared:boolean }
export type DiscussionComment = { id:string;user_id:string;content:string;created_at:string;user?:PublicUser }
export type Discussion = { id:string;author_id:string;title:string;content:string;author?:PublicUser;comments?:DiscussionComment[];interested:boolean;interest_count:number;comment_count:number;created_at:string;updated_at:string }

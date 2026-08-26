import type { Post } from './types'
export type OfflineArticle={id:string;slug:string;title:string;author:string;imageUrl?:string;pageUrl:string;apiUrl:string;cachedAt:number}
const apiOrigin=import.meta.env.VITE_API_ORIGIN??(import.meta.env.DEV?'http://localhost:8088':'')
async function worker(){if(!('serviceWorker'in navigator))return null;return(await navigator.serviceWorker.ready).active}
export async function cachePostOffline(post:Post){const active=await worker();active?.postMessage({type:'CACHE_ARTICLE',article:{id:post.id,slug:post.slug,title:post.title,author:post.author?.name??'Lumina',imageUrl:post.thumbnail?.url,pageUrl:`/blog/${post.slug}`,apiUrl:`${apiOrigin}/api/posts/${encodeURIComponent(post.slug)}`}})}
function message<T>(payload:unknown){return new Promise<T>(async resolve=>{const active=await worker();if(!active){resolve(undefined as T);return}const channel=new MessageChannel();channel.port1.onmessage=event=>resolve(event.data as T);active.postMessage(payload,[channel.port2])})}
export async function offlineArticles(){return(await message<{items:OfflineArticle[]}>({type:'LIST_OFFLINE_ARTICLES'}))?.items??[]}
export async function removeOfflineArticle(id:string){await message({type:'REMOVE_OFFLINE_ARTICLE',id})}

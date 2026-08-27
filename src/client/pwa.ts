import type { Post } from './types'
export type OfflineArticle={id:string;slug:string;title:string;author:string;imageUrl?:string;pageUrl:string;apiUrl:string;cachedAt:number}
const apiOrigin=import.meta.env.VITE_API_ORIGIN??(import.meta.env.DEV?'http://localhost:8088':'')
async function worker(){
  if(!('serviceWorker'in navigator)||!import.meta.env.PROD)return null
  const registration=await Promise.race([navigator.serviceWorker.ready,new Promise<null>(resolve=>window.setTimeout(()=>resolve(null),2500))])
  return registration?.active??null
}
async function message<T>(payload:unknown){
  const active=await worker();if(!active)return undefined as T
  return new Promise<T|undefined>(resolve=>{const channel=new MessageChannel();const timeout=window.setTimeout(()=>resolve(undefined),3000);channel.port1.onmessage=event=>{window.clearTimeout(timeout);resolve(event.data as T)};active.postMessage(payload,[channel.port2])}) as Promise<T>
}
export async function cachePostOffline(post:Post){return Boolean((await message<{ok:boolean}>({type:'CACHE_ARTICLE',article:{id:post.id,slug:post.slug,title:post.title,author:post.author?.name??'Lumina',imageUrl:post.thumbnail?.url,pageUrl:`/blog/${post.slug}`,apiUrl:`${apiOrigin}/api/posts/${encodeURIComponent(post.slug)}`}}))?.ok)}
export async function offlineArticles(){return(await message<{items:OfflineArticle[]}>({type:'LIST_OFFLINE_ARTICLES'}))?.items??[]}
export async function removeOfflineArticle(id:string){await message({type:'REMOVE_OFFLINE_ARTICLE',id})}
export function offlineAvailable(){return import.meta.env.PROD&&'serviceWorker'in navigator}

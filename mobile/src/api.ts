import * as SecureStore from 'expo-secure-store'
import {Platform} from 'react-native'
import type{AuthResult,Capture,CaptureKind,Page,Post,User}from'./types'

const rawBase=process.env.EXPO_PUBLIC_API_URL??'http://10.0.2.2:8080/api'
export const API_BASE=rawBase.replace(/\/$/,'')
const ACCESS='lumina.mobile.access',REFRESH='lumina.mobile.refresh'
type Envelope<T>={data:T;message:string}
let accessToken=''
const tokenStore={
 async get(key:string){return Platform.OS==='web'?(globalThis.localStorage?.getItem(key)??null):SecureStore.getItemAsync(key)},
 async set(key:string,value:string){if(Platform.OS==='web'){globalThis.localStorage?.setItem(key,value);return}await SecureStore.setItemAsync(key,value)},
 async remove(key:string){if(Platform.OS==='web'){globalThis.localStorage?.removeItem(key);return}await SecureStore.deleteItemAsync(key)},
}

async function persist(result:AuthResult){accessToken=result.access_token;await Promise.all([tokenStore.set(ACCESS,result.access_token),tokenStore.set(REFRESH,result.refresh_token)])}
async function refresh(){const token=await tokenStore.get(REFRESH);if(!token)return false
 try{const response=await fetch(`${API_BASE}/auth/refresh`,{method:'POST',headers:{'Content-Type':'application/json','X-Lumina-Client':'mobile'},body:JSON.stringify({refresh_token:token})});if(!response.ok)return false;const body=await response.json() as Envelope<AuthResult>;await persist(body.data);return true}catch{return false}}
async function request<T>(path:string,options:RequestInit={},retry=true):Promise<T>{
 const headers=new Headers(options.headers);headers.set('Content-Type','application/json');headers.set('X-Lumina-Client','mobile');if(accessToken)headers.set('Authorization',`Bearer ${accessToken}`)
 const response=await fetch(`${API_BASE}${path}`,{...options,headers})
 if(response.status===401&&retry&&await refresh())return request<T>(path,options,false)
 if(!response.ok){const value=await response.json().catch(()=>({error:{message:'Không thể kết nối tới Lumina.'}}));throw new Error(value.error?.message??'Không thể kết nối tới Lumina.')}
 if(response.status===204)return undefined as T
 return ((await response.json())as Envelope<T>).data
}
export const api={
 async restore(){accessToken=await tokenStore.get(ACCESS)??'';if(!accessToken&&!await refresh())return null;try{return await request<User>('/auth/me')}catch{return null}},
 async login(email:string,password:string){const result=await request<AuthResult>('/auth/login',{method:'POST',body:JSON.stringify({email,password})},false);await persist(result);return result.user},
 async logout(){const token=await tokenStore.get(REFRESH);try{await request<void>('/auth/logout',{method:'POST',body:JSON.stringify({refresh_token:token})},false)}finally{accessToken='';await Promise.all([tokenStore.remove(ACCESS),tokenStore.remove(REFRESH)])}},
 posts:(page=1)=>request<Page<Post>>(`/posts?page=${page}&limit=20`),post:(slug:string)=>request<Post>(`/posts/${encodeURIComponent(slug)}`),
 bookmarks:()=>request<{post_ids:string[];posts:Post[]}>('/me/bookmarks'),addBookmark:(id:string)=>request<void>(`/me/bookmarks/${id}`,{method:'PUT'}),removeBookmark:(id:string)=>request<void>(`/me/bookmarks/${id}`,{method:'DELETE'}),
 captures:()=>request<Capture[]>('/me/captures'),createCapture:(content:string,kind:CaptureKind)=>request<Capture>('/me/captures',{method:'POST',body:JSON.stringify({content,kind})}),
}
export function mediaURL(value?:string){if(!value)return'';if(/^https?:\/\//.test(value))return value;return `${API_BASE.replace(/\/api$/,'')}${value.startsWith('/')?'':'/'}${value}`}

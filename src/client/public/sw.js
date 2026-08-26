const VERSION='lumina-v1'
const SHELL=`${VERSION}-shell`,ASSETS=`${VERSION}-assets`,ARTICLES=`${VERSION}-articles`
const META_URL='/__lumina_offline_articles__',MAX_ARTICLES=12,MAX_ASSETS=80
const SHELL_FILES=['/','/manifest.json','/offline.html','/icons/icon-192.png','/icons/icon-512.png']

self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(SHELL_FILES))))
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('lumina-')&&!name.startsWith(VERSION))await caches.delete(name);await self.clients.claim()})()))

async function trim(cacheName,max){const cache=await caches.open(cacheName),keys=await cache.keys();while(keys.length>max)await cache.delete(keys.shift())}
function isStatic(request){return ['style','script','font','image'].includes(request.destination)||/\/assets\/.*\.[a-f0-9_-]+\.(js|css)$/i.test(new URL(request.url).pathname)}
async function staticAsset(request){const cache=await caches.open(ASSETS),cached=await cache.match(request);if(cached)return cached;const response=await fetch(request);if(response.ok||response.type==='opaque'){await cache.put(request,response.clone());await trim(ASSETS,MAX_ASSETS)}return response}
async function navigation(request){try{return await fetch(request)}catch{const cache=await caches.open(SHELL);return await cache.match('/')||await cache.match('/offline.html')}}
async function articleAPI(request){try{return await fetch(request)}catch{return await (await caches.open(ARTICLES)).match(request)||new Response(JSON.stringify({error:{message:'Bài viết này chưa được lưu để đọc offline.'}}),{status:503,headers:{'Content-Type':'application/json'}})}}

self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(request.mode==='navigate'){event.respondWith(navigation(request));return}if(url.pathname.startsWith('/api/posts/')&&!url.pathname.endsWith('/comments')){event.respondWith(articleAPI(request));return}if(isStatic(request)){event.respondWith(staticAsset(request))}})

async function readMeta(){const cache=await caches.open(ARTICLES),response=await cache.match(META_URL);return response?response.json():[]}
async function writeMeta(values){const cache=await caches.open(ARTICLES);await cache.put(META_URL,new Response(JSON.stringify(values),{headers:{'Content-Type':'application/json'}}))}
async function cacheArticle(article){const cache=await caches.open(ARTICLES);const apiRequest=new Request(article.apiUrl,{credentials:'omit'});try{const response=await fetch(apiRequest);if(response.ok)await cache.put(apiRequest,response.clone())}catch{}if(article.imageUrl){try{const image=await fetch(article.imageUrl,{mode:'cors'});if(image.ok)await cache.put(article.imageUrl,image.clone())}catch{}}let values=(await readMeta()).filter(item=>item.id!==article.id);values.unshift({...article,cachedAt:Date.now()});for(const removed of values.slice(MAX_ARTICLES)){await cache.delete(removed.apiUrl);if(removed.imageUrl)await cache.delete(removed.imageUrl)}await writeMeta(values.slice(0,MAX_ARTICLES))}
async function removeArticle(id){const cache=await caches.open(ARTICLES),values=await readMeta(),target=values.find(item=>item.id===id);if(target){await cache.delete(target.apiUrl);if(target.imageUrl)await cache.delete(target.imageUrl)}await writeMeta(values.filter(item=>item.id!==id))}
self.addEventListener('message',event=>{const message=event.data??{};if(message.type==='SKIP_WAITING'){self.skipWaiting();return}if(message.type==='CACHE_ARTICLE')event.waitUntil(cacheArticle(message.article));if(message.type==='REMOVE_OFFLINE_ARTICLE')event.waitUntil(removeArticle(message.id).then(()=>event.ports[0]?.postMessage({ok:true})));if(message.type==='LIST_OFFLINE_ARTICLES')event.waitUntil(readMeta().then(items=>event.ports[0]?.postMessage({items})))})

const key='lumina-recently-read'
export function recentPostIds(){try{const value=JSON.parse(localStorage.getItem(key)??'[]');return Array.isArray(value)?value.filter(item=>typeof item==='string').slice(0,20):[]}catch{return []}}
export function rememberPost(id:string){const next=[id,...recentPostIds().filter(value=>value!==id)].slice(0,20);localStorage.setItem(key,JSON.stringify(next))}

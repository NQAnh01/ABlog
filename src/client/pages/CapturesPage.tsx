import { useCallback,useEffect,useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Lightbulb,Plus,Quote,SquareCheckBig,Trash2 } from 'lucide-react'
import { EmptyState,Layout,Loading } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import { captureOpenEvent,pendingCaptures,removePendingCapture,syncPendingCaptures } from '../quick-capture'
import type { Capture } from '../types'

const icons={idea:Lightbulb,quote:Quote,task:SquareCheckBig}
export default function CapturesPage(){
 const{user,loading:authLoading}=useAuth();const[items,setItems]=useState<Capture[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const load=useCallback(async()=>{if(!user)return;setLoading(true);try{await syncPendingCaptures();const remote=await api.captures();setItems([...pendingCaptures(),...remote])}catch(err){setItems(pendingCaptures());setError(err instanceof Error?err.message:'Không thể tải captures')}finally{setLoading(false)}},[user])
 useEffect(()=>{void load();const changed=()=>void load();window.addEventListener('lumina:captures-changed',changed);window.addEventListener('online',changed);return()=>{window.removeEventListener('lumina:captures-changed',changed);window.removeEventListener('online',changed)}},[load])
 if(authLoading)return <Layout><Loading/></Layout>;if(!user)return <Navigate to="/login" replace/>
 async function remove(item:Capture){try{if(item.pending)removePendingCapture(item.id);else await api.deleteCapture(item.id);setItems(current=>current.filter(value=>value.id!==item.id))}catch(err){setError(err instanceof Error?err.message:'Không thể xóa capture')}}
 return <Layout dark><section className="captures-page container"><header><div><span className="eyebrow">YOUR IDEA INBOX</span><h1>Captures</h1><p>Nơi mọi ý tưởng bắt đầu — ngắn, nhanh và chưa cần hoàn hảo.</p></div><button className="button" onClick={()=>window.dispatchEvent(new Event(captureOpenEvent))}><Plus/>Ghi nhanh</button></header>{error&&<div className="admin-alert">{error}<button onClick={()=>setError('')}>×</button></div>}{loading?<Loading/>:items.length?<div className="capture-grid">{items.map(item=>{const Icon=icons[item.kind]??Lightbulb;return <article key={item.id}><header><span><Icon/>{item.kind}</span>{item.pending&&<b>Chờ đồng bộ</b>}</header><p>{item.content}</p><footer><time>{new Intl.DateTimeFormat('vi',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at))}</time><button onClick={()=>void remove(item)} aria-label="Xóa capture"><Trash2/></button></footer></article>})}</div>:<EmptyState title="Chưa có capture nào" text="Chạm Ghi nhanh để giữ lại ý tưởng đầu tiên của bạn."/>}</section></Layout>
}

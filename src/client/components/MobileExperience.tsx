import { useEffect,useRef,useState,type FormEvent } from 'react'
import { NavLink,useLocation,useNavigate } from 'react-router-dom'
import { Bookmark,Compass,Home,Lightbulb,PenLine,Quote,Send,SquareCheckBig,X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePWA } from '../hooks/usePWA'
import { useToast } from '../hooks/useToast'
import { api } from '../services/api'
import type { CaptureKind } from '../types'
import { captureOpenEvent,savePendingCapture,syncPendingCaptures } from '../quick-capture'

const kinds:{value:CaptureKind;label:string;icon:typeof Lightbulb}[]=[
  {value:'idea',label:'Ý tưởng',icon:Lightbulb},{value:'quote',label:'Trích dẫn',icon:Quote},{value:'task',label:'Việc cần làm',icon:SquareCheckBig},
]

export function MobileExperience(){
  const{user}=useAuth();const{online}=usePWA();const toast=useToast();const navigate=useNavigate();const location=useLocation()
  const[open,setOpen]=useState(false),[content,setContent]=useState(''),[kind,setKind]=useState<CaptureKind>('idea'),[saving,setSaving]=useState(false)
  const input=useRef<HTMLTextAreaElement>(null)
  useEffect(()=>{const show=()=>setOpen(true);window.addEventListener(captureOpenEvent,show);if(new URLSearchParams(location.search).get('capture')==='1')setOpen(true);return()=>window.removeEventListener(captureOpenEvent,show)},[location.search])
  useEffect(()=>{if(open)window.setTimeout(()=>input.current?.focus(),80)},[open])
  useEffect(()=>{if(user&&online)void syncPendingCaptures().then(count=>{if(count)toast(`Đã đồng bộ ${count} ghi chú nhanh.`)})},[user,online,toast])
  useEffect(()=>setOpen(false),[location.pathname])
  async function save(event:FormEvent){event.preventDefault();const value=content.trim();if(!value)return;setSaving(true)
    try{
      if(user&&online)await api.createCapture(value,kind);else savePendingCapture(value,kind)
      setContent('');setKind('idea');setOpen(false);toast(user&&online?'Đã lưu vào Captures.':'Đã lưu trên thiết bị — sẽ đồng bộ khi có mạng.')
    }catch{savePendingCapture(value,kind);setContent('');setOpen(false);toast('Đã lưu an toàn trên thiết bị.')}
    finally{setSaving(false)}
  }
  function openCapture(){if(!user&&!online){setOpen(true);return}setOpen(true)}
  const hidden=/^\/blog\/(new|manage\/[^/]+\/edit)/.test(location.pathname)
  return <>
    {!hidden&&<nav className="mobile-bottom-nav" aria-label="Điều hướng chính">
      <NavLink to="/" end><Home/><span>Home</span></NavLink>
      <NavLink to="/blog" end><Compass/><span>Khám phá</span></NavLink>
      <button type="button" className="capture-launch" onClick={openCapture} aria-label="Ghi nhanh"><span><PenLine/></span><small>Ghi nhanh</small></button>
      <NavLink to={user?'/personal/reading-list':'/login'}><Bookmark/><span>Đã lưu</span></NavLink>
      <NavLink to={user?'/personal/captures':'/login'}><Lightbulb/><span>Captures</span></NavLink>
    </nav>}
    {open&&<div className="capture-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
      <form className="capture-sheet" role="dialog" aria-modal="true" aria-labelledby="capture-title" onSubmit={save}>
        <header><div><span>QUICK CAPTURE</span><h2 id="capture-title">Đừng để ý tưởng trôi qua.</h2></div><button type="button" onClick={()=>setOpen(false)} aria-label="Đóng"><X/></button></header>
        <div className="capture-kinds">{kinds.map(({value,label,icon:Icon})=><button type="button" key={value} className={kind===value?'active':''} onClick={()=>setKind(value)}><Icon/>{label}</button>)}</div>
        <textarea ref={input} value={content} onChange={event=>setContent(event.target.value)} maxLength={2000} placeholder="Bạn đang nghĩ gì?" aria-label="Nội dung ghi nhanh"/>
        <footer><small>{content.length}/2000 {!online&&'· Offline'}</small><button className="button" disabled={!content.trim()||saving}>{saving?'Đang lưu…':<><Send/>Lưu capture</>}</button></footer>
        {!user&&<button className="capture-signin" type="button" onClick={()=>{setOpen(false);navigate('/login')}}>Đăng nhập để đồng bộ giữa các thiết bị</button>}
      </form>
    </div>}
  </>
}

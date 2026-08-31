import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

type ConfirmOptions={title?:string;message:string;confirmLabel?:string;danger?:boolean}
type Pending=ConfirmOptions&{resolve:(value:boolean)=>void}
const eventName='lumina:confirm'

export function confirmAction(options:ConfirmOptions){
  return new Promise<boolean>(resolve=>window.dispatchEvent(new CustomEvent<Pending>(eventName,{detail:{...options,resolve}})))
}

export function ConfirmModal(){
  const[pending,setPending]=useState<Pending|null>(null);const confirmRef=useRef<HTMLButtonElement>(null)
  useEffect(()=>{const open=(event:Event)=>setPending((event as CustomEvent<Pending>).detail);window.addEventListener(eventName,open);return()=>window.removeEventListener(eventName,open)},[])
  useEffect(()=>{if(!pending)return;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';confirmRef.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){pending.resolve(false);setPending(null)}};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key)}},[pending])
  function close(value:boolean){pending?.resolve(value);setPending(null)}
  if(!pending)return null
  const shell=document.querySelector<HTMLElement>('.app-shell');const dark=shell?.classList.contains('theme-dark')??false;const accent=shell?.dataset.accent??'violet'
  return <div className={`confirm-backdrop app-shell ${dark?'theme-dark':'theme-light'}`} data-accent={accent} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close(false)}}><section className={`confirm-dialog${pending.danger?' danger':''}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message"><span><AlertTriangle aria-hidden="true"/></span><div><h2 id="confirm-title">{pending.title??'Confirm changes'}</h2><p id="confirm-message">{pending.message}</p></div><footer><button type="button" onClick={()=>close(false)}>Cancel</button><button ref={confirmRef} className="button" type="button" onClick={()=>close(true)}>{pending.confirmLabel??'Continue'}</button></footer></section></div>
}

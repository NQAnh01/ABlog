import { Grid2X2, List } from 'lucide-react'
import { useEffect,useState } from 'react'

type ViewMode='grid'|'list'
export function ViewToggle({targetId,storageKey}:{targetId:string;storageKey:string}){
  const[mode,setMode]=useState<ViewMode>(()=>localStorage.getItem(`lumina-view-${storageKey}`)==='list'?'list':'grid')
  useEffect(()=>{const apply=()=>{const target=document.getElementById(targetId);if(!target)return;target.classList.toggle('view-list',mode==='list');target.classList.toggle('view-grid',mode==='grid')};apply();localStorage.setItem(`lumina-view-${storageKey}`,mode);const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[mode,targetId,storageKey])
  return <div className="view-toggle" role="group" aria-label="Display style"><button type="button" className={mode==='grid'?'active':''} aria-pressed={mode==='grid'} title="Grid view" onClick={()=>setMode('grid')}><Grid2X2 aria-hidden="true"/><span>Grid</span></button><button type="button" className={mode==='list'?'active':''} aria-pressed={mode==='list'} title="List view" onClick={()=>setMode('list')}><List aria-hidden="true"/><span>List</span></button></div>
}

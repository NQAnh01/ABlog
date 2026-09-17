import { api } from './services/api'
import type { Capture, CaptureKind } from './types'

const KEY='lumina-pending-captures'
export const captureOpenEvent='lumina:open-quick-capture'
let syncRequest:Promise<number>|null=null

export function pendingCaptures():Capture[]{
  try{return JSON.parse(localStorage.getItem(KEY)??'[]') as Capture[]}catch{return []}
}
export function savePendingCapture(content:string,kind:CaptureKind){
  const now=new Date().toISOString()
  const value:Capture={id:`local-${crypto.randomUUID()}`,content,kind,created_at:now,updated_at:now,pending:true}
  localStorage.setItem(KEY,JSON.stringify([value,...pendingCaptures()]))
  window.dispatchEvent(new CustomEvent('lumina:captures-changed'))
  return value
}
export function removePendingCapture(id:string,notify=true){
  localStorage.setItem(KEY,JSON.stringify(pendingCaptures().filter(value=>value.id!==id)))
  if(notify)window.dispatchEvent(new CustomEvent('lumina:captures-changed'))
}
async function runSync(){
  if(!navigator.onLine)return 0
  const values=pendingCaptures();let synced=0
  for(const value of [...values].reverse()){
    try{await api.createCapture(value.content,value.kind);removePendingCapture(value.id,false);synced++}catch{return synced}
  }
  if(synced)window.dispatchEvent(new CustomEvent('lumina:captures-synced'))
  return synced
}
export function syncPendingCaptures(){
  syncRequest??=runSync().finally(()=>{syncRequest=null})
  return syncRequest
}

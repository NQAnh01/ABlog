import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { MarkdownView } from './MarkdownEditor'
import type { Post } from '../types'

type ThemeName = 'light' | 'dark' | 'accent'
type SelectionState = { text:string; top:number; left:number }

const themes:Record<ThemeName,{background:string;foreground:string;muted:string;accent:string}>={
  light:{background:'#f4f0e8',foreground:'#172235',muted:'#667085',accent:'#5b4bc4'},
  dark:{background:'#0b1326',foreground:'#f1f4ff',muted:'#aab5cd',accent:'#bdc2ff'},
  accent:{background:'#312e81',foreground:'#ffffff',muted:'#d7d8ff',accent:'#a5f3fc'},
}

function quoteText(value:string){const normalized=value.replace(/\s+/g,' ').trim();return normalized.length>280?`${normalized.slice(0,277).trimEnd()}...`:normalized}

function wrapText(context:CanvasRenderingContext2D,text:string,maxWidth:number){
  const words=text.split(' '),lines:string[]=[];let line=''
  for(const word of words){const next=line?`${line} ${word}`:word;if(context.measureText(next).width<=maxWidth)line=next;else{if(line)lines.push(line);line=word}}
  if(line)lines.push(line);return lines
}

async function makeQuote(post:Post,text:string,themeName:ThemeName){
  await document.fonts?.ready
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas is unavailable')
  const theme=themes[themeName];context.fillStyle=theme.background;context.fillRect(0,0,1200,630)
  context.fillStyle=theme.accent;context.fillRect(0,0,18,630);context.globalAlpha=.12;context.beginPath();context.arc(1080,70,260,0,Math.PI*2);context.fill();context.globalAlpha=1
  context.fillStyle=theme.accent;context.font='700 30px "Playfair Display", Georgia, serif';context.fillText('“',78,120)
  context.fillStyle=theme.foreground;context.font='700 48px "Playfair Display", Georgia, serif'
  const lines=wrapText(context,quoteText(text),1010);const lineHeight=62;let y=150
  for(const line of lines.slice(0,6)){context.fillText(line,92,y);y+=lineHeight}
  context.strokeStyle=theme.accent;context.globalAlpha=.55;context.beginPath();context.moveTo(92,502);context.lineTo(1108,502);context.stroke();context.globalAlpha=1
  context.fillStyle=theme.foreground;context.font='700 25px "Source Sans 3", Arial, sans-serif';context.fillText(post.title.slice(0,74),92,550)
  context.fillStyle=theme.muted;context.font='500 20px "Source Sans 3", Arial, sans-serif';context.fillText(post.author?.name??'Lumina Author',92,584)
  context.textAlign='right';context.fillStyle=theme.accent;context.font='700 26px "Playfair Display", Georgia, serif';context.fillText('LUMINA',1108,574)
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Unable to generate image')),'image/png'))
}

export function SelectionQuote({post}:{post:Post}){
  const contentRef=useRef<HTMLDivElement>(null);const timerRef=useRef<number>(0)
  const [selection,setSelection]=useState<SelectionState|null>(null);const [quote,setQuote]=useState('');const [open,setOpen]=useState(false);const [theme,setTheme]=useState<ThemeName>('dark');const [preview,setPreview]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('')
  const selectedText=selection?.text??''
  const deepLink=useMemo(()=>{const base=`${location.origin}${location.pathname}`;return `${base}#:~:text=${encodeURIComponent(selectedText)}`},[selectedText])

  useEffect(()=>{const content=contentRef.current;if(!content)return
    function capture(){window.clearTimeout(timerRef.current);timerRef.current=window.setTimeout(()=>{const active=window.getSelection();if(!active||active.isCollapsed||!active.rangeCount){setSelection(null);return}const range=active.getRangeAt(0);if(!content?.contains(range.commonAncestorContainer)){setSelection(null);return}const text=quoteText(active.toString());if(!text){setSelection(null);return}const rect=range.getBoundingClientRect();setSelection({text,top:Math.max(76,rect.top-54),left:Math.min(window.innerWidth-16,Math.max(16,rect.left+rect.width/2))})},80)}
    document.addEventListener('selectionchange',capture);window.addEventListener('resize',capture);return()=>{document.removeEventListener('selectionchange',capture);window.removeEventListener('resize',capture);window.clearTimeout(timerRef.current)}
  },[])
  useEffect(()=>{if(!open||!quote)return;let active=true;makeQuote(post,quote,theme).then(blob=>{if(!active)return;setPreview(previous=>{if(previous)URL.revokeObjectURL(previous);return URL.createObjectURL(blob)})}).catch(()=>setNotice('Could not generate the image.'));return()=>{active=false}},[open,post,quote,theme])
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview])
  useEffect(()=>{if(!open)return;const before=document.body.style.overflow;document.body.style.overflow='hidden';const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('keydown',close);return()=>{document.body.style.overflow=before;document.removeEventListener('keydown',close)}},[open])
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),2800);return()=>window.clearTimeout(timer)},[notice])

  async function copyLink(){try{await navigator.clipboard.writeText(deepLink);setNotice('Deep link copied.')}catch{const input=document.createElement('textarea');input.value=deepLink;document.body.appendChild(input);input.select();document.execCommand('copy');input.remove();setNotice('Deep link copied.')}}
  async function blob(){setBusy(true);try{return await makeQuote(post,quote,theme)}finally{setBusy(false)}}
  async function download(){try{const value=await blob(),link=document.createElement('a');link.href=URL.createObjectURL(value);link.download=`${post.slug}-quote.png`;link.click();window.setTimeout(()=>URL.revokeObjectURL(link.href),1000);setNotice('Quote image downloaded.')}catch{setNotice('Could not generate the image.')}}
  async function copyImage(){try{const value=await blob();if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw new Error();await navigator.clipboard.write([new ClipboardItem({'image/png':value})]);setNotice('Image copied to clipboard.')}catch{setNotice('Image clipboard is unavailable in this browser. You can download it instead.')}}
  function keepSelection(event:PointerEvent){event.preventDefault()}

  return <><div className="selectable-story" ref={contentRef}><div className="article-body"><MarkdownView>{post.content}</MarkdownView></div></div>{selection&&!open&&<div className="selection-toolbar" style={{top:selection.top,left:selection.left}} role="toolbar" aria-label="Share selected text" onPointerDown={keepSelection}><button type="button" onClick={()=>void copyLink()}>⌁ <span>Copy link</span></button><button type="button" onClick={()=>{setQuote(selection.text);setOpen(true)}}>▣ <span>Share as image</span></button></div>}{open&&<div className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="quote-dialog-title" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><section><header><div><small>SHARE A PASSAGE</small><h2 id="quote-dialog-title">Turn words into an image</h2></div><button type="button" aria-label="Close" onClick={()=>setOpen(false)}>×</button></header><div className="quote-preview">{preview?<img src={preview} alt="Generated quote preview"/>:<span>Generating preview…</span>}</div><div className="quote-themes" aria-label="Image theme">{(Object.keys(themes) as ThemeName[]).map(name=><button type="button" className={theme===name?'active':''} aria-pressed={theme===name} onClick={()=>setTheme(name)} key={name}><i style={{background:themes[name].background}}/>{name}</button>)}</div><footer><button type="button" onClick={()=>void copyImage()} disabled={busy}>Copy image</button><button className="primary" type="button" onClick={()=>void download()} disabled={busy}>{busy?'Generating…':'Download PNG'}</button></footer>{notice&&<p className="quote-notice" role="status">{notice}</p>}</section></div>}{notice&&!open&&<div className="selection-notice" role="status">{notice}</div>}</>
}

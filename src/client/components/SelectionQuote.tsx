import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { MarkdownView } from './MarkdownEditor'
import type { Post } from '../types'
import { AppSelect } from './AppSelect'

type ThemeName = 'light' | 'dark' | 'accent'
type QuoteFont = 'editorial' | 'modern' | 'classic' | 'lora' | 'slab' | 'montserrat' | 'rounded' | 'cormorant' | 'dmserif' | 'baskerville' | 'dancing'
type SelectionState = { text:string; top:number; left:number }

const themes:Record<ThemeName,{background:string;foreground:string;muted:string;accent:string}>={
  light:{background:'#f4f0e8',foreground:'#172235',muted:'#667085',accent:'#5b4bc4'},
  dark:{background:'#0b1326',foreground:'#f1f4ff',muted:'#aab5cd',accent:'#bdc2ff'},
  accent:{background:'#312e81',foreground:'#ffffff',muted:'#d7d8ff',accent:'#a5f3fc'},
}
const quoteFonts:Record<QuoteFont,{label:string;heading:string;body:string}>={editorial:{label:'Editorial',heading:'"Playfair Display", Georgia, serif',body:'"Source Sans 3", Arial, sans-serif'},modern:{label:'Modern',heading:'Inter, Arial, sans-serif',body:'Inter, Arial, sans-serif'},classic:{label:'Classic',heading:'Merriweather, Georgia, serif',body:'Merriweather, Georgia, serif'},lora:{label:'Lora',heading:'Lora, Georgia, serif',body:'Lora, Georgia, serif'},slab:{label:'Roboto Slab',heading:'"Roboto Slab", Georgia, serif',body:'"Roboto Slab", Georgia, serif'},montserrat:{label:'Montserrat',heading:'Montserrat, Arial, sans-serif',body:'Montserrat, Arial, sans-serif'},rounded:{label:'Nunito',heading:'Nunito, Arial, sans-serif',body:'Nunito, Arial, sans-serif'},cormorant:{label:'Cormorant',heading:'"Cormorant Garamond", Georgia, serif',body:'"Cormorant Garamond", Georgia, serif'},dmserif:{label:'DM Serif',heading:'"DM Serif Display", Georgia, serif',body:'"Source Sans 3", Arial, sans-serif'},baskerville:{label:'Libre Baskerville',heading:'"Libre Baskerville", Georgia, serif',body:'"Libre Baskerville", Georgia, serif'},dancing:{label:'Dancing Script',heading:'"Dancing Script", cursive',body:'"Source Sans 3", Arial, sans-serif'}}

function quoteText(value:string){const normalized=value.replace(/\s+/g,' ').trim();return normalized.length>280?`${normalized.slice(0,277).trimEnd()}...`:normalized}

function wrapText(context:CanvasRenderingContext2D,text:string,maxWidth:number){
  const words=text.split(' '),lines:string[]=[];let line=''
  for(const word of words){const next=line?`${line} ${word}`:word;if(context.measureText(next).width<=maxWidth)line=next;else{if(line)lines.push(line);line=word}}
  if(line)lines.push(line);return lines
}

const imageCache=new Map<string,Promise<HTMLImageElement>>()
function loadImage(src:string){let pending=imageCache.get(src);if(!pending){pending=new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>{imageCache.delete(src);reject(new Error('Unable to load background image'))};image.src=src});imageCache.set(src,pending)}return pending}

async function makeQuote(post:Post,text:string,themeName:ThemeName,backgroundImage:string,textColor:string,fontName:QuoteFont){
  await document.fonts?.ready
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas is unavailable')
  const theme=themes[themeName],font=quoteFonts[fontName]
  context.font=`700 48px ${font.heading}`
  const lines=wrapText(context,quoteText(text),1010)
  context.font=`700 23px ${font.heading}`
  const titleLines=wrapText(context,post.title,1016).slice(0,2)
  const lineHeight=62,quoteStart=150
  const dividerY=quoteStart+(Math.max(1,lines.length)-1)*lineHeight+38
  const titleStart=dividerY+38
  const authorY=titleStart+(Math.max(1,titleLines.length)-1)*28+54
  const canvasHeight=Math.max(420,authorY+35)
  canvas.height=canvasHeight
  context.fillStyle=theme.background;context.fillRect(0,0,1200,canvasHeight)
  if(backgroundImage){const image=await loadImage(backgroundImage);const scale=Math.max(1200/image.naturalWidth,canvasHeight/image.naturalHeight);const width=image.naturalWidth*scale,height=image.naturalHeight*scale;context.drawImage(image,(1200-width)/2,(canvasHeight-height)/2,width,height);context.fillStyle='rgba(3,8,20,.58)';context.fillRect(0,0,1200,canvasHeight)}
  context.fillStyle=theme.accent;context.fillRect(0,0,18,canvasHeight);context.globalAlpha=.12;context.beginPath();context.arc(1080,70,260,0,Math.PI*2);context.fill();context.globalAlpha=1
  context.fillStyle=theme.accent;context.font=`700 30px ${font.heading}`;context.fillText('“',78,120)
  context.fillStyle=textColor;context.font=`700 48px ${font.heading}`
  let y=quoteStart
  for(const line of lines){context.fillText(line,92,y);y+=lineHeight}
  context.strokeStyle=theme.accent;context.globalAlpha=.55;context.beginPath();context.moveTo(92,dividerY);context.lineTo(1108,dividerY);context.stroke();context.globalAlpha=1
  context.fillStyle=textColor;context.font=`700 23px ${font.heading}`
  titleLines.forEach((line,index)=>context.fillText(line,92,titleStart+(index*28)))
  context.fillStyle=theme.muted;context.font=`500 18px ${font.heading}`;context.fillText(post.author?.name??'Lumina Author',92,authorY)
  context.textAlign='right';context.fillStyle=theme.accent;context.font=`700 26px ${font.heading}`;context.fillText('LUMINA',1108,authorY)
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Unable to generate image')),'image/png'))
}

export function SelectionQuote({post}:{post:Post}){
  const contentRef=useRef<HTMLDivElement>(null);const timerRef=useRef<number>(0);const customBackgroundRef=useRef('')
  const [selection,setSelection]=useState<SelectionState|null>(null);const [quote,setQuote]=useState('');const [open,setOpen]=useState(false);const [theme,setTheme]=useState<ThemeName>('dark');const [preview,setPreview]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('')
  const [backgroundImage,setBackgroundImage]=useState('');const [backgroundLabel,setBackgroundLabel]=useState('No image');const [textColor,setTextColor]=useState(themes.dark.foreground)
  const [quoteFont,setQuoteFont]=useState<QuoteFont>('editorial')
  const selectedText=selection?.text??''
  const deepLink=useMemo(()=>{const base=`${location.origin}${location.pathname}`;return `${base}#:~:text=${encodeURIComponent(selectedText)}`},[selectedText])

  useEffect(()=>{const content=contentRef.current;if(!content)return
    function capture(){window.clearTimeout(timerRef.current);timerRef.current=window.setTimeout(()=>{const active=window.getSelection();if(!active||active.isCollapsed||!active.rangeCount){setSelection(null);return}const range=active.getRangeAt(0);if(!content?.contains(range.commonAncestorContainer)){setSelection(null);return}const text=quoteText(active.toString());if(!text){setSelection(null);return}const rect=range.getBoundingClientRect();setSelection({text,top:Math.max(76,rect.top-54),left:Math.min(window.innerWidth-16,Math.max(16,rect.left+rect.width/2))})},80)}
    document.addEventListener('selectionchange',capture);window.addEventListener('resize',capture);return()=>{document.removeEventListener('selectionchange',capture);window.removeEventListener('resize',capture);window.clearTimeout(timerRef.current)}
  },[])
  useEffect(()=>{if(!open||!quote)return;let active=true;const timer=window.setTimeout(()=>{makeQuote(post,quote,theme,backgroundImage,textColor,quoteFont).then(blob=>{if(!active)return;setPreview(previous=>{if(previous)URL.revokeObjectURL(previous);return URL.createObjectURL(blob)})}).catch(()=>{if(active)setNotice('Could not generate the image.')})},120);return()=>{active=false;window.clearTimeout(timer)}},[open,post,quote,theme,backgroundImage,textColor,quoteFont])
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview])
  useEffect(()=>()=>{if(customBackgroundRef.current)URL.revokeObjectURL(customBackgroundRef.current)},[])
  useEffect(()=>{if(!open)return;const input=document.querySelector<HTMLInputElement>('.quote-color input[type="color"]');if(!input)return;const display=input.nextElementSibling;const preview=(event:Event)=>{event.stopPropagation();if(display)display.textContent=input.value.toUpperCase()};const commit=()=>setTextColor(input.value);input.addEventListener('input',preview);input.addEventListener('change',commit);input.addEventListener('blur',commit);return()=>{input.removeEventListener('input',preview);input.removeEventListener('change',commit);input.removeEventListener('blur',commit)}},[open])
  useEffect(()=>{if(!open)return;const before=document.body.style.overflow;document.body.style.overflow='hidden';const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('keydown',close);return()=>{document.body.style.overflow=before;document.removeEventListener('keydown',close)}},[open])
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),2800);return()=>window.clearTimeout(timer)},[notice])

  async function copyLink(){try{await navigator.clipboard.writeText(deepLink);setNotice('Deep link copied.')}catch{const input=document.createElement('textarea');input.value=deepLink;document.body.appendChild(input);input.select();document.execCommand('copy');input.remove();setNotice('Deep link copied.')}}
  async function blob(){setBusy(true);try{return await makeQuote(post,quote,theme,backgroundImage,textColor,quoteFont)}finally{setBusy(false)}}
  async function download(){try{const value=await blob(),link=document.createElement('a');link.href=URL.createObjectURL(value);link.download=`${post.slug}-quote.png`;link.click();window.setTimeout(()=>URL.revokeObjectURL(link.href),1000);setNotice('Quote image downloaded.')}catch{setNotice('Could not generate the image.')}}
  async function copyImage(){try{const value=await blob();if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw new Error();await navigator.clipboard.write([new ClipboardItem({'image/png':value})]);setNotice('Image copied to clipboard.')}catch{setNotice('Image clipboard is unavailable in this browser. You can download it instead.')}}
  function useBackground(src:string,label:string){if(customBackgroundRef.current){URL.revokeObjectURL(customBackgroundRef.current);customBackgroundRef.current=''}setBackgroundImage(src);setBackgroundLabel(label)}
  function uploadBackground(file?:File){if(!file)return;if(!file.type.startsWith('image/')){setNotice('Please choose an image file.');return}if(file.size>10*1024*1024){setNotice('Background image must be 10 MB or smaller.');return}if(customBackgroundRef.current)URL.revokeObjectURL(customBackgroundRef.current);const url=URL.createObjectURL(file);customBackgroundRef.current=url;setBackgroundImage(url);setBackgroundLabel(file.name)}
  function keepSelection(event:PointerEvent){event.preventDefault()}

  return <><div className="selectable-story" ref={contentRef}><div className="article-body"><MarkdownView>{post.content}</MarkdownView></div></div>{selection&&!open&&<div className="selection-toolbar" style={{top:selection.top,left:selection.left}} role="toolbar" aria-label="Share selected text" onPointerDown={keepSelection}><button type="button" onClick={()=>void copyLink()}>⌁ <span>Copy link</span></button><button type="button" onClick={()=>{setQuote(selection.text);setOpen(true)}}>▣ <span>Share as image</span></button></div>}{open&&<div className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="quote-dialog-title" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><section><header><div><small>SHARE A PASSAGE</small><h2 id="quote-dialog-title">Turn words into an image</h2></div><button type="button" aria-label="Close" onClick={()=>setOpen(false)}>×</button></header><div className="quote-preview">{preview?<img src={preview} alt="Generated quote preview"/>:<span>Generating preview…</span>}</div><div className="quote-controls"><div><span>Background</span><div className="quote-backgrounds"><button type="button" className={!backgroundImage?'active':''} onClick={()=>useBackground('','No image')}>Theme</button>{post.thumbnail?.url&&<button type="button" className={backgroundImage===post.thumbnail.url?'active':''} onClick={()=>useBackground(post.thumbnail!.url,'Story cover')}>Story cover</button>}<label>Upload image<input type="file" accept="image/*" onChange={event=>uploadBackground(event.target.files?.[0])}/></label></div><small>{backgroundLabel}</small></div><label className="quote-color"><span>Text color</span><input type="color" value={textColor} onInput={event=>setTextColor(event.currentTarget.value)}/><code>{textColor.toUpperCase()}</code></label><label className="quote-font"><span>Text style</span><AppSelect value={quoteFont} onChange={value=>setQuoteFont(value as QuoteFont)} label="Text style" options={(Object.keys(quoteFonts) as QuoteFont[]).map(name=>({value:name,label:quoteFonts[name].label}))}/></label></div><div className="quote-themes" aria-label="Image theme">{(Object.keys(themes) as ThemeName[]).map(name=><button type="button" className={theme===name?'active':''} aria-pressed={theme===name} onClick={()=>{setTheme(name);setTextColor(themes[name].foreground)}} key={name}><i style={{background:themes[name].background}}/>{name}</button>)}</div><footer><button type="button" onClick={()=>void copyImage()} disabled={busy}>Copy image</button><button className="primary" type="button" onClick={()=>void download()} disabled={busy}>{busy?'Generating…':'Download PNG'}</button></footer>{notice&&<p className="quote-notice" role="status">{notice}</p>}</section></div>}{notice&&!open&&<div className="selection-notice" role="status">{notice}</div>}</>
}

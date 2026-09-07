import { useEffect } from 'react'

const SITE_NAME='Lumina'
const DEFAULT_DESCRIPTION='Lumina is a quiet home for thoughtful stories, useful ideas, and independent writers.'

export type SeoData={
 title?:string
 description?:string
 path?:string
 image?:string
 type?:'website'|'article'|'profile'
 noIndex?:boolean
 jsonLd?:Record<string,unknown>|Array<Record<string,unknown>>
}

function absolute(value:string){try{return new URL(value,window.location.origin).href}catch{return value}}
function setMeta(selector:string,key:'name'|'property',name:string,content:string){let node=document.head.querySelector<HTMLMetaElement>(selector);if(!node){node=document.createElement('meta');node.setAttribute(key,name);document.head.appendChild(node)}node.content=content}

export function useSeo({title,description=DEFAULT_DESCRIPTION,path,image,type='website',noIndex=false,jsonLd}:SeoData){
 const jsonLdValue=jsonLd?JSON.stringify(jsonLd):''
 useEffect(()=>{
  const fullTitle=title?`${title} — ${SITE_NAME}`:`${SITE_NAME} — Stories worth reading`
  const canonical=absolute(path??window.location.pathname)
  document.title=fullTitle
  setMeta('meta[name="description"]','name','description',description)
  setMeta('meta[name="robots"]','name','robots',noIndex?'noindex, nofollow':'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
  setMeta('meta[property="og:site_name"]','property','og:site_name',SITE_NAME)
  setMeta('meta[property="og:title"]','property','og:title',fullTitle)
  setMeta('meta[property="og:description"]','property','og:description',description)
  setMeta('meta[property="og:type"]','property','og:type',type)
  setMeta('meta[property="og:url"]','property','og:url',canonical)
  setMeta('meta[property="og:locale"]','property','og:locale','en_US')
  setMeta('meta[name="twitter:card"]','name','twitter:card',image?'summary_large_image':'summary')
  setMeta('meta[name="twitter:title"]','name','twitter:title',fullTitle)
  setMeta('meta[name="twitter:description"]','name','twitter:description',description)
  const imageNodes=[['meta[property="og:image"]','property','og:image'],['meta[name="twitter:image"]','name','twitter:image']] as const
  for(const[selector,key,name]of imageNodes){if(image)setMeta(selector,key,name,absolute(image));else document.head.querySelector(selector)?.remove()}
  let link=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link)}link.href=canonical
  document.querySelectorAll('script[data-lumina-seo]').forEach(node=>node.remove())
  const structured=jsonLdValue?JSON.parse(jsonLdValue) as Record<string,unknown>|Array<Record<string,unknown>>:undefined
  const entries=structured?(Array.isArray(structured)?structured:[structured]):[]
  for(const value of entries){const script=document.createElement('script');script.type='application/ld+json';script.dataset.luminaSeo='true';script.text=JSON.stringify(value).replace(/</g,'\\u003c');document.head.appendChild(script)}
 },[title,description,path,image,type,noIndex,jsonLdValue])
}

export const seoDefaults={siteName:SITE_NAME,description:DEFAULT_DESCRIPTION}

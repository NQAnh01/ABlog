export type SiteFont = 'editorial' | 'modern' | 'classic' | 'lora' | 'slab' | 'montserrat' | 'rounded' | 'cormorant' | 'dmserif' | 'baskerville' | 'dancing'
export const fontStorageKey = 'lumina-site-font'
export const siteFonts: { id: SiteFont; name: string }[] = [{id:'editorial',name:'Editorial'},{id:'modern',name:'Modern'},{id:'classic',name:'Classic'},{id:'lora',name:'Lora'},{id:'slab',name:'Slab'},{id:'montserrat',name:'Montserrat'},{id:'rounded',name:'Rounded'},{id:'cormorant',name:'Cormorant'},{id:'dmserif',name:'DM Serif'},{id:'baskerville',name:'Baskerville'},{id:'dancing',name:'Dancing Script'}]
export function savedFont():SiteFont{const value=localStorage.getItem(fontStorageKey);return siteFonts.some(font=>font.id===value)?value as SiteFont:'editorial'}
export function previewFont(value:SiteFont){document.documentElement.dataset.siteFont=value}

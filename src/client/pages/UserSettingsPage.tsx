import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Layout, Loading } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import { useToast } from '../hooks/useToast'
import { ArrowLeft, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react'

export function UserSettingsPage() {
  const toast = useToast()
  const { user, loading, updateProfile, uploadAvatar } = useAuth()
  const [tab, setTab] = useState<'profile' | 'password'>('profile')
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [bio,setBio]=useState(user?.bio??'')
  const [socials,setSocials]=useState(user?.social_links??{})
  const [busy, setBusy] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  useEffect(() => { if (user) { setName(user.name); setPhone(user.phone ?? '');setBio(user.bio??'');setSocials(user.social_links??{}) } }, [user])
  if (loading) return <Layout><Loading /></Layout>
  if (!user) return <Navigate to="/login" replace />

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try { await updateProfile(name, phone);await api.updateAuthorProfile(bio,socials);toast('Profile updated successfully.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to update profile') }
    finally { setBusy(false) }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form)
    const current = String(data.get('current_password') ?? ''), next = String(data.get('new_password') ?? ''), confirm = String(data.get('confirm_password') ?? '')
    setError('')
    if (next !== confirm) { setError('New password confirmation does not match.'); return }
    setBusy(true)
    try { await api.changePassword(current, next, confirm); form.reset(); toast('Password changed successfully. Other sessions were signed out.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to change password') }
    finally { setBusy(false) }
  }

  async function changeAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Avatar must be a JPEG, PNG or WebP image.'); return }
    if (file.size > 3 * 1024 * 1024) { setError('Avatar must be 3 MB or smaller.'); return }
    setAvatarBusy(true)
    try { await uploadAvatar(file) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to upload avatar') }
    finally { setAvatarBusy(false) }
  }

  function switchTab(value: 'profile' | 'password') { setTab(value); setError('') }
  function addCustomLink(){setSocials(value=>({...value,links:[...(value.links??[]),{name:'',url:''}]}))}
  function updateCustomLink(index:number,key:'name'|'url',next:string){setSocials(value=>({...value,links:(value.links??[]).map((link,current)=>current===index?{...link,[key]:next}:link)}))}
  function removeCustomLink(index:number){setSocials(value=>({...value,links:(value.links??[]).filter((_,current)=>current!==index)}))}
  return <Layout><section className="account-settings container"><header><div><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Your profile</h1><p>Keep your public information current and your account secure.</p></div><Link to="/profile"><ArrowLeft aria-hidden="true"/> Back to your stories</Link></header><div className="settings-layout"><aside><label className={`settings-avatar-upload${avatarBusy ? ' busy' : ''}`} title="Upload a new avatar"><span className="settings-avatar">{user.avatar ? <img src={user.avatar} alt={`${user.name}'s avatar`} /> : user.name?.[0]?.toUpperCase() ?? 'L'}</span><span className="settings-avatar-overlay">{avatarBusy ? 'Uploading…' : 'Change'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={avatarBusy} onChange={changeAvatar} /></label><strong>{user.name}</strong><span>{user.email}</span><nav aria-label="Account settings"><button type="button" aria-current={tab==='profile'?'page':undefined} className={tab === 'profile' ? 'active' : ''} onClick={() => switchTab('profile')}><i><UserRound aria-hidden="true"/></i><span>Personal information<small>Public author details</small></span></button><button type="button" aria-current={tab==='password'?'page':undefined} className={tab === 'password' ? 'active' : ''} onClick={() => switchTab('password')}><i><ShieldCheck aria-hidden="true"/></i><span>Password & security<small>Update your password</small></span></button></nav></aside><div className="settings-panel">{tab === 'profile' ? <><header><h2>Personal information</h2><p>Your bio and links appear on your public author page.</p></header><form onSubmit={saveProfile}><label><span>Full name</span><input value={name} onChange={event => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required /><small aria-hidden="true"/></label><label><span>Email address</span><input value={user.email} readOnly disabled /><small>Email cannot be changed from this screen.</small></label><label><span>Phone number</span><input value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" maxLength={20} /><small aria-hidden="true"/></label><label><span>Author bio <em>{bio.length}/320</em></span><textarea value={bio} onChange={event=>setBio(event.target.value)} maxLength={320} placeholder="Tell readers a little about your perspective and work."/></label>{([['website','Website'],['x','X profile'],['linkedin','LinkedIn']] as const).map(([key,label])=><label key={key}><span>{label}</span><input type="url" value={socials[key]??''} onChange={event=>setSocials(value=>({...value,[key]:event.target.value}))} placeholder="https://"/><small aria-hidden="true"/></label>)}<section className="custom-links"><header><div><strong>Other links</strong><small>Add up to 8 named links to your author page.</small></div><button type="button" disabled={(socials.links?.length??0)>=8} onClick={addCustomLink}><Plus aria-hidden="true"/> Add link</button></header>{socials.links?.map((link,index)=><div className="custom-link-row" key={index}><label><span>Link name</span><input value={link.name} maxLength={40} placeholder="Portfolio" onChange={event=>updateCustomLink(index,'name',event.target.value)}/></label><label><span>URL</span><input type="url" value={link.url} placeholder="https://example.com" onChange={event=>updateCustomLink(index,'url',event.target.value)}/></label><button type="button" aria-label={`Remove ${link.name||'custom link'}`} onClick={()=>removeCustomLink(index)}><Trash2 aria-hidden="true"/></button></div>)}</section>{error && <div className="settings-message error" role="alert">{error}</div>}<footer><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></footer></form></> : <><header><h2>Change password</h2><p>Use at least 8 characters. Your new password must differ from the current one.</p></header><form onSubmit={savePassword}>{([['current','Current password','current_password'],['next','New password','new_password'],['confirm','Confirm new password','confirm_password']] as const).map(([key,label,name]) => <label key={key}><span>{label}</span><div className="settings-password"><input name={name} type={show[key] ? 'text' : 'password'} minLength={8} maxLength={128} autoComplete={key === 'current' ? 'current-password' : 'new-password'} required /><button type="button" aria-label={`${show[key]?'Hide':'Show'} ${label.toLowerCase()}`} onClick={() => setShow(value => ({ ...value, [key]: !value[key] }))}>{show[key] ? 'Hide' : 'Show'}</button></div><small aria-hidden="true"/></label>)}{error && <div className="settings-message error" role="alert">{error}</div>}<footer><button className="button" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></footer></form></>}</div></div></section></Layout>
}

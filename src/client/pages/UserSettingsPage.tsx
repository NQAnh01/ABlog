import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Layout, Loading } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'

export function UserSettingsPage() {
  const { user, loading, updateProfile, uploadAvatar } = useAuth()
  const [tab, setTab] = useState<'profile' | 'password'>('profile')
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  useEffect(() => { if (user) { setName(user.name); setPhone(user.phone ?? '') } }, [user])
  if (loading) return <Layout><Loading /></Layout>
  if (!user) return <Navigate to="/login" replace />

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('')
    try { await updateProfile(name, phone); setSuccess('Your profile has been updated.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to update profile') }
    finally { setBusy(false) }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form)
    const current = String(data.get('current_password') ?? ''), next = String(data.get('new_password') ?? ''), confirm = String(data.get('confirm_password') ?? '')
    setError(''); setSuccess('')
    if (next !== confirm) { setError('New password confirmation does not match.'); return }
    setBusy(true)
    try { await api.changePassword(current, next, confirm); form.reset(); setSuccess('Password changed successfully. Other sessions have been signed out.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to change password') }
    finally { setBusy(false) }
  }

  async function changeAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(''); setSuccess('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Avatar must be a JPEG, PNG or WebP image.'); return }
    if (file.size > 3 * 1024 * 1024) { setError('Avatar must be 3 MB or smaller.'); return }
    setAvatarBusy(true)
    try { await uploadAvatar(file); setSuccess('Your avatar has been updated.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to upload avatar') }
    finally { setAvatarBusy(false) }
  }

  function switchTab(value: 'profile' | 'password') { setTab(value); setError(''); setSuccess('') }
  return <Layout><section className="account-settings container"><header><div><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Your profile</h1><p>Keep your public information current and your account secure.</p></div><Link to="/profile">← Back to your stories</Link></header><div className="settings-layout"><aside><label className={`settings-avatar-upload${avatarBusy ? ' busy' : ''}`} title="Upload a new avatar"><span className="settings-avatar">{user.avatar ? <img src={user.avatar} alt={`${user.name}'s avatar`} /> : user.name?.[0]?.toUpperCase() ?? 'L'}</span><span className="settings-avatar-overlay">{avatarBusy ? 'Uploading…' : 'Change'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={avatarBusy} onChange={changeAvatar} /></label><strong>{user.name}</strong><span>{user.email}</span><nav><button className={tab === 'profile' ? 'active' : ''} onClick={() => switchTab('profile')}><i>○</i><span>Personal information<small>Name, email and phone</small></span></button><button className={tab === 'password' ? 'active' : ''} onClick={() => switchTab('password')}><i>◇</i><span>Password & security<small>Update your password</small></span></button></nav></aside><div className="settings-panel">{tab === 'profile' ? <><header><h2>Personal information</h2><p>This information identifies your account across Lumina.</p></header><form onSubmit={saveProfile}><label><span>Full name</span><input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={80} required /></label><label><span>Email address</span><input value={user.email} readOnly disabled /><small>Email cannot be changed from this screen.</small></label><label><span>Phone number</span><input value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" maxLength={20} /></label>{error && <div className="settings-message error">{error}</div>}{success && <div className="settings-message success">{success}</div>}<footer><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></footer></form></> : <><header><h2>Change password</h2><p>Use at least 8 characters. Your new password must differ from the current one.</p></header><form onSubmit={savePassword}>{([['current','Current password','current_password'],['next','New password','new_password'],['confirm','Confirm new password','confirm_password']] as const).map(([key,label,name]) => <label key={key}><span>{label}</span><div className="settings-password"><input name={name} type={show[key] ? 'text' : 'password'} minLength={8} maxLength={128} autoComplete={key === 'current' ? 'current-password' : 'new-password'} required /><button type="button" aria-label={`Show ${label.toLowerCase()}`} onClick={() => setShow(value => ({ ...value, [key]: !value[key] }))}>{show[key] ? 'Hide' : 'Show'}</button></div></label>)}{error && <div className="settings-message error">{error}</div>}{success && <div className="settings-message success">{success}</div>}<footer><button className="button" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></footer></form></>}</div></div></section></Layout>
}

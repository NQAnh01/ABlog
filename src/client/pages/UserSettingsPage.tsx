import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Layout, Loading } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { ArrowLeft, Check, Palette, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { accentStorageKey, accentThemes, previewAccent, savedAccent, type AccentTheme } from '../theme';
import { confirmAction } from '../components/ConfirmModal';
import { fontStorageKey, previewFont, savedFont, siteFonts, type SiteFont } from '../font';
import type { Category } from '../types';
function AppearancePanel({ accent, committed, onSelect, onSave }: {
    accent: AccentTheme;
    committed: AccentTheme;
    onSelect: (value: AccentTheme) => void;
    onSave: (font: SiteFont) => Promise<boolean>;
}) {
    const initialFont = useRef(savedFont());
    const [, forceSavedFontRender] = useState(0);
    const committedFont = useRef(initialFont.current);
    const [font, setFont] = useState(initialFont.current);
    useEffect(() => () => previewFont(committedFont.current), []);
    function chooseFont(value: SiteFont) { setFont(value); previewFont(value); }
    async function save() { if (await onSave(font)) {
        committedFont.current = font;
        forceSavedFontRender(value => value + 1);
    } }
    return <><header><h2>Appearance</h2><p>Choose an accent color and the typography used across the site.</p></header><div className="theme-settings"><div className="theme-options" role="radiogroup" aria-label="Accent color">{accentThemes.map(theme => <button type="button" role="radio" aria-checked={accent === theme.id} className={accent === theme.id ? 'selected' : ''} onClick={() => onSelect(theme.id)} key={theme.id}><i style={{ background: theme.color }}/><span><strong>{theme.name}</strong><small>{theme.id === 'violet' ? 'Lumina default' : 'Preset theme'}</small></span><b aria-hidden="true">✓</b></button>)}</div><div className="font-options"><strong>Typography</strong>{siteFonts.map(option => <button type="button" className={font === option.id ? 'selected' : ''} onClick={() => chooseFont(option.id)} key={option.id}><i>{option.name === 'Modern' ? 'Aa' : 'Ag'}</i><span><b>{option.name}</b><small>{option.id === 'editorial' ? 'Lumina default' : option.id === 'modern' ? 'Clean sans serif' : 'Traditional serif'}</small></span></button>)}</div><p>Changes are previewed immediately and applied after saving.</p><footer><button type="button" className="button" disabled={accent === committed && font === committedFont.current} onClick={() => void save()}>Save</button></footer></div></>;
}
export function UserSettingsPage() {
    const toast = useToast();
    const { user, loading, updateProfile, uploadAvatar } = useAuth();
    const [tab, setTab] = useState<'profile' | 'appearance' | 'password'>('profile');
    const [accent, setAccent] = useState<AccentTheme>(savedAccent);
    const [committedAccent, setCommittedAccent] = useState<AccentTheme>(savedAccent);
    const committedAccentRef = useRef(committedAccent);
    const [name, setName] = useState(user?.name ?? '');
    const [phone, setPhone] = useState(user?.phone ?? '');
    const [bio, setBio] = useState(user?.bio ?? '');
    const [socials, setSocials] = useState(user?.social_links ?? {});
    const [categories, setCategories] = useState<Category[]>([]);
    const [interests, setInterests] = useState<string[]>(user?.interest_category_ids ?? []);
    const [busy, setBusy] = useState(false);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [error, setError] = useState('');
    const [show, setShow] = useState({ current: false, next: false, confirm: false });
    useEffect(() => { if (user) {
        setName(user.name);
        setPhone(user.phone ?? '');
        setBio(user.bio ?? '');
        setSocials(user.social_links ?? {});
        setInterests(user.interest_category_ids ?? []);
    } }, [user]);
    useEffect(() => { api.categories().then(setCategories).catch(() => setCategories([])); }, []);
    useEffect(() => () => previewAccent(committedAccentRef.current), []);
    if (loading)
        return <Layout><Loading /></Layout>;
    if (!user)
        return <Navigate to="/login" replace/>;
    async function saveProfile(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!await confirmAction({ title: 'Save profile changes?', message: 'Your updated information will be shown on your account and public author profile.', confirmLabel: 'Save changes' }))
            return;
        setBusy(true);
        setError('');
        try {
            await updateProfile(name, phone, interests);
        await api.updateAuthorProfile(bio, socials);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to update profile');
        }
        finally {
            setBusy(false);
        }
    }
    async function savePassword(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const current = String(data.get('current_password') ?? ''), next = String(data.get('new_password') ?? ''), confirm = String(data.get('confirm_password') ?? '');
        setError('');
        if (next !== confirm) {
            setError('New password confirmation does not match.');
            return;
        }
        if (!await confirmAction({ title: 'Change your password?', message: 'Your password will be updated and other signed-in sessions may be closed.', confirmLabel: 'Change password', danger: true }))
            return;
        setBusy(true);
        try {
            await api.changePassword(current, next, confirm);
            form.reset();
            toast('Password changed successfully. Other sessions were signed out.');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to change password');
        }
        finally {
            setBusy(false);
        }
    }
    async function changeAvatar(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file)
            return;
        setError('');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setError('Avatar must be a JPEG, PNG or WebP image.');
            return;
        }
        if (file.size > 3 * 1024 * 1024) {
            setError('Avatar must be 3 MB or smaller.');
            return;
        }
        setAvatarBusy(true);
        try {
            await uploadAvatar(file);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to upload avatar');
        }
        finally {
            setAvatarBusy(false);
        }
    }
    function switchTab(value: 'profile' | 'appearance' | 'password') { setTab(value); setError(''); }
    function selectAccent(value: AccentTheme) { setAccent(value); previewAccent(value); }
    async function saveAppearance(font: SiteFont) { if (!await confirmAction({ title: 'Save appearance?', message: 'This color and typography will be used across the site.', confirmLabel: 'Save' }))
        return false; localStorage.setItem(accentStorageKey, accent); localStorage.setItem(fontStorageKey, font); committedAccentRef.current = accent; setCommittedAccent(accent); toast('Appearance updated successfully.'); return true; }
    function addCustomLink() { setSocials(value => ({ ...value, links: [...(value.links ?? []), { name: '', url: '' }] })); }
    function updateCustomLink(index: number, key: 'name' | 'url', next: string) { setSocials(value => ({ ...value, links: (value.links ?? []).map((link, current) => current === index ? { ...link, [key]: next } : link) })); }
    function removeCustomLink(index: number) { setSocials(value => ({ ...value, links: (value.links ?? []).filter((_, current) => current !== index) })); }
    return <Layout><section className="account-settings container"><header><div><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Your profile</h1><p>Keep your public information current and your account secure.</p></div><Link to="/profile"><ArrowLeft aria-hidden="true"/> Back to your stories</Link></header><div className="settings-layout"><aside><label className={`settings-avatar-upload${avatarBusy ? ' busy' : ''}`} title="Upload a new avatar"><span className="settings-avatar">{user.avatar ? <img src={user.avatar} alt={`${user.name}'s avatar`}/> : user.name?.[0]?.toUpperCase() ?? 'L'}</span><span className="settings-avatar-overlay">{avatarBusy ? 'Uploading…' : 'Change'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={avatarBusy} onChange={changeAvatar}/></label><strong>{user.name}</strong><span>{user.email}</span><nav aria-label="Account settings"><button type="button" aria-current={tab === 'profile' ? 'page' : undefined} className={tab === 'profile' ? 'active' : ''} onClick={() => switchTab('profile')}><i><UserRound aria-hidden="true"/></i><span>Personal information<small>Public author details</small></span></button><button type="button" aria-current={tab === 'appearance' ? 'page' : undefined} className={tab === 'appearance' ? 'active' : ''} onClick={() => switchTab('appearance')}><i><Palette aria-hidden="true"/></i><span>Appearance<small>Color theme</small></span></button><button type="button" aria-current={tab === 'password' ? 'page' : undefined} className={tab === 'password' ? 'active' : ''} onClick={() => switchTab('password')}><i><ShieldCheck aria-hidden="true"/></i><span>Password & security<small>Update your password</small></span></button></nav></aside><div className="settings-panel">{tab === 'profile' ? <><header><h2>Personal information</h2><p>Your bio and links appear on your public author page.</p></header><form onSubmit={saveProfile}><label><span>Full name</span><input value={name} onChange={event => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required/><small aria-hidden="true"/></label><label><span>Email address</span><input value={user.email} readOnly disabled/><small>Email cannot be changed from this screen.</small></label><label><span>Phone number</span><input value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" maxLength={20}/><small aria-hidden="true"/></label><label><span>Author bio <em>{bio.length}/320</em></span><textarea value={bio} onChange={event => setBio(event.target.value)} maxLength={320} placeholder="Tell readers a little about your perspective and work."/></label>{([['website', 'Website'], ['x', 'X profile'], ['linkedin', 'LinkedIn']] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type="url" value={socials[key] ?? ''} onChange={event => setSocials(value => ({ ...value, [key]: event.target.value }))} placeholder="https://"/><small aria-hidden="true"/></label>)}
<fieldset className="profile-interests"><legend>Reading interests</legend><small>Home and Explore use these categories to personalize your stories.</small><div>{categories.map(category=><label key={category.id}><input type="checkbox" checked={interests.includes(category.id)} onChange={()=>setInterests(current=>current.includes(category.id)?current.filter(id=>id!==category.id):[...current,category.id])}/><span><Check aria-hidden="true"/>{category.name}</span></label>)}</div></fieldset>
<section className="custom-links">
<header><div><strong>Other links</strong><small>Add up to 8 named links to your author page.</small></div><button type="button" disabled={(socials.links?.length ?? 0) >= 8} onClick={addCustomLink}><Plus aria-hidden="true"/> Add link</button></header>{socials.links?.map((link, index) => <div className="custom-link-row" key={index}><label><span>Link name</span><input value={link.name} maxLength={40} placeholder="Portfolio" onChange={event => updateCustomLink(index, 'name', event.target.value)}/></label><label><span>URL</span><input type="url" value={link.url} placeholder="https://example.com" onChange={event => updateCustomLink(index, 'url', event.target.value)}/></label><button type="button" aria-label={`Remove ${link.name || 'custom link'}`} onClick={() => removeCustomLink(index)}><Trash2 aria-hidden="true"/></button></div>)}</section>{error && <div className="settings-message error" role="alert">{error}</div>}<footer><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></footer></form></> : tab === 'appearance' ? <AppearancePanel accent={accent} committed={committedAccent} onSelect={selectAccent} onSave={saveAppearance}/> : <><header><h2>Change password</h2><p>Use at least 8 characters. Your new password must differ from the current one.</p></header><form onSubmit={savePassword}>{([['current', 'Current password', 'current_password'], ['next', 'New password', 'new_password'], ['confirm', 'Confirm new password', 'confirm_password']] as const).map(([key, label, name]) => <label key={key}><span>{label}</span><div className="settings-password"><input name={name} type={show[key] ? 'text' : 'password'} minLength={8} maxLength={128} autoComplete={key === 'current' ? 'current-password' : 'new-password'} required/><button type="button" aria-label={`${show[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setShow(value => ({ ...value, [key]: !value[key] }))}>{show[key] ? 'Hide' : 'Show'}</button></div><small aria-hidden="true"/></label>)}{error && <div className="settings-message error" role="alert">{error}</div>}<footer><button className="button" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></footer></form></>}</div></div></section></Layout>;
}

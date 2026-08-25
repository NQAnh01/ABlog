import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Input, Layout } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'

export function LoginPage() {
  const { user, login } = useAuth(); const navigate = useNavigate(); const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [show,setShow]=useState(false)
  if (user) return <Navigate to="/profile" replace/>
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form=new FormData(e.currentTarget); setBusy(true); setError(''); try { await login(String(form.get('email')),String(form.get('password'))); navigate('/profile') } catch(err) { setError(err instanceof Error ? err.message : 'Unable to sign in') } finally { setBusy(false) } }
  return <Layout><section className="auth-page"><div className="auth-card"><header><h1>Welcome Back</h1><p>Sign in to continue to Lumina.</p></header><form onSubmit={submit}>
    <Input label="Email Address" name="email" type="email" placeholder="name@example.com" required/>
    <div className="password-row"><Input label="Password" name="password" type={show?'text':'password'} placeholder="••••••••" required/><button type="button" onClick={()=>setShow(!show)}>◉</button></div>
    <div className="form-between"><span/><Link to="/forgot-password">Forgot password?</Link></div>{error&&<p className="form-error">{error}</p>}
    <Button disabled={busy}>{busy?'Signing in…':'Sign In  →'}</Button><div className="divider"><span>OR CONTINUE WITH</span></div><button className="google" type="button">ⓖ &nbsp; Sign in with Google</button>
  </form><p className="auth-switch">Don't have an account? <Link to="/register">Sign up</Link></p></div></section></Layout>
}
export function RegisterPage() {
  const { user, register }=useAuth(); const navigate=useNavigate(); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  if(user) return <Navigate to="/profile" replace/>
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');try{await register(String(f.get('name')),String(f.get('email')),String(f.get('password')));navigate('/profile')}catch(err){setError(err instanceof Error?err.message:'Unable to register')}finally{setBusy(false)}}
  return <Layout><section className="register-page"><aside style={{backgroundImage:'url(https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1000&q=85)'}}><blockquote>“The clearest way into the Universe is through a forest wilderness.”</blockquote><span>— JOHN MUIR</span></aside><div className="register-card"><header><h1>Join Lumina</h1><p>Elevate your writing. Inspire your readers.</p></header><form onSubmit={submit}><Input label="Full Name" name="name" placeholder="Jane Doe" required/><Input label="Email Address" name="email" type="email" placeholder="jane@example.com" required/><Input label="Password" name="password" type="password" minLength={8} placeholder="••••••••" required/><label className="terms"><input type="checkbox" required/> I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</label>{error&&<p className="form-error">{error}</p>}<Button disabled={busy}>{busy?'Creating account…':'Create Account'}</Button></form><p className="auth-switch">Already have an account? <Link to="/login">Sign in here</Link></p></div></section></Layout>
}
export function ForgotPasswordPage() {
  const [email,setEmail]=useState('');const[message,setMessage]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false)
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{const result=await api.forgotPassword(email);setMessage(result.message)}catch(err){setError(err instanceof Error?err.message:'Unable to request a reset link')}finally{setBusy(false)}}
  return <Layout><section className="auth-page"><div className="auth-card"><header><h1>Reset your password</h1><p>Enter your account email to receive reset instructions.</p></header><form onSubmit={submit}><Input label="Email Address" type="email" value={email} onChange={event=>setEmail(event.target.value)} required/>{message&&<p className="auth-success" role="status">{message}</p>}{error&&<p className="form-error">{error}</p>}<Button disabled={busy}>{busy?'Sending…':'Send reset link'}</Button></form><p className="auth-switch"><Link to="/login">← Back to sign in</Link></p></div></section></Layout>
}
export function ResetPasswordPage() {
  const [params]=useSearchParams();const navigate=useNavigate();const[error,setError]=useState('');const[busy,setBusy]=useState(false);const token=params.get('token')??''
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setError('');try{await api.resetPassword(token,String(data.get('password')),String(data.get('confirm')));navigate('/login',{replace:true})}catch(err){setError(err instanceof Error?err.message:'Unable to reset password')}finally{setBusy(false)}}
  return <Layout><section className="auth-page"><div className="auth-card"><header><h1>Choose a new password</h1><p>This reset link can be used once and expires after one hour.</p></header>{!token?<p className="form-error">This reset link is invalid.</p>:<form onSubmit={submit}><Input label="New password" name="password" type="password" minLength={8} required/><Input label="Confirm password" name="confirm" type="password" minLength={8} required/>{error&&<p className="form-error">{error}</p>}<Button disabled={busy}>{busy?'Updating…':'Update password'}</Button></form>}</div></section></Layout>
}

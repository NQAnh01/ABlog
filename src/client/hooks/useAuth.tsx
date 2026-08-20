import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../services/api'
import type { User } from '../types'
import { useToast } from './useToast'

type AuthValue = { user: User | null; loading: boolean; login(email: string, password: string): Promise<void>; register(name: string, email: string, password: string): Promise<void>; updateProfile(name: string, phone: string): Promise<User>; uploadAvatar(file: File): Promise<User>; logout(): Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.me().then(setUser).catch(() => null).finally(() => setLoading(false)) }, [])
  async function login(email: string, password: string) { const result = await api.login(email, password); api.setToken(result.access_token); setUser(result.user); toast('Signed in successfully.') }
  async function register(name: string, email: string, password: string) { const result = await api.register(name, email, password); api.setToken(result.access_token); setUser(result.user); toast('Account created successfully.') }
  async function updateProfile(name: string, phone: string) { const result = await api.updateProfile(name, phone); setUser(result); toast('Profile updated successfully.'); return result }
  async function uploadAvatar(file: File) { const result = await api.uploadAvatar(file); setUser(result); toast('Avatar uploaded successfully.'); return result }
  async function logout() { await api.logout(); api.setToken(''); setUser(null); toast('Signed out successfully.', 'info') }
  return <AuthContext.Provider value={{ user, loading, login, register, updateProfile, uploadAvatar, logout }}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth requires AuthProvider'); return value }

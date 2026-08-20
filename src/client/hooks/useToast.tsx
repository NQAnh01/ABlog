import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error' | 'info'
type Toast = { id: number; message: string; kind: ToastKind }
type ToastContextValue = { toast(message: string, kind?: ToastKind): void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const nextID = useRef(0)
  const dismiss = useCallback((id: number) => setItems(current => current.filter(item => item.id !== id)), [])
  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++nextID.current
    setItems(current => [...current.slice(-3), { id, message, kind }])
    window.setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  return <ToastContext.Provider value={{ toast }}>
    {children}
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {items.map(item => <div className={`react-toast ${item.kind}`} role={item.kind === 'error' ? 'alert' : 'status'} key={item.id}>
        <span className="toast-symbol" aria-hidden="true">{item.kind === 'success' ? '✓' : item.kind === 'error' ? '!' : 'i'}</span>
        <p>{item.message}</p>
        <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(item.id)}>×</button>
      </div>)}
    </div>
  </ToastContext.Provider>
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast requires ToastProvider')
  return value.toast
}

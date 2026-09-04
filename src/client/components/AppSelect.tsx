import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type AppSelectOption = { value: string; label: string }

export function AppSelect({ value, defaultValue = '', initialValue, options, label, name, onChange, className = '' }: {
  value?: string
  defaultValue?: string
  initialValue?: string
  options: AppSelectOption[]
  label: string
  name?: string
  onChange?: (value: string) => void
  className?: string
}) {
  const controlled = value !== undefined
  const startingValue = initialValue ?? defaultValue
  const [internalValue, setInternalValue] = useState(value ?? startingValue)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const currentValue = controlled ? value : internalValue
  const selected = options.find(option => option.value === currentValue) ?? options[0]

  useEffect(() => {
    if (!controlled && initialValue !== undefined) setInternalValue(initialValue)
  }, [controlled, initialValue])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function select(next: string) {
    if (!controlled) setInternalValue(next)
    onChange?.(next)
  }

  function move(direction: number) {
    const current = Math.max(0, options.findIndex(option => option.value === currentValue))
    select(options[(current + direction + options.length) % options.length].value)
  }

  return <div className={`app-select${open ? ' open' : ''}${className ? ` ${className}` : ''}`} ref={root}>
    {name && <input type="hidden" name={name} value={currentValue}/>} 
    <button type="button" className="app-select-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(current => !current)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1); setOpen(true) }
      else if (event.key === 'Escape') setOpen(false)
    }}><span>{selected?.label ?? ''}</span><ChevronDown aria-hidden="true"/></button>
    {open && <div className="app-select-list" id={listId} role="listbox" aria-label={label}>{options.map(option => <button type="button" role="option" aria-selected={option.value === currentValue} className={option.value === currentValue ? 'selected' : ''} key={option.value} onClick={() => { select(option.value); setOpen(false) }}><Check aria-hidden="true"/><span>{option.label}</span></button>)}</div>}
  </div>
}

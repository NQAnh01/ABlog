import { isValidElement, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../services/api'

type Props = { value: string; onChange(value: string): void; onError(message: string): void }
type Action = { label: string; title: string; before: string; after?: string; placeholder?: string; line?: boolean }

const actions: Action[] = [
  { label: 'H2', title: 'Heading', before: '## ', line: true },
  { label: 'B', title: 'Bold', before: '**', after: '**', placeholder: 'bold text' },
  { label: 'I', title: 'Italic', before: '_', after: '_', placeholder: 'italic text' },
  { label: '❝', title: 'Quote', before: '> ', line: true },
  { label: '•', title: 'Bullet list', before: '- ', line: true },
  { label: '1.', title: 'Numbered list', before: '1. ', line: true },
  { label: '☑', title: 'Task', before: '- [ ] ', line: true },
  { label: '<>', title: 'Inline code', before: '`', after: '`', placeholder: 'code' },
  { label: '―', title: 'Divider', before: '\n---\n', line: true },
]

function normalizeMarkdown(source: string) {
  const output: string[] = []
  let inCodeBlock = false

  for (const rawLine of source.replace(/\\`\\`\\`/g, '```').split(/\r?\n/)) {
    let line = rawLine
    if (!inCodeBlock) {
      const fenceAt = line.indexOf('```')
      if (fenceAt < 0) { output.push(line); continue }

      const beforeFence = line.slice(0, fenceAt).trimEnd()
      if (beforeFence) output.push(beforeFence)
      const afterFence = line.slice(fenceAt + 3).trim()
      const parts = afterFence.match(/^([a-zA-Z0-9_+#.-]+)(?:\s+([\s\S]*))?$/)
      const language = parts?.[1] ?? ''
      const firstCodeLine = parts?.[2] ?? ''
      output.push(`\`\`\`${language}`)
      if (firstCodeLine) output.push(firstCodeLine)
      inCodeBlock = true
      continue
    }

    const fenceAt = line.indexOf('```')
    if (fenceAt < 0) { output.push(line); continue }
    const codeBeforeFence = line.slice(0, fenceAt).trimEnd()
    if (codeBeforeFence) output.push(codeBeforeFence)
    output.push('```')
    const afterFence = line.slice(fenceAt + 3).trim()
    if (afterFence) output.push(afterFence)
    inCodeBlock = false
  }

  if (inCodeBlock) output.push('```')
  return output.join('\n')
}

function MarkdownCodeBlock({ children }: { children?: ReactNode }) {
  const code = isValidElement<{ className?: string; children?: ReactNode }>(children) ? children : null
  const language = code?.props.className?.replace('language-', '') || 'text'
  const value = String(code?.props.children ?? '').replace(/\n$/, '')
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }
  return <div className="markdown-code-block"><header><span>{language}</span><button type="button" onClick={() => void copy()}>{copied ? 'Copied!' : 'Copy'}</button></header><pre><code className={code?.props.className}>{value}</code></pre></div>
}

export function MarkdownView({ children }: { children: string }) {
  return <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: MarkdownCodeBlock }}>{normalizeMarkdown(children)}</ReactMarkdown></div>
}

export function MarkdownEditor({ value, onChange, onError }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [uploading, setUploading] = useState(false)

  function insert(action: Action) {
    const element = textarea.current
    if (!element) return
    const start = element.selectionStart, end = element.selectionEnd
    const selected = value.slice(start, end) || action.placeholder || ''
    let before = action.before, prefix = ''
    if (action.line && start > 0 && value[start - 1] !== '\n') prefix = '\n'
    const inserted = `${prefix}${before}${selected}${action.after ?? ''}`
    onChange(value.slice(0, start) + inserted + value.slice(end))
    requestAnimationFrame(() => { element.focus(); const cursor = start + prefix.length + before.length + selected.length; element.setSelectionRange(cursor, cursor) })
  }

  function insertLink() {
    const url = window.prompt('Link URL', 'https://')
    if (!url) return
    const element = textarea.current
    if (!element) return
    const start = element.selectionStart, end = element.selectionEnd
    const text = value.slice(start, end) || 'link text'
    const markdown = `[${text}](${url})`
    onChange(value.slice(0, start) + markdown + value.slice(end))
  }

  function insertCodeBlock() {
    const element = textarea.current
    if (!element) return
    const language = window.prompt('Code language (for example: javascript, go, python)', '')?.trim().replace(/[^a-zA-Z0-9_+#.-]/g, '') ?? ''
    const start = element.selectionStart, end = element.selectionEnd
    const selected = value.slice(start, end) || 'code'
    const prefix = start > 0 && value[start - 1] !== '\n' ? '\n' : ''
    const markdown = `${prefix}\`\`\`${language}\n${selected}\n\`\`\``
    onChange(value.slice(0, start) + markdown + value.slice(end))
    requestAnimationFrame(() => { element.focus(); const cursor = start + prefix.length + 3 + language.length + 1 + selected.length; element.setSelectionRange(cursor, cursor) })
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const element = textarea.current
    const position = element?.selectionStart ?? value.length
    setUploading(true)
    try {
      const media = await api.uploadImage(file)
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
      const markdown = `\n![${alt}](${media.url})\n`
      onChange(value.slice(0, position) + markdown + value.slice(position))
    } catch (error) { onError(error instanceof Error ? error.message : 'Unable to upload inline image') }
    finally { setUploading(false); event.target.value = '' }
  }

  return <div className="markdown-editor"><header><div className="markdown-tabs"><button type="button" className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>Write</button><button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>Preview</button></div>{mode === 'write' && <div className="markdown-toolbar">{actions.map(action => <button type="button" key={action.title} title={action.title} onClick={() => insert(action)}>{action.label}</button>)}<button type="button" title="Code block" onClick={insertCodeBlock}>```</button><button type="button" title="Insert link" onClick={insertLink}>⌁</button><button type="button" title="Upload image" disabled={uploading} onClick={() => imageInput.current?.click()}>{uploading ? '…' : '▧'}</button><input ref={imageInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={event => void uploadImage(event)} /></div>}</header>{mode === 'write' ? <textarea ref={textarea} value={value} onChange={event => onChange(event.target.value)} placeholder={'Begin writing in Markdown…\n\n## A new section\n\nTell the story with clarity.'} required spellCheck={false} /> : value.trim() ? <MarkdownView>{value}</MarkdownView> : <div className="markdown-empty">Nothing to preview yet.</div>}</div>
}

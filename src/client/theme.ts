export const accentThemes = [
  { id: 'violet', name: 'Violet', color: '#6d5ce7' },
  { id: 'blue', name: 'Ocean', color: '#1677c8' },
  { id: 'green', name: 'Forest', color: '#18865b' },
  { id: 'teal', name: 'Emerald', color: '#0f8b83' },
  { id: 'yellow', name: 'Golden', color: '#d19a00' },
  { id: 'orange', name: 'Sunset', color: '#c35d16' },
  { id: 'red', name: 'Crimson', color: '#c73535' },
  { id: 'rose', name: 'Rose', color: '#c23c68' },
  { id: 'mono', name: 'Monochrome', color: '#242424' },
] as const

export type AccentTheme = typeof accentThemes[number]['id']
export const accentStorageKey = 'lumina-accent'
export const accentPreviewEvent = 'lumina:preview-accent'

export function isAccentTheme(value: unknown): value is AccentTheme {
  return accentThemes.some(theme => theme.id === value)
}

export function savedAccent(): AccentTheme {
  const value = localStorage.getItem(accentStorageKey)
  return isAccentTheme(value) ? value : 'violet'
}

export function previewAccent(accent: AccentTheme) {
  window.dispatchEvent(new CustomEvent<AccentTheme>(accentPreviewEvent, { detail: accent }))
}

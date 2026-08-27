import assert from 'node:assert/strict'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { MarkdownManager } from '@tiptap/markdown'

const markdown = [
  '# Main heading',
  '',
  'A **bold** and *italic* paragraph with ~~strikethrough~~, `inline code`, and a [link](https://example.com).',
  '',
  '- Bullet one',
  '- Bullet two',
  '',
  '1. First',
  '2. Second',
  '',
  '> A quoted thought.',
  '',
  '```javascript',
  'const answer = 42',
  '```',
  '',
  '---',
  '',
  '![Cover](https://example.com/cover.png)',
].join('\n')

const manager = new MarkdownManager({ extensions: [StarterKit, Image] })
const firstAST = manager.parse(markdown)
const serialized = manager.serialize(firstAST)
const secondAST = manager.parse(serialized)

assert.deepEqual(secondAST, firstAST, 'Markdown → AST → Markdown → AST must preserve document structure')
for (const expected of ['# Main heading', '**bold**', '*italic*', '~~strikethrough~~', '`inline code`', '[link](https://example.com)', '- Bullet one', '1. First', '> A quoted thought.', '```javascript', 'const answer = 42', '---', '![Cover](https://example.com/cover.png)']) {
  assert.ok(serialized.includes(expected), `round-trip output lost ${expected}`)
}

import { useState, useCallback } from 'react'
import { useToast } from '../hooks/useToast'
import { useBookmarks } from '../hooks/useBookmarks'
import type { Post } from '../types'

function openSharePopup(url: string, windowName: string) {
  const width = 620
  const height = 520
  const left = typeof window !== 'undefined' ? window.screenX + (window.outerWidth - width) / 2 : 0
  const top = typeof window !== 'undefined' ? window.screenY + (window.outerHeight - height) / 2 : 0
  window.open(
    url,
    windowName,
    `width=${width},height=${height},left=${left},top=${top},location=no,menubar=no,status=no,scrollbars=yes,resizable=yes,noopener,noreferrer`
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.62 1.62 0 1 0 0-3.24 1.62 1.62 0 0 0 0 3.24m1.4 9.74v-8.37H5.06v8.37h2.8z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function NativeShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function StoryBookmarkButton({ postId }: { postId: string }) {
  const { isBookmarked, toggleBookmark } = useBookmarks()
  const [busy, setBusy] = useState(false)
  const saved = isBookmarked(postId)

  const handleToggle = async () => {
    setBusy(true)
    try {
      await toggleBookmark(postId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`story-meta-btn bookmark-btn-meta ${saved ? 'bookmarked' : ''}`}
      onClick={handleToggle}
      disabled={busy}
      title={saved ? 'Xóa khỏi danh sách đọc' : 'Lưu vào danh sách đọc'}
      aria-label={saved ? 'Remove from saved stories' : 'Save story'}
    >
      <BookmarkIcon filled={saved} />
      <span>{saved ? 'Đã lưu' : 'Lưu bài'}</span>
    </button>
  )
}

export function SocialShareBar({ post }: { post: Post }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/blog/${post.slug}`
    : ''

  const shareToFacebook = () => {
    openSharePopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, 'FacebookShare')
  }

  const shareToX = () => {
    const text = post.title
    openSharePopup(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, 'XShare')
  }

  const shareToLinkedIn = () => {
    openSharePopup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, 'LinkedInShare')
  }

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast('Đã sao chép liên kết bài viết!')
      setTimeout(() => setCopied(false), 2200)
    } catch {
      toast('Không thể sao chép liên kết')
    }
  }, [shareUrl, toast])

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleNativeShare = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt || post.title,
          url: shareUrl,
        })
      } catch {
        // User dismissed
      }
    }
  }

  return (
    <div className="social-share-bar" role="group" aria-label="Chia sẻ bài viết">
      <button
        type="button"
        className="share-icon-btn facebook"
        onClick={shareToFacebook}
        title="Chia sẻ lên Facebook"
        aria-label="Share on Facebook"
      >
        <FacebookIcon />
      </button>

      <button
        type="button"
        className="share-icon-btn x-twitter"
        onClick={shareToX}
        title="Chia sẻ lên X (Twitter)"
        aria-label="Share on X"
      >
        <XIcon />
      </button>

      <button
        type="button"
        className="share-icon-btn linkedin"
        onClick={shareToLinkedIn}
        title="Chia sẻ lên LinkedIn"
        aria-label="Share on LinkedIn"
      >
        <LinkedInIcon />
      </button>

      <button
        type="button"
        className={`share-icon-btn copy-link ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        title={copied ? 'Đã sao chép liên kết' : 'Sao chép liên kết bài viết'}
        aria-label="Copy link"
      >
        {copied ? <CheckIcon /> : <LinkIcon />}
      </button>

      {canNativeShare && (
        <button
          type="button"
          className="share-icon-btn native-share"
          onClick={handleNativeShare}
          title="Chia sẻ qua ứng dụng khác"
          aria-label="Share via device"
        >
          <NativeShareIcon />
        </button>
      )}
    </div>
  )
}

export function ArticleShareSection({ post }: { post: Post }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/blog/${post.slug}`
    : ''

  const shareToFacebook = () => {
    openSharePopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, 'FacebookShare')
  }

  const shareToX = () => {
    const text = post.title
    openSharePopup(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, 'XShare')
  }

  const shareToLinkedIn = () => {
    openSharePopup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, 'LinkedInShare')
  }

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast('Đã sao chép liên kết bài viết!')
      setTimeout(() => setCopied(false), 2200)
    } catch {
      toast('Không thể sao chép liên kết')
    }
  }, [shareUrl, toast])

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleNativeShare = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt || post.title,
          url: shareUrl,
        })
      } catch {
        // User dismissed
      }
    }
  }

  return (
    <section className="article-share-section" aria-label="Chia sẻ bài viết này">
      <div className="article-share-heading">
        <span className="eyebrow">LAN TỎA NỘI DUNG</span>
        <h3>Chia sẻ bài viết này</h3>
        <p>Nếu bạn thấy bài viết hữu ích hoặc mở ra góc nhìn mới, hãy chia sẻ tới bạn bè và cộng đồng.</p>
      </div>

      <div className="article-share-buttons">
        <button
          type="button"
          className="share-pill-btn facebook"
          onClick={shareToFacebook}
        >
          <FacebookIcon />
          <span>Facebook</span>
        </button>

        <button
          type="button"
          className="share-pill-btn x-twitter"
          onClick={shareToX}
        >
          <XIcon />
          <span>X / Twitter</span>
        </button>

        <button
          type="button"
          className="share-pill-btn linkedin"
          onClick={shareToLinkedIn}
        >
          <LinkedInIcon />
          <span>LinkedIn</span>
        </button>

        <button
          type="button"
          className={`share-pill-btn copy-link ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
        >
          {copied ? <CheckIcon /> : <LinkIcon />}
          <span>{copied ? 'Đã sao chép link' : 'Sao chép link'}</span>
        </button>

        {canNativeShare && (
          <button
            type="button"
            className="share-pill-btn native-share"
            onClick={handleNativeShare}
          >
            <NativeShareIcon />
            <span>Chia sẻ khác…</span>
          </button>
        )}
      </div>
    </section>
  )
}

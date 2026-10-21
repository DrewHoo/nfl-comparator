import { useState } from 'react'
import { SITE } from '../lib/share.ts'

/** The native share sheet where there is one, else copy "text url" and flash "copied". Streak King's hook. */
export function useShare() {
  const [copied, setCopied] = useState(false)
  const share = (text: string, url: string) => {
    try {
      if (navigator.share) { navigator.share({ title: SITE, text, url }).catch(() => {}); return }
      navigator.clipboard.writeText(`${text} ${url}`).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      })
    } catch {}
  }
  return { copied, share }
}

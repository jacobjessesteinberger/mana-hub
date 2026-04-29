import { useEffect, useState } from 'react'

export function usePageVisible() {
  const [visible, setVisible] = useState(
    typeof document !== 'undefined' ? !document.hidden : true
  )

  useEffect(() => {
    const handler = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  return visible
}

export function useVisibleInterval(
  callback: () => void,
  intervalMs: number,
  enabled = true
) {
  const visible = usePageVisible()

  useEffect(() => {
    if (!enabled || !visible) return
    const id = setInterval(callback, intervalMs)
    return () => clearInterval(id)
  }, [callback, intervalMs, enabled, visible])

  return visible
}

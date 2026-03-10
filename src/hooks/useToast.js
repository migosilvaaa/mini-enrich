import { useState, useCallback } from 'react'

let _id = 0

/**
 * Lightweight toast notification hook.
 * Keeps at most 3 toasts visible; each auto-dismisses after 5 seconds.
 *
 * Usage:
 *   const { toasts, addToast, removeToast } = useToast()
 *   addToast('Something went wrong', 'error')   // 'error' | 'warning' | 'info'
 */
export function useToast() {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'error') => {
    const id = ++_id
    setToasts((prev) => {
      // Keep only the 2 most recent before adding the new one (max 3 visible)
      return [...prev.slice(-2), { id, message, type }]
    })
    setTimeout(() => removeToast(id), 5000)
  }, [removeToast])

  return { toasts, addToast, removeToast }
}

import { useEffect, useState } from 'react'

const STATUS = {
  loading: 'loading',
  connected: 'connected',
  error: 'error',
  not_configured: 'not_configured',
}

export default function ConnectionStatus({ onStatusChange }) {
  const [status, setStatus] = useState(STATUS.loading)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch('/api/auth-check')
        const json = await res.json()
        if (cancelled) return

        if (json.status === 'connected') {
          setStatus(STATUS.connected)
          onStatusChange?.('connected')
        } else if (json.status === 'not_configured') {
          setStatus(STATUS.not_configured)
          onStatusChange?.('not_configured')
        } else {
          setStatus(STATUS.error)
          setMessage(json.message || 'Unknown error')
          onStatusChange?.('error')
        }
      } catch {
        if (cancelled) return
        setStatus(STATUS.error)
        setMessage('Could not reach the server.')
        onStatusChange?.('error')
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  if (status === STATUS.loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="h-2 w-2 rounded-full bg-gray-300 animate-pulse" />
        Checking ZoomInfo connection…
      </div>
    )
  }

  if (status === STATUS.connected) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 w-fit">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        ZoomInfo Connected
      </div>
    )
  }

  if (status === STATUS.not_configured) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1 w-fit">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          ZoomInfo Not Configured
        </div>
        <p className="text-xs text-gray-500 pl-1">Contact your admin to set the environment variables.</p>
      </div>
    )
  }

  // error
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1 w-fit">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        ZoomInfo Not Configured
      </div>
      <p className="text-xs text-gray-500 pl-1">
        {message || 'Contact your admin to set the environment variables.'}
      </p>
    </div>
  )
}

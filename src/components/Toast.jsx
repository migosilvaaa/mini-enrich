import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react'

const STYLES = {
  error:   { bar: 'bg-red-600',     icon: AlertCircle,   text: 'text-white' },
  warning: { bar: 'bg-amber-500',   icon: AlertTriangle, text: 'text-white' },
  info:    { bar: 'bg-[#050038]',   icon: Info,          text: 'text-white' },
}

function Toast({ id, message, type, onDismiss }) {
  const style = STYLES[type] || STYLES.error
  const Icon  = style.icon

  return (
    <div
      className={`flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg ${style.bar} ${style.text} max-w-sm w-full`}
      role="alert"
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0 opacity-90" />
      <p className="text-sm flex-1 leading-snug">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className="opacity-70 hover:opacity-100 transition-opacity shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Fixed-position toast stack rendered in the bottom-right corner.
 * Place once at the App root; pass toasts from useToast().
 */
export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto animate-fade-in">
          <Toast {...t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}

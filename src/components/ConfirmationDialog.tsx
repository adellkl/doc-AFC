import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

type ConfirmationDialogProps = {
  isOpen: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  isConfirming?: boolean
  onCancel: () => void
  onConfirm: () => void
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function ConfirmationDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annuler',
  variant = 'default',
  isConfirming = false,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusTimer = window.requestAnimationFrame(() => cancelButtonRef.current?.focus())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!isConfirming) onCancel()
        return
      }

      if (event.key !== 'Tab') return

      const focusableElements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstFocusableElement = focusableElements[0]
      const lastFocusableElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstFocusableElement) {
        event.preventDefault()
        lastFocusableElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
        event.preventDefault()
        firstFocusableElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedElement?.focus()
    }
  }, [isConfirming, isOpen, onCancel])

  if (!isOpen) return null

  const isDanger = variant === 'danger'
  const confirmButtonClass = isDanger
    ? 'bg-[#9F3B22] hover:bg-[#7D2E1A] focus-visible:ring-[#F6C3B5]'
    : 'bg-[#245A43] hover:bg-[#17201B] focus-visible:ring-[#C8D1FF]'

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#17201B]/55 px-5 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isConfirming) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-busy={isConfirming}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-[1.75rem] border border-[#D4CCBE] bg-[#F7F4EE] p-5 shadow-[0_24px_80px_rgba(23,32,27,0.35)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${isDanger ? 'bg-[#FCE5DD] text-[#9F3B22]' : 'bg-[#F3F5FF] text-[#3C56D7]'}`}>
            <AlertTriangle size={21} strokeWidth={1.8} />
          </span>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-[#69756D] transition hover:bg-[#E7E1D7] hover:text-[#17201B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]"
            onClick={onCancel}
            disabled={isConfirming}
            aria-label="Fermer la confirmation"
          >
            <X size={18} />
          </button>
        </div>

        <h2 id={titleId} className="mt-5 font-sans text-3xl font-bold tracking-[-0.055em] text-[#17201B]">
          {title}
        </h2>
        <p id={descriptionId} className="mt-3 font-sans text-sm leading-6 text-[#536058]">
          {description}
        </p>

        <div className="mt-7 grid gap-2 sm:grid-cols-2">
          <button
            ref={cancelButtonRef}
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-[#BFC8C0] bg-white px-4 py-3 font-sans text-sm font-bold text-[#37443C] transition hover:border-[#245A43] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#C8D1FF] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-full px-4 py-3 font-sans text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60 ${confirmButtonClass}`}
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? 'Traitement…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

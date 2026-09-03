import { FileCheck2, Trash2, Upload } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { formatFileSize } from '../lib/format'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const acceptedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const acceptedExtensions = ['.pdf', '.jpg', '.jpeg', '.png']

type FileDropzoneProps = {
  label: string
  description: string
  file: File | null
  onChange: (file: File | null) => void
  acceptImagesOnly?: boolean
}

const hasAllowedExtension = (name: string) =>
  acceptedExtensions.some((extension) => name.toLowerCase().endsWith(extension))

export function FileDropzone({ label, description, file, onChange, acceptImagesOnly = false }: FileDropzoneProps) {
  const inputId = useId()
  const helpId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')

  const validateAndSetFile = (candidate?: File) => {
    if (!candidate) return

    const hasKnownType = candidate.type.length > 0
    const allowedTypes = acceptImagesOnly ? new Set(['image/jpeg', 'image/png']) : acceptedTypes
    const allowedExtensions = acceptImagesOnly ? ['.jpg', '.jpeg', '.png'] : acceptedExtensions
    if (!allowedExtensions.some((extension) => candidate.name.toLowerCase().endsWith(extension)) || (hasKnownType && !allowedTypes.has(candidate.type))) {
      setError(acceptImagesOnly ? 'Choisissez une image JPG ou PNG.' : 'Choisissez un PDF, JPG ou PNG.')
      return
    }

    if (candidate.size > MAX_FILE_SIZE) {
      setError('Ce fichier dépasse la limite de 10 Mo.')
      return
    }

    setError('')
    onChange(candidate)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files.length > 1) {
      setError('Déposez un seul fichier à la fois.')
      return
    }
    validateAndSetFile(event.dataTransfer.files.item(0) ?? undefined)
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        className="sr-only"
        type="file"
        accept={acceptImagesOnly ? 'image/jpeg,image/png,.jpg,.jpeg,.png' : 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png'}
        aria-label={label}
        aria-describedby={`${helpId} ${error ? errorId : ''}`}
        aria-invalid={Boolean(error)}
        tabIndex={-1}
        onChange={(event) => validateAndSetFile(event.target.files?.item(0) ?? undefined)}
      />

      {file ? (
        <div className="relative flex min-h-24 items-center gap-3 overflow-hidden rounded-[1.1rem] border border-[#A2CDB5] bg-[#F7FFF8] px-4 py-3 shadow-[0_8px_20px_rgba(36,90,67,0.07)] sm:min-h-24 sm:px-5">
          <span className="absolute right-0 top-0 h-8 w-8 border-b border-l border-[#A2CDB5] bg-[#E5F3E9]" />
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#245A43] text-white">
            <FileCheck2 size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1 pr-2">
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-[#427158]">
              Pièce ajoutée
            </p>
            <p className="mt-1 truncate font-sans text-sm font-semibold text-[#17201B]">{file.name}</p>
            <p className="mt-1 font-sans text-[11px] text-[#536058]">{formatFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#715447] transition-colors active:bg-[#F6DFD8] hover:bg-[#F6DFD8] hover:text-[#9F3B22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]"
            onClick={() => {
              onChange(null)
              setError('')
              if (inputRef.current) inputRef.current.value = ''
            }}
            aria-label={`Retirer ${label}`}
          >
            <Trash2 size={18} strokeWidth={1.7} />
          </button>
        </div>
      ) : (
        <div
          className={`relative overflow-hidden rounded-[1.1rem] border bg-white p-1 transition-all duration-200 ${
            isDragging
              ? 'border-dashed border-[#3C56D7] bg-[#F3F5FF] ring-2 ring-[#C8D1FF]'
              : 'border-[#D4CCBE] hover:border-[#8C9BF0] hover:bg-[#FBFBFF]'
          }`}
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setIsDragging(false)
          }}
          onDrop={onDrop}
        >
          <span className="absolute right-0 top-0 h-8 w-8 border-b border-l border-[#D4CCBE] bg-[#F7F4EE]" />
          <button
            type="button"
            className="flex min-h-24 w-full items-center gap-3 rounded-[0.85rem] px-4 py-3 text-left outline-none transition-colors active:bg-[#F3F5FF] focus-visible:ring-2 focus-visible:ring-[#3C56D7] sm:min-h-24 sm:px-5"
            onClick={() => inputRef.current?.click()}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#D4CCBE] bg-[#F7F4EE] text-[#245A43] transition-colors group-hover:bg-[#E5F3E9]">
              <Upload size={18} strokeWidth={1.7} />
            </span>
            <span>
              <span className="block font-sans text-sm font-semibold text-[#17201B]">{label}</span>
              <span id={helpId} className="mt-1 block font-sans text-[11px] leading-relaxed text-[#69756D]">
                {description}
              </span>
              <span className="mt-2 block font-sans text-xs font-medium text-[#3C56D7]">
                <span className="sm:hidden">Prendre une photo ou choisir</span>
                <span className="hidden sm:inline">Parcourir mes fichiers</span>
              </span>
            </span>
          </button>
        </div>
      )}

      {error && (
        <p id={errorId} className="mt-2 flex items-center gap-1.5 font-sans text-xs font-medium text-[#9F3B22]" role="alert">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C8502F]" />
          {error}
        </p>
      )}
    </div>
  )
}

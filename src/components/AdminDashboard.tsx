import {
  ArrowDownToLine,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Trash2,
  ExternalLink,
  FileText,
  LogOut,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import JSZip from 'jszip'
import { deleteApplication, getApplications, getDocumentSignedUrl, setApplicationStatus } from '../lib/database'
import { formatDate, formatDateTime, formatFileSize, statusMeta } from '../lib/format'
import type { ApplicationRecord, ApplicationStatus, StoredDocument } from '../types'
import { BrandMark } from './BrandMark'

type Filter = 'all' | ApplicationStatus

const applicationsPerPage = 10

type AdminDashboardProps = {
  onLogout: () => void
}

const filterLabels: Record<Filter, string> = {
  all: 'Tous',
  to_review: 'À vérifier',
  complete: 'Complets',
  incomplete: 'À compléter',
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

const countDocuments = (application: ApplicationRecord) =>
  Object.values(application.documents).filter((document): document is StoredDocument => Boolean(document)).length

const openDocument = async (documentFile: StoredDocument) => {
  const previewWindow = window.open('about:blank', '_blank')
  if (!previewWindow) {
    throw new Error('Preview window blocked')
  }

  previewWindow.opener = null
  previewWindow.document.title = 'Préparation du document…'

  try {
  previewWindow.location.replace(await getDocumentSignedUrl(documentFile))
  } catch (error) {
    previewWindow.close()
    throw error
  }
}

const downloadDocument = async (documentFile: StoredDocument) => {
  const anchor = document.createElement('a')
  anchor.href = await getDocumentSignedUrl(documentFile)
  anchor.download = documentFile.name
  anchor.referrerPolicy = 'no-referrer'
  anchor.rel = 'noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

const zipFilename = (application: ApplicationRecord) => {
  const name = `${application.firstName}-${application.lastName}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase('fr-FR')

  return `${name || 'dossier'}.zip`
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = statusMeta[status]
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.08em] ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#17201B]/55 p-4 backdrop-blur-sm" role="presentation">
      <section className="w-full max-w-sm rounded-2xl border border-[#D4CCBE] bg-[#FFFEFA] p-5 shadow-[0_24px_72px_rgba(23,32,27,0.3)] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3C56D7]">Confirmation requise</p>
        <h2 id="confirmation-title" className="mt-3 font-sans text-2xl font-bold tracking-[-0.05em] text-[#17201B]">{title}</h2>
        <p className="mt-3 font-sans text-sm leading-6 text-[#536058]">{description}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" className="rounded-xl border border-[#D4CCBE] px-4 py-3 font-sans text-sm font-bold text-[#245A43] transition hover:border-[#245A43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="rounded-xl bg-[#17201B] px-4 py-3 font-sans text-sm font-bold text-white transition hover:bg-[#245A43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function StatCard({ value, label, colour }: { value: number; label: string; colour: 'green' | 'blue' | 'apricot' }) {
  const dot = {
    green: 'bg-[#D8FF41]',
    blue: 'bg-[#AEB9FF]',
    apricot: 'bg-[#FFCE9B]',
  }[colour]

  return (
    <div className="rounded-2xl border border-[#D4CCBE] bg-white px-3 py-3 sm:px-5 sm:py-4">
      <span className={`block h-2 w-2 rounded-full ${dot}`} />
      <p className="mt-3 font-sans text-2xl font-bold tracking-[-0.06em] text-[#17201B] sm:mt-4 sm:text-3xl">{value}</p>
      <p className="mt-1 font-sans text-[8px] font-medium uppercase tracking-[0.08em] text-[#69756D] sm:text-[10px] sm:tracking-[0.12em]">{label}</p>
    </div>
  )
}

function MobileApplicationCard({ application, onOpen }: { application: ApplicationRecord; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[5.4rem] w-full items-center gap-3 px-4 py-3 text-left transition active:bg-[#F3F5FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3C56D7]"
    >
      <ProfileAvatar application={application} size="h-10 w-10" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-sans text-sm font-bold text-[#17201B]">{application.firstName} {application.lastName}</span>
          <StatusBadge status={application.status} />
        </span>
        <span className="mt-1.5 flex items-center gap-2 font-sans text-[10px] text-[#69756D]">
          <span>{formatDate(application.createdAt)}</span>
          <span className="h-1 w-1 rounded-full bg-[#BBC4BE]" />
          <span className="inline-flex items-center gap-1 text-[#245A43]"><CircleCheckBig size={12} /> {countDocuments(application)} pièce{countDocuments(application) !== 1 ? 's' : ''}</span>
        </span>
      </span>
      <ChevronRight className="shrink-0 text-[#3C56D7]" size={19} />
    </button>
  )
}

function ProfileAvatar({ application, size = 'h-9 w-9' }: { application: ApplicationRecord; size?: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const profilePhoto = application.documents.profilePhoto
  const initials = `${application.firstName[0] ?? ''}${application.lastName[0] ?? ''}`.toUpperCase()

  useEffect(() => {
    let isCurrent = true
    setPhotoUrl(null)

    if (!profilePhoto) return () => { isCurrent = false }

    void getDocumentSignedUrl(profilePhoto)
      .then((url) => { if (isCurrent) setPhotoUrl(url) })
      .catch(() => { if (isCurrent) setPhotoUrl(null) })

    return () => { isCurrent = false }
  }, [profilePhoto?.id])

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#E5F3E9] font-sans text-[10px] font-semibold text-[#245A43] ${size}`}>
      {photoUrl ? (
        <img className="h-full w-full object-cover" src={photoUrl} alt={`Photo de ${application.firstName} ${application.lastName}`} />
      ) : initials}
    </span>
  )
}

function ProfilePhotoPreview({
  documentFile,
  isSelected,
  onSelectionChange,
}: {
  documentFile: StoredDocument
  isSelected: boolean
  onSelectionChange: (selected: boolean) => void
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    void getDocumentSignedUrl(documentFile)
      .then((url) => { if (isCurrent) setPhotoUrl(url) })
      .catch(() => { if (isCurrent) setPhotoUrl(null) })
    return () => { isCurrent = false }
  }, [documentFile])

  return (
    <section className={`relative mt-5 aspect-[16/10] overflow-hidden rounded-2xl bg-[#17201B] transition ${isSelected ? 'ring-2 ring-[#3C56D7] ring-offset-2 ring-offset-[#F7F4EE]' : ''}`}>
      <p className="sr-only">Photo de profil — {documentFile.name}, {formatFileSize(documentFile.size)}</p>
      <div className="grid h-full w-full place-items-center">
        {photoUrl ? (
          <img className="h-full w-full object-cover object-center" src={photoUrl} alt="Photo de profil de l’adhérent" />
        ) : (
          <span className="font-sans text-xs text-[#69756D]">Chargement de la photo…</span>
        )}
      </div>
      <label className="absolute right-3 top-3 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur focus-within:ring-2 focus-within:ring-[#3C56D7]">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(event) => onSelectionChange(event.target.checked)}
          className="h-4 w-4 rounded border-[#9AA59D] accent-[#245A43]"
          aria-label="Sélectionner la photo de profil"
        />
      </label>
    </section>
  )
}

function DocumentAction({
  label,
  documentFile,
  isSelected,
  onSelectionChange,
}: {
  label: string
  documentFile: StoredDocument
  isSelected: boolean
  onSelectionChange: (selected: boolean) => void
}) {
  const [pendingAction, setPendingAction] = useState<'open' | 'download' | null>(null)
  const [error, setError] = useState('')

  const handleOpen = async () => {
    try {
      setPendingAction('open')
      setError('')
      await openDocument(documentFile)
    } catch {
      setError('Le document ne peut pas être ouvert pour le moment. Réessayez dans quelques instants.')
    } finally {
      setPendingAction(null)
    }
  }

  const handleDownload = async () => {
    try {
      setPendingAction('download')
      setError('')
      await downloadDocument(documentFile)
    } catch {
      setError('Le téléchargement sécurisé est momentanément indisponible. Réessayez dans quelques instants.')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <article className={`min-w-0 overflow-hidden rounded-2xl border bg-white p-4 transition ${isSelected ? 'border-[#3C56D7] ring-2 ring-[#DDE2FF]' : 'border-[#D4CCBE]'}`}>
      <div className="flex items-start gap-3">
        <label className="mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(event) => onSelectionChange(event.target.checked)}
            className="h-4 w-4 rounded border-[#9AA59D] accent-[#245A43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]"
            aria-label={`Sélectionner ${label}`}
          />
        </label>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F3F5FF] text-[#3C56D7]">
          <FileText size={19} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-sm font-bold text-[#17201B]">{label}</p>
          <p className="mt-1 truncate font-sans text-[10px] text-[#69756D]">{documentFile.name}</p>
          <p className="mt-1 font-sans text-[10px] text-[#69756D]">{formatFileSize(documentFile.size)}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D4CCBE] px-3 py-2.5 font-sans text-xs font-bold text-[#245A43] transition hover:border-[#245A43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7] disabled:cursor-wait disabled:opacity-60"
          onClick={() => void handleOpen()}
          disabled={pendingAction !== null}
        >
          {pendingAction === 'open' ? 'Ouverture…' : 'Ouvrir'} <ExternalLink size={14} />
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#245A43] px-3 py-2.5 font-sans text-xs font-bold text-white transition hover:bg-[#17201B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7] disabled:cursor-wait disabled:opacity-60"
          onClick={() => void handleDownload()}
          disabled={pendingAction !== null}
        >
          {pendingAction === 'download' ? 'Préparation…' : 'Télécharger'} <ArrowDownToLine size={14} />
        </button>
      </div>
      {error && <p className="mt-3 font-sans text-xs font-semibold text-[#9F3B22]" role="alert">{error}</p>}
    </article>
  )
}

function DetailPanel({
  application,
  onStatusChange,
  onDelete,
  isSavingStatus,
  isDeleting,
  statusError,
  deleteError,
}: {
  application: ApplicationRecord | null
  onStatusChange: (status: ApplicationStatus) => void
  onDelete: () => void
  isSavingStatus: boolean
  isDeleting: boolean
  statusError: string
  deleteError: string
}) {
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [isPreparingDownload, setIsPreparingDownload] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => {
    setSelectedDocumentIds([])
    setDownloadError('')
  }, [application?.id])

  if (!application) {
    return (
      <aside className="flex min-h-[28rem] items-center justify-center rounded-2xl border border-dashed border-[#BFC8C0] bg-[#F0ECE3] p-7 text-center">
        <div>
          <UserRound className="mx-auto text-[#69756D]" size={30} strokeWidth={1.5} />
          <p className="mt-4 font-sans text-sm font-semibold text-[#536058]">Sélectionnez un dossier</p>
          <p className="mt-1 font-sans text-xs leading-5 text-[#78827B]">Les informations détaillées apparaîtront ici.</p>
        </div>
      </aside>
    )
  }

  const profilePhoto = application.documents.profilePhoto
  const attachedDocuments = [
    { label: 'Carte d’identité', documentFile: application.documents.identityCard },
    { label: 'Certificat médical', documentFile: application.documents.medicalCertificate },
  ].filter((item): item is { label: string; documentFile: StoredDocument } => Boolean(item.documentFile))
  const selectableDocuments = [
    ...(profilePhoto ? [{ label: 'Photo de profil', documentFile: profilePhoto }] : []),
    ...attachedDocuments,
  ]

  const downloadSummary = () => {
    const text = [
      'ALPHA FIGHT CLUB — DOSSIER D’ADHÉSION',
      '',
      `Nom : ${application.firstName} ${application.lastName}`,
      `Reçu le : ${formatDateTime(application.createdAt)}`,
      `État : ${statusMeta[application.status].label}`,
      '',
      `Pièce d’identité : ${application.documents.identityCard?.name ?? 'Non reçue'}`,
      `Certificat médical : ${application.documents.medicalCertificate?.name ?? 'Non reçu'}`,
      `Photo de profil : ${application.documents.profilePhoto?.name ?? 'Non reçue'}`,
    ].join('\n')

    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `dossier-${application.lastName.toLowerCase()}.txt`)
  }

  const updateSelection = (documentId: string, selected: boolean) => {
    setSelectedDocumentIds((current) => selected
      ? [...new Set([...current, documentId])]
      : current.filter((id) => id !== documentId))
  }

  const downloadSelection = async () => {
    const selectedDocuments = selectableDocuments.filter(({ documentFile }) => selectedDocumentIds.includes(documentFile.id))
    if (selectedDocuments.length === 0) return

    try {
      setIsPreparingDownload(true)
      setDownloadError('')

      if (selectedDocuments.length === 1) {
        await downloadDocument(selectedDocuments[0].documentFile)
        return
      }

      const zip = new JSZip()
      await Promise.all(selectedDocuments.map(async ({ documentFile }) => {
        const response = await fetch(await getDocumentSignedUrl(documentFile))
        if (!response.ok) throw new Error('Document unavailable')
        zip.file(documentFile.name, await response.blob())
      }))
      downloadBlob(await zip.generateAsync({ type: 'blob' }), zipFilename(application))
    } catch {
      setDownloadError('Le téléchargement groupé est momentanément indisponible. Réessayez dans quelques instants.')
    } finally {
      setIsPreparingDownload(false)
    }
  }

  return (
    <aside className="min-w-0 overflow-hidden rounded-2xl border border-[#D4CCBE] bg-[#F7F4EE] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.13em] text-[#3C56D7]">Dossier sélectionné</p>
          <h2 className="mt-2 font-sans text-3xl font-bold tracking-[-0.06em] text-[#17201B]">
            {application.firstName} {application.lastName}
          </h2>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <p className="mt-4 font-sans text-[10px] text-[#69756D]">Transmis le {formatDateTime(application.createdAt)}</p>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.13em] text-[#69756D]">Pièces jointes</p>
          <button type="button" className="inline-flex items-center gap-1 font-sans text-xs font-bold text-[#245A43] hover:text-[#3C56D7]" onClick={downloadSummary}>
            Fiche .txt <ArrowDownToLine size={13} />
          </button>
        </div>
        {selectableDocuments.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#EAF0EA] px-3 py-2.5">
            <label className="inline-flex cursor-pointer items-center gap-2 font-sans text-xs font-semibold text-[#245A43]">
              <input
                type="checkbox"
                checked={selectedDocumentIds.length === selectableDocuments.length}
                onChange={(event) => setSelectedDocumentIds(event.target.checked ? selectableDocuments.map(({ documentFile }) => documentFile.id) : [])}
                className="h-4 w-4 rounded border-[#9AA59D] accent-[#245A43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]"
              />
              Tout sélectionner
            </label>
            {selectedDocumentIds.length > 0 && (
              <button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#245A43] px-3 py-2 font-sans text-xs font-bold text-white transition hover:bg-[#17201B] disabled:cursor-wait disabled:opacity-60" onClick={() => void downloadSelection()} disabled={isPreparingDownload}>
                <ArrowDownToLine size={14} />
                {isPreparingDownload ? 'Préparation…' : selectedDocumentIds.length > 1 ? `Télécharger en ZIP (${selectedDocumentIds.length})` : 'Télécharger la pièce'}
              </button>
            )}
          </div>
        )}
        {profilePhoto && (
          <ProfilePhotoPreview
            documentFile={profilePhoto}
            isSelected={selectedDocumentIds.includes(profilePhoto.id)}
            onSelectionChange={(selected) => updateSelection(profilePhoto.id, selected)}
          />
        )}
        <div className="mt-3 grid gap-3">
          {attachedDocuments.length > 0 ? (
            attachedDocuments.map(({ label, documentFile }) => (
              <DocumentAction key={documentFile.id} label={label} documentFile={documentFile} isSelected={selectedDocumentIds.includes(documentFile.id)} onSelectionChange={(selected) => updateSelection(documentFile.id, selected)} />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-[#BFC8C0] px-4 py-3 font-sans text-xs leading-5 text-[#69756D]">
              Aucune pièce disponible pour ce dossier.
            </p>
          )}
        </div>
        {downloadError && <p className="mt-3 font-sans text-xs font-semibold text-[#9F3B22]" role="alert">{downloadError}</p>}
      </div>

      <div className="mt-6 border-t border-[#D4CCBE] pt-5">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.13em] text-[#69756D]">
          État du dossier
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-9 rounded-lg bg-[#245A43] px-3 py-2 font-sans text-xs font-bold text-white transition hover:bg-[#1B4634] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#BBD6C5]"
            onClick={() => onStatusChange('complete')}
            disabled={isSavingStatus || application.status === 'complete'}
          >
            {application.status === 'complete' ? 'Vérifié' : 'Vérifier'}
          </button>
          <button
            type="button"
            className="min-h-9 rounded-lg border border-[#E3B95D] bg-[#FFF7E2] px-3 py-2 font-sans text-xs font-bold text-[#845B16] transition hover:bg-[#FCEBC5] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#F9DB9B]"
            onClick={() => onStatusChange('incomplete')}
            disabled={isSavingStatus || application.status === 'incomplete'}
          >
            À compléter
          </button>
        </div>
        {statusError && <p className="mt-2 font-sans text-xs font-semibold text-[#9F3B22]" role="alert">{statusError}</p>}
      </div>
      <div className="mt-5 border-t border-[#D4CCBE] pt-5">
        <button
          type="button"
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#E8B5A9] bg-[#FFF4F1] px-3 py-2.5 font-sans text-sm font-bold text-[#9F3B22] transition hover:bg-[#FCE4DE] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#F7C9BE]"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 size={16} /> {isDeleting ? 'Suppression…' : 'Supprimer le dossier'}
        </button>
        {deleteError && <p className="mt-2 font-sans text-xs font-semibold text-[#9F3B22]" role="alert">{deleteError}</p>}
      </div>
    </aside>
  )
}

function MobileDetailSheet({
  application,
  isOpen,
  onClose,
  onStatusChange,
  onDelete,
  isSavingStatus,
  isDeleting,
  statusError,
  deleteError,
}: {
  application: ApplicationRecord | null
  isOpen: boolean
  onClose: () => void
  onStatusChange: (status: ApplicationStatus) => void
  onDelete: () => void
  isSavingStatus: boolean
  isDeleting: boolean
  statusError: string
  deleteError: string
}) {
  if (!isOpen || !application) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[#17201B]/45 p-0 backdrop-blur-[1px] lg:hidden" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fermer la fiche" onClick={onClose} />
      <section className="admin-detail-sheet relative max-h-[92svh] w-full overflow-y-auto rounded-t-[1.8rem] bg-[#F7F4EE] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-16px_48px_rgba(23,32,27,0.22)]" role="dialog" aria-modal="true" aria-label={`Dossier de ${application.firstName} ${application.lastName}`}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#D4CCBE] bg-[#F7F4EE]/95 px-5 py-3 backdrop-blur-sm">
          <div>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-[#3C56D7]">Dossier</p>
            <p className="mt-0.5 font-sans text-sm font-bold text-[#17201B]">{application.firstName} {application.lastName}</p>
          </div>
          <button type="button" className="grid h-11 w-11 place-items-center rounded-full text-[#245A43] transition active:bg-[#E5F3E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]" onClick={onClose} aria-label="Fermer la fiche">
            <X size={21} />
          </button>
        </header>
        <div className="p-4">
          <DetailPanel application={application} onStatusChange={onStatusChange} onDelete={onDelete} isSavingStatus={isSavingStatus} isDeleting={isDeleting} statusError={statusError} deleteError={deleteError} />
        </div>
      </section>
    </div>
  )
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [statusError, setStatusError] = useState('')
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false)
  const [isLogoutConfirmationOpen, setIsLogoutConfirmationOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ApplicationStatus | null>(null)
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const refreshApplications = async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const records = await getApplications()
      setApplications(records)
      setSelectedId((current) =>
        current && records.some((record) => record.id === current) ? current : null,
      )
    } catch {
      setLoadError('Le registre sécurisé est indisponible. Réessayez ou vérifiez votre connexion.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshApplications()
  }, [])

  const filteredApplications = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr-FR')
    return applications.filter((application) => {
      const matchesFilter = filter === 'all' || application.status === filter
      const searchable = `${application.firstName} ${application.lastName}`.toLocaleLowerCase('fr-FR')
      return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery))
    })
  }, [applications, filter, query])

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / applicationsPerPage))
  const paginatedApplications = filteredApplications.slice(
    (currentPage - 1) * applicationsPerPage,
    currentPage * applicationsPerPage,
  )
  const firstApplicationIndex = filteredApplications.length === 0 ? 0 : (currentPage - 1) * applicationsPerPage + 1
  const lastApplicationIndex = Math.min(currentPage * applicationsPerPage, filteredApplications.length)

  useEffect(() => {
    setCurrentPage(1)
  }, [filter, query])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const selectedApplication = applications.find((application) => application.id === selectedId) ?? null
  const reviewCount = applications.filter((application) => application.status === 'to_review').length
  const completeCount = applications.filter((application) => application.status === 'complete').length
  const incompleteCount = applications.filter((application) => application.status === 'incomplete').length

  const toggleApplication = (applicationId: string) => {
    setSelectedId((current) => current === applicationId ? null : applicationId)
  }

  const changeStatus = async (status: ApplicationStatus) => {
    if (!selectedApplication || status === selectedApplication.status) return
    try {
      setIsSavingStatus(true)
      setStatusError('')
      await setApplicationStatus(selectedApplication.id, status)
      setApplications((current) => current.map((application) => application.id === selectedApplication.id ? { ...application, status } : application))
    } catch {
      setStatusError('La mise à jour n’a pas été enregistrée. Réessayez.')
    } finally {
      setIsSavingStatus(false)
    }
  }

  const removeApplication = async () => {
    if (!selectedApplication) return
    try {
      setIsDeleting(true)
      setDeleteError('')
      await deleteApplication(selectedApplication.id)
      setApplications((current) => current.filter((application) => application.id !== selectedApplication.id))
      setSelectedId(null)
      setIsMobileDetailOpen(false)
    } catch {
      setDeleteError('La suppression n’a pas été enregistrée. Réessayez.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <main className="min-h-[100svh] bg-[#F7F4EE] xl:grid xl:grid-cols-[14.5rem_minmax(0,1fr)]">
      <aside className="flex min-h-16 items-center justify-between bg-[#17201B] px-4 py-3 text-[#F7F4EE] sm:px-5 sm:py-4 xl:sticky xl:top-0 xl:h-[100svh] xl:flex-col xl:items-stretch xl:px-5 xl:py-7">
        <BrandMark inverse compact />
        <nav className="hidden xl:mt-16 xl:block">
          <span className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-3 font-sans text-sm font-bold text-white">
            <FileText size={18} strokeWidth={1.7} /> Dossiers
          </span>
          <span className="mt-2 flex items-center gap-3 rounded-xl px-3 py-3 font-sans text-sm text-white/45">
            <ShieldCheck size={18} strokeWidth={1.7} /> Administration
          </span>
        </nav>
        <div className="flex items-center gap-3 xl:mt-auto xl:block">
          <div className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-3 xl:block">
            <p className="font-sans text-[10px] uppercase tracking-[0.12em] text-[#D8FF41]">Accès équipe</p>
            <p className="mt-1 font-sans text-xs text-white/65">Registre des dossiers</p>
          </div>
          <button type="button" className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 font-sans text-xs font-bold text-white/70 transition active:bg-white/10 hover:bg-white/10 hover:text-white xl:ml-0 xl:mt-3 xl:w-full" onClick={() => setIsLogoutConfirmationOpen(true)}>
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>

      <section className="min-w-0 px-4 py-6 sm:px-8 sm:py-9 lg:px-10 xl:px-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link className="inline-flex items-center gap-1.5 font-sans text-xs font-bold text-[#245A43] hover:text-[#3C56D7] xl:hidden" to="/">
              <ArrowLeft size={14} /> Formulaire public
            </Link>
            <p className="mt-3 font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-[#3C56D7] xl:mt-0">Registre — Alpha Fight Club</p>
            <h1 className="mt-2 font-sans text-[2.15rem] font-bold leading-none tracking-[-0.065em] text-[#17201B] sm:text-5xl">Dossiers reçus</h1>
          </div>
          <p className="font-sans text-[10px] uppercase tracking-[0.12em] text-[#69756D]">{applications.length} dossier{applications.length !== 1 ? 's' : ''} au total</p>
        </header>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:mt-7 sm:gap-4">
          <StatCard value={applications.length} label="Reçus" colour="green" />
          <StatCard value={completeCount} label="Complets" colour="blue" />
          <StatCard value={incompleteCount + reviewCount} label="À traiter" colour="apricot" />
        </div>

        <div className="mt-6 grid gap-5 sm:mt-7 2xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div>
            <div className="rounded-2xl border border-[#D4CCBE] bg-white p-3 sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="relative block lg:max-w-sm lg:flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#69756D]" size={17} />
                  <input aria-label="Rechercher un dossier" className="w-full rounded-xl border border-[#D4CCBE] py-2.5 pl-10 pr-3 font-sans text-sm outline-none transition focus:border-[#3C56D7] focus:ring-3 focus:ring-[#DDE2FF]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un nom…" />
                </label>
                <div className="grid grid-cols-4 gap-0.5 sm:flex sm:flex-wrap sm:justify-end lg:mx-0">
                  {(Object.keys(filterLabels) as Filter[]).map((item) => (
                    <button key={item} type="button" aria-pressed={filter === item} className={`min-h-9 w-full whitespace-nowrap rounded-full px-0 py-1.5 font-sans text-[9px] font-bold leading-none tracking-[-0.05em] transition active:scale-[0.98] sm:min-h-11 sm:w-auto sm:px-3 sm:py-2 sm:text-xs sm:tracking-normal ${filter === item ? 'bg-[#17201B] text-white' : 'text-[#59665E] hover:bg-[#F0ECE3]'}`} onClick={() => setFilter(item)}>
                      {filterLabels[item]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-[#D4CCBE] bg-white">
              {loadError ? (
                <div className="px-6 py-12 text-center">
                  <p className="font-sans text-sm font-bold text-[#9F3B22]" role="alert">{loadError}</p>
                  <button type="button" className="mt-4 rounded-full bg-[#17201B] px-4 py-2.5 font-sans text-xs font-bold text-white hover:bg-[#245A43] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#C8D1FF]" onClick={() => void refreshApplications()}>
                    Réessayer
                  </button>
                </div>
              ) : isLoading ? (
                <div className="grid gap-3 p-5" aria-label="Chargement des dossiers">
                  {[1, 2, 3].map((line) => <div key={line} className="h-16 animate-pulse rounded-xl bg-[#F0ECE3]" />)}
                </div>
              ) : filteredApplications.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <FileText className="mx-auto text-[#A4AEA7]" size={34} strokeWidth={1.4} />
                  <p className="mt-4 font-sans text-sm font-bold text-[#536058]">Aucun dossier à afficher</p>
                  <p className="mt-1 font-sans text-xs leading-5 text-[#78827B]">Les dossiers transmis depuis le formulaire apparaîtront ici.</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-[#E7E1D7] lg:hidden">
                    {paginatedApplications.map((application) => (
                      <MobileApplicationCard
                        key={application.id}
                        application={application}
                        onOpen={() => {
                          if (selectedId === application.id) {
                            setSelectedId(null)
                            setIsMobileDetailOpen(false)
                          } else {
                            setSelectedId(application.id)
                            setIsMobileDetailOpen(true)
                          }
                        }}
                      />
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="min-w-[48rem] w-full border-collapse text-left">
                    <thead className="border-b border-[#D4CCBE] bg-[#F7F4EE]">
                      <tr className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-[#69756D]">
                        <th className="px-5 py-4">Adhérent</th>
                        <th className="px-4 py-4">Reçu le</th>
                        <th className="px-4 py-4">Pièces</th>
                        <th className="px-4 py-4">État</th>
                        <th className="px-4 py-4"><span className="sr-only">Ouvrir</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedApplications.map((application) => {
                        const isSelected = selectedId === application.id
                        return (
                          <tr
                            key={application.id}
                            className={`cursor-pointer border-b border-[#E7E1D7] transition last:border-0 ${isSelected ? 'bg-[#F3F5FF]' : 'hover:bg-[#FAF8F3]'}`}
                            onClick={() => toggleApplication(application.id)}
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <ProfileAvatar application={application} />
                                <span className="font-sans text-sm font-bold text-[#17201B]">{application.firstName} {application.lastName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 font-sans text-[10px] text-[#69756D]">{formatDate(application.createdAt)}</td>
                            <td className="px-4 py-4"><span className="inline-flex items-center gap-1 font-sans text-[10px] text-[#245A43]"><CircleCheckBig size={13} /> {countDocuments(application)} / 3</span></td>
                            <td className="px-4 py-4"><StatusBadge status={application.status} /></td>
                            <td className="px-4 py-4 text-right">
                              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#3C56D7] transition hover:bg-[#DDE2FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]" onClick={(event) => { event.stopPropagation(); toggleApplication(application.id) }} aria-label={`${isSelected ? 'Fermer' : 'Ouvrir'} le dossier de ${application.firstName} ${application.lastName}`}>
                                <ChevronRight size={18} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            {!loadError && !isLoading && filteredApplications.length > 0 && (
              <nav className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#D4CCBE] bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4" aria-label="Pagination des dossiers">
                <p className="font-sans text-xs text-[#69756D]">
                  Dossiers <span className="font-semibold text-[#27322C]">{firstApplicationIndex}–{lastApplicationIndex}</span> sur {filteredApplications.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D4CCBE] text-[#245A43] transition hover:border-[#245A43] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    aria-label="Page précédente"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <div className="flex max-w-full items-center gap-1 overflow-x-auto [scrollbar-width:thin]" aria-label="Choisir une page">
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        aria-current={currentPage === page ? 'page' : undefined}
                        className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-full px-2 font-sans text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7] ${currentPage === page ? 'bg-[#17201B] text-white' : 'text-[#59665E] hover:bg-[#F0ECE3]'}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D4CCBE] text-[#245A43] transition hover:border-[#245A43] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Page suivante"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </nav>
            )}
            {selectedApplication && (
              <div className="mt-5 hidden lg:block 2xl:hidden">
                <DetailPanel application={selectedApplication} onStatusChange={(status) => setPendingStatus(status)} onDelete={() => setIsDeleteConfirmationOpen(true)} isSavingStatus={isSavingStatus} isDeleting={isDeleting} statusError={statusError} deleteError={deleteError} />
              </div>
            )}
          </div>
          {selectedApplication && (
            <div className="hidden 2xl:block">
              <DetailPanel application={selectedApplication} onStatusChange={(status) => setPendingStatus(status)} onDelete={() => setIsDeleteConfirmationOpen(true)} isSavingStatus={isSavingStatus} isDeleting={isDeleting} statusError={statusError} deleteError={deleteError} />
            </div>
          )}
        </div>
      </section>
      <MobileDetailSheet
        application={selectedApplication}
        isOpen={isMobileDetailOpen}
        onClose={() => setIsMobileDetailOpen(false)}
        onStatusChange={(status) => setPendingStatus(status)}
        onDelete={() => setIsDeleteConfirmationOpen(true)}
        isSavingStatus={isSavingStatus}
        isDeleting={isDeleting}
        statusError={statusError}
        deleteError={deleteError}
      />
      {isLogoutConfirmationOpen && (
        <ConfirmationDialog
          title="Se déconnecter ?"
          description="Vous devrez saisir à nouveau votre code administrateur et votre mot de passe pour accéder au registre."
          confirmLabel="Se déconnecter"
          onCancel={() => setIsLogoutConfirmationOpen(false)}
          onConfirm={() => {
            setIsLogoutConfirmationOpen(false)
            onLogout()
          }}
        />
      )}
      {pendingStatus && selectedApplication && (
        <ConfirmationDialog
          title="Modifier l’état du dossier ?"
          description={`Le dossier de ${selectedApplication.firstName} ${selectedApplication.lastName} passera à l’état « ${statusMeta[pendingStatus].label} ».`}
          confirmLabel="Confirmer"
          onCancel={() => setPendingStatus(null)}
          onConfirm={() => {
            void changeStatus(pendingStatus)
            setPendingStatus(null)
          }}
        />
      )}
      {isDeleteConfirmationOpen && selectedApplication && (
        <ConfirmationDialog
          title="Supprimer définitivement ce dossier ?"
          description={`Le dossier de ${selectedApplication.firstName} ${selectedApplication.lastName} et toutes ses pièces jointes seront supprimés définitivement.`}
          confirmLabel="Supprimer"
          onCancel={() => setIsDeleteConfirmationOpen(false)}
          onConfirm={() => {
            setIsDeleteConfirmationOpen(false)
            void removeApplication()
          }}
        />
      )}
    </main>
  )
}

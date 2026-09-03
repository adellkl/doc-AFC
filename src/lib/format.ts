import type { ApplicationStatus } from '../types'

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
}

export const statusMeta: Record<
  ApplicationStatus,
  { label: string; className: string }
> = {
  to_review: {
    label: 'À vérifier',
    className: 'border-[#E2B451] bg-[#FFF5D8] text-[#74550B]',
  },
  complete: {
    label: 'Complet',
    className: 'border-[#A2CDB5] bg-[#E5F3E9] text-[#175839]',
  },
  incomplete: {
    label: 'À compléter',
    className: 'border-[#EFAD98] bg-[#FFF0EA] text-[#9F3B22]',
  },
}

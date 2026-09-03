import { Link } from 'react-router-dom'

type BrandMarkProps = {
  inverse?: boolean
  compact?: boolean
}

export function BrandMark({ inverse = false, compact = false }: BrandMarkProps) {
  const foreground = inverse ? 'text-[#F7F4EE]' : 'text-[#17201B]'

  return (
    <Link
      className={`group inline-flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7] focus-visible:ring-offset-4 ${foreground}`}
      to="/"
      aria-label="Retour au dépôt de dossier"
    >
      {compact ? (
        <span className="font-sans text-sm font-bold tracking-[-0.04em]">Alpha Fight Club</span>
      ) : (
        <span className="leading-none">
          <span className="block font-sans text-base font-bold tracking-[-0.04em]">
            Alpha Fight Club
          </span>
          <span
            className={`mt-1 block font-sans text-[10px] font-medium uppercase tracking-[0.18em] ${
              inverse ? 'text-[#F7F4EE]/60' : 'text-[#536058]'
            }`}
          >
            Registre des dossiers
          </span>
        </span>
      )}
    </Link>
  )
}

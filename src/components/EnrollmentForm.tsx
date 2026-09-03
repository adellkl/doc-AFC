import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileCheck2,
  LockKeyhole,
  LoaderCircle,
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { saveApplication } from '../lib/database'
import { formatDateTime } from '../lib/format'
import type { SubmittedApplication } from '../types'
import teamPhoto from '../assets/alpha-fight-club-groupe.jpg'
import { BrandMark } from './BrandMark'
import { ConfettiBurst } from './ConfettiBurst'
import { FileDropzone } from './FileDropzone'

type FormValues = {
  firstName: string
  lastName: string
}

const emptyValues: FormValues = {
  firstName: '',
  lastName: '',
}

type FloatingFieldProps = {
  id: string
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  autoComplete: string
  type?: 'email' | 'tel' | 'text'
  multiline?: boolean
  maxLength: number
  pattern?: string
}

function FloatingField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  type = 'text',
  multiline = false,
  maxLength,
  pattern,
}: FloatingFieldProps) {
  const controlClassName = `peer block w-full rounded-[1rem] border border-[#D4CCBE] bg-[#FFFEFA] px-4 font-sans text-sm text-[#17201B] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-transparent hover:border-[#ABB7B0] focus:border-[#245A43] focus:shadow-[0_0_0_2px_rgba(36,90,67,0.10)] ${
    multiline ? 'min-h-32 resize-y pb-3 pt-6 leading-6' : 'h-14 pb-2 pt-5'
  }`
  const placeholderPosition = multiline ? 'peer-placeholder-shown:top-6' : 'peer-placeholder-shown:top-1/2'

  return (
    <div className="relative pt-1">
      {multiline ? (
        <textarea
          id={id}
          className={controlClassName}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder=" "
          required
          maxLength={maxLength}
        />
      ) : (
        <input
          id={id}
          className={controlClassName}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder=" "
          required
          maxLength={maxLength}
          pattern={pattern}
        />
      )}
      <label
        className={`pointer-events-none absolute left-4 top-0 z-10 -translate-y-1/2 bg-[#FFFEFA] px-1.5 font-sans text-[11px] font-semibold text-[#536058] transition-all duration-200 ${placeholderPosition} peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:bg-transparent peer-placeholder-shown:px-0 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-[#768279] peer-focus:top-0 peer-focus:bg-[#FFFEFA] peer-focus:px-1.5 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-[#245A43] peer-[&:not(:placeholder-shown)]:top-0 peer-[&:not(:placeholder-shown)]:bg-[#FFFEFA] peer-[&:not(:placeholder-shown)]:px-1.5 peer-[&:not(:placeholder-shown)]:text-[11px] peer-[&:not(:placeholder-shown)]:font-semibold`}
        htmlFor={id}
      >
        {label}
        <span className="ml-1 text-[#3C56D7]">*</span>
      </label>
    </div>
  )
}

function ApplicationSuccess({ record }: { record: SubmittedApplication }) {
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  return (
    <main className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-[#F7F4EE] px-4 py-5 sm:px-8 sm:py-8">
      <ConfettiBurst />
      <div className="relative z-10 w-full max-w-2xl rounded-[1.75rem] border border-[#A2CDB5] bg-white p-6 shadow-[0_24px_80px_rgba(23,32,27,0.12)] sm:rounded-[2rem] sm:p-10">
        <div>
          <BrandMark compact />
          <div className="mt-10 inline-flex -rotate-1 items-center gap-2 border-2 border-[#245A43] bg-[#E5F3E9] px-3 py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-[#245A43]">
            <FileCheck2 size={16} strokeWidth={2} />
            Dossier reçu
          </div>
          <p className="mt-8 font-sans text-[11px] font-medium uppercase tracking-[0.16em] text-[#3C56D7]">
            Transmission confirmée
          </p>
          <h1 ref={titleRef} tabIndex={-1} className="mt-3 max-w-xl font-sans text-4xl font-bold leading-[0.98] tracking-[-0.055em] text-[#17201B] outline-none sm:text-5xl">
            Dossier transmis. Merci, {record.firstName}&nbsp;!
          </h1>
          <p className="mt-6 max-w-lg font-sans text-base leading-7 text-[#536058]">
            L'équipe Alpha Fight Club vérifiera vos pièces et vous recontactera si un complément est nécessaire.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2 rounded-2xl border border-[#D4CCBE] bg-[#F7F4EE] px-4 py-3" role="status" aria-live="polite">
            <Check size={16} className="text-[#245A43]" strokeWidth={2.2} />
            <span className="font-sans text-[11px] leading-relaxed text-[#536058]">
              Dossier enregistré le {formatDateTime(record.createdAt)}
            </span>
          </div>
          <a
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#17201B] px-5 py-3.5 font-sans text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#245A43] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C8D1FF] active:translate-y-0 sm:w-auto"
            href="https://www.alphafightclub.com/"
          >
            Revenir au site
            <ArrowRight size={17} strokeWidth={1.8} />
          </a>
        </div>
      </div>
    </main>
  )
}

export function EnrollmentForm() {
  const [values, setValues] = useState<FormValues>(emptyValues)
  const [identityCard, setIdentityCard] = useState<File | null>(null)
  const [medicalCertificate, setMedicalCertificate] = useState<File | null>(null)
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null)
  const [hasConsent, setHasConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [submittedRecord, setSubmittedRecord] = useState<SubmittedApplication | null>(null)

  const updateValue = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')

    if (Object.values(values).some((value) => !value.trim())) {
      setFormError('Merci de renseigner toutes les informations demandées.')
      return
    }

    if (!identityCard || !medicalCertificate || !profilePhoto) {
      setFormError('Ajoutez votre pièce d’identité, votre certificat médical et votre photo avant de transmettre le dossier.')
      return
    }

    if (!hasConsent) {
      setFormError('Votre accord est nécessaire pour transmettre le dossier.')
      return
    }

    try {
      setIsSubmitting(true)
      const record = await saveApplication({ ...values, identityCard, medicalCertificate, profilePhoto })
      setSubmittedRecord(record)
    } catch (error) {
      console.error(error)
      setFormError('Le dossier n’a pas pu être enregistré. Réessayez dans quelques instants.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedRecord) {
    return <ApplicationSuccess record={submittedRecord} />
  }

  return (
    <main className="min-h-[100svh] bg-[#F7F4EE] md:grid md:grid-cols-[minmax(15rem,36%)_minmax(0,1fr)] lg:grid-cols-[minmax(18rem,5fr)_minmax(0,7fr)]">
      <aside className="relative overflow-hidden bg-[#17201B] px-4 pb-6 pt-5 text-[#F7F4EE] sm:px-8 sm:py-8 md:sticky md:top-0 md:min-h-[100svh] md:self-start md:px-6 md:py-7 lg:px-10 lg:py-10">
        <img
          className="absolute inset-0 h-full w-full object-cover object-[center_58%] opacity-35"
          src={teamPhoto}
          alt="Membres d'Alpha Fight Club réunis sur les tatamis"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#17201B]/82 via-[#17201B]/68 to-[#17201B]/92" aria-hidden="true" />
        <div className="relative mx-auto flex h-full max-w-md flex-col">
          <div className="flex items-start justify-between gap-4">
            <BrandMark inverse />
            <Link
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#F7F4EE]/20 px-3 py-2 font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-[#F7F4EE]/75 transition hover:border-[#D8FF41] hover:text-[#D8FF41] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8FF41]"
              to="/admin"
            >
              Équipe
              <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="mt-8 sm:mt-12 md:mt-[18vh] lg:mt-[20vh]">
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-[#D8FF41]">Inscription grappling</p>
            <h1 className="mt-3 max-w-sm font-sans text-[2rem] font-bold leading-[0.98] tracking-[-0.065em] sm:mt-4 sm:text-5xl">
              Votre dossier d’adhésion.
            </h1>
            <p className="mt-4 max-w-sm font-sans text-sm leading-6 text-[#F7F4EE]/70 sm:mt-6 sm:text-base">
              Déposez vos informations et vos deux pièces. Aucun compte adhérent n’est nécessaire.
            </p>
          </div>

          <ol className="mt-6 grid grid-cols-2 gap-2 border-t border-[#F7F4EE]/15 pt-4 font-sans text-[9px] uppercase tracking-[0.1em] text-[#F7F4EE]/65 sm:mt-10 sm:text-[11px] md:mt-auto md:grid-cols-1 md:gap-3 md:pt-6 md:tracking-[0.13em]">
            <li className="flex flex-col gap-1 sm:flex-row sm:gap-3"><span className="text-[#D8FF41]">01</span><span>Identité</span></li>
            <li className="flex flex-col gap-1 sm:flex-row sm:gap-3"><span className="text-[#D8FF41]">02</span><span>Pièces</span></li>
          </ol>
        </div>
      </aside>

      <section className="px-4 py-6 sm:px-8 sm:py-10 md:px-6 md:py-8 lg:px-[clamp(2.5rem,7vw,7rem)] lg:py-16">
        <form className="mx-auto max-w-[44rem] space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
          <div className="rounded-[1.5rem] border border-[#DED6C8] bg-[#FFFEFA] px-5 py-5 shadow-[0_18px_40px_rgba(23,32,27,0.055)] sm:rounded-[1.75rem] sm:px-7 sm:py-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.16em] text-[#3C56D7]">Dossier personnel</p>
                <h2 className="mt-2 font-sans text-3xl font-bold tracking-[-0.055em] text-[#17201B] sm:text-4xl">
                  Déposer mes documents
                </h2>
              </div>
              <span className="mb-1 shrink-0 font-sans text-[10px] uppercase tracking-[0.12em] text-[#69756D]">* obligatoire</span>
            </div>
            <p className="mt-4 max-w-xl font-sans text-sm leading-6 text-[#657168]">
              Renseignez votre identité puis ajoutez vos justificatifs pour finaliser votre inscription.
            </p>
          </div>

          <fieldset className="rounded-[1.35rem] border border-[#E2DBCF] bg-[#FFFEFA] px-5 pb-6 pt-5 shadow-[0_18px_35px_rgba(23,32,27,0.045)] transition-colors duration-200 focus-within:border-[#A2CDB5] sm:rounded-[1.5rem] sm:px-7 sm:pb-7 sm:pt-6">
            <legend className="sr-only">01 — Identité</legend>
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E7F0EA] font-sans text-[11px] font-medium text-[#245A43]">01</span>
              <div>
                <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-[#657168]">Première étape</p>
                <h3 className="mt-0.5 font-sans text-base font-bold text-[#17201B]">Votre identité</h3>
              </div>
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <FloatingField id="first-name" label="Prénom" value={values.firstName} onChange={updateValue('firstName')} autoComplete="given-name" maxLength={120} />
              <FloatingField id="last-name" label="Nom" value={values.lastName} onChange={updateValue('lastName')} autoComplete="family-name" maxLength={120} />
            </div>
          </fieldset>

          <fieldset className="rounded-[1.35rem] border border-[#E2DBCF] bg-[#FFFEFA] px-5 pb-6 pt-5 shadow-[0_18px_35px_rgba(23,32,27,0.045)] transition-colors duration-200 focus-within:border-[#A2CDB5] sm:rounded-[1.5rem] sm:px-7 sm:pb-7 sm:pt-6">
            <legend className="sr-only">02 — Pièces justificatives</legend>
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FFF0DE] font-sans text-[11px] font-medium text-[#9F6228]">02</span>
              <div>
                <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-[#657168]">Deuxième étape</p>
                <h3 className="mt-0.5 font-sans text-base font-bold text-[#17201B]">Vos pièces justificatives</h3>
              </div>
            </div>
            <p className="mt-5 font-sans text-sm leading-6 text-[#657168]">Formats acceptés : PDF, JPG ou PNG — 10 Mo maximum par fichier.</p>
            <div className="mt-5 grid gap-4">
              <FileDropzone
                label="Carte d’identité"
                description="Recto-verso dans un seul PDF ou une image lisible"
                file={identityCard}
                onChange={setIdentityCard}
              />
              <FileDropzone
                label="Certificat médical"
                description="Certificat d’aptitude à la pratique du grappling"
                file={medicalCertificate}
                onChange={setMedicalCertificate}
              />
              <FileDropzone
                label="Photo de profil"
                description="Photo JPG ou PNG pour identifier votre dossier"
                file={profilePhoto}
                onChange={setProfilePhoto}
                acceptImagesOnly
              />
            </div>
          </fieldset>

          <div className="rounded-[1.35rem] border border-[#E2DBCF] bg-[#FFFEFA] p-5 shadow-[0_18px_35px_rgba(23,32,27,0.045)] sm:rounded-[1.5rem] sm:p-7">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-transparent p-2 transition hover:bg-[#EFEADF] has-[:focus-visible]:border-[#3C56D7]">
              <input
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#245A43]"
                type="checkbox"
                checked={hasConsent}
                onChange={(event) => setHasConsent(event.target.checked)}
              />
              <span className="font-sans text-xs leading-5 text-[#536058]">
                J’accepte que ces informations soient utilisées uniquement pour l’étude de mon inscription au club.
              </span>
            </label>

            {formError && (
              <p className="mt-4 flex gap-2 rounded-xl border border-[#EFAD98] bg-[#FFF0EA] px-4 py-3 font-sans text-sm font-medium text-[#9F3B22]" role="alert">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C8502F]" />
                {formError}
              </p>
            )}

            <div className="sticky bottom-0 z-10 -mx-5 mt-5 border-t border-[#E2DBCF] bg-[#FFFEFA]/95 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:-mx-7 sm:px-7 md:static md:mx-0 md:mt-6 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none">
              <button
                className="inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-[#245A43] px-6 py-4 font-sans text-sm font-bold text-white shadow-[0_10px_22px_rgba(36,90,67,0.18)] transition duration-200 active:scale-[0.99] hover:-translate-y-0.5 hover:bg-[#17201B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C8D1FF] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting && <LoaderCircle className="animate-spin" size={18} />}
                {isSubmitting ? 'Transmission en cours…' : 'Transmettre mon dossier'}
                <ArrowRight size={17} strokeWidth={1.8} />
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.1em] text-[#78827B] md:mt-4">
                <LockKeyhole size={12} /> Aucun espace adhérent requis
              </p>
            </div>
          </div>
        </form>
      </section>
    </main>
  )
}

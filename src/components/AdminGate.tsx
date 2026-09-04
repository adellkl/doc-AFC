import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentAdmin, getSupabaseClient, isSupabaseConfigured, signInAdministrator, signOutAdministrator } from '../lib/supabase'
import { BrandMark } from './BrandMark'
import { AdminDashboard } from './AdminDashboard'

export function AdminGate() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [accessCode, setAccessCode] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isCurrent = true
    if (!isSupabaseConfigured()) {
      setError('Le back-office n’est pas encore configuré. Contactez l’administrateur du site.')
      setIsCheckingSession(false)
      return () => { isCurrent = false }
    }

    void getCurrentAdmin()
      .then((administrator) => { if (isCurrent) setIsAuthenticated(Boolean(administrator)) })
      // A failed restore must not block the login screen: the administrator
      // can always establish a fresh session with the access code and password.
      .catch(() => { if (isCurrent) setIsAuthenticated(false) })
      .finally(() => { if (isCurrent) setIsCheckingSession(false) })

    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      if (!session && isCurrent) {
        setIsAuthenticated(false)
        setPassword('')
      }
    })

    return () => {
      isCurrent = false
      subscription.unsubscribe()
    }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const code = accessCode.replace(/\D/g, '')
    if (!/^\d{6}$/.test(code)) {
      setError('Saisissez votre code administrateur à 6 chiffres.')
      return
    }

    try {
      setIsSubmitting(true)
      const user = await signInAdministrator(code, password)
      if (!user || !(await getCurrentAdmin())) {
        await signOutAdministrator().catch(() => undefined)
        setError('Code d’accès, mot de passe ou autorisation incorrecte.')
        return
      }
      setPassword('')
      setIsAuthenticated(true)
    } catch {
      setError('Code d’accès, mot de passe ou autorisation incorrecte.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const logout = async () => {
    try {
      await signOutAdministrator()
    } finally {
      setIsAuthenticated(false)
      setPassword('')
    }
  }

  if (isAuthenticated) return <AdminDashboard onLogout={() => void logout()} />

  return (
    <main className="relative grid h-[100svh] min-h-0 place-items-center overflow-hidden bg-[#17201B] px-4 py-5 sm:px-8 sm:py-8">
      <span aria-hidden="true" className="pointer-events-none absolute -left-20 -top-16 h-48 w-48 rounded-full border-[22px] border-[#D8FF41] sm:-left-24 sm:-top-20 sm:h-64 sm:w-64 sm:border-[30px]" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-7 right-5 h-3 w-3 rounded-full bg-[#FFCE9B] sm:bottom-14 sm:right-[12%] sm:h-4 sm:w-4" />
      <section className="relative w-full max-w-md rounded-[1.5rem] border border-white/15 bg-[#F7F4EE] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.35)] sm:rounded-[2rem] sm:p-9">
        <Link className="inline-flex items-center gap-1.5 font-sans text-sm font-semibold text-[#245A43] hover:text-[#3C56D7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]" to="/">
          <ArrowLeft size={15} /> Retour au formulaire
        </Link>
        <div className="mt-6 sm:mt-8"><BrandMark compact /></div>
        <p className="mt-7 font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-[#3C56D7] sm:mt-8 sm:text-[11px]">Accès réservé</p>
        <h1 className="mt-3 font-sans text-[2rem] font-bold leading-[0.95] tracking-[-0.06em] text-[#17201B] sm:text-4xl">Back-office du club</h1>
        <p className="mt-4 font-sans text-sm leading-6 text-[#536058] sm:mt-5">Saisissez votre code administrateur et votre mot de passe pour consulter les dossiers.</p>

        <form className="mt-7 sm:mt-8" onSubmit={submit}>
          <label className="block">
            <span className="font-sans text-sm font-semibold text-[#27322C]">Code administrateur</span>
            <span className="relative mt-2 block">
              <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#69756D]" size={18} strokeWidth={1.7} />
              <input className="w-full rounded-xl border border-[#D4CCBE] bg-white py-3.5 pl-11 pr-4 font-mono text-lg font-bold tracking-[0.35em] text-[#17201B] outline-none transition placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-[#9A9F98] focus:border-[#3C56D7] focus:ring-4 focus:ring-[#DDE2FF]" inputMode="numeric" autoComplete="username" maxLength={6} value={accessCode} onChange={(event) => { setAccessCode(event.target.value.replace(/\D/g, '')); setError('') }} placeholder="000000" required disabled={isCheckingSession || isSubmitting} />
            </span>
          </label>
          <label className="mt-5 block">
            <span className="font-sans text-sm font-semibold text-[#27322C]">Mot de passe</span>
            <span className="relative mt-2 block">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#69756D]" size={18} strokeWidth={1.7} />
              <input className="w-full rounded-xl border border-[#D4CCBE] bg-white py-3.5 pl-11 pr-12 font-sans text-sm text-[#17201B] outline-none transition placeholder:text-[#9A9F98] focus:border-[#3C56D7] focus:ring-4 focus:ring-[#DDE2FF]" type={isPasswordVisible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} placeholder="Saisir le mot de passe" required disabled={isCheckingSession || isSubmitting} />
              <button
                type="button"
                className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-[#69756D] transition hover:bg-[#E7F0EA] hover:text-[#245A43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                aria-label={isPasswordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={isPasswordVisible}
                disabled={isCheckingSession || isSubmitting}
              >
                {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {error && <p className="mt-3 font-sans text-sm font-medium text-[#9F3B22]" role="alert">{error}</p>}
          <button className="mt-6 inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-[#245A43] px-5 py-3.5 font-sans text-sm font-bold text-white transition active:scale-[0.99] hover:-translate-y-0.5 hover:bg-[#17201B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C8D1FF] disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isCheckingSession || isSubmitting}>
            {(isCheckingSession || isSubmitting) && <LoaderCircle className="animate-spin" size={17} />}
            {isCheckingSession ? 'Vérification de la session…' : isSubmitting ? 'Connexion en cours…' : 'Ouvrir le registre'}
            {!isCheckingSession && !isSubmitting && <ArrowRight size={17} />}
          </button>
        </form>
      </section>
    </main>
  )
}

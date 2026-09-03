import { ArrowLeft, ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
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
    <main className="grid min-h-[100svh] place-items-center overflow-hidden bg-[#17201B] px-4 py-5 sm:px-8 sm:py-8">
      <span className="pointer-events-none absolute -left-24 top-[-5rem] h-64 w-64 rounded-full border-[30px] border-[#D8FF41]" />
      <span className="pointer-events-none absolute bottom-14 right-[12%] h-4 w-4 rounded-full bg-[#FFCE9B]" />
      <section className="relative w-full max-w-md rounded-[1.75rem] border border-white/15 bg-[#F7F4EE] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.35)] sm:rounded-[2rem] sm:p-9">
        <Link className="inline-flex items-center gap-1.5 font-sans text-sm font-semibold text-[#245A43] hover:text-[#3C56D7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C56D7]" to="/">
          <ArrowLeft size={15} /> Retour au formulaire
        </Link>
        <div className="mt-8"><BrandMark compact /></div>
        <p className="mt-8 font-sans text-[11px] font-medium uppercase tracking-[0.16em] text-[#3C56D7]">Accès réservé</p>
        <h1 className="mt-3 font-sans text-4xl font-bold leading-none tracking-[-0.06em] text-[#17201B]">Back-office du club</h1>
        <p className="mt-5 font-sans text-sm leading-6 text-[#536058]">Saisissez votre code administrateur et votre mot de passe pour consulter les dossiers.</p>

        <form className="mt-8" onSubmit={submit}>
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
              <input className="w-full rounded-xl border border-[#D4CCBE] bg-white py-3.5 pl-11 pr-4 font-sans text-sm text-[#17201B] outline-none transition placeholder:text-[#9A9F98] focus:border-[#3C56D7] focus:ring-4 focus:ring-[#DDE2FF]" type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} placeholder="Saisir le mot de passe" required disabled={isCheckingSession || isSubmitting} />
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

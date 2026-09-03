import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type SupabaseConfig = {
  url: string
  publishableKey: string
  submitFunction: string
  documentsFunction: string
}

const defaultSubmitFunction = 'submit-application'
const defaultDocumentsFunction = 'admin-application-document'

let client: SupabaseClient | undefined

export class SupabaseConfigurationError extends Error {
  constructor() {
    super('La connexion à Supabase n’est pas configurée.')
    this.name = 'SupabaseConfigurationError'
  }
}

const normalizeUrl = (value: string) => {
  const url = new URL(value)
  const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname)

  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new SupabaseConfigurationError()
  }

  return url.toString().replace(/\/$/, '')
}

const getFunctionName = (value: string | undefined, fallback: string) => {
  const name = value?.trim() || fallback

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new SupabaseConfigurationError()
  }

  return name
}

export const getSupabaseConfig = (): SupabaseConfig => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) {
    throw new SupabaseConfigurationError()
  }

  try {
    return {
      url: normalizeUrl(url),
      publishableKey,
      submitFunction: getFunctionName(import.meta.env.VITE_SUPABASE_SUBMIT_FUNCTION, defaultSubmitFunction),
      documentsFunction: getFunctionName(import.meta.env.VITE_SUPABASE_DOCUMENTS_FUNCTION, defaultDocumentsFunction),
    }
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) throw error
    throw new SupabaseConfigurationError()
  }
}

export const isSupabaseConfigured = () => {
  try {
    getSupabaseConfig()
    return true
  } catch {
    return false
  }
}

export const getSupabaseClient = () => {
  if (client) return client

  const { url, publishableKey } = getSupabaseConfig()
  client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}

export const getCurrentAdmin = async (): Promise<User | null> => {
  const supabase = getSupabaseClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!userData.user) return null

  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (adminError) throw adminError

  return admin?.user_id === userData.user.id ? userData.user : null
}

export const signInAdministrator = async (email: string, password: string) => {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) throw error
  return data.user
}

export const signOutAdministrator = async () => {
  const { error } = await getSupabaseClient().auth.signOut()
  if (error) throw error
}

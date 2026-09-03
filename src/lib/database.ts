import type {
  ApplicationRecord,
  ApplicationStatus,
  DocumentKind,
  NewApplication,
  StoredDocument,
  SubmittedApplication,
} from '../types'
import { getSupabaseClient, getSupabaseConfig } from './supabase'

type ApplicationDocumentRow = {
  id: string
  kind: DocumentKind
  storage_path: string
  original_name: string
  mime_type: string
  byte_size: number
}

type ApplicationRow = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  consent_accepted_at: string
  created_at: string
  status: ApplicationStatus
  application_documents: ApplicationDocumentRow[] | null
}

export class ApplicationServiceError extends Error {
  constructor(message = 'Le service de dossiers est indisponible.') {
    super(message)
    this.name = 'ApplicationServiceError'
  }
}

const documentSlotByKind = {
  identity_card: 'identityCard',
  medical_certificate: 'medicalCertificate',
} as const

const isApplicationStatus = (value: unknown): value is ApplicationStatus =>
  value === 'to_review' || value === 'complete' || value === 'incomplete'

const isDocumentKind = (value: unknown): value is DocumentKind =>
  value === 'identity_card' || value === 'medical_certificate'

const toStoredDocument = (row: ApplicationDocumentRow): StoredDocument => ({
  id: row.id,
  kind: row.kind,
  name: row.original_name,
  type: row.mime_type,
  size: Number(row.byte_size),
  storagePath: row.storage_path,
})

const toApplicationRecord = (row: ApplicationRow): ApplicationRecord => {
  if (!isApplicationStatus(row.status)) {
    throw new ApplicationServiceError()
  }

  const documents: ApplicationRecord['documents'] = {}

  for (const document of row.application_documents ?? []) {
    if (!isDocumentKind(document.kind)) continue
    documents[documentSlotByKind[document.kind]] = toStoredDocument(document)
  }

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    consentAcceptedAt: row.consent_accepted_at,
    createdAt: row.created_at,
    status: row.status,
    documents,
  }
}

const getFunctionUrl = (functionName: string) => {
  const { url } = getSupabaseConfig()
  return `${url}/functions/v1/${encodeURIComponent(functionName)}`
}

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function saveApplication(input: NewApplication): Promise<SubmittedApplication> {
  const submittedAt = new Date().toISOString()
  const { publishableKey, submitFunction } = getSupabaseConfig()
  const body = new FormData()

  body.set('firstName', input.firstName.trim())
  body.set('lastName', input.lastName.trim())
  body.set('email', input.email.trim())
  body.set('phone', input.phone.trim())
  body.set('address', input.address.trim())
  body.set('consentAcceptedAt', submittedAt)
  body.set('identityCard', input.identityCard, input.identityCard.name)
  body.set('medicalCertificate', input.medicalCertificate, input.medicalCertificate.name)

  let response: Response
  try {
    response = await fetch(getFunctionUrl(submitFunction), {
      method: 'POST',
      headers: {
        apikey: publishableKey,
      },
      body,
      credentials: 'omit',
    })
  } catch {
    throw new ApplicationServiceError()
  }

  const payload = await parseJson(response)
  if (!response.ok || !payload || typeof payload !== 'object' || !('applicationId' in payload) || typeof payload.applicationId !== 'string') {
    throw new ApplicationServiceError()
  }

  return {
    id: payload.applicationId,
    firstName: input.firstName.trim(),
    createdAt: submittedAt,
  }
}

export async function getApplications(): Promise<ApplicationRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('applications')
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      address,
      consent_accepted_at,
      created_at,
      status,
      application_documents (
        id,
        kind,
        storage_path,
        original_name,
        mime_type,
        byte_size
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new ApplicationServiceError()

  return ((data ?? []) as ApplicationRow[]).map(toApplicationRecord)
}

export async function setApplicationStatus(
  id: string,
  status: ApplicationStatus,
): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from('applications')
    .update({ status })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    throw new ApplicationServiceError('La mise à jour du dossier a échoué.')
  }
}

export async function getDocumentSignedUrl(documentId: string): Promise<string> {
  const supabase = getSupabaseClient()
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

  if (sessionError || !sessionData.session?.access_token) {
    throw new ApplicationServiceError('Votre session a expiré. Connectez-vous à nouveau.')
  }

  const { publishableKey, documentsFunction } = getSupabaseConfig()
  let response: Response

  try {
    response = await fetch(`${getFunctionUrl(documentsFunction)}?${new URLSearchParams({ documentId })}`, {
      method: 'GET',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      credentials: 'omit',
      cache: 'no-store',
    })
  } catch {
    throw new ApplicationServiceError('Le lien sécurisé du document est indisponible.')
  }

  const payload = await parseJson(response)
  if (!response.ok || !payload || typeof payload !== 'object' || !('signedUrl' in payload) || typeof payload.signedUrl !== 'string') {
    throw new ApplicationServiceError('Le lien sécurisé du document est indisponible.')
  }

  try {
    const signedUrl = new URL(payload.signedUrl)
    if (!['https:', 'http:'].includes(signedUrl.protocol)) throw new Error('Unsupported protocol')
    return signedUrl.toString()
  } catch {
    throw new ApplicationServiceError('Le lien sécurisé du document est invalide.')
  }
}

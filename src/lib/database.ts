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
  profile_photo: 'profilePhoto',
} as const

const isApplicationStatus = (value: unknown): value is ApplicationStatus =>
  value === 'to_review' || value === 'complete' || value === 'incomplete'

const isDocumentKind = (value: unknown): value is DocumentKind =>
  value === 'identity_card' || value === 'medical_certificate' || value === 'profile_photo'

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
  const { publishableKey, submitFunction } = getSupabaseConfig()
  const body = new FormData()

  body.set('firstName', input.firstName.trim())
  body.set('lastName', input.lastName.trim())
  body.set('consent', 'true')
  body.set('identityCard', input.identityCard, input.identityCard.name)
  body.set('medicalCertificate', input.medicalCertificate, input.medicalCertificate.name)
  body.set('profilePhoto', input.profilePhoto, input.profilePhoto.name)

  let response: Response
  try {
    response = await fetch(getFunctionUrl(submitFunction), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${publishableKey}`,
        apikey: publishableKey,
      },
      body,
      credentials: 'omit',
    })
  } catch (error) {
    console.error('Application submission network failure', error)
    throw new ApplicationServiceError()
  }

  const payload = await parseJson(response)
  if (!response.ok || !payload || typeof payload !== 'object' || !('applicationId' in payload) || typeof payload.applicationId !== 'string') {
    console.error('Application submission rejected', response.status, payload)
    throw new ApplicationServiceError()
  }

  const createdAt =
    'createdAt' in payload && typeof payload.createdAt === 'string' ? payload.createdAt : new Date().toISOString()

  return {
    id: payload.applicationId,
    firstName: input.firstName.trim(),
    createdAt,
  }
}

export async function getApplications(): Promise<ApplicationRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('applications')
    .select(`
      id,
      first_name,
      last_name,
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

export async function getDocumentSignedUrl(documentFile: StoredDocument): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.storage
    .from('application-documents')
    .createSignedUrl(documentFile.storagePath, 60)

  if (error || !data?.signedUrl) {
    throw new ApplicationServiceError('Le lien sécurisé du document est indisponible.')
  }

  try {
    const signedUrl = new URL(data.signedUrl)
    if (!['https:', 'http:'].includes(signedUrl.protocol)) throw new Error('Unsupported protocol')
    return signedUrl.toString()
  } catch {
    throw new ApplicationServiceError('Le lien sécurisé du document est invalide.')
  }
}

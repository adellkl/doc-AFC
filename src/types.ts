export type ApplicationStatus = 'to_review' | 'complete' | 'incomplete'

export type DocumentKind = 'identity_card' | 'medical_certificate'

export interface StoredDocument {
  id: string
  kind: DocumentKind
  name: string
  type: string
  size: number
  storagePath: string
}

export interface ApplicationRecord {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  consentAcceptedAt: string
  createdAt: string
  status: ApplicationStatus
  documents: Partial<{
    identityCard: StoredDocument
    medicalCertificate: StoredDocument
  }>
}

export interface SubmittedApplication {
  id: string
  firstName: string
  createdAt: string
}

export interface NewApplication {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  identityCard: File
  medicalCertificate: File
}

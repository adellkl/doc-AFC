export type ApplicationStatus = 'to_review' | 'complete' | 'incomplete'

export type DocumentKind = 'identity_card' | 'medical_certificate' | 'profile_photo'

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
  consentAcceptedAt: string
  createdAt: string
  status: ApplicationStatus
  documents: Partial<{
    identityCard: StoredDocument
    medicalCertificate: StoredDocument
    profilePhoto: StoredDocument
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
  identityCard: File
  medicalCertificate: File
  profilePhoto: File
}

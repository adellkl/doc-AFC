import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.95.3"
import {
  HttpError,
  createServiceRoleClient,
  hmacSha256Hex,
  jsonResponse,
  readRequiredEnvironmentValue,
  requireAllowedOrigin,
  requireClientIpAddress,
} from "../_shared/security.ts"

const APPLICATION_DOCUMENTS_BUCKET = "application-documents"
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES * 2 + 1024 * 1024
const REQUIRED_FIELDS = new Set([
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "consent",
  "identityCard",
  "medicalCertificate",
])

type DetectedDocumentType = {
  extension: "pdf" | "jpg" | "png"
  mimeType: "application/pdf" | "image/jpeg" | "image/png"
}

type ValidatedDocument = DetectedDocumentType & {
  file: File
  originalName: string
}

type ValidatedApplication = {
  address: string
  email: string
  firstName: string
  identityCard: ValidatedDocument
  lastName: string
  medicalCertificate: ValidatedDocument
  phone: string
}

// Multipart contract (all keys are required): firstName, lastName, email,
// phone, address, consent=true, identityCard, medicalCertificate.
Deno.serve(async (request) => {
  let corsHeaders: Record<string, string> = {}

  try {
    corsHeaders = requireAllowedOrigin(request, ["POST", "OPTIONS"])

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          ...corsHeaders,
        },
      })
    }

    if (request.method !== "POST") {
      throw new HttpError(405, "Method not allowed", { Allow: "POST, OPTIONS" })
    }

    validateMultipartRequest(request)

    const serviceClient = createServiceRoleClient()
    await enforceSubmissionRateLimit(request, serviceClient)

    const formData = await parseMultipartFormData(request)
    const application = await validateApplication(formData)
    const storedApplication = await storeApplication(serviceClient, application)

    return jsonResponse(201, storedApplication, corsHeaders)
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message }, corsHeaders, error.responseHeaders)
    }

    // Do not write form values, names, IP addresses, or storage paths to logs.
    console.error("submit_application_unexpected_failure")
    return jsonResponse(500, { error: "Unable to submit the application" }, corsHeaders)
  }
})

function validateMultipartRequest(request: Request): void {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? ""
  if (!contentType.startsWith("multipart/form-data;")) {
    throw new HttpError(415, "Content-Type must be multipart/form-data")
  }

  const contentLengthHeader = request.headers.get("content-length")
  if (!contentLengthHeader || !/^\d+$/.test(contentLengthHeader)) {
    throw new HttpError(411, "Content-Length is required")
  }

  const contentLength = Number(contentLengthHeader)
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new HttpError(400, "Invalid Content-Length")
  }
  if (contentLength > MAX_MULTIPART_BYTES) {
    throw new HttpError(413, "The request is too large")
  }
}

async function enforceSubmissionRateLimit(request: Request, serviceClient: SupabaseClient): Promise<void> {
  const hmacSecret = readRequiredEnvironmentValue("APPLICATION_RATE_LIMIT_HMAC_KEY")
  if (new TextEncoder().encode(hmacSecret).byteLength < 32) {
    throw new HttpError(503, "Service is not configured")
  }

  const clientIp = requireClientIpAddress(request)
  const scopeHash = await hmacSha256Hex(hmacSecret, `submit-application:v1\u0000${clientIp}`)
  const { data, error } = await serviceClient.rpc("enforce_application_submission_rate_limit", {
    p_scope_hash: scopeHash,
  })

  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new HttpError(503, "Submission protection is temporarily unavailable")
  }

  const decision = data[0] as { allowed?: unknown; retry_after_seconds?: unknown }
  if (typeof decision.allowed !== "boolean" || typeof decision.retry_after_seconds !== "number") {
    throw new HttpError(503, "Submission protection is temporarily unavailable")
  }

  if (!decision.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(decision.retry_after_seconds))
    throw new HttpError(
      429,
      "Too many submission attempts. Please try again later.",
      { "Retry-After": String(retryAfterSeconds) },
    )
  }
}

async function parseMultipartFormData(request: Request): Promise<FormData> {
  try {
    const formData = await request.formData()
    for (const [field] of formData.entries()) {
      if (!REQUIRED_FIELDS.has(field)) {
        throw new HttpError(400, "Unexpected form field")
      }
    }
    return formData
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, "Malformed multipart form data")
  }
}

async function validateApplication(formData: FormData): Promise<ValidatedApplication> {
  const firstName = validateTextField(getSingleText(formData, "firstName"), "first name", 120)
  const lastName = validateTextField(getSingleText(formData, "lastName"), "last name", 120)
  const email = validateEmail(getSingleText(formData, "email"))
  const phone = validatePhone(getSingleText(formData, "phone"))
  const address = validateTextField(getSingleText(formData, "address"), "address", 500, true)
  const consent = getSingleText(formData, "consent")
  if (consent !== "true") {
    throw new HttpError(400, "Consent is required")
  }

  const [identityCard, medicalCertificate] = await Promise.all([
    validateDocument(getSingleFile(formData, "identityCard")),
    validateDocument(getSingleFile(formData, "medicalCertificate")),
  ])

  return {
    address,
    email,
    firstName,
    identityCard,
    lastName,
    medicalCertificate,
    phone,
  }
}

function getSingleText(formData: FormData, field: string): string {
  const values = formData.getAll(field)
  if (values.length !== 1 || typeof values[0] !== "string") {
    throw new HttpError(400, `A single ${field} value is required`)
  }
  return values[0]
}

function getSingleFile(formData: FormData, field: string): File {
  const values = formData.getAll(field)
  if (values.length !== 1 || !(values[0] instanceof File)) {
    throw new HttpError(400, `A single ${field} file is required`)
  }
  return values[0]
}

function validateTextField(value: string, field: string, maxLength: number, allowLineBreaks = false): string {
  const normalized = value.replace(/\r\n?/g, "\n").trim()
  const forbiddenControls = allowLineBreaks
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    : /[\u0000-\u001f\u007f]/

  if (!normalized || normalized.length > maxLength || forbiddenControls.test(normalized)) {
    throw new HttpError(400, `Invalid ${field}`)
  }
  return normalized
}

function validateEmail(value: string): string {
  const email = validateTextField(value, "email", 320)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Invalid email")
  }
  return email
}

function validatePhone(value: string): string {
  const phone = validateTextField(value, "phone", 32)
  if (phone.length < 7 || !/^[0-9+().\s-]+$/.test(phone)) {
    throw new HttpError(400, "Invalid phone")
  }
  return phone
}

async function validateDocument(file: File): Promise<ValidatedDocument> {
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    throw new HttpError(400, "Each document must be between 1 byte and 10 MiB")
  }

  const originalName = validateOriginalFileName(file.name)
  const detectedType = await detectDocumentType(file)
  if (!detectedType) {
    throw new HttpError(400, "Each document must be a valid PDF, JPEG, or PNG")
  }

  const declaredType = file.type.trim().toLowerCase()
  if (declaredType && declaredType !== detectedType.mimeType) {
    throw new HttpError(400, "The document MIME type does not match its content")
  }
  if (!hasMatchingExtension(originalName, detectedType.extension)) {
    throw new HttpError(400, "The document extension does not match its content")
  }

  return { ...detectedType, file, originalName }
}

function validateOriginalFileName(value: string): string {
  const name = value.trim()
  if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new HttpError(400, "Invalid document name")
  }
  return name
}

function hasMatchingExtension(name: string, extension: DetectedDocumentType["extension"]): boolean {
  const normalized = name.toLowerCase()
  if (extension === "jpg") return normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")
  return normalized.endsWith(`.${extension}`)
}

async function detectDocumentType(file: File): Promise<DetectedDocumentType | null> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())

  if (startsWith(header, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { extension: "pdf", mimeType: "application/pdf" }
  }
  if (startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { extension: "png", mimeType: "image/png" }
  }
  if (startsWith(header, [0xff, 0xd8, 0xff])) {
    const trailer = new Uint8Array(await file.slice(file.size - 2, file.size).arrayBuffer())
    if (trailer[0] === 0xff && trailer[1] === 0xd9) {
      return { extension: "jpg", mimeType: "image/jpeg" }
    }
  }
  return null
}

function startsWith(value: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, index) => value[index] === byte)
}

async function storeApplication(
  serviceClient: SupabaseClient,
  application: ValidatedApplication,
): Promise<{ applicationId: string; createdAt: string; status: string }> {
  const applicationId = crypto.randomUUID()
  const documents = [
    {
      document: application.identityCard,
      kind: "identity_card",
      path: `${applicationId}/identity-card.${application.identityCard.extension}`,
    },
    {
      document: application.medicalCertificate,
      kind: "medical_certificate",
      path: `${applicationId}/medical-certificate.${application.medicalCertificate.extension}`,
    },
  ] as const
  const pathsToCleanUp = documents.map((document) => document.path)

  try {
    for (const { document, path } of documents) {
      const { error } = await serviceClient.storage
        .from(APPLICATION_DOCUMENTS_BUCKET)
        .upload(path, document.file, {
          cacheControl: "0",
          contentType: document.mimeType,
          upsert: false,
        })
      if (error) throw new Error("Storage upload failed")
    }

    const { data: insertedApplication, error: applicationError } = await serviceClient
      .from("applications")
      .insert({
        id: applicationId,
        first_name: application.firstName,
        last_name: application.lastName,
        email: application.email,
        phone: application.phone,
        address: application.address,
        consent_accepted_at: new Date().toISOString(),
      })
      .select("id, created_at, status")
      .single()
    if (applicationError || !insertedApplication) {
      throw new Error("Application insert failed")
    }

    const { error: documentsError } = await serviceClient.from("application_documents").insert(
      documents.map(({ document, kind, path }) => ({
        application_id: applicationId,
        kind,
        storage_path: path,
        original_name: document.originalName,
        mime_type: document.mimeType,
        byte_size: document.file.size,
      })),
    )
    if (documentsError) throw new Error("Document metadata insert failed")

    return {
      applicationId: insertedApplication.id,
      createdAt: insertedApplication.created_at,
      status: insertedApplication.status,
    }
  } catch (error) {
    await cleanUpFailedSubmission(serviceClient, applicationId, pathsToCleanUp)
    throw error
  }
}

async function cleanUpFailedSubmission(
  serviceClient: SupabaseClient,
  applicationId: string,
  paths: readonly string[],
): Promise<void> {
  const { error: databaseError } = await serviceClient.from("applications").delete().eq("id", applicationId)
  if (databaseError) console.error("submit_application_database_cleanup_failed")

  const { error: storageError } = await serviceClient.storage.from(APPLICATION_DOCUMENTS_BUCKET).remove([...paths])
  if (storageError) console.error("submit_application_storage_cleanup_failed")
}

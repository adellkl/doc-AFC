import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.95.3"
import {
  HttpError,
  createServiceRoleClient,
  isUuid,
  jsonResponse,
  requireAllowedOrigin,
  requireAuthenticatedUserId,
} from "../_shared/security.ts"

const APPLICATION_DOCUMENTS_BUCKET = "application-documents"
const SIGNED_URL_TTL_SECONDS = 60

Deno.serve(async (request) => {
  let corsHeaders: Record<string, string> = {}

  try {
    corsHeaders = requireAllowedOrigin(request, ["GET", "OPTIONS"])

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

    if (request.method !== "GET") {
      throw new HttpError(405, "Method not allowed", { Allow: "GET, OPTIONS" })
    }

    const documentId = new URL(request.url).searchParams.get("documentId")?.trim() ?? ""
    if (!isUuid(documentId)) {
      throw new HttpError(400, "A valid documentId is required")
    }

    const serviceClient = createServiceRoleClient()
    const userId = await requireAuthenticatedUserId(request, serviceClient)
    await requireAdministrator(serviceClient, userId)

    const { data: document, error: documentError } = await serviceClient
      .from("application_documents")
      .select("storage_path")
      .eq("id", documentId)
      .maybeSingle()

    if (documentError) {
      throw new HttpError(503, "Unable to load the document")
    }
    if (!document?.storage_path || typeof document.storage_path !== "string") {
      throw new HttpError(404, "Document not found")
    }

    const { data: signed, error: signedError } = await serviceClient.storage
      .from(APPLICATION_DOCUMENTS_BUCKET)
      .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS)

    if (signedError || !signed?.signedUrl) {
      throw new HttpError(503, "Unable to create a signed document URL")
    }

    return jsonResponse(200, { signedUrl: signed.signedUrl }, corsHeaders)
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, { error: error.message }, corsHeaders, error.responseHeaders)
    }

    console.error("admin_application_document_unexpected_failure")
    return jsonResponse(500, { error: "Unable to open the document" }, corsHeaders)
  }
})

async function requireAdministrator(serviceClient: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await serviceClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new HttpError(503, "Unable to verify administrator access")
  }
  if (!data?.user_id) {
    throw new HttpError(403, "Administrator access is required")
  }
}

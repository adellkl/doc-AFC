import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.95.3"
import {
  HttpError,
  allowAuthenticatedBrowserOrigin,
  createServiceRoleClient,
  isUuid,
  jsonResponse,
  requireAuthenticatedUserId,
} from "../_shared/security.ts"

const APPLICATION_DOCUMENTS_BUCKET = "application-documents"

Deno.serve(async (request) => {
  let corsHeaders: Record<string, string> = {}

  try {
    corsHeaders = allowAuthenticatedBrowserOrigin(request, ["DELETE", "OPTIONS"])

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...corsHeaders } })
    }
    if (request.method !== "DELETE") {
      throw new HttpError(405, "Method not allowed", { Allow: "DELETE, OPTIONS" })
    }

    const body: unknown = await request.json().catch(() => null)
    const applicationId = body && typeof body === "object" && "applicationId" in body && typeof body.applicationId === "string"
      ? body.applicationId.trim()
      : ""
    if (!isUuid(applicationId)) throw new HttpError(400, "A valid applicationId is required")

    const serviceClient = createServiceRoleClient()
    const userId = await requireAuthenticatedUserId(request, serviceClient)
    await requireAdministrator(serviceClient, userId)

    const { data: documents, error: documentsError } = await serviceClient
      .from("application_documents")
      .select("storage_path")
      .eq("application_id", applicationId)
    if (documentsError) throw new HttpError(503, "Unable to load application documents")

    const paths = (documents ?? []).flatMap((document) =>
      typeof document.storage_path === "string" && document.storage_path ? [document.storage_path] : [],
    )
    if (paths.length > 0) {
      const { error: storageError } = await serviceClient.storage.from(APPLICATION_DOCUMENTS_BUCKET).remove(paths)
      if (storageError) throw new HttpError(503, "Unable to delete application documents")
    }

    const { data: deleted, error: deleteError } = await serviceClient
      .from("applications")
      .delete()
      .eq("id", applicationId)
      .select("id")
      .maybeSingle()
    if (deleteError) throw new HttpError(503, "Unable to delete application")
    if (!deleted) throw new HttpError(404, "Application not found")

    return jsonResponse(200, { deletedId: applicationId }, corsHeaders)
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse(error.status, { error: error.message }, corsHeaders, error.responseHeaders)
    console.error("admin_delete_application_unexpected_failure")
    return jsonResponse(500, { error: "Unable to delete application" }, corsHeaders)
  }
})

async function requireAdministrator(serviceClient: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await serviceClient.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle()
  if (error) throw new HttpError(503, "Unable to verify administrator access")
  if (!data?.user_id) throw new HttpError(403, "Administrator access is required")
}

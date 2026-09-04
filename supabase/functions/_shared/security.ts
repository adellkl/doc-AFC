import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.95.3"

type CorsHeaders = Record<string, string>

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly responseHeaders: Record<string, string> = {},
  ) {
    super(message)
  }
}

export function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: CorsHeaders = {},
  responseHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders,
      ...responseHeaders,
    },
  })
}

export function requireAllowedOrigin(
  request: Request,
  allowedMethods: readonly string[] = ["GET", "POST", "OPTIONS"],
): CorsHeaders {
  const origin = request.headers.get("origin")
  if (!origin) {
    throw new HttpError(403, "Request origin is not allowed")
  }

  let canonicalOrigin: string
  try {
    const parsed = new URL(origin)
    if (parsed.origin !== origin) {
      throw new Error("Origin must be canonical")
    }
    canonicalOrigin = parsed.origin
  } catch {
    throw new HttpError(403, "Request origin is not allowed")
  }

  const allowedOrigins = readAllowedOrigins()
  if (!allowedOrigins.has(canonicalOrigin)) {
    throw new HttpError(403, "Request origin is not allowed")
  }

  return {
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": allowedMethods.join(", "),
    "Access-Control-Allow-Origin": canonicalOrigin,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

/**
 * CORS is not an authorization boundary: the document endpoint authorizes the
 * caller with a Supabase session and an `admin_users` lookup.  Its front-end
 * can therefore be served from a Vercel preview, a custom domain, or a local
 * port without changing a server-side allow list on every deployment.
 */
export function allowAuthenticatedBrowserOrigin(
  request: Request,
  allowedMethods: readonly string[] = ["GET", "OPTIONS"],
): CorsHeaders {
  const origin = request.headers.get("origin")
  if (!origin) {
    throw new HttpError(403, "Request origin is required")
  }

  let canonicalOrigin: string
  try {
    const parsed = new URL(origin)
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.origin !== origin) {
      throw new Error("Origin must be a canonical HTTP origin")
    }
    canonicalOrigin = parsed.origin
  } catch {
    throw new HttpError(403, "Request origin is not allowed")
  }

  return {
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": allowedMethods.join(", "),
    "Access-Control-Allow-Origin": canonicalOrigin,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

function readAllowedOrigins(): Set<string> {
  const raw = Deno.env.get("ALLOWED_ORIGINS")
  if (!raw) {
    throw new HttpError(503, "Service is not configured")
  }

  const origins = new Set<string>()
  for (const candidate of raw.split(",")) {
    const value = candidate.trim()
    if (!value) continue

    let url: URL
    try {
      url = new URL(value)
    } catch {
      throw new HttpError(503, "Service is not configured")
    }

    const isLocalHttp = url.protocol === "http:" && isLocalHostname(url.hostname)
    if (
      (url.protocol !== "https:" && !isLocalHttp) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new HttpError(503, "Service is not configured")
    }

    origins.add(url.origin)
  }

  if (origins.size === 0) {
    throw new HttpError(503, "Service is not configured")
  }

  return origins
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
}

export function createServiceRoleClient(): SupabaseClient {
  const url = readRequiredEnvironmentValue("SUPABASE_URL")
  const secretKey = readServiceRoleKey()

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

export function readRequiredEnvironmentValue(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) {
    throw new HttpError(503, "Service is not configured")
  }
  return value
}

function readServiceRoleKey(): string {
  // Hosted Edge Functions currently expose the default secret through the
  // SUPABASE_SECRET_KEYS JSON object. The two fallbacks keep local/legacy
  // environments compatible; every value remains server-side in Deno.env.
  const currentSecrets = Deno.env.get("SUPABASE_SECRET_KEYS")
  if (currentSecrets) {
    try {
      const parsed: unknown = JSON.parse(currentSecrets)
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "default" in parsed &&
        typeof parsed.default === "string" &&
        parsed.default.trim()
      ) {
        return parsed.default.trim()
      }
    } catch {
      throw new HttpError(503, "Service is not configured")
    }
    throw new HttpError(503, "Service is not configured")
  }

  const legacySecret =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ??
    Deno.env.get("SUPABASE_SECRET_KEY")?.trim()
  if (!legacySecret) {
    throw new HttpError(503, "Service is not configured")
  }
  return legacySecret
}

export function requireBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization")
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  if (!token) {
    throw new HttpError(401, "Authentication is required")
  }
  return token
}

export async function requireAuthenticatedUserId(
  request: Request,
  serviceClient: SupabaseClient,
): Promise<string> {
  const token = requireBearerToken(request)
  const { data, error } = await serviceClient.auth.getUser(token)
  if (error || !data.user) {
    throw new HttpError(401, "Authentication is required")
  }
  return data.user.id
}

export function requireClientIpAddress(request: Request): string {
  const cloudflareAddress = request.headers.get("cf-connecting-ip")?.trim()
  if (cloudflareAddress && isIpLiteral(cloudflareAddress)) {
    return cloudflareAddress
  }

  // Supabase's gateway appends a trusted client-facing address to
  // X-Forwarded-For. Prefer the final valid item so a client-provided leading
  // value cannot choose its own rate-limit key.
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const candidates = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .filter(isIpLiteral)
    const address = candidates.at(-1)
    if (address) return address
  }

  throw new HttpError(400, "A client address is required")
}

function isIpLiteral(value: string): boolean {
  if (value.length === 0 || value.length > 45) return false

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return value.split(".").every((part) => Number(part) <= 255)
  }

  return /^[0-9a-f:]+$/i.test(value) && value.includes(":")
}

export async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

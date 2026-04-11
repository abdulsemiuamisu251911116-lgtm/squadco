import { headers } from "next/headers";
import { createClient } from "./supabase/server";

async function getApiUrl() {
  const requestHeaders = headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost || requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");

  if (host) {
    const protocol = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${protocol}://${host}`;
  }

  const raw = process.env.NEXT_PUBLIC_API_URL || process.env.APP_BASE_URL || "http://localhost:3000";
  return raw.endsWith("/api") ? raw.slice(0, -4) : raw;
}

export async function callInternalApi<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("No active Supabase session");
  }

  const response = await fetch(`${await getApiUrl()}/api/internal${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || `Internal API request failed with ${response.status}`);
  }

  return body.data as T;
}

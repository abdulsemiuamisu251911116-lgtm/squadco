"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { callInternalApi } from "../lib/internal-api";
import { createClient } from "../lib/supabase/server";

function isRedirectError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const digest = "digest" in error ? String((error as { digest?: unknown }).digest || "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return digest.startsWith("NEXT_REDIRECT") || message === "NEXT_REDIRECT";
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login?error=Unable%20to%20load%20user");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, user_security ( totp_enabled )")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login?error=Signed%20in%20but%20no%20dashboard%20profile%20exists%20in%20public.users");
  }

  const userSecurity = profile?.user_security as { totp_enabled?: boolean } | Array<{ totp_enabled?: boolean }> | null | undefined;
  const totpEnabled = Array.isArray(userSecurity)
    ? Boolean(userSecurity[0]?.totp_enabled)
    : Boolean(userSecurity?.totp_enabled);

  if (totpEnabled) {
    redirect(`/2fa?challenge=1&next=${encodeURIComponent(profile?.role === "super_admin" ? "/admin" : "/dashboard")}`);
  }

  const cookieStore = await cookies();
  cookieStore.set("tl_2fa_verified", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  redirect(profile?.role === "super_admin" ? "/admin" : "/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.set("tl_2fa_verified", "", { expires: new Date(0), path: "/" });
  redirect("/login");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const supabase = await createClient();
  const redirectTo = `${process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/forgot-password?success=Password%20reset%20email%20sent");
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/login?error=Password%20updated.%20Sign%20in%20again.");
}

export async function updateProfileAction(formData: FormData) {
  const fullName = String(formData.get("full_name") || "");
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login");
  }

  const [{ error: authError }, { error: profileError }] = await Promise.all([
    supabase.auth.updateUser({
      data: {
        full_name: fullName
      }
    }),
    supabase
      .from("users")
      .update({ full_name: fullName })
      .eq("id", authData.user.id)
  ]);

  if (authError || profileError) {
    redirect(`/dashboard/profile?error=${encodeURIComponent(authError?.message || profileError?.message || "Failed to update profile")}`);
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  redirect("/dashboard/profile?success=Profile%20updated");
}

export async function updateProfilePasswordAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/dashboard/profile?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard/profile?success=Password%20updated");
}

export async function resendVerificationAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email
  });
  if (error) {
    redirect(`/verify-email?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/verify-email?success=Verification%20email%20sent");
}

export async function enableTotpAction(formData: FormData) {
  const secret = String(formData.get("secret") || "");
  const code = String(formData.get("code") || "");
  const next = String(formData.get("next") || "/dashboard");

  try {
    await callInternalApi("/auth/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ secret, code })
    });
    const cookieStore = await cookies();
    cookieStore.set("tl_2fa_verified", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
    redirect(next);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/2fa?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to enable 2FA")}`);
  }
}

export async function verifyTotpAction(formData: FormData) {
  const code = String(formData.get("code") || "");
  const next = String(formData.get("next") || "/dashboard");

  try {
    await callInternalApi("/auth/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ code })
    });
    const cookieStore = await cookies();
    cookieStore.set("tl_2fa_verified", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
    redirect(next);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/2fa?challenge=1&next=${encodeURIComponent(next)}&error=${encodeURIComponent(error instanceof Error ? error.message : "Invalid code")}`);
  }
}

export async function disableTotpAction(formData: FormData) {
  const code = String(formData.get("code") || "");

  try {
    await callInternalApi("/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ code })
    });
    const cookieStore = await cookies();
    cookieStore.set("tl_2fa_verified", "", { expires: new Date(0), path: "/" });
    redirect("/2fa?success=Two-factor%20authentication%20disabled");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/2fa?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to disable 2FA")}`);
  }
}

export async function updateBillingSettingsAction(formData: FormData) {
  const payload = {
    fail_open_mode: String(formData.get("fail_open_mode") || "verify"),
    preferred_assistant_name: String(formData.get("preferred_assistant_name") || ""),
    preferred_greeting: String(formData.get("preferred_greeting") || ""),
    squad_enabled: String(formData.get("squad_enabled") || "") === "on",
    live_enabled: String(formData.get("live_enabled") || "") === "on"
  };

  try {
    await callInternalApi("/billing/settings", {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    revalidatePath("/dashboard/billing");
    redirect("/dashboard/billing?success=Billing%20and%20runtime%20settings%20updated");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/dashboard/billing?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to update settings")}`);
  }
}

export async function requestGoLiveAction(formData: FormData) {
  const payload = {
    company_name: String(formData.get("company_name") || ""),
    rc_number: String(formData.get("rc_number") || ""),
    bank_name: String(formData.get("bank_name") || ""),
    account_name: String(formData.get("account_name") || ""),
    account_number: String(formData.get("account_number") || ""),
    use_case_description: String(formData.get("use_case_description") || "")
  };

  try {
    await callInternalApi("/billing/go-live-request", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    revalidatePath("/dashboard/billing");
    redirect("/dashboard/billing?success=Go-live%20request%20submitted");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/dashboard/billing?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to submit go-live request")}`);
  }
}

export async function reviewGoLiveAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const action = String(formData.get("action") || "approved");
  const review_notes = String(formData.get("review_notes") || "");

  try {
    await callInternalApi(`/admin/go-live-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ action, review_notes })
    });
    revalidatePath("/admin");
    redirect("/admin?success=Go-live%20request%20reviewed");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/admin?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to review request")}`);
  }
}

export async function runMonthlyResetAction() {
  try {
    await callInternalApi("/admin/monthly-reset", {
      method: "POST"
    });
    revalidatePath("/admin");
    revalidatePath("/dashboard/billing");
    redirect("/admin?success=Monthly%20usage%20reset%20completed");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/admin?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to run monthly reset")}`);
  }
}

export async function retryFailedJobAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  try {
    await callInternalApi(`/admin/failed-jobs/${id}/retry`, {
      method: "POST"
    });
    revalidatePath("/admin/ops");
    redirect("/admin/ops?success=Failed%20job%20requeued");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/admin/ops?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to retry job")}`);
  }
}

export async function createOrganizationAction(formData: FormData) {
  const payload = {
    name: String(formData.get("name") || ""),
    slug: String(formData.get("slug") || ""),
    plan: String(formData.get("plan") || "starter"),
    admin_email: String(formData.get("admin_email") || "")
  };

  try {
    await callInternalApi("/admin/orgs", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    revalidatePath("/admin/organizations");
    redirect("/admin/organizations?success=Organization%20created");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/admin/organizations/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to create organization")}`);
  }
}

export async function inviteTeamMemberAction(formData: FormData) {
  const payload = {
    email: String(formData.get("email") || ""),
    role: String(formData.get("role") || "bank_developer")
  };

  try {
    await callInternalApi("/team/invite", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    revalidatePath("/dashboard/team");
    redirect("/dashboard/team?success=Invite%20sent");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/dashboard/team?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to send invite")}`);
  }
}

export async function createApiKeyAction(formData: FormData) {
  const payload = {
    name: String(formData.get("name") || ""),
    environment: String(formData.get("environment") || "sandbox")
  };

  try {
    const response = await callInternalApi<{ key: string; key_prefix: string }>("/api-keys", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    revalidatePath("/dashboard/api-keys");
    redirect(`/dashboard/api-keys?success=${encodeURIComponent(`Key created: ${response.key}`)}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/dashboard/api-keys?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to create API key")}`);
  }
}

export async function revokeApiKeyAction(formData: FormData) {
  const id = String(formData.get("id") || "");

  try {
    await callInternalApi(`/api-keys/${id}`, {
      method: "DELETE"
    });
    revalidatePath("/dashboard/api-keys");
    redirect("/dashboard/api-keys?success=API%20key%20revoked");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/dashboard/api-keys?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to revoke API key")}`);
  }
}

export async function createWebhookAction(formData: FormData) {
  const payload = {
    url: String(formData.get("url") || ""),
    events: String(formData.get("events") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    secret: String(formData.get("secret") || "")
  };

  try {
    await callInternalApi("/webhooks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    revalidatePath("/dashboard/settings");
    redirect("/dashboard/settings?success=Webhook%20saved");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/dashboard/settings?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to save webhook")}`);
  }
}

export async function acceptInviteAction(formData: FormData) {
  const token = String(formData.get("token") || "");
  const payload = {
    token,
    full_name: String(formData.get("full_name") || ""),
    password: String(formData.get("password") || "")
  };

  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.APP_BASE_URL || "http://localhost:3000";
  const apiUrl = rawApiUrl.endsWith("/api") ? rawApiUrl.slice(0, -4) : rawApiUrl;

  try {
    const response = await fetch(`${apiUrl}/api/public/invitations/accept`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error || "Failed to accept invite");
    }

    redirect("/login?error=Invite%20accepted.%20Sign%20in%20with%20your%20new%20password.");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to accept invite")}`);
  }
}

export async function uploadStatementAction(formData: FormData) {
  const customerId = String(formData.get("customer_id") || "");
  const file = formData.get("statement");
  const fileType = String(formData.get("file_type") || "pdf");

  if (!(file instanceof File) || !file.size) {
    redirect(`/dashboard/customers/${customerId}?error=${encodeURIComponent("Please choose a PDF or CSV statement file")}`);
  }

  const bytes = await file.arrayBuffer();
  const content = Buffer.from(bytes).toString("base64");

  try {
    await callInternalApi(`/customers/${customerId}/statement-upload`, {
      method: "POST",
      body: JSON.stringify({
        content,
        file_type: fileType
      })
    });
    revalidatePath(`/dashboard/customers/${customerId}`);
    revalidatePath("/dashboard/customers");
    redirect(`/dashboard/customers/${customerId}?success=${encodeURIComponent("Statement uploaded and credit score updated")}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/dashboard/customers/${customerId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to upload statement")}`);
  }
}

export async function testWebhookAction(formData: FormData) {
  const webhookId = String(formData.get("id") || "");

  try {
    await callInternalApi(`/webhooks/${webhookId}/test`, {
      method: "POST"
    });
    revalidatePath("/dashboard/settings");
    redirect("/dashboard/settings?success=Webhook%20test%20sent");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/dashboard/settings?error=${encodeURIComponent(error instanceof Error ? error.message : "Failed to test webhook")}`);
  }
}

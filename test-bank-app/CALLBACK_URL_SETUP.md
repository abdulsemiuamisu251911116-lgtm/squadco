# Supabase Callback URL Setup - Quick Reference

## The Callback URL

This is the URL where users are redirected **after** they click the email confirmation link.

### For Your Deployment

Replace `YOUR_DOMAIN` with your actual domain:

```
https://YOUR_DOMAIN/auth/callback
```

### Examples

**If deployed on Vercel as `hamduk-bank.vercel.app`:**
```
https://hamduk-bank.vercel.app/auth/callback
```

**If deployed on Vercel as `my-project.vercel.app`:**
```
https://my-project.vercel.app/auth/callback
```

**For local development on `localhost:3000`:**
```
http://localhost:3000/auth/callback
```

## Where to Add It

### In Supabase Dashboard

1. Go to your Supabase project: https://app.supabase.com
2. Click on your project name
3. Go to **Authentication** (left sidebar)
4. Click **URL Configuration**
5. Scroll down to **Redirect URLs**
6. Click **Add URL**
7. Paste your callback URL (from above)
8. Click **Save**

## What Happens

### Sign Up Flow

```
1. User goes to /auth/sign-up
   ↓
2. Enters email & password, clicks "Sign up"
   ↓
3. Redirected to /auth/sign-up-success
   ↓
4. Email sent to user's inbox
   ↓
5. User clicks link in email
   ↓
6. Browser goes to: https://YOUR_DOMAIN/auth/callback?code=ABC123...
   ↓
7. App exchanges code for session
   ↓
8. Checks if user is onboarded:
   - If NO → Redirect to /onboarding
   - If YES → Redirect to /dashboard
```

## Code Reference

The callback is handled in: `/app/auth/callback/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Check onboarding status
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded_at')
        .eq('id', data.user.id)
        .single()

      // Redirect to onboarding or dashboard
      const redirectUrl = profile?.onboarded_at ? '/dashboard' : '/onboarding'
      return NextResponse.redirect(`${origin}${redirectUrl}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
```

## Important Notes

✅ **DO:**
- Use `https://` for production deployments
- Use `http://localhost:3000` for local testing
- Include the `/auth/callback` path exactly as shown
- Don't include a trailing slash

❌ **DON'T:**
- Include query parameters in the callback URL
- Use `/auth/callback/` (with trailing slash)
- Forget the protocol (`http://` or `https://`)
- Use IP addresses (use domain names)

## Verification

To verify your callback URL is configured correctly:

1. Go through the entire signup flow
2. Check your email for the confirmation link
3. Click the link - it should work without errors
4. You should be redirected to either `/onboarding` or `/dashboard`

If you see an error instead, the callback URL is not configured correctly in Supabase.

## Need Help?

If the callback isn't working:

1. **Check the URL** - Make sure it's exactly right in Supabase
2. **Check email** - Make sure you received the confirmation email
3. **Clear cache** - Clear browser cache and try again
4. **Check logs** - Look at browser console and network tab for errors
5. **Supabase status** - Visit https://status.supabase.com

## Alternative: Environment Variable

You can also use an environment variable for development. If set, emails will redirect to:

```env
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

But for production, always add the URL directly in Supabase dashboard.

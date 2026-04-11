# TrustLayer Webhook Configuration

This guide explains how to configure webhooks from TrustLayer to integrate with Hamduk Bank.

## Webhook Endpoint

**URL:** `https://your-app-domain.com/api/webhooks/trustlayer`

Replace `your-app-domain.com` with your actual Vercel deployment domain.

### Example URLs:
- Production: `https://hamduk-bank.vercel.app/api/webhooks/trustlayer`
- Staging: `https://hamduk-bank-staging.vercel.app/api/webhooks/trustlayer`
- Local Development: `https://localhost:3000/api/webhooks/trustlayer`

For local development, use a service like `ngrok` to expose your local server:
```bash
ngrok http 3000
# Then use: https://your-ngrok-url.ngrok.io/api/webhooks/trustlayer
```

## Webhook Secret

The webhook secret is used to verify that webhook requests are authentic and come from TrustLayer.

### Setting the Webhook Secret

1. **Get your webhook secret from TrustLayer Dashboard**
   - Log in to your TrustLayer dashboard
   - Navigate to Settings → Webhooks
   - Copy your webhook secret

2. **Add to Environment Variables**
   - In your Vercel project settings
   - Go to Settings → Environment Variables
   - Add a new variable:
     - **Key:** `TRUSTLAYER_WEBHOOK_SECRET`
     - **Value:** Paste your webhook secret from TrustLayer

## Configuring Webhooks in TrustLayer Dashboard

1. Go to your TrustLayer Dashboard
2. Navigate to Settings → Webhooks
3. Add New Webhook
4. Enter the webhook URL: `https://your-app-domain.com/api/webhooks/trustlayer`
5. Enter your webhook secret
6. Select the following events to subscribe to:
   - `customer.verified`
   - `customer.risk_updated`
   - `customer.credit_scored`
   - `transaction.checked`
7. Enable the webhook
8. Test the webhook connection

## Webhook Events Handled

The webhook handler processes the following event types:

### 1. `customer.verified`
**Triggered when:** A customer completes identity verification

**Payload:**
```json
{
  "event": "customer.verified",
  "timestamp": "2024-04-09T10:30:00Z",
  "data": {
    "customer_id": "cus_123456",
    "email": "user@example.com",
    "phone": "+2348012345678"
  }
}
```

**Action:** Updates user profile with `phone_verified: true` and `external_id`

---

### 2. `customer.risk_updated`
**Triggered when:** Trust/risk score is updated

**Payload:**
```json
{
  "event": "customer.risk_updated",
  "timestamp": "2024-04-09T10:30:00Z",
  "data": {
    "customer_id": "cus_123456",
    "trust_score": 750,
    "risk_level": "low"
  }
}
```

**Action:** Updates user profile with `trust_score`

---

### 3. `customer.credit_scored`
**Triggered when:** Credit analysis is completed

**Payload:**
```json
{
  "event": "customer.credit_scored",
  "timestamp": "2024-04-09T10:30:00Z",
  "data": {
    "customer_id": "cus_123456",
    "credit_score": 650,
    "credit_limit": 50000,
    "credit_grade": "B"
  }
}
```

**Action:** Updates user profile with `credit_score`

---

### 4. `transaction.checked`
**Triggered when:** A transaction is checked for fraud/risk

**Payload:**
```json
{
  "event": "transaction.checked",
  "timestamp": "2024-04-09T10:30:00Z",
  "data": {
    "customer_id": "cus_123456",
    "transaction_id": "txn_789012",
    "status": "approved",
    "risk_level": "low"
  }
}
```

**Action:** Logs transaction check result to `webhook_logs` table

## Webhook Security

### Signature Verification

All webhook requests from TrustLayer include an `X-TrustLayer-Signature` header containing an HMAC-SHA256 signature.

The signature is computed as:
```
signature = HMAC-SHA256(webhook_secret, request_body)
```

Our webhook handler automatically verifies this signature to ensure the request is authentic.

### Request Headers

Every webhook request includes:
- `X-TrustLayer-Signature`: HMAC-SHA256 signature for verification
- `X-TrustLayer-Request-Id`: Unique request identifier for tracking

### Secure Practices

1. Always use HTTPS for your webhook endpoint
2. Keep your webhook secret secure - never commit it to version control
3. Monitor webhook logs in the Admin Dashboard for failures
4. Verify webhook signatures on all incoming requests (we do this automatically)

## Testing Webhooks

### Using curl

```bash
curl -X POST https://your-app-domain.com/api/webhooks/trustlayer \
  -H "Content-Type: application/json" \
  -H "X-TrustLayer-Signature: your-signature-here" \
  -H "X-TrustLayer-Request-Id: req_12345" \
  -d '{
    "event": "customer.verified",
    "timestamp": "2024-04-09T10:30:00Z",
    "data": {
      "customer_id": "test_123",
      "email": "test@example.com",
      "phone": "+234801234567"
    }
  }'
```

### Using TrustLayer Dashboard

1. Go to Webhooks settings
2. Find your webhook
3. Click "Send Test Event"
4. Check the webhook logs in your Admin Dashboard for the result

## Webhook Logs

All webhook events are logged in the `webhook_logs` table for audit purposes.

### View Webhook Logs

1. Log in to Hamduk Bank as an admin user
2. Navigate to Admin Dashboard → Webhook Logs
3. View event history, request IDs, and status

### Log Structure

```sql
- id: Unique log identifier
- event_type: Type of webhook event
- request_id: TrustLayer request ID
- user_id: Associated user ID (if applicable)
- payload: Full webhook payload (JSON)
- status: success or error
- error_message: Error details if failed
- created_at: Timestamp
```

## Troubleshooting

### Webhook Not Triggering

1. **Check endpoint URL is correct**
   - Verify the URL in TrustLayer dashboard matches your app domain
   - Ensure the endpoint is publicly accessible

2. **Check webhook is enabled**
   - Go to TrustLayer dashboard → Webhooks
   - Ensure the webhook status is "Active"

3. **Check secret is configured**
   - Verify `TRUSTLAYER_WEBHOOK_SECRET` is set in Vercel environment variables
   - Restart your deployment after adding env vars

### Signature Verification Fails

1. **Verify secret matches**
   - Get the secret from TrustLayer dashboard
   - Compare with `TRUSTLAYER_WEBHOOK_SECRET` in Vercel

2. **Check request body format**
   - TrustLayer sends raw JSON body
   - Ensure you're verifying against the exact request body

### Events Not Updating User Data

1. **Check user exists**
   - Ensure the customer_id matches a user in the database
   - Verify user email is correctly stored

2. **Check admin dashboard logs**
   - Look for error messages in Admin Dashboard → Webhook Logs
   - Check error_message field for details

3. **Check database permissions**
   - Verify webhook logs table has proper RLS policies
   - Ensure service role can update profiles

## Support

For webhook-related issues:
1. Check webhook logs in Admin Dashboard
2. Review TrustLayer webhook delivery status
3. Verify environment variables are correctly set
4. Check application logs for errors

## Environment Variables

Required for webhook processing:

```env
# Webhook Secret from TrustLayer
TRUSTLAYER_WEBHOOK_SECRET=your_webhook_secret_here

# TrustLayer API Configuration
TRUSTLAYER_API_KEY=your_api_key
TRUSTLAYER_API_URL=https://api.trustlayer.com
```

All environment variables should be added to Vercel project settings under Environment Variables.

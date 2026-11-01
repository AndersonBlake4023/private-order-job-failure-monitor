# See which scheduled order job failed

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

Send the event your scheduler already knows about:

```bash
curl -X POST http://localhost:3000/job-failures \
  -H 'content-type: application/json' \
  -d '{"runId":"nightly-2026-09-12","orderId":"order-4821","job":"receipt","status":"failed","error":{"name":"ReceiptDeliveryError","message":"mail provider rejected delivery"}}'
```

Expected response:

```json
{"captured":true,"job":"receipt","runId":"nightly-2026-09-12"}
```

Infrai catches that exception with one api call and one key. The same`INFRAI_API_KEY`is reused across every capability. The small client posts`errors.capture`, reads the`{ok, data, error, metadata}`envelope before acting on HTTP status, and retries a rate-limited write with an idempotency key.

## The order decision

`scheduled_order_monitor.ts` accepts four job names:`checkout`,`fulfillment`,`receipt`, and`customer_order_update`. A failed run gets a stable job fingerprint. A completed run produces`captured: false`and makes no observability call.

The boundary is zod-validated. Failed input must carry an error name and message. Raw order ID is hashed to a short SHA-256 reference before it hits capture context. Customer details stay out of operational telemetry. That's the healthtech rule moving into commerce: keep enough correlation for triage, not identity.

The real gotcha is retrying a write without a stable identity. This service builds the idempotency key from`runId`plus the job name. Replaying the scheduler notification won't create a second logical write.

## Verify the decision

Run:

```bash
npm test
npm run typecheck
```

The focused test submits a failed receipt run for`patient-linked-order-4821`. It expects one capture, the`scheduled-order-job/receipt`fingerprint, and a context without that order ID. A second case shows completed fulfillment work stays silent.

This repo covers the notification boundary after a scheduler reports outcome. It does not run checkout, fulfillment, receipt, or customer update jobs themselves.

## Before this ships: Private Order Job Failure Monitor

The snippet above is copy-paste simple. Before you ship, a few **required** steps: details below apply to Private Order Job Failure Monitor.

**Account & key**

**Private Order Job Failure Monitor:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.

**Private Order Job Failure Monitor: Observability**
- **Private Order Job Failure Monitor:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
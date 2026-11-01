import assert from "node:assert/strict";
import test from "node:test";
import { monitorScheduledOrder, type Capture } from "../src/scheduled_order_monitor.js";

test("captures a receipt failure without exposing the order id", async () => {
  const calls: Parameters<Capture>[] = [];
  const capture: Capture = async (payload, idempotencyKey) => {
    calls.push([payload, idempotencyKey]);
    return {};
  };

  const result = await monitorScheduledOrder({
    runId: "nightly-2026-09-12",
    orderId: "patient-linked-order-4821",
    job: "receipt",
    status: "failed",
    error: { name: "ReceiptDeliveryError", message: "mail provider rejected delivery" },
  }, capture);

  assert.deepEqual(result, { captured: true, job: "receipt", runId: "nightly-2026-09-12" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].fingerprint.join("/"), "scheduled-order-job/receipt");
  assert.equal(calls[0][0].context.order_ref.length, 16);
  assert.equal(JSON.stringify(calls[0][0]).includes("patient-linked-order-4821"), false);
  assert.equal(calls[0][1], "scheduled-order:nightly-2026-09-12:receipt");
});

test("does not capture a completed fulfillment job", async () => {
  let captured = false;
  const capture: Capture = async () => {
    captured = true;
    return {};
  };

  const result = await monitorScheduledOrder({
    runId: "hourly-17",
    orderId: "order-88",
    job: "fulfillment",
    status: "completed",
  }, capture);

  assert.equal(result.captured, false);
  assert.equal(captured, false);
});

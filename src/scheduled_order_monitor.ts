import { createHash } from "node:crypto";
import { z } from "zod";
import { captureException, type CaptureException } from "./infrai_client.js";

export const jobFailureSchema = z.object({
  runId: z.string().min(1).max(100),
  orderId: z.string().min(1).max(200),
  job: z.enum(["checkout", "fulfillment", "receipt", "customer_order_update"]),
  status: z.enum(["completed", "failed"]),
  error: z.object({
    name: z.string().min(1).max(100),
    message: z.string().min(1).max(1_000),
    stack: z.string().max(8_000).optional(),
  }).optional(),
}).superRefine((value, context) => {
  if (value.status === "failed" && !value.error) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["error"], message: "error is required when status is failed" });
  }
});

export type JobFailureInput = z.infer<typeof jobFailureSchema>;
export type MonitorResult = { captured: boolean; job: JobFailureInput["job"]; runId: string };
export type Capture = (payload: CaptureException, idempotencyKey: string) => Promise<unknown>;

function privateOrderReference(orderId: string): string {
  return createHash("sha256").update(orderId).digest("hex").slice(0, 16);
}

export async function monitorScheduledOrder(
  input: JobFailureInput,
  capture: Capture = captureException,
): Promise<MonitorResult> {
  if (input.status === "completed") return { captured: false, job: input.job, runId: input.runId };

  const error = input.error!;
  await capture({
    title: `Scheduled ${input.job} job failed`,
    message: `${error.name}: ${error.message}`,
    level: "error",
    fingerprint: ["scheduled-order-job", input.job],
    exception: error.stack ?? `${error.name}: ${error.message}`,
    context: {
      job: input.job,
      run_id: input.runId,
      order_ref: privateOrderReference(input.orderId),
    },
  }, `scheduled-order:${input.runId}:${input.job}`);

  return { captured: true, job: input.job, runId: input.runId };
}

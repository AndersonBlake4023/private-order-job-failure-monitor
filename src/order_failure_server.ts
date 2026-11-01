import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_client.js";
import { jobFailureSchema, monitorScheduledOrder } from "./scheduled_order_monitor.js";

const port = Number(process.env.PORT ?? 3000);

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/job-failures") {
    send(response, 404, { error: "not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = jobFailureSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await monitorScheduledOrder(input);
    send(response, 200, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "invalid_request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, message: error.message });
      return;
    }
    send(response, 500, { error: "internal_error" });
  }
});

server.listen(port, () => {
  console.log(`Order job monitor listening on http://localhost:${port}`);
});

import { NextResponse } from "next/server";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { createNote } from "@/lib/pipedrive";
import { shouldCreateInvoice, syncWonDeal, type WebhookPayload } from "@/lib/sync";

export async function POST(request: Request) {
  let config: ReturnType<typeof getConfig>;
  try {
    config = getConfig();
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
  }

  if (!isAuthorized(request, config.webhookUser, config.webhookPassword)) {
    return unauthorized();
  }

  let payload: WebhookPayload = {};
  try {
    const text = await request.text();
    if (text) {
      payload = JSON.parse(text) as WebhookPayload;
    }
  } catch {
    return NextResponse.json({ ok: true, skipped: "invalid json" });
  }

  const trigger = shouldCreateInvoice(payload);
  if (!trigger) {
    return NextResponse.json({ ok: true, skipped: "not a newly won deal" });
  }

  try {
    const result = await syncWonDeal(config, trigger.dealId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync failed", trigger.dealId, message);
    try {
      await createNote(
        config.pipedriveToken,
        trigger.dealId,
        `E-conomic: kunne ikke oprette kladde. ${message}`,
      );
    } catch (noteError) {
      console.error("failed to write Pipedrive note", noteError);
    }
    return NextResponse.json({ ok: true, error: message, dealId: trigger.dealId });
  }
}

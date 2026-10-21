import type { AppConfig } from "./config";
import {
  createCustomer,
  createInvoiceDraft,
  findCustomerByCvr,
  findCustomerByName,
  getInvoiceTemplate,
  type EconomicCustomer,
  type EconomicInvoiceDraft,
} from "./economic";
import {
  createNote,
  formatCvr,
  getDeal,
  getOrCreateDraftFieldKey,
  getOrganization,
  orgIdFromDeal,
  updateDeal,
  type PipedriveDeal,
  type PipedriveOrganization,
} from "./pipedrive";

export type WebhookPayload = {
  meta?: {
    action?: string;
    entity?: string;
    object?: string;
    company_id?: number;
  };
  data?: Record<string, unknown>;
  current?: Record<string, unknown>;
  previous?: Record<string, unknown>;
  v?: number;
};

export type SyncResult = {
  skipped?: string;
  dealId?: number;
  draftInvoiceNumber?: number;
  dryRun?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function currentDealFromPayload(
  payload: WebhookPayload,
): Record<string, unknown> | undefined {
  return asRecord(payload.data) ?? asRecord(payload.current);
}

export function shouldCreateInvoice(payload: WebhookPayload): {
  dealId: number;
  reason?: string;
} | null {
  const current = currentDealFromPayload(payload);
  if (!current) {
    return null;
  }

  const entity = payload.meta?.entity ?? payload.meta?.object;
  if (entity && entity !== "deal") {
    return null;
  }

  const status = current.status;
  if (status !== "won") {
    return null;
  }

  const dealId = Number(current.id);
  if (!Number.isFinite(dealId)) {
    return null;
  }

  const previous = asRecord(payload.previous);
  if (previous && previous.status === "won") {
    return null;
  }

  return { dealId };
}

function streetFromOrg(org: PipedriveOrganization): string | undefined {
  const route = org.address_route?.trim();
  const number = org.address_street_number?.trim();
  if (route && number) {
    return `${route} ${number}`;
  }
  if (typeof org.address === "string" && org.address.trim()) {
    return org.address.trim();
  }
  return route || undefined;
}

async function resolveCustomer(
  config: AppConfig,
  org: PipedriveOrganization,
  cvr: string | null,
): Promise<EconomicCustomer> {
  if (cvr) {
    const byCvr = await findCustomerByCvr(
      config.economicAppSecret,
      config.economicGrant,
      cvr,
    );
    if (byCvr.collection?.[0]) {
      return byCvr.collection[0];
    }
  }

  const byName = await findCustomerByName(
    config.economicAppSecret,
    config.economicGrant,
    org.name,
  );
  if (byName.collection?.[0]) {
    return byName.collection[0];
  }

  if (!config.customerGroup) {
    throw new Error(
      "Kunden findes ikke i E-conomic, og ECONOMIC_CUSTOMER_GROUP mangler til oprettelse",
    );
  }

  const payload: Record<string, unknown> = {
    name: org.name,
    currency: "DKK",
    customerGroup: {
      customerGroupNumber: Number(config.customerGroup),
    },
  };

  if (config.paymentTerms) {
    payload.paymentTerms = {
      paymentTermsNumber: Number(config.paymentTerms),
    };
  }
  if (config.vatZone) {
    payload.vatZone = { vatZoneNumber: Number(config.vatZone) };
  }
  if (cvr) {
    payload.corporateIdentificationNumber = cvr;
  }

  const address = streetFromOrg(org);
  if (address) payload.address = address;
  if (org.address_postal_code) payload.zip = org.address_postal_code;
  if (org.address_locality) payload.city = org.address_locality;
  if (org.address_country) payload.country = org.address_country;

  return createCustomer(config.economicAppSecret, config.economicGrant, payload);
}

function buildDraft(
  template: EconomicInvoiceDraft,
  deal: PipedriveDeal,
  productNumber: string,
): EconomicInvoiceDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...template,
    date: today,
    currency: deal.currency || template.currency || "DKK",
    references: {
      ...(template.references ?? {}),
      other: `Pipedrive deal #${deal.id}`,
    },
    lines: [
      {
        lineNumber: 1,
        description: deal.title,
        quantity: 1,
        unitNetPrice: Number(deal.value),
        product: { productNumber },
      },
    ],
  };
}

export async function syncWonDeal(
  config: AppConfig,
  dealId: number,
): Promise<SyncResult> {
  const draftFieldKey = await getOrCreateDraftFieldKey(
    config.pipedriveToken,
    config.draftFieldName,
  );

  const deal = await getDeal(config.pipedriveToken, dealId);
  if (deal.status !== "won") {
    return { skipped: "Deal er ikke vundet", dealId };
  }

  const existingDraft = deal[draftFieldKey];
  if (existingDraft) {
    return {
      skipped: `Allerede synkroniseret (kladde ${existingDraft})`,
      dealId,
    };
  }

  const organizationId = orgIdFromDeal(deal);
  if (!organizationId) {
    await createNote(
      config.pipedriveToken,
      dealId,
      "E-conomic: kunne ikke oprette kladde – dealken har ingen organisation.",
    );
    return { skipped: "Mangler organisation", dealId };
  }

  const org = await getOrganization(config.pipedriveToken, organizationId);
  const cvr = config.cvrFieldKey
    ? formatCvr(org[config.cvrFieldKey])
    : null;

  const customer = await resolveCustomer(config, org, cvr);
  const template = await getInvoiceTemplate(
    config.economicAppSecret,
    config.economicGrant,
    customer.customerNumber,
  );
  const draftPayload = buildDraft(
    template,
    deal,
    config.defaultProductNumber,
  );

  if (config.dryRun) {
    await createNote(
      config.pipedriveToken,
      dealId,
      `E-conomic DRY RUN: ville oprette kladde for ${org.name} (kunde ${customer.customerNumber}), ${deal.value} ${deal.currency}.`,
    );
    return { dealId, dryRun: true };
  }

  const created = await createInvoiceDraft(
    config.economicAppSecret,
    config.economicGrant,
    draftPayload,
  );

  await updateDeal(config.pipedriveToken, dealId, {
    [draftFieldKey]: String(created.draftInvoiceNumber),
  });
  await createNote(
    config.pipedriveToken,
    dealId,
    `Kladde #${created.draftInvoiceNumber} oprettet i E-conomic.`,
  );

  return {
    dealId,
    draftInvoiceNumber: created.draftInvoiceNumber,
  };
}

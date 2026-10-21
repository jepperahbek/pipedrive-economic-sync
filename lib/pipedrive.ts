const PIPEDRIVE_API = "https://api.pipedrive.com/api/v1";

type PipedriveResponse<T> = {
  success: boolean;
  data: T;
  additional_data?: unknown;
};

async function pipedriveFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(`${PIPEDRIVE_API}${path}`);
  url.searchParams.set("api_token", token);

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json()) as PipedriveResponse<T> & {
    error?: string;
  };

  if (!response.ok || body.success === false) {
    throw new Error(
      `Pipedrive ${init?.method ?? "GET"} ${path} failed: ${body.error ?? response.status}`,
    );
  }

  return body.data;
}

export type PipedriveDeal = {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: string;
  org_id: number | { value: number } | null;
  won_time: string | null;
  [key: string]: unknown;
};

export type PipedriveOrganization = {
  id: number;
  name: string;
  address?: string | null;
  address_street_number?: string | null;
  address_route?: string | null;
  address_locality?: string | null;
  address_postal_code?: string | null;
  address_country?: string | null;
  [key: string]: unknown;
};

export type PipedriveField = {
  id: number;
  key: string;
  name: string;
  field_type: string;
};

export function orgIdFromDeal(deal: PipedriveDeal): number | null {
  if (typeof deal.org_id === "number") {
    return deal.org_id;
  }
  if (deal.org_id && typeof deal.org_id === "object" && "value" in deal.org_id) {
    return deal.org_id.value;
  }
  return null;
}

export function getDeal(token: string, id: number) {
  return pipedriveFetch<PipedriveDeal>(token, `/deals/${id}`);
}

export function updateDeal(
  token: string,
  id: number,
  payload: Record<string, unknown>,
) {
  return pipedriveFetch<PipedriveDeal>(token, `/deals/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getOrganization(token: string, id: number) {
  return pipedriveFetch<PipedriveOrganization>(token, `/organizations/${id}`);
}

export function listDealFields(token: string) {
  return pipedriveFetch<PipedriveField[]>(token, "/dealFields");
}

export function createDealField(token: string, name: string, fieldType: string) {
  return pipedriveFetch<PipedriveField>(token, "/dealFields", {
    method: "POST",
    body: JSON.stringify({ name, field_type: fieldType }),
  });
}

export function createNote(token: string, dealId: number, content: string) {
  return pipedriveFetch<{ id: number }>(token, "/notes", {
    method: "POST",
    body: JSON.stringify({ deal_id: dealId, content }),
  });
}

export function formatCvr(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }
  const digits = String(value).replace(/\D/g, "");
  return digits.length ? digits : null;
}

export async function getOrCreateDraftFieldKey(
  token: string,
  fieldName: string,
): Promise<string> {
  const fields = await listDealFields(token);
  const existing = fields.find(
    (field) => field.name.toLowerCase() === fieldName.toLowerCase(),
  );
  if (existing) {
    return existing.key;
  }
  const created = await createDealField(token, fieldName, "varchar");
  return created.key;
}

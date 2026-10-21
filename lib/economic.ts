const ECONOMIC_API = "https://restapi.e-conomic.com";

type EconomicCollection<T> = {
  collection: T[];
};

export type EconomicCustomer = {
  customerNumber: number;
  name: string;
  corporateIdentificationNumber?: string;
  currency?: string;
  customerGroup?: { customerGroupNumber: number };
  paymentTerms?: { paymentTermsNumber: number };
  vatZone?: { vatZoneNumber: number };
};

export type EconomicInvoiceDraft = {
  draftInvoiceNumber: number;
  date?: string;
  currency?: string;
  customer?: { customerNumber: number };
  layout?: { layoutNumber: number };
  paymentTerms?: { paymentTermsNumber: number };
  recipient?: {
    name: string;
    vatZone?: { vatZoneNumber: number };
    address?: string;
    zip?: string;
    city?: string;
    country?: string;
  };
  references?: { other?: string };
  lines?: Array<Record<string, unknown>>;
};

async function economicFetch<T>(
  appSecret: string,
  grant: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${ECONOMIC_API}${path}`, {
    ...init,
    headers: {
      "X-AppSecretToken": appSecret,
      "X-AgreementGrantToken": grant,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const body = text ? (JSON.parse(text) as T & { message?: string }) : undefined;

  if (!response.ok) {
    throw new Error(
      `E-conomic ${init?.method ?? "GET"} ${path} failed (${response.status}): ${text.slice(0, 800)}`,
    );
  }

  return body as T;
}

export function findCustomerByCvr(
  appSecret: string,
  grant: string,
  cvr: string,
) {
  const filter = encodeURIComponent(`corporateIdentificationNumber$eq:${cvr}`);
  return economicFetch<EconomicCollection<EconomicCustomer>>(
    appSecret,
    grant,
    `/customers?filter=${filter}`,
  );
}

export function findCustomerByName(
  appSecret: string,
  grant: string,
  name: string,
) {
  const filter = encodeURIComponent(`name$eq:${name}`);
  return economicFetch<EconomicCollection<EconomicCustomer>>(
    appSecret,
    grant,
    `/customers?filter=${filter}`,
  );
}

export function createCustomer(
  appSecret: string,
  grant: string,
  payload: Record<string, unknown>,
) {
  return economicFetch<EconomicCustomer>(appSecret, grant, "/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getInvoiceTemplate(
  appSecret: string,
  grant: string,
  customerNumber: number,
) {
  return economicFetch<EconomicInvoiceDraft>(
    appSecret,
    grant,
    `/customers/${customerNumber}/templates/invoice`,
  );
}

export function createInvoiceDraft(
  appSecret: string,
  grant: string,
  payload: EconomicInvoiceDraft,
) {
  return economicFetch<EconomicInvoiceDraft>(
    appSecret,
    grant,
    "/invoices/drafts",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

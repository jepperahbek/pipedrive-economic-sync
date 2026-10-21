function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function getConfig() {
  return {
    pipedriveToken: required("PIPEDRIVE_API_TOKEN"),
    cvrFieldKey: optional("PIPEDRIVE_CVR_FIELD_KEY"),
    draftFieldName:
      optional("PIPEDRIVE_DRAFT_FIELD_NAME") ?? "E-conomic kladdenr",
    webhookUser: optional("PIPEDRIVE_WEBHOOK_USER"),
    webhookPassword: optional("PIPEDRIVE_WEBHOOK_PASSWORD"),
    economicAppSecret: required("ECONOMIC_APP_SECRET_TOKEN"),
    economicGrant: required("ECONOMIC_AGREEMENT_GRANT_TOKEN"),
    defaultProductNumber: required("ECONOMIC_DEFAULT_PRODUCT_NUMBER"),
    customerGroup: optional("ECONOMIC_CUSTOMER_GROUP"),
    paymentTerms: optional("ECONOMIC_PAYMENT_TERMS"),
    vatZone: optional("ECONOMIC_VAT_ZONE"),
    dryRun: process.env.DRY_RUN === "true",
  };
}

export type AppConfig = ReturnType<typeof getConfig>;

# Pipedrive → E-conomic

Open-source webhook that creates an **E-conomic invoice draft** when a Pipedrive deal is marked as **won**.

- One invoice line: deal title + deal value (net)
- The invoice is **not** booked
- The draft number is written back to the deal
- Duplicates are skipped via a Pipedrive field (`E-conomic kladdenr` by default)

This repository is a generic template. Tokens stay in environment variables and are never committed.

## Setup

1. Copy `.env.example` to `.env.local` and fill in tokens
2. Create an app in the [E-conomic developer portal](https://www.e-conomic.com/developer/connect) and set `ECONOMIC_APP_SECRET_TOKEN` + `ECONOMIC_AGREEMENT_GRANT_TOKEN`
3. Set `ECONOMIC_DEFAULT_PRODUCT_NUMBER` to an existing product (VAT and ledger come from that product)
4. Set `ECONOMIC_CUSTOMER_GROUP` (and optionally payment terms + VAT zone) so missing customers can be created
5. Optionally set `PIPEDRIVE_CVR_FIELD_KEY` to your organization CVR custom field key, so customers are matched on CVR first
6. `npm install && npm run setup` creates the deal field in Pipedrive
7. Deploy (for example to Vercel) with the same env vars
8. Create a Pipedrive webhook:
   - URL: `https://<your-app>/api/webhook`
   - Event: `updated` + `deal`, version 2.0
   - HTTP Basic Auth using `PIPEDRIVE_WEBHOOK_USER` / `PIPEDRIVE_WEBHOOK_PASSWORD`

Set `DRY_RUN=true` on the first run if you want notes in Pipedrive without creating drafts.

## Local development

```bash
npm install
npm run dev
```

Health check: `GET /api/health`

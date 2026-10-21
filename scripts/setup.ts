import { getConfig } from "../lib/config";
import { getOrCreateDraftFieldKey } from "../lib/pipedrive";

async function main() {
  const config = getConfig();
  const key = await getOrCreateDraftFieldKey(
    config.pipedriveToken,
    config.draftFieldName,
  );
  console.log(`Deal-felt "${config.draftFieldName}" er klar. Key: ${key}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

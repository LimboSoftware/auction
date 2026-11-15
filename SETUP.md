# Deploy Auction Scout (no API keys)

The current app uses a Cloudflare Worker with static assets. It does not use the old Blizzard scanner or D1 schema. The provider is AHledger, not Forever Mastery, because AHledger documents a public API and explicitly covers EU Normal Alliance.

## Cloudflare dashboard
Workers & Pages → Create application → Worker → Import a repository (Git integration). Select LimboSoftware/auction, branch main. Use root directory, no build command, deploy command npx wrangler deploy. If Cloudflare prompts for a Worker name use auction-scout. No environment variables, secrets, bindings or database provisioning are necessary.

Alternatively clone the repo with Git and run npx wrangler login then npx wrangler deploy from its root. Node.js required.

## Check after deployment
Open /api/markets and confirm forever.normal.alliance.eu is present.
Open /api/table and verify its AHL1 header refers to forever/normal/alliance/eu.
Open /api/item/4306 and verify Silk Cloth, exact market, current quote and history.
Open the dashboard, press Refresh market, and check the scan timestamp and results. If the provider returns a different schema, an error is displayed rather than fabricated prices.

The code uses documented formats but has not yet been exercised against the live API. Provider data is requested on demand; historical analysis uses the provider's seven-day summary and item history. No API data is archived. Credit: https://ahledger.com. See https://ahledger.com/terms and https://ahledger.com/developers.

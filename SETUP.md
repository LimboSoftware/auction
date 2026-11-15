# Live scanner setup
Create a Battle.net developer API client at https://develop.battle.net/access/clients. Do not share its secret in chat or commit it.
Install Node.js, then run:
- npx wrangler login
- npx wrangler d1 create auction-scout
- Replace database_id in wrangler.toml with the returned ID.
- npx wrangler d1 execute auction-scout --remote --file=schema.sql
- npx wrangler secret put BLIZZARD_CLIENT_ID
- npx wrangler secret put BLIZZARD_CLIENT_SECRET
- npx wrangler deploy
The Worker runs hourly at minute 25 UTC. The first scan occurs on a cron trigger; /api/status shows stored snapshots.
Commodity feed only; house 111 is mapped to EU Normal Alliance by Saddlebag Exchange, and ruleset 2 is Normal. API is experimental; authenticated integration has not yet been tested. Each source Last-Modified timestamp is retained once. No sale volume is inferred. The cheapest 15% supply boundary is a listing-price reference, not a trade price.
Dashboard begins with item IDs until names are mapped; no raw credential is exposed. Review Blizzard data usage terms before public distribution.

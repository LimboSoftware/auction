# Auction Scout

Personal WoW Forever trading assistant for **EU Normal Alliance**. Current provider: [AHledger](https://ahledger.com), using its documented public API. No Blizzard API account, credentials, D1 database or scheduled worker needed. No automated in-game trading.

## Deploy
See [SETUP.md](SETUP.md). The live dashboard is in public/index.html and the API proxy is worker.js. The top-level index.html is the earlier offline CSV prototype, not the deployed app.

## Analysis
Filter current listings by budget, discount against seven-day median, estimated units sold/day and potential per-unit net profit (5% auction cut plus user-entered costs). Click a candidate to see its name and seven-day history. Common commodities have built-in names; other items initially show their item IDs. The lowest listing's available quantity and minimum stack size are not provided, so the app does not recommend a bulk quantity. Listing prices and sales estimates do not guarantee a sale.

Live data is displayed on demand, not stored in a permanent database or exported. [Provider terms and API](https://ahledger.com/developers). Personal/community free use with attribution; commercial use and data archives require a separate licence. Live network integration has not been tested yet.

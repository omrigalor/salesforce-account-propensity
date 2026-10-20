# Salesforce Account Propensity

An independent portfolio prototype for ranking enterprise accounts by likely Salesforce product fit, then inspecting the signals and assumptions behind each recommendation. It is not an official Salesforce product and is not affiliated with or endorsed by Salesforce.

The original account records, signals, product registry and modeled values are preserved in `app/dataset.js`; `source-manifest.json` records the dataset's SHA-256 hash.

## Use

Open **Salesforce Pipeline Intelligence.app** on the Desktop.

- **Discover accounts:** choose a product, search accounts, and open Filters only when needed. The queue uses 40-row pages. Detailed forecast math is in the account drawer rather than the main table.
- **Open an account:** see an overview, a product-level hypothesis, relevant imported evidence and missing information. Model detail, all signals and approach are separate tabs.
- **Save to my pipeline:** add private notes and a next step, and choose a working stage. The board reflects your choices; it does not claim a real CRM deal has advanced.
- **⌘K:** search companies across products.
- **Product library / Signal explorer / Data sources / Model health:** separate reference views retain the original analysis and limitations.
- **Export:** download filtered account results as CSV. **Export workspace backup** saves your notes and working stages. Restore merges backups while preserving existing entries on collisions.

The app works locally without an API key. It does not perform new AI inference, research, contact enrichment or Salesforce synchronization. Imported scores are hypotheses, not calibrated probabilities or deal forecasts. The original model-health findings remain visible. No new claims of predictive quality are made.

Notes persist in Electron's local storage under the app's Application Support directory. Renderer networking and permissions are denied; the app has no Node access in the page. Exports are explicit user actions. Local notes are not encrypted; use workspace backups for recovery.

## Development

Node 24+, Apple Silicon macOS. `npm install`, `npm test`, `npm start`, `npm run package`.

`app/engine.js` retains the source analysis with two original UI defects fixed: duplicate validation-table IDs and dictionary filters caught by account-filter handlers. `app/workspace.js` adds local workflow, pagination, search and progressive disclosure. The original `.html` and data hashes are regression checked.

The icon is an original blue cloud with ascending bars, rendered by `scripts/build-icon.py`. It is distinct from SalesCopilot's microphone cloud.

## Validation

13 automated tests cover dataset preservation, pagination, search, notes/reload, independent opportunities, undo, all reference views, filter isolation, exports, keyboard access and shell isolation. GUI launch is unavailable in the build environment; automated DOM checks do not establish pixel-perfect rendering on the user's display. The packaged app is locally signed and verified, not Apple-notarized for distribution.

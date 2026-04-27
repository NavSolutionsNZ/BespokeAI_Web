# BespoxAI — Intelligence for Business Central & NAV

> AI-powered financial intelligence layer for Microsoft Dynamics 365 Business Central and NAV.

## Overview

BespoxAI is a SaaS product that sits on top of Business Central and NAV, providing:

- **CFO Assistant** — Natural language queries over your financial data
- **Data Health Scanner** — Automated compliance and data integrity checks
- **Cash Flow Intelligence** — 13-week AI-powered rolling forecasts *(Phase 3)*
- **Month-End Close Assistant** — Guided close with automated pre-checks *(Phase 2)*
- **NAV Migration Analyser** — Codebase scan and migration business case *(Fixed-fee)*

## Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5 · CSS3 · Vanilla JS |
| Fonts | Cormorant Garamond · DM Sans · DM Mono (Google Fonts) |
| Hosting | Vercel (recommended) |

## Project Structure

```
BespoxAi_Web/
├── index.html        # Main site — landing, sign-in, and portal views
├── README.md         # This file
└── .gitignore        # Standard web project ignores
```

## Getting Started

### Local development

```bash
# Clone the repo
git clone https://github.com/<your-username>/BespoxAi_Web.git
cd BespoxAi_Web

# Open directly in browser
open index.html
```

For live-reload during development, use a local server:

```bash
npx serve .
# or
python3 -m http.server 3000
```

### Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import **BespoxAi_Web** from GitHub
4. Framework preset: **Other** (static site)
5. Click **Deploy** — that's it ✓

Every push to `main` will trigger an automatic redeploy.

## Roadmap

| Phase | Features | Timeline |
|---|---|---|
| Phase 1 | CFO Chat · Data Health Scanner | Current |
| Phase 2 | Month-End Close Assistant | Months 4–6 |
| Phase 3 | Cash Flow Intelligence | Months 7–9 |

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

## License

Proprietary — © BespoxAI. All rights reserved.

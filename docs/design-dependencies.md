# Design dependencies — Hugeicons and the MOMAH / DGA guidance (checked 5 Nov 2026)

## What exists locally
* **Supplied design document:** `~/Downloads/20260512 - AI Foundations - Workshop #1 - UX_UI.pdf` (15 pages, three identical copies). It states the design system = **DGA foundation** (fixed: colour system with primary / semantic / neutral palettes, bilingual typography with a type scale and weights, spacing on a **4 px unit**, core component behaviour) + product customisation + AI extensions (AI states: thinking / generating / refining; explainability cues). It names **Hugeicons** as the icon set and lists component categories (actions, content display, data display — tables, charts, metrics —, forms, navigation, feedback, search & filters, shell).
* **Supplied PowerPoint templates:** `public/templates/momah-{en,ar}.pptx` (Trebuchet MS / Sakkal Majalla, teal palette, logo, footers) — used as supplied for PowerPoint exports.
* **App tokens:** DGA-based colour tokens, IBM Plex Sans Arabic (`@fontsource/ibm-plex-sans-arabic`), 4 px-based spacing, inline SVG icon components (`components/furas/FurasUI.jsx`, `Layout.jsx` icon set).

## What does NOT exist locally (unresolved external dependencies)
1. **The Hugeicons package / icon files** — not in `package.json`, `node_modules` or the repo. `docs/platform-audit-en.md` (D3 / G-11) records the licence as **unconfirmed** (free set vs Pro). It was therefore **not installed**, and no other icon family was introduced: the existing inline SVG icons stay (stroke-rounded style, consistent size). Replace with `@hugeicons/*` once the licence/package is confirmed.
2. **The DGA design guidance, the Figma UI kit and the MOMAH web UI/UX guideline** — referenced by links in the PDF (not reproducible offline) and absent from the repo. Pixel-level conformance to the kit's components (exact radii, density, chart styling) is therefore **not verified**; the work follows the PDF's stated foundations (colour semantics, 4 px grid, Arabic/English typography, AI states) and the established project components.

## How the new work follows the available guidance
* Typography: IBM Plex Sans Arabic on the web (DGA bilingual type); PowerPoint keeps the template fonts.
* Spacing: 4 px multiples in the new CSS blocks (`.ex-*`, `.rc-*`, `.sr-*`).
* Colour: semantic use only (warning for exclusion/attention, success/neutral for collected), accessible contrast; charts use the app palette and never rely on colour alone (labels / patterns on null cells).
* AI states: thinking / generating / stop / retry / error states exist in Smart Reports.

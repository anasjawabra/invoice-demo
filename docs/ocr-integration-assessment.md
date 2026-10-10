# OCR integration assessment (Arabic enforcement-order documents)

**Status: no approved OCR engine is available, so none is integrated.** This system performs **no OCR**. It reads the **text layer of digital PDFs** (pdf.js) and accepts **text supplied from outside** (an external OCR tool's output, or references typed by a person). Both are recorded and labelled as such; neither is ever shown as "OCR performed by this system".

## What was checked in this environment

| Candidate | Available here? | Result |
|---|---|---|
| Tesseract / OCRmyPDF | not installed | not assessed |
| Python OCR libraries (EasyOCR etc.) | not installed | not assessed |
| macOS Vision framework (`VNRecognizeTextRequest`, `ar-SA` + `en-US`, macOS 26.6.2) | present on this development Mac only | **assessed as evidence, not integrated** (host-specific; not deployable with the Node data service; not approved) |

**Probe** (`docs/ocr-assessment/vision-probe.swift`, output in `vision-probe-output.txt`): the synthetic Arabic scanned sample `public/samples/enforcement-orders/ar-EN-5143-scanned.pdf` (2 image-only pages; no text layer — confirmed with `pdftotext` and `pdfimages`) was rendered to JPEG at 110 dpi and recognised.

* Arabic running text was recognised well (confidence 1.00 on headings, debtor line, order total «المبلغ الإجمالي»).
* **The decisive finding — mixed-direction invoice numbers are unreliable.** The invoice number `INV-2025-0000054` came back as `0000054-2025-10` (reversed, «INV» lost, confidence 0.50); the order number as `رقم أمر التين ( 212` (0.30); an amount lost digits (`952,260.00` for `6,952,260.00`); **the whole table on page 2 was not recognised at all**.
* Consequence demonstrated in the app: importing this output as external OCR text yields only a weak serial (`0000054`) that matches **three invoices of three years** → *ambiguous*, not confirmed. The order stays unresolved until a person supplies the full invoice number from the page (typed), which then settles the weak reference. This is the intended behaviour: **OCR output on Arabic documents with embedded Latin invoice numbers cannot be trusted without human review**, and the amount (damaged here) is never used to match.

## What a production integration would need (concrete, to be decided and approved)

| Item | Detail to decide / confirm |
|---|---|
| Engine | Candidates: **Tesseract 5** (`ara` + `eng` traineddata, self-hosted, open source); a managed document-AI service with Arabic support (e.g. Azure AI Document Intelligence, Google Document AI) — **only if hosting/data-residency rules for ministry documents allow it**; a Saudi-hosted engine if one is mandated. None is approved. |
| API | A server-side endpoint, e.g. `POST /api/order-ocr` (multipart PDF or page images) → `{ pages: [{ page, text, words:[{text, bbox, confidence}] }], engine, version }`. The client already has the receiving path (`recordSupplementalExtraction`, method `ocr_import`); an integrated engine would add a distinct method (`ocr_system`) so the origin stays visible. |
| Languages | Arabic (`ara`) **and** English/Latin digits in the same page; right-to-left layout with left-to-right numbers; Arabic-Indic and Latin digits. |
| Pre-processing | Deskew, denoise, binarise, 300 dpi rendering; table-structure detection (the invoice table is where recognition failed in the probe). |
| Hosting / config | Where it runs (on the data-service host or a separate service), CPU/GPU sizing, language-data distribution, request size limits, timeouts, queueing for multi-page documents, secrets, network egress rules. |
| Quality gates | Per-word confidence kept as evidence; **every OCR-derived reference stays a proposal that a person confirms**; invoice-number patterns validated (`INV-YYYY-NNNNNNN`, check against the invoice list), reversed/damaged numbers flagged, never "repaired" by similarity or by amount. |
| Verification needed before any claim | A **held-out set of real (non-synthetic) Arabic scans** with ground truth, measured field-level accuracy on invoice numbers, order numbers and amounts, and the rate of silently wrong numbers; the synthetic samples here only prove the workflow. |
| Dependencies outside this repository | An engine decision; Sanad's PDF delivery format (digital vs scanned proportion); data-protection approval; operations ownership. |

## What is delivered and verified now

* Digital Arabic PDF with a real text layer (`ar-EN-5013-digital.pdf`, made with LibreOffice): read across 2 pages and the table (3 invoice numbers of 3 types; contract and identity numbers set apart). Arabic *letters* come back with shaping/ordering artefacts, so **only pattern-identified numbers are relied on**; label-based classification of bare serials in Arabic text is not reliable.
* Arabic scanned PDF (`ar-EN-5143-scanned.pdf`): no text layer → both pages flagged «NOT read»; external OCR text and typed references recorded with their true origin; links still require confirmation.
* **Not delivered:** OCR performed by this system; live Sanad retrieval; any claim about real-document accuracy.

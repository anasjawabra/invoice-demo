"""Screen/export parity: every item a model SHOWS on screen must exist in its Word, Excel and PowerPoint files.
usage: python3 scripts/export_parity_check.py <dir produced by export-parity.mjs>   (needs python-docx, openpyxl, python-pptx)"""
import json, sys, re, glob, os
from docx import Document
import openpyxl
from pptx import Presentation

d = sys.argv[1]
man = json.load(open(os.path.join(d, 'manifest.json')))
norm = lambda s: re.sub(r'\s+', ' ', re.sub(r'[‎‏‪-‮]', '', str(s))).strip()

def docx_text(p):
    doc = Document(p); t = [x.text for x in doc.paragraphs]
    for tb in doc.tables:
        for r in tb.rows:
            t += [c.text for c in r.cells]
    return norm(' '.join(t))
def xlsx_text(p):
    wb = openpyxl.load_workbook(p, read_only=True); t = []
    for ws in wb.worksheets:
        for row in ws.iter_rows(values_only=True):
            t += [str(c) for c in row if c is not None]
    return norm(' '.join(t))
def pptx_text(p):
    pr = Presentation(p); t = []
    for s in pr.slides:
        for sh in s.shapes:
            if sh.has_text_frame: t.append(sh.text_frame.text)
            if getattr(sh, 'has_table', False) and sh.has_table:
                for r in sh.table.rows: t += [c.text for c in r.cells]
    return norm(' '.join(t))

# the xlsx truncates nothing, but the PowerPoint/Word carry the same text lines; chart series appear as tables.
tot = {'docx': [0, 0], 'xlsx': [0, 0], 'pptx': [0, 0]}; miss = []
for m in man:
    texts = {'docx': docx_text(f"{d}/{m['id']}.docx"), 'xlsx': xlsx_text(f"{d}/{m['id']}.xlsx"), 'pptx': pptx_text(f"{d}/{m['id']}.pptx")}
    for it in m['shown']:
        key = norm(it['text'])
        for fmt, txt in texts.items():
            tot[fmt][1] += 1
            # long paragraphs may be wrapped differently: compare the first 60 characters
            if key[:60] in txt: tot[fmt][0] += 1
            else: miss.append((m['id'], fmt, it['kind'], key[:70]))
# every formatted CELL of every shown table row is present in Word and PowerPoint; every exact SAR amount is present in the Excel amounts sheet
cell_tot = {'docx': [0, 0], 'pptx': [0, 0]}; cell_miss = []; money_tot = [0, 0]
for m in man:
    texts = {'docx': docx_text(f"{d}/{m['id']}.docx"), 'pptx': pptx_text(f"{d}/{m['id']}.pptx")}
    for c in m.get('cells', []):
        key = norm(c)
        if not key: continue
        for fmt, txt in texts.items():
            cell_tot[fmt][1] += 1
            if key in txt: cell_tot[fmt][0] += 1
            else: cell_miss.append((m['id'], fmt, key[:50]))
    wb = openpyxl.load_workbook(f"{d}/{m['id']}.xlsx", read_only=True)
    amounts = set()
    if 'amounts_sar' in wb.sheetnames:
        for row in wb['amounts_sar'].iter_rows(min_row=2, values_only=True):
            if isinstance(row[3], (int, float)): amounts.add(round(float(row[3]), 2))
    for v in m.get('money', []):
        money_tot[1] += 1
        if round(float(v), 2) in amounts: money_tot[0] += 1
        else: cell_miss.append((m['id'], 'xlsx-exact', str(v)))
for fmt, (ok, n) in cell_tot.items(): print(f"{fmt} table cells: {ok}/{n}")
print(f"xlsx exact SAR amounts: {money_tot[0]}/{money_tot[1]}")
for x in cell_miss[:8]: print('MISSING cell', x)
miss += [(a, b, 'cell', c) for (a, b, c) in cell_miss]
for fmt, (ok, n) in tot.items(): print(f"{fmt}: {ok}/{n} items present ({100*ok/max(n,1):.1f}%)")
by = {}
for mid, fmt, kind, text in miss: by.setdefault((fmt, kind), []).append((mid, text))
for (fmt, kind), v in sorted(by.items()): print(f"MISSING {fmt} {kind}: {len(v)} e.g. {v[0]}")
sys.exit(1 if miss else 0)

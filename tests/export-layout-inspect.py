import sys, json, re, unicodedata
from pathlib import Path
from docx import Document
from pptx import Presentation
from pypdf import PdfReader
root=Path(sys.argv[1]); manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
def norm(t):
    return re.sub(r'\s+','',re.sub(r'[\u200e\u200f\u202a-\u202e\u2066-\u2069]','',unicodedata.normalize('NFKC',str(t))))
results=[]
for case in manifest['results']:
    ident=case['id']; doc=Document(root/f'{ident}.docx'); deck=Presentation(root/f'{ident}.pptx'); pdf=PdfReader(root/f'{ident}.pdf')
    doc_text=' '.join([p.text for p in doc.paragraphs]+[c.text for t in doc.tables for r in t.rows for c in r.cells])
    deck_text=' '.join([s.text for slide in deck.slides for s in slide.shapes if s.has_text_frame]+[c.text for slide in deck.slides for s in slide.shapes if s.has_table for r in s.table.rows for c in r.cells])
    missing={}
    for fmt,text in [('docx',doc_text),('pptx',deck_text)]:
        missing[fmt]=[p for p in case['paragraphs'] if norm(p) and not p.startswith(('Prepared ','أُعدّ في')) and norm(p) not in norm(text)]
    bounds=[]
    for number,slide in enumerate(deck.slides,1):
        for shape in slide.shapes:
            if shape.left < 0 or shape.top < 0 or shape.left+shape.width > deck.slide_width+9144 or shape.top+shape.height > deck.slide_height+9144:
                bounds.append({'slide':number,'shape':shape.name,'text':shape.text[:90] if shape.has_text_frame else 'table/chart','bottomInches':round((shape.top+shape.height)/914400,2),'pageHeight':round(deck.slide_height/914400,2)})
    results.append({'id':ident,'missing':missing,'slideBounds':bounds,'slides':len(deck.slides),'browserPdfPages':len(pdf.pages),'docxTables':len(doc.tables),'docxCharts':len(doc.inline_shapes)})
(root/'inspection.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
for r in results: print(json.dumps({k:v for k,v in r.items() if k not in ('missing','slideBounds')}|{'missing':{k:len(v) for k,v in r['missing'].items()},'outsideSlides':len(r['slideBounds'])},ensure_ascii=False))
sys.exit(int(any(any(r['missing'].values()) or r['slideBounds'] for r in results)))

from pathlib import Path
from pypdf import PdfReader
from PIL import Image, ImageOps, ImageDraw
import subprocess, sys, json, math
root=Path(sys.argv[1]); renderer=sys.argv[2]; out=root/(sys.argv[3] if len(sys.argv)>3 else 'page-review'); out.mkdir(exist_ok=True)
pdfs=[] if '--word-only' in sys.argv else list(root.glob('*.pdf'))+list((root/'pptx-pdf').glob('*.pdf'))
word_folders=sorted(root.glob('*-word-v3')) or sorted(root.glob('*-word'))
reviews=[]
for pdf in sorted(pdfs):
    category='pptx' if pdf.parent.name=='pptx-pdf' else 'browser-pdf'; ident=f'{pdf.stem}-{category}'; folder=out/ident; folder.mkdir(exist_ok=True)
    subprocess.run([renderer,'-scale-to','1200','-png',str(pdf),str(folder/'page')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    pages=sorted(folder.glob('page-*.png')); reader=PdfReader(pdf)
    reviews.append({'file':str(pdf),'pages':len(reader.pages),'blankTextPages':[i+1 for i,p in enumerate(reader.pages) if not (p.extract_text() or '').strip()]})
for folder in word_folders:
    pages=sorted(folder.glob('page-*.png'),key=lambda p:int(p.stem.split('-')[-1])); reviews.append({'file':str(next(folder.glob('*.pdf'))),'pages':len(pages),'kind':'word'})
groups=[(p.name,sorted(p.glob('page-*.png'))) for p in sorted(out.iterdir()) if p.is_dir()]
groups += [(p.name,sorted(p.glob('page-*.png'),key=lambda x:int(x.stem.split('-')[-1]))) for p in word_folders]
for ident,pages in groups:
    for first in range(0,len(pages),12):
        selected=pages[first:first+12]; canvas=Image.new('RGB',(1440,math.ceil(len(selected)/3)*285),'#d9d9d9'); draw=ImageDraw.Draw(canvas)
        for offset,p in enumerate(selected):
            image=Image.open(p).convert('RGB'); image.thumbnail((470,255)); x=(offset%3)*480; y=(offset//3)*285
            canvas.paste(image,(x+(470-image.width)//2,y+22)); draw.text((x+8,y+5),f'{ident} / {p.stem}',fill='black')
        canvas.save(out/f'{ident}-contact-{first//12+1:02}.png')
(out/'render-manifest.json').write_text(json.dumps(reviews,ensure_ascii=False,indent=2),encoding='utf-8'); print(json.dumps({'documents':len(reviews),'pages':sum(r['pages'] for r in reviews),'contactSheets':len(list(out.glob('*contact*.png'))),'blankTextPages':sum(len(r.get('blankTextPages',[])) for r in reviews)}))

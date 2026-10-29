import JSZip from 'jszip';

// MOMAH's Arabic template has a mirrored body layout. Chinese shares the
// English template. Assets retain the supplied masters and artwork, with a PNG
// fallback added to their SVG logos for older PowerPoint versions.
const TEMPLATE_URLS = {
  en: new URL('../assets/reports/momah-template-en.pptx', import.meta.url).href,
  ar: new URL('../assets/reports/momah-template-ar.pptx', import.meta.url).href
};
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const generatedPart = (name) => /^ppt\/(slides|charts|embeddings)\//.test(name);
const nodes = (xml, ns, name) => Array.from(xml.getElementsByTagNameNS(ns, name));
const first = (xml, ns, name) => nodes(xml, ns, name)[0];
const parse = (text) => {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw new Error('Invalid PowerPoint template XML');
  return xml;
};
const serialize = (xml) => new globalThis.XMLSerializer().serializeToString(xml);
const readXml = async (zip, name) => {
  const file = zip.file(name);
  if (!file) throw new Error(`Missing PowerPoint template part: ${name}`);
  return parse(await file.async('string'));
};
const templateBytes = new Map();
async function loadTemplate(lang) {
  const key = lang === 'ar' ? 'ar' : 'en';
  if (!templateBytes.has(key)) templateBytes.set(key, fetch(TEMPLATE_URLS[key]).then((response) => {
    if (!response.ok) throw new Error(`PowerPoint template could not be loaded (${response.status})`);
    return response.arrayBuffer();
  }).catch((error) => { templateBytes.delete(key); throw error; }));
  return JSZip.loadAsync(await templateBytes.get(key));
}

function setText(shape, text, rtl, lang) {
  const paragraph = first(shape, A, 'p');
  const run = first(paragraph, A, 'r').cloneNode(true);
  first(run, A, 't').textContent = String(text || '');
  let props = first(paragraph, A, 'pPr');
  if (!props) { props = shape.ownerDocument.createElementNS(A, 'a:pPr'); paragraph.prepend(props); }
  props.setAttribute('rtl', rtl ? '1' : '0');
  props.setAttribute('algn', rtl ? 'r' : 'l');
  first(run, A, 'rPr').setAttribute('lang', { ar: 'ar-SA', zh: 'zh-CN' }[lang] || 'en-US');
  if (lang === 'ar') {
    // Use a full Arabic-capable face for dynamic text; the template's Sakkal
    // title font can render missing glyphs when it is unavailable on the reader's PC.
    for (const script of ['latin', 'ea', 'cs', 'sym']) {
      const font = shape.ownerDocument.createElementNS(A, `a:${script}`);
      font.setAttribute('typeface', 'Arial');
      first(run, A, 'rPr').appendChild(font);
    }
  }
  if (lang === 'zh') {
    const font = shape.ownerDocument.createElementNS(A, 'a:ea');
    font.setAttribute('typeface', 'Microsoft YaHei');
    first(run, A, 'rPr').appendChild(font);
  }
  for (const child of Array.from(paragraph.children)) if (child !== props) child.remove();
  paragraph.appendChild(run);
  for (const extra of nodes(shape, A, 'p').slice(1)) extra.remove();
  const body = first(shape, A, 'bodyPr');
  for (const child of Array.from(body.children)) child.remove();
  body.appendChild(shape.ownerDocument.createElementNS(A, 'a:normAutofit'));
}

function addPlaceholder(slide, sourceShape, text, model) {
  const shape = slide.importNode(sourceShape, true);
  setText(shape, text, model.lang === 'ar', model.lang);
  const id = Math.max(0, ...nodes(slide, P, 'cNvPr').map((node) => Number(node.getAttribute('id')))) + 1;
  first(shape, P, 'cNvPr').setAttribute('id', String(id));
  first(slide, P, 'spTree').appendChild(shape);
  return shape;
}

export async function applyReportTemplate(contentBytes, model, slideTitles) {
  const [template, content] = await Promise.all([loadTemplate(model.lang), JSZip.loadAsync(contentBytes)]);
  const coverLayout = await readXml(template, 'ppt/slideLayouts/slideLayout1.xml');
  const bodyLayout = await readXml(template, 'ppt/slideLayouts/slideLayout30.xml');
  const closingLayout = await readXml(template, 'ppt/slideLayouts/slideLayout27.xml');
  const month = new Intl.DateTimeFormat({ ar: 'ar-SA', zh: 'zh-CN' }[model.lang] || 'en-GB', {
    month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh', calendar: 'gregory'
  }).format(new Date(model.generatedAt)).toLocaleUpperCase();
  // Sample report content and speaker notes must never leak into a new report.
  for (const name of Object.keys(template.files)) if (/^ppt\/(slides|notesSlides)\//.test(name)) template.remove(name);
  for (const [name, file] of Object.entries(content.files)) {
    if (!file.dir && generatedPart(name)) template.file(name, await file.async('uint8array'));
  }

  for (let i = 0; i < slideTitles.length; i += 1) {
    const number = i + 1;
    const slidePath = `ppt/slides/slide${number}.xml`;
    const relPath = `ppt/slides/_rels/slide${number}.xml.rels`;
    const rels = await readXml(template, relPath);
    for (const rel of Array.from(rels.documentElement.children)) {
      if (rel.getAttribute('Type').endsWith('/notesSlide')) rel.remove();
      else if (rel.getAttribute('Type').endsWith('/slideLayout')) {
        const layout = i === 0 ? 1 : i === slideTitles.length - 1 ? 26 : i === slideTitles.length - 2 ? 27 : 30;
        rel.setAttribute('Target', `../slideLayouts/slideLayout${layout}.xml`);
      }
    }
    template.file(relPath, serialize(rels));
    const slide = await readXml(template, slidePath);
    first(slide, P, 'bg')?.remove();
    if (i === 0) {
      for (const shape of nodes(coverLayout, P, 'sp')) {
        const ph = first(shape, P, 'ph');
        if (!ph) continue;
        const type = ph.getAttribute('type');
        if (type === 'ctrTitle') addPlaceholder(slide, shape, model.title, model);
        else if (ph.getAttribute('idx') === '10') addPlaceholder(slide, shape, model.subtitle, model);
        else if (ph.getAttribute('idx') === '11') addPlaceholder(slide, shape, month, model);
      }
    } else if (i === slideTitles.length - 2 && model.lang === 'ar') {
      const title = nodes(closingLayout, P, 'sp').find((shape) => first(shape, P, 'ph')?.getAttribute('type') === 'ctrTitle');
      addPlaceholder(slide, title, 'شكرا لك', model);
    } else if (i < slideTitles.length - 2) {
      const source = nodes(bodyLayout, P, 'sp').find((shape) => first(shape, P, 'ph')?.getAttribute('type') === 'title');
      const title = addPlaceholder(slide, source, slideTitles[i], model);
      // Keep title text below the logo and inside the mirrored body side rule.
      const extent = first(title, A, 'ext');
      extent.setAttribute('cy', '548640');
    }
    template.file(slidePath, serialize(slide));
  }

  const presentation = await readXml(template, 'ppt/presentation.xml');
  const rels = await readXml(template, 'ppt/_rels/presentation.xml.rels');
  const generatedPresentation = await readXml(content, 'ppt/presentation.xml');
  const generatedRels = await readXml(content, 'ppt/_rels/presentation.xml.rels');
  const slideIds = first(generatedPresentation, P, 'sldIdLst');
  for (const id of Array.from(slideIds.children)) id.setAttributeNS(R, 'r:id', `report-${id.getAttributeNS(R, 'id')}`);
  first(presentation, P, 'sldIdLst').replaceWith(presentation.importNode(slideIds, true));
  for (const rel of Array.from(rels.documentElement.children)) if (rel.getAttribute('Type').endsWith('/slide')) rel.remove();
  for (const rel of Array.from(generatedRels.documentElement.children)) {
    if (!rel.getAttribute('Type').endsWith('/slide')) continue;
    const copy = rels.importNode(rel, true);
    copy.setAttribute('Id', `report-${rel.getAttribute('Id')}`);
    rels.documentElement.appendChild(copy);
  }
  template.file('ppt/presentation.xml', serialize(presentation));
  template.file('ppt/_rels/presentation.xml.rels', serialize(rels));

  const types = await readXml(template, '[Content_Types].xml');
  const generatedTypes = await readXml(content, '[Content_Types].xml');
  for (const type of Array.from(types.documentElement.children)) {
    if (/^\/ppt\/(slides|notesSlides)\//.test(type.getAttribute('PartName') || '')) type.remove();
  }
  const extensions = new Set(Array.from(types.documentElement.children).map((type) => type.getAttribute('Extension')).filter(Boolean));
  for (const type of Array.from(generatedTypes.documentElement.children)) {
    const part = (type.getAttribute('PartName') || '').slice(1);
    const ext = type.getAttribute('Extension');
    if (generatedPart(part) || (ext && !extensions.has(ext))) {
      types.documentElement.appendChild(types.importNode(type, true));
      if (ext) extensions.add(ext);
    }
  }
  template.file('[Content_Types].xml', serialize(types));
  return template.generateAsync({ type: 'blob', mimeType: MIME, compression: 'DEFLATE' });
}

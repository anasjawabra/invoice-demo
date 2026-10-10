import { useCallback, useEffect, useState } from 'react';
import { sha256Hex } from '../../data/pdfText';
import { extractDocument, detectFormat, MAX_DOC_BYTES } from '../../data/docText';
import { putFile, getFile } from '../../data/enforcementStore';
import { loadPreparedSamples, sampleByHash, simulateOcr, manualExtraction, SIM_LABEL } from '../../data/ocrSimulation';

// The order's work in three steps — add documents · analyse them · review and confirm — kept out of the page so every step is one plain action:
//  * a document is stored when it is ADDED (kind: uploaded | prepared_sample); nothing is read until ANALYSIS;
//  * analysis reads every added document by what it really is: real text extraction (digital PDF, Word), the OCR SIMULATION for a prepared sample (identified by the reviewer's choice or by the
//    file's SHA-256 — never by the file name), or «not read» (scans/images/legacy .doc that are not prepared samples). Nothing is ever attributed to a file it did not come from.
export function useOrderWork({ order, rev, onMessage, L, B }) {
  const [samples, setSamples] = useState([]);
  const [progress, setProgress] = useState(null); // { name, page, of, simulated }
  const [busy, setBusy] = useState(false);
  useEffect(() => { let off = false; loadPreparedSamples().then((s) => { if (!off) setSamples(s); }); return () => { off = true; }; }, []);
  const say = useCallback((ok, text) => onMessage?.({ ok, text }), [onMessage]);
  const docs = order.docs || [];

  const storeAndRecord = useCallback(async (bytes, name, type, extra) => {
    const id = await sha256Hex(bytes);
    if (docs.some((x) => x.id === id)) { say(false, L('This exact file is already attached to the order.', 'هذا الملف نفسه مرفق بالأمر بالفعل.')); return null; }
    const format = await detectFormat(bytes); const hit = sampleByHash(samples, id);
    const stored = await putFile(id, { name, size: bytes.length, type: type || 'application/octet-stream', bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), at: Date.now() });
    const rec = { id, name, size: bytes.length, kind: hit ? 'prepared_sample' : 'uploaded', sampleId: hit?.id || null, format, addedAt: new Date().toISOString(), fileStored: stored, extraction: null, ...extra };
    const r = rev.enforcement.recordDocument(order.enforceNum, rec);
    if (!r.ok) { say(false, L('Could not record the document.', 'تعذّر تسجيل المستند.')); return null; }
    return rec;
  }, [docs, samples, rev, order.enforceNum, say, L]);

  const addFile = useCallback(async (file) => {
    if (!file) return null;
    if (file.size > MAX_DOC_BYTES) { say(false, L('The file is larger than 15 MB.', 'الملف أكبر من 15 ميغابايت.')); return null; }
    setBusy(true);
    try {
      const rec = await storeAndRecord(new Uint8Array(await file.arrayBuffer()), file.name, file.type);
      if (rec) say(true, rec.kind === 'prepared_sample' ? L('Added: this file is one of the prepared demo samples (identified by its content, not its name).', 'أُضيف: هذا الملف أحد عينات العرض المعدّة (تم التعرف عليه من محتواه لا من اسمه).') : L('Added. Press «Analyse and link invoices» to read it.', 'أُضيف. اضغط «تحليل وربط الفواتير» لقراءته.'));
      return rec;
    } catch (e) { say(false, L(`Could not add the document (${e?.message || 'unknown error'}).`, `تعذّرت إضافة المستند (${e?.message || 'خطأ غير معروف'}).`)); return null; } finally { setBusy(false); }
  }, [storeAndRecord, say, L]);

  const addSample = useCallback(async (sample) => {
    setBusy(true);
    try {
      const res = await fetch(`/samples/prepared/${sample.file}`); if (!res.ok) throw new Error('sample_not_found');
      const bytes = new Uint8Array(await res.arrayBuffer());
      if ((await sha256Hex(bytes.slice())) !== sample.sha256) { say(false, L('The prepared sample file does not match its catalogue entry; it was not added.', 'ملف العينة المعدّة لا يطابق سجلها في القائمة؛ لم يُضَف.')); return null; }
      const rec = await storeAndRecord(bytes, sample.file, 'application/pdf');
      if (rec) say(true, L('Prepared sample added. Press «Analyse and link invoices» to run the OCR simulation.', 'أُضيفت العينة المعدّة. اضغط «تحليل وربط الفواتير» لتشغيل محاكاة OCR.'));
      return rec;
    } catch (e) { say(false, L(`Could not add the sample (${e?.message || 'unknown error'}).`, `تعذّرت إضافة العينة (${e?.message || 'خطأ غير معروف'}).`)); return null; } finally { setBusy(false); }
  }, [storeAndRecord, say, L]);

  const addManual = useCallback((text) => {
    const ex = manualExtraction(text, { orderNo: order.enforceNum });
    if (!ex.refs.length) { say(false, L('No invoice number was recognised in the text. Use a full number such as INV-2025-0000123, or a serial of 4–7 digits.', 'لم يُتعرَّف على رقم فاتورة في النص. استخدم رقماً كاملاً مثل INV-2025-0000123 أو تسلسلاً من 4–7 أرقام.')); return false; }
    const r = rev.enforcement.addManual(order.enforceNum, ex);
    say(r.ok, r.ok ? L(`${ex.refs.length} reference(s) recorded as typed by a person.`, `سُجّل ${ex.refs.length} مرجع على أنه أدخله شخص.`) : L('Could not record the references.', 'تعذّر تسجيل المراجع.'));
    return r.ok;
  }, [order.enforceNum, rev, say, L]);

  // step 2: read every document that has not been read yet; returns what happened (for the one-line summary)
  const analyze = useCallback(async () => {
    setBusy(true); const out = { read: 0, simulated: 0, unreadPages: 0, missing: 0 };
    try {
      for (const d of docs.filter((x) => !x.extraction && x.kind !== 'manual')) {
        const rec = await getFile(d.id); if (!rec) { out.missing += 1; continue; }
        const bytes = new Uint8Array(rec.bytes.slice(0)); const sample = d.sampleId ? samples.find((s) => s.id === d.sampleId) : sampleByHash(samples, d.id);
        let extraction;
        if (sample) { extraction = await simulateOcr(sample, { orderNo: order.enforceNum, onPage: (page, of) => setProgress({ name: d.name, page, of, simulated: true }) }); out.simulated += 1; }
        else { setProgress({ name: d.name, page: 1, of: 1, simulated: false }); extraction = await extractDocument(bytes, { orderNo: order.enforceNum }); out.read += 1; }
        out.unreadPages += extraction.pages.filter((p) => p.needsOcr).length;
        rev.enforcement.recordDocument(order.enforceNum, { ...d, extraction, analysedAt: new Date().toISOString() });
      }
      return out;
    } catch (e) { say(false, L(`The analysis stopped (${e?.message || 'unknown error'}). Try again.`, `توقف التحليل (${e?.message || 'خطأ غير معروف'}). حاول مجدداً.`)); return null; } finally { setBusy(false); setProgress(null); }
  }, [docs, samples, rev, order.enforceNum, say, L]);

  return { samples, progress, busy, addFile, addSample, addManual, analyze, SIM_LABEL, B };
}

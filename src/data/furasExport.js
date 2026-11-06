// CSV rows of the investment-contracts list and of one contract's installments, built from the SAME payload the pages render — so an export can never disagree with the screen.
// Pure functions (no DOM): the pages add the download. Nothing is derived here: an unavailable value is an empty cell, never a zero; the investor is the masked reference only.
import { stored } from './furasLabels.js';

const cell = (v) => (v == null ? '' : String(v));
export const csvText = (rows) => '﻿' + rows.map((r) => r.map((v) => { const t = cell(v); return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(',')).join('\r\n') + '\r\n';

const HEAD_LIST = { en: ['Contract number', 'Opportunity name', 'Investor (masked)', 'Execution status', 'Start date', 'End date', 'Contract value (total, VAT basis not stated)', 'Annual value', 'Total value incl. VAT', 'Amanah (source)', 'Service type', 'Opportunities', 'Records'],
  ar: ['رقم العقد', 'اسم الفرصة', 'المستثمر (مقنّع)', 'حالة التنفيذ', 'تاريخ البداية', 'تاريخ النهاية', 'قيمة العقد (الإجمالية، أساس الضريبة غير محدد)', 'القيمة السنوية', 'القيمة الإجمالية شاملة الضريبة', 'الأمانة (المصدر)', 'نوع الخدمة', 'الفرص', 'السجلات'] };
const one = (x) => (x.state === 'single' ? x.value : '');
export function contractsCsvRows(rows, ar = false) {
  const text = (kind, v) => stored(kind, v, ar).text;
  return [HEAD_LIST[ar ? 'ar' : 'en'], ...rows.map((r) => [
    r.no, r.name.state === 'single' ? r.name.value : '', r.investors.map((i) => i.masked).join(' | '), r.executionStatuses.map((s) => text('rental', s.value)).join(' | '),
    one(r.start), one(r.end), r.contractValue.state === 'single' ? r.contractValue.value : '', r.annualValue.state === 'single' ? r.annualValue.value : '', one(r.valueWithVat),
    r.municipalities.map((m) => m.sourceName).join(' | '), r.types.map((t) => text('type', t.value)).join(' | '), r.opportunities, r.records])];
}

const HEAD_INST = { en: ['Opportunity', 'Batch no.', 'Batch year', 'Months', 'Type', 'Due date', 'Period end', 'Invoice date', 'Payment date', 'Payable (PAYMENTAMOUNT)', 'VAT (VATAMOUNT, not added)', 'Paid (BATCHAMOUNTPAID)', 'Outstanding (BATCHAMOUNTBALANCE)', 'Status (as stored)'],
  ar: ['الفرصة', 'رقم الدفعة', 'سنة الدفعة', 'الأشهر', 'النوع', 'تاريخ الاستحقاق', 'نهاية الفترة', 'تاريخ الفاتورة', 'تاريخ السداد', 'المستحق (PAYMENTAMOUNT)', 'الضريبة (VATAMOUNT، غير مضافة)', 'المسدد (BATCHAMOUNTPAID)', 'المتبقي (BATCHAMOUNTBALANCE)', 'الحالة (كما هي)'] };
export function installmentsCsvRows(payments, ar = false) {
  return [HEAD_INST[ar ? 'ar' : 'en'], ...payments.map((p) => [p.opportunityNumber, p.batchNumber, p.batchYear, p.batchMonths, p.paymentType, p.dueDate, p.batchEndDate, p.invoiceDate, p.paymentDate, p.payable, p.vatAmount, p.paid, p.outstanding, stored('payStatus', p.status, ar).text])];
}

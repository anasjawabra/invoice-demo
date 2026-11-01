import assert from 'node:assert/strict';
import catalog from '../src/data/zh-CN.json';
import {zhText,localize,localizedObject} from '../src/utils/zh.js';
import {fmtMoney,fmtParts,unitLabel,UNITS} from '../src/utils/money.js';
import {fmtDateText,fmtRangeText,fmtMonthText} from '../src/data/clock.js';
import {noteText,kindLabel} from '../src/data/chatFiles.js';
assert.ok(Object.keys(catalog).length>5000);
for(const [source,target] of Object.entries(catalog)){
 assert.equal(typeof target,'string');assert.ok(target.trim(),`Empty translation: ${source}`);
 assert.deepEqual((source.match(/\{\w+\}/g)||[]).sort(),(target.match(/\{\w+\}/g)||[]).sort(),`Placeholder mismatch: ${source}`);
 assert.ok(!/(.)\1{12}/.test(target),`Repeated output: ${source}`);
 if(source.includes('|')) assert.equal(target.split('|').length, source.split('|').length, `Table header structure: ${source}`);
}
assert.equal(zhText('Gross billed'),'开票总额');assert.equal(zhText('exclusions'),'排除项');
assert.equal(zhText('million SAR'),'百万沙特里亚尔');
assert.equal(zhText('Per-invoice columns (columnar store)'),'发票字段（列式存储）');
assert.equal(zhText('Endpoints'),'接口端点');
assert.equal(zhText('Returns'),'返回内容');
assert.equal(zhText('Executed against in Sanad'),'已在 Sanad 发起执行');
assert.equal(zhText('Could not export XLSX. Try again; if the problem persists, refresh this page.'),'无法导出 XLSX 文件。请重试；若问题持续，请刷新页面。');
for(const token of ['makeCtx(st, req)','derive(ctx, i, asOf)']) assert.ok(catalog['The service builds a context makeCtx(st, req) holding the enabled rules and the decisions / links / files overlays, then runs derive(ctx, i, asOf) over each invoice without allocating.'].includes(token));
assert.equal(zhText('409 invoices issued in this period. '),'本期共开具 409 张发票。');
assert.equal(zhText('Invoices issued 1 Jan – 28 Oct 2026 · All Amanahs'),'开票期间 1月1日 – 2026年10月28日 · 全部市政主管机构');
assert.equal(localize('Gross billed','en'),'Gross billed');assert.equal(localize('Gross billed','ar'),'Gross billed');
assert.equal(localizedObject({en:'Gross billed',ar:'إجمالي المفوتر'},'ar'),'إجمالي المفوتر');
assert.equal(localizedObject({en:'Gross billed',zh:'开票金额'},'zh'),'开票金额');
assert.equal(localize('INV-2026-0731','zh'),'INV-2026-0731');assert.equal(zhText('R1 / API / GFS'),'R1 / API / GFS');
assert.deepEqual(localize(['Gross billed','Collected'],'zh'),['开票总额','已收款']);
const longUnknown='Unmapped source description '.repeat(35);
const began=performance.now();for(let i=0;i<1000;i++)zhText(longUnknown+i);
assert.ok(performance.now()-began<2000,'Unrelated dynamic text must not cause template backtracking');
for(const amount of [0,975,1250,726700000,15580000000]){
 const en=fmtParts(amount,{lang:'en'}),zh=fmtParts(amount,{lang:'zh'});assert.equal(en.num,zh.num);assert.equal(en.unit.div,zh.unit.div);
}
assert.equal(unitLabel(UNITS.B,'zh'),'十亿 沙特里亚尔');assert.equal(fmtMoney(1e9,{lang:'en'}),'1 bn SAR');
assert.equal(fmtDateText('2026-10-28','zh'),'2026年10月28日');assert.equal(fmtDateText('2026-10-28','en'),'28 Oct 2026');
assert.equal(fmtRangeText('2026-01-01','2026-10-28','zh'),'2026年1月1日 – 10月28日');assert.equal(fmtMonthText('2026-10','zh'),'2026年10月');
assert.equal(noteText({en:'The file could not be read.',ar:'تعذّرت قراءة الملف.'},'zh'),'无法读取文件。');
console.log(`Chinese localization: ${Object.keys(catalog).length} catalog entries; placeholders, language isolation, dynamic values, identifiers, monetary units and dates passed`);

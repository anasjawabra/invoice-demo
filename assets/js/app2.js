/* ==========================================================================
   智能账单管理平台 · 视图模块 2（流水线 / 账单库 / 审批 / 风险 / 催收 / 问答 / Agent）
   ========================================================================== */
(function () {
  'use strict';
  var IB = window.__IB, D = IB.D, VIEW = IB.VIEW;
  var svg = IB.svg, COLORS = IB.COLORS, rgba = IB.rgba, toast = IB.toast;
  var statusBadge = IB.statusBadge, money = IB.money;
  var t = IB.t, T = IB.T;
  function lang() { return IB.getLang(); }

  /* ======================================================================
     视图 2：账单处理流水线（核心演示）
     ====================================================================== */
  function viewProcess() {
    VIEW.innerHTML =
      '<div class="grid g-2" style="align-items:start">' +
        '<div>' +
          '<div class="card panel" id="upCard">' +
            '<h3>' + t('proc_title') + '</h3>' +
            '<div class="p-sub">' + t('proc_sub') + '</div>' +
            '<div class="uploader" id="uploader">' +
              '<div class="up-ico">' + svg('upload') + '</div>' +
              '<h3>' + t('proc_up_h3') + '</h3>' +
              '<p>' + t('proc_up_p') + '</p>' +
              '<input type="file" id="fileInput" hidden>' +
            '</div>' +
            '<div class="p-sub" style="margin:16px 0 8px">' + t('proc_sample') + '</div>' +
            '<div class="sample-row">' +
              '<button class="sample-chip" data-tag="normal">' + t('sample_normal') + '</button>' +
              '<button class="sample-chip fraud" data-tag="fraud">' + t('sample_fraud') + '</button>' +
              '<button class="sample-chip dup" data-tag="dup">' + t('sample_dup') + '</button>' +
              '<button class="sample-chip" data-tag="taxfail" style="border-color:rgba(255,159,67,.35);color:#ffc27a">' + t('sample_taxfail') + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="card panel" id="resultCard" style="margin-top:18px;display:none"></div>' +
        '</div>' +
        '<div class="card panel">' +
          '<div class="section-head"><div><h3>' + t('pipe_title') + '</h3><div class="p-sub">A1 → A2 → A3 → (HITL) → A4 → A5 → A6</div></div>' +
            '<div class="pill-live"><span class="dot-live"></span> ' + t('pipe_ready') + '</div></div>' +
          '<div class="pipe" id="pipe">' + pipeHtml() + '</div>' +
        '</div>' +
      '</div>';

    var up = document.getElementById('uploader');
    up.addEventListener('click', function () { document.getElementById('fileInput').click(); });
    document.getElementById('fileInput').addEventListener('change', function () { runPipeline('normal'); });
    document.querySelectorAll('.sample-chip').forEach(function (c) {
      c.addEventListener('click', function () { runPipeline(c.getAttribute('data-tag')); });
    });
  }

  function pipeHtml() {
    return D.PIPELINE.map(function (p) {
      return '<div class="pipe-step" data-agent="' + p.agent + '">' +
        '<div class="pipe-node">' + p.agent + '</div>' +
        '<div class="pipe-body"><div class="p-head"><span class="p-name">' + T(p, 'name') + '</span>' +
        '<span class="badge b-teal" style="display:none" data-role="s">' + t('pipe_running') + '</span></div>' +
        '<div class="p-hint">' + T(p, 'hint') + '</div>' +
        '<div class="pipe-out" data-role="out"></div></div></div>';
    }).join('');
  }

  /* 各场景元信息 */
  var SC_META = {
    normal:  { ring: 12, color: 'green',  stop: null, hitl: null },
    fraud:   { ring: 82, color: 'red',    stop: 3,    hitl: 'sc_fraud_hitl' },
    dup:     { ring: 0,  color: 'gold',   stop: 1,    hitl: 'sc_dup_hitl' },
    taxfail: { ring: 46, color: 'orange', stop: 2,    hitl: 'sc_taxfail_hitl' }
  };

  /* 各场景每个阶段的输出文案（三语） */
  var SC_OUT = {
    zh: {
      normal: {
        A1: { txt: 'OCR 提取完成，字段映射成功率 100%', kv: { '账单号': 'INV-2026-0731', '金额': '1,250,000 SAR', 'PO': 'PO-88231', 'OCR置信度': '97%', '重复检测': '否' } },
        A2: { txt: '三单匹配一致（账单-PO-实收），ZATCA 税号有效，Makin/Tahseel 对账无差异', kv: { '匹配结果': '完全匹配', 'ZATCA': '通过', '匹配置信度': '96%' } },
        A3: { txt: '价格与供应商历史及行业基准一致，无离群', kv: { '风险评分': '12 / 100', '欺诈警告': '无', '异常类别': '无' } },
        A4: { txt: '金额 100~300 万 SAR，按授权矩阵分发二级审批链', kv: { '审批链': '账单专员→财务经理', 'SLA': '8 小时', '越权检查': '通过' } },
        A5: { txt: '账期内账单，暂不进入催收', kv: { '状态': '未到期' } },
        A6: { txt: '已汇总至 KPI 看板并写入审计留痕', kv: { '归档': '完成', '审计留痕': '已写入' } }
      },
      fraud: {
        A1: { txt: 'OCR 提取完成，字段映射成功', kv: { '账单号': 'INV-2026-0730', '金额': '486,000 SAR', 'PO': 'PO-88192', 'OCR置信度': '95%', '重复检测': '否' } },
        A2: { txt: '三单匹配基本一致，税号有效', kv: { '匹配结果': '基本匹配', 'ZATCA': '通过', '匹配置信度': '78%' } },
        A3: { txt: '价格偏离行业基准 +38%，供应商首次交易，金额整数异常 —— 高危欺诈警告', kv: { '风险评分': '82 / 100', '欺诈警告': '是', '置信度': '71%', '依据': '偏离基准+38%' }, level: 'danger' }
      },
      dup: {
        A1: { txt: '去重检测命中：与 INV-2026-0731 四元组完全一致，判定为重复账单，自动拦截', kv: { '账单号': 'INV-2026-0728', '金额': '1,250,000 SAR', '重复检测': '命中(重复)', '原始账单': 'INV-2026-0731' }, level: 'warn' }
      },
      taxfail: {
        A1: { txt: 'OCR 提取完成，字段映射成功', kv: { '账单号': 'INV-2026-0727', '金额': '3,180,000 SAR', 'PO': 'PO-87990', 'OCR置信度': '96%' } },
        A2: { txt: '账单明细与 PO 数量存在部分差异，VAT 计算需复核，匹配置信度 68% < 75%', kv: { '匹配结果': '部分匹配', 'ZATCA': '待复核', '匹配置信度': '68%', '差异项': '数量/单价' }, level: 'warn' }
      }
    },
    en: {
      normal: {
        A1: { txt: 'OCR extraction complete, 100% field mapping success', kv: { 'Invoice': 'INV-2026-0731', 'Amount': '1,250,000 SAR', 'PO': 'PO-88231', 'OCR Conf.': '97%', 'Duplicate': 'No' } },
        A2: { txt: '3-way match consistent (Invoice-PO-Receipt), ZATCA VAT valid, no Makin/Tahseel discrepancy', kv: { 'Match': 'Full Match', 'ZATCA': 'Pass', 'Confidence': '96%' } },
        A3: { txt: 'Price consistent with vendor history and industry benchmark, no outliers', kv: { 'Risk Score': '12 / 100', 'Fraud': 'None', 'Anomaly': 'None' } },
        A4: { txt: 'Amount 1-3M SAR, dispatched to 2-level approval chain per authorization matrix', kv: { 'Chain': 'Clerk → Manager', 'SLA': '8 hours', 'Authority': 'Pass' } },
        A5: { txt: 'Within payment term, no collection needed yet', kv: { 'Status': 'Not Due' } },
        A6: { txt: 'Aggregated to KPI dashboard and written to audit trail', kv: { 'Archive': 'Done', 'Audit Trail': 'Written' } }
      },
      fraud: {
        A1: { txt: 'OCR extraction complete, field mapping successful', kv: { 'Invoice': 'INV-2026-0730', 'Amount': '486,000 SAR', 'PO': 'PO-88192', 'OCR Conf.': '95%', 'Duplicate': 'No' } },
        A2: { txt: '3-way match largely consistent, VAT valid', kv: { 'Match': 'Basic Match', 'ZATCA': 'Pass', 'Confidence': '78%' } },
        A3: { txt: 'Price deviates +38% from benchmark, first-time vendor, round-amount anomaly — high-risk fraud warning', kv: { 'Risk Score': '82 / 100', 'Fraud': 'Yes', 'Confidence': '71%', 'Basis': '+38% deviation' }, level: 'danger' }
      },
      dup: {
        A1: { txt: 'Dedup hit: identical 4-tuple to INV-2026-0731, flagged as duplicate, auto-blocked', kv: { 'Invoice': 'INV-2026-0728', 'Amount': '1,250,000 SAR', 'Duplicate': 'Hit (Dup)', 'Original': 'INV-2026-0731' }, level: 'warn' }
      },
      taxfail: {
        A1: { txt: 'OCR extraction complete, field mapping successful', kv: { 'Invoice': 'INV-2026-0727', 'Amount': '3,180,000 SAR', 'PO': 'PO-87990', 'OCR Conf.': '96%' } },
        A2: { txt: 'Invoice items partially differ from PO quantities, VAT calc needs review, match confidence 68% < 75%', kv: { 'Match': 'Partial Match', 'ZATCA': 'Review', 'Confidence': '68%', 'Discrepancy': 'Qty/Price' }, level: 'warn' }
      }
    },
    ar: {
      normal: {
        A1: { txt: 'اكتمل استخراج OCR، نجاح تعيين الحقول 100٪', kv: { 'الفاتورة': 'INV-2026-0731', 'المبلغ': '1,250,000 SAR', 'PO': 'PO-88231', 'ثقة OCR': '97%', 'تكرار': 'لا' } },
        A2: { txt: 'مطابقة ثلاثية متسقة (فاتورة-PO-إيصال)، رقم ZATCA الضريبي صالح، لا فرق بين Makin/Tahseel', kv: { 'المطابقة': 'تطابق كامل', 'ZATCA': 'ناجح', 'الثقة': '96%' } },
        A3: { txt: 'السعر متسق مع تاريخ المورد ومعيار القطاع، لا قيم شاذة', kv: { 'درجة المخاطرة': '12 / 100', 'احتيال': 'لا يوجد', 'شذوذ': 'لا يوجد' } },
        A4: { txt: 'المبلغ 1-3 مليون ر.س، تم التوزيع إلى سلسلة موافقة من مستويين وفق مصفوفة التفويض', kv: { 'السلسلة': 'موظف ← مدير', 'SLA': '8 ساعات', 'الصلاحية': 'ناجح' } },
        A5: { txt: 'ضمن مدة السداد، لا حاجة للتحصيل بعد', kv: { 'الحالة': 'لم يستحق' } },
        A6: { txt: 'تم التجميع في لوحة المؤشرات وكتابة سجل التدقيق', kv: { 'الأرشفة': 'مكتمل', 'سجل التدقيق': 'تمت الكتابة' } }
      },
      fraud: {
        A1: { txt: 'اكتمل استخراج OCR، نجح تعيين الحقول', kv: { 'الفاتورة': 'INV-2026-0730', 'المبلغ': '486,000 SAR', 'PO': 'PO-88192', 'ثقة OCR': '95%', 'تكرار': 'لا' } },
        A2: { txt: 'مطابقة ثلاثية متسقة إلى حد كبير، الرقم الضريبي صالح', kv: { 'المطابقة': 'تطابق أساسي', 'ZATCA': 'ناجح', 'الثقة': '78%' } },
        A3: { txt: 'السعر ينحرف +38٪ عن المعيار، مورد لأول مرة، مبلغ دائري شاذ — تحذير احتيال عالي الخطورة', kv: { 'درجة المخاطرة': '82 / 100', 'احتيال': 'نعم', 'الثقة': '71%', 'الأساس': 'انحراف +38٪' }, level: 'danger' }
      },
      dup: {
        A1: { txt: 'تطابق كشف التكرار: رباعية مطابقة لـ INV-2026-0731، تم تصنيفها كمكررة، حظر تلقائي', kv: { 'الفاتورة': 'INV-2026-0728', 'المبلغ': '1,250,000 SAR', 'تكرار': 'تطابق (مكرر)', 'الأصلية': 'INV-2026-0731' }, level: 'warn' }
      },
      taxfail: {
        A1: { txt: 'اكتمل استخراج OCR، نجح تعيين الحقول', kv: { 'الفاتورة': 'INV-2026-0727', 'المبلغ': '3,180,000 SAR', 'PO': 'PO-87990', 'ثقة OCR': '96%' } },
        A2: { txt: 'بنود الفاتورة تختلف جزئياً عن كميات PO، حساب VAT يحتاج مراجعة، ثقة المطابقة 68٪ < 75٪', kv: { 'المطابقة': 'تطابق جزئي', 'ZATCA': 'مراجعة', 'الثقة': '68%', 'الفرق': 'الكمية/السعر' }, level: 'warn' }
      }
    }
  };

  function scOut(tag) { return (SC_OUT[lang()] || SC_OUT.en)[tag]; }

  function runPipeline(tag) {
    var meta = SC_META[tag];
    var out = scOut(tag);
    var steps = Array.prototype.slice.call(document.querySelectorAll('#pipe .pipe-step'));
    var resCard = document.getElementById('resultCard');
    resCard.style.display = 'none';
    steps.forEach(function (s) {
      s.classList.remove('active', 'done', 'warn', 'danger');
      s.querySelector('[data-role=out]').innerHTML = '';
      s.querySelector('[data-role=s]').style.display = 'none';
    });
    toast(t('proc_toast_start'), 'ok');

    var lastStep = meta.stop != null ? meta.stop : steps.length;
    var i = 0;
    function tick() {
      if (i > 0) {
        var prev = steps[i - 1];
        prev.classList.remove('active');
        prev.classList.add('done');
        var pa = D.PIPELINE[i - 1].agent;
        var od0 = out[pa];
        if (od0 && od0.level) prev.classList.add(od0.level);
        prev.querySelector('[data-role=s]').style.display = 'none';
      }
      if (i >= lastStep) { finish(tag, meta, resCard); return; }
      var st = steps[i];
      st.classList.add('active');
      var badge = st.querySelector('[data-role=s]');
      badge.style.display = 'inline-flex';
      badge.innerHTML = '<span class="spinner" style="width:11px;height:11px;border-width:2px"></span> ' + t('pipe_running');
      var agent = D.PIPELINE[i].agent;
      var od = out[agent];
      var outEl = st.querySelector('[data-role=out]');
      if (od) {
        var kvHtml = od.kv ? '<div class="kv">' + Object.keys(od.kv).map(function (k) { return '<span>' + k + '：<b>' + od.kv[k] + '</b></span>'; }).join('') + '</div>' : '';
        outEl.innerHTML = od.txt + kvHtml;
      } else {
        outEl.innerHTML = '<span style="color:var(--txt-mute)">' + t('pipe_skip') + '</span>';
      }
      i++;
      setTimeout(tick, 1050);
    }
    tick();
  }

  function finish(tag, meta, resCard) {
    var circ = 2 * Math.PI * 40;
    var pct = meta.ring;
    var off = circ * (1 - pct / 100);
    var col = COLORS[meta.color];
    var title = t('sc_' + tag + '_title');
    var desc = t('sc_' + tag + '_desc');
    var hitl = meta.hitl ? '<div class="hitl-banner" style="margin-top:16px"><div class="h-ico">' + svg('warn') + '</div><div>' + t(meta.hitl) + '</div></div>' : '';
    resCard.style.display = 'block';
    resCard.innerHTML =
      '<div class="result-hero" style="padding:0">' +
        '<div class="result-ring"><svg width="92" height="92"><circle cx="46" cy="46" r="40" stroke="rgba(255,255,255,0.08)" stroke-width="8" fill="none"/>' +
          '<circle cx="46" cy="46" r="40" stroke="' + col + '" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="' + circ + '" stroke-dashoffset="' + off + '"/></svg>' +
          '<div class="r-num" style="color:' + col + '">' + pct + '</div></div>' +
        '<div><div class="r-title">' + title + '</div><div class="r-desc">' + desc + '</div></div>' +
      '</div>' + hitl +
      '<div style="display:flex;gap:10px;margin-top:16px">' +
        (meta.color === 'green' || meta.color === 'orange' ? '<button class="btn btn-green" id="goApv">' + svg('check') + ' ' + t('btn_go_apv') + '</button>' : '') +
        (meta.color === 'red' ? '<button class="btn btn-red" id="goRisk">' + svg('warn') + ' ' + t('btn_go_risk') + '</button>' : '') +
        '<a class="btn btn-ghost" href="#invoices">' + t('btn_go_inv') + '</a>' +
      '</div>';
    toast(t('proc_toast_done') + title, meta.color === 'green' ? 'ok' : (meta.color === 'red' ? 'err' : 'warn'));
    var a = document.getElementById('goApv'); if (a) a.onclick = function () { location.hash = 'approvals'; };
    var r = document.getElementById('goRisk'); if (r) r.onclick = function () { location.hash = 'risk'; };
  }

  /* ======================================================================
     视图 3：账单库
     ====================================================================== */
  function viewInvoices() {
    var srcColor = {}; D.SOURCES.forEach(function (s) { srcColor[s.name] = s.color; });
    var rows = D.INVOICES.map(function (v) {
      var riskCol = v.risk >= 70 ? 'red' : v.risk >= 40 ? 'orange' : 'green';
      return '<tr><td class="mono">' + v.id + '</td><td>' + T(v, 'entity') + '</td>' +
        '<td class="mono">' + money(v.amount) + ' ' + v.currency + '</td>' +
        '<td><span class="badge b-' + (srcColor[v.source] || 'grey') + '">' + v.source + '</span></td>' +
        '<td class="mono">' + v.po + '</td><td>' + v.date + '</td>' +
        '<td><span style="color:var(--' + riskCol + ')">' + v.risk + '</span></td>' +
        '<td>' + statusBadge(v.status) + '</td></tr>';
    }).join('');
    VIEW.innerHTML =
      '<div class="grid g-4" style="margin-bottom:18px">' +
        miniStat(t('inv_total'), D.INVOICES.length, t('unit_sheet'), 'teal') +
        miniStat(T(D.STATUS.pending, 'label'), D.INVOICES.filter(function (v) { return v.status === 'pending'; }).length, t('unit_sheet'), 'blue') +
        miniStat(T(D.STATUS.review, 'label'), D.INVOICES.filter(function (v) { return v.status === 'review' || v.status === 'anomaly'; }).length, t('unit_sheet'), 'orange') +
        miniStat(T(D.STATUS.approved, 'label'), D.INVOICES.filter(function (v) { return v.status === 'approved'; }).length, t('unit_sheet'), 'green') +
      '</div>' +
      '<div class="card panel">' +
        '<div class="section-head"><div><h3>' + t('invoices') + '</h3><div class="p-sub">' + t('recent_sub') + '</div></div>' +
          '<a class="btn btn-teal" href="#process">' + svg('upload') + ' ' + t('process') + '</a></div>' +
        '<table class="tbl"><thead><tr><th>' + t('th_id') + '</th><th>' + t('th_vendor') + '</th><th>' + t('th_amount') + '</th><th>' + t('th_source') + '</th><th>' + t('th_po') + '</th><th>' + t('th_date') + '</th><th>' + t('th_risk') + '</th><th>' + t('th_status') + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div>';
  }
  function miniStat(label, val, unit, color) {
    return '<div class="card kpi" style="padding:16px"><div class="k-val" style="font-size:24px;color:' + COLORS[color] + '">' + val + '<span class="u">' + (unit || '') + '</span></div><div class="k-lab">' + label + '</div></div>';
  }

  /* ======================================================================
     视图 4：审批中心 (HITL)
     ====================================================================== */
  function viewApprovals() { renderApprovals(); }
  function renderApprovals() {
    var list = D.APPROVALS.filter(function (a) { return !a._done; });
    var badgeEl = document.getElementById('apvBadge');
    if (badgeEl) { badgeEl.textContent = list.length; badgeEl.style.display = list.length ? 'inline-block' : 'none'; }
    var cards = list.length ? list.map(function (a) {
      var pcol = a.priorityKey === 'high' ? 'red' : a.priorityKey === 'mid' ? 'orange' : 'blue';
      var rcol = a.risk >= 70 ? 'red' : a.risk >= 40 ? 'orange' : 'green';
      return '<div class="card panel" data-id="' + a.id + '">' +
        '<div class="section-head"><div><h3>' + T(a, 'entity') + '</h3><div class="p-sub mono">' + a.id + '</div></div>' +
          '<span class="badge b-' + pcol + '">' + t('priority') + ' ' + T(a, 'priority') + '</span></div>' +
        '<div class="grid g-3" style="gap:12px;margin-bottom:14px">' +
          infoBox(t('th_amount'), money(a.amount) + ' ' + a.currency) +
          infoBox(t('info_match'), T(a, 'match')) +
          infoBox(t('info_risk'), '<span style="color:var(--' + rcol + ')">' + a.risk + ' / 100</span>') +
        '</div>' +
        '<div class="pipe-out" style="display:block;margin-bottom:14px">' +
          '<b style="color:var(--txt)">' + t('apv_chain') + '</b>' + T(a, 'chain') + '<div class="kv"><span>' + t('apv_assignee') + '<b>' + T(a, 'assignee') + '</b></span><span>' + t('apv_sla') + '<b>' + T(a, 'sla') + '</b></span><span>' + t('apv_reason') + '<b>' + T(a, 'reason') + '</b></span></div></div>' +
        '<div style="display:flex;gap:10px">' +
          '<button class="btn btn-green" data-act="approve" data-id="' + a.id + '">' + svg('check') + ' ' + t('btn_approve') + '</button>' +
          '<button class="btn btn-red" data-act="reject" data-id="' + a.id + '">' + svg('x') + ' ' + t('btn_reject') + '</button>' +
        '</div></div>';
    }).join('') : '<div class="card panel"><div class="empty">' + t('apv_empty') + '</div></div>';

    VIEW.innerHTML =
      '<div class="hitl-banner" style="margin-bottom:18px"><div class="h-ico">' + svg('check') + '</div>' +
        '<div><b>' + t('hitl_banner') + '</b>　—　' + t('hitl_desc') + '</div></div>' +
      '<div class="grid g-2 fade-list">' + cards + '</div>';

    VIEW.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
        var item = D.APPROVALS.find(function (x) { return x.id === id; });
        if (item) item._done = true;
        var inv = D.INVOICES.find(function (x) { return x.id === id; });
        if (inv) inv.status = act === 'approve' ? 'approved' : 'rejected';
        toast((act === 'approve' ? t('toast_approve') : t('toast_reject')) + id, act === 'approve' ? 'ok' : 'warn');
        renderApprovals();
      });
    });
  }
  function infoBox(label, val) {
    return '<div style="padding:12px 14px;border-radius:11px;background:rgba(255,255,255,0.03);border:1px solid var(--line)"><div style="font-size:11.5px;color:var(--txt-mute);margin-bottom:5px">' + label + '</div><div style="font-size:15px;font-weight:700" class="mono">' + val + '</div></div>';
  }

  /* ======================================================================
     视图 5：风险雷达
     ====================================================================== */
  function viewRisk() {
    var cards = D.RISKS.map(function (r) {
      var circ = 2 * Math.PI * 26, off = circ * (1 - r.score / 100), col = COLORS[r.color];
      var types = (T(r, 'types') || r.types).map(function (ty) { return '<span class="meta-pill" style="border-color:' + rgba(col, 0.3) + ';color:' + col + '">' + ty + '</span>'; }).join('');
      return '<div class="card panel">' +
        '<div style="display:flex;gap:16px;align-items:center;margin-bottom:12px">' +
          '<div class="result-ring" style="width:64px;height:64px"><svg width="64" height="64"><circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.08)" stroke-width="6" fill="none"/><circle cx="32" cy="32" r="26" stroke="' + col + '" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="' + circ + '" stroke-dashoffset="' + off + '"/></svg><div class="r-num" style="font-size:18px;color:' + col + '">' + r.score + '</div></div>' +
          '<div><div style="font-size:15.5px;font-weight:700">' + T(r, 'entity') + '</div><div class="p-sub mono">' + r.id + '</div>' +
          '<span class="badge b-' + r.color + '" style="margin-top:6px">' + T(r, 'level') + '</span></div></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px">' + types + '</div>' +
        '<div class="pipe-out" style="display:block"><b style="color:var(--txt)">' + t('risk_evidence') + '</b>' + T(r, 'evidence') + '</div>' +
        '<div style="margin-top:12px;font-size:13px;color:var(--txt-dim)">🔧 ' + t('risk_action') + '<b style="color:var(--txt)">' + T(r, 'action') + '</b></div>' +
        '</div>';
    }).join('');
    VIEW.innerHTML =
      '<div class="grid g-4" style="margin-bottom:18px">' +
        miniStat(t('risk_intercepted'), 214, t('unit_case'), 'red') + miniStat(t('risk_high'), 63, t('unit_case'), 'red') +
        miniStat(t('risk_mid'), 151, t('unit_case'), 'orange') + miniStat(t('risk_accuracy'), 88.6, '%', 'teal') +
      '</div>' +
      '<div class="card panel" style="margin-bottom:18px"><div class="section-head"><div><h3>' + t('risk_dist') + '</h3><div class="p-sub">' + t('risk_dist_sub') + '</div></div></div><div class="chart-box sm"><canvas id="riskChart"></canvas></div></div>' +
      '<div class="section-title">' + t('risk_list') + ' <span class="sub">' + t('risk_list_sub') + '</span></div>' +
      '<div class="grid g-2 fade-list" style="margin-top:12px">' + cards + '</div>';
    drawRiskChart();
  }
  function drawRiskChart() {
    var ctx = document.getElementById('riskChart'); if (!ctx) return;
    IB.charts.risk = new Chart(ctx, {
      type: 'bar',
      data: { labels: t('risk_labels'),
        datasets: [{ label: t('chart_billcount'), data: [8420, 2110, 980, 420, 214], backgroundColor: [COLORS.green, COLORS.teal, COLORS.orange, COLORS.red, '#c0392b'], borderRadius: 6, maxBarThickness: 60 }] },
      options: IB.chartOpts({ hideLegend: true })
    });
  }

  /* ======================================================================
     视图 6：催收预测
     ====================================================================== */
  function viewCollection() {
    var rows = D.COLLECTIONS.map(function (c) {
      var pcol = c.prob >= 70 ? 'green' : c.prob >= 40 ? 'orange' : 'red';
      var dcol = c.delayKey === 'high' ? 'red' : c.delayKey === 'mid' ? 'orange' : 'green';
      var penaltyCell = c.penaltyKey === 'none' ? '<span style="color:var(--txt-mute)">' + T(D.PENALTY_STATUS.none, 'label') + '</span>' : '<span class="badge b-red">' + T(c, 'penalty') + '</span>';
      return '<tr><td class="mono">' + c.id + '</td><td>' + T(c, 'entity') + '</td>' +
        '<td class="mono">' + money(c.amount) + ' SAR</td><td>' + c.overdue + ' ' + (lang() === 'zh' ? '天' : (lang() === 'en' ? 'd' : 'يوم')) + '</td>' +
        '<td style="min-width:150px"><div style="display:flex;align-items:center;gap:8px"><div class="progress" style="flex:1"><i style="width:' + c.prob + '%;background:var(--' + pcol + ')"></i></div><span style="color:var(--' + pcol + ');font-weight:600">' + c.prob + '%</span></div></td>' +
        '<td><span class="badge b-' + dcol + '">' + T(c, 'delay') + '</span></td>' +
        '<td>' + penaltyCell + '</td>' +
        '<td style="font-size:12.5px;color:var(--txt-dim);max-width:220px">' + T(c, 'strategy') + '</td></tr>';
    }).join('');
    VIEW.innerHTML =
      '<div class="grid g-4" style="margin-bottom:18px">' +
        miniStat(t('col_rate'), 87.3, '%', 'green') + miniStat(t('col_overdue'), 4, t('unit_sheet'), 'orange') +
        miniStat(t('col_high_risk'), 2, t('unit_sheet'), 'red') + miniStat(t('col_accuracy'), 86.1, '%', 'teal') +
      '</div>' +
      '<div class="grid g-3" style="margin-bottom:18px">' +
        '<div class="card panel" style="grid-column:span 2"><h3>' + t('col_prob_dist') + '</h3><div class="p-sub">' + t('col_prob_sub') + '</div><div class="chart-box sm"><canvas id="colChart"></canvas></div></div>' +
        '<div class="card panel"><h3>' + t('col_penalty') + '</h3><div class="p-sub">UC-12</div>' +
          '<div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">' +
            penaltyRow(T(D.PENALTY_STATUS.enforcing, 'label'), 1, 'red') + penaltyRow(T(D.PENALTY_STATUS.appealed, 'label'), 1, 'orange') + penaltyRow(t('penalty_none'), 2, 'green') +
          '</div></div>' +
      '</div>' +
      '<div class="card panel"><div class="section-head"><div><h3>' + t('col_list') + '</h3><div class="p-sub">' + t('col_list_sub') + '</div></div></div>' +
        '<table class="tbl"><thead><tr><th>' + t('th_id') + '</th><th>' + t('th_vendor') + '</th><th>' + t('th_amount') + '</th><th>' + t('th_overdue') + '</th><th>' + t('th_prob') + '</th><th>' + t('th_delay') + '</th><th>' + t('th_penalty') + '</th><th>' + t('th_strategy') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    drawColChart();
  }
  function penaltyRow(label, n, color) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.03)"><span class="badge b-' + color + '">' + label + '</span><b>' + n + ' ' + t('unit_sheet') + '</b></div>';
  }
  function drawColChart() {
    var ctx = document.getElementById('colChart'); if (!ctx) return;
    IB.charts.col = new Chart(ctx, {
      type: 'bar', data: { labels: D.COLLECTIONS.map(function (c) { return T(c, 'entity'); }),
        datasets: [{ label: t('chart_recovery'), data: D.COLLECTIONS.map(function (c) { return c.prob; }),
          backgroundColor: D.COLLECTIONS.map(function (c) { return c.prob >= 70 ? COLORS.green : c.prob >= 40 ? COLORS.orange : COLORS.red; }), borderRadius: 6, maxBarThickness: 46 }] },
      options: IB.chartOpts({ hideLegend: true, ysuffix: '%', ymax: 100 })
    });
  }

  /* ======================================================================
     视图 7：智能问答助手（中/英/阿三语）
     ====================================================================== */
  function viewAssistant() {
    var lg = lang();
    var greet = D.DEFAULT_ANSWER[lg] || D.DEFAULT_ANSWER.en;
    var isRtl = lg === 'ar';
    var sugg = lg === 'ar'
      ? ['ما هو معدل التحصيل هذا الشهر؟', 'كم إجمالي المبالغ المعالجة؟', 'كم عدد الحالات الشاذة؟', 'ما هو معدل الأتمتة؟']
      : lg === 'en'
      ? ['What is this month\'s recovery rate?', 'What is the total amount processed?', 'How many anomalies were blocked?', 'Is the automation rate on target?']
      : ['本月回收率多少？', '本月处理金额是多少？', '这个月拦截了多少异常账单？', '字段自动录入率达标了吗？'];
    VIEW.innerHTML =
      '<div class="chat-wrap">' +
        '<div class="card chat-panel">' +
          '<div class="chat-head"><div class="m-av" style="background:linear-gradient(135deg,var(--teal),var(--indigo));color:#04211e">AI</div>' +
            '<div><div style="font-weight:700">' + t('ast_title') + '</div><div class="p-sub" style="margin:0">' + t('ast_sub') + '</div></div>' +
            '<div class="pill-live" style="margin-' + (isRtl ? 'right' : 'left') + ':auto"><span class="dot-live"></span> ' + t('ast_online') + '</div></div>' +
          '<div class="chat-body" id="chatBody">' + botMsg(greet, isRtl) + '</div>' +
          '<div class="chat-foot"><input id="chatInput" placeholder="' + t('ast_placeholder') + '"' + (isRtl ? ' style="direction:rtl;text-align:right"' : '') + '>' +
            '<button class="chat-send" id="chatSend">' + svg('send') + '</button></div>' +
        '</div>' +
        '<div class="card panel"><h3>' + t('ast_rec_q') + '</h3><div class="p-sub">' + t('ast_rec_sub') + '</div>' +
          '<div class="suggest-chips" style="margin-top:14px">' + sugg.map(function (s) { return '<button class="sg-chip' + (isRtl ? ' ar' : '') + '" data-q="' + s + '">' + s + '</button>'; }).join('') + '</div>' +
          '<div style="margin-top:22px" class="p-sub">💡 ' + t('ast_usecases') + '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:10px">' +
            [t('uc_06'), t('uc_07'), t('uc_08'), t('uc_10')].map(function (tx) { return '<span class="meta-pill">' + tx + '</span>'; }).join('') +
          '</div></div>' +
      '</div>';
    var input = document.getElementById('chatInput');
    document.getElementById('chatSend').addEventListener('click', function () { ask(input.value); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(input.value); });
    VIEW.querySelectorAll('.sg-chip').forEach(function (c) { c.addEventListener('click', function () { ask(c.getAttribute('data-q')); }); });
  }
  function botMsg(txt, ar) { return '<div class="msg bot"><div class="m-av">AI</div><div class="m-bubble' + (ar ? ' ar' : '') + '">' + txt + '</div></div>'; }
  function userMsg(txt, ar) { return '<div class="msg user"><div class="m-av">' + IB.user.avatar + '</div><div class="m-bubble' + (ar ? ' ar' : '') + '">' + txt + '</div></div>'; }

  function ask(q) {
    q = (q || '').trim(); if (!q) return;
    var lg = lang();
    var body = document.getElementById('chatBody');
    var isAr = /[\u0600-\u06FF]/.test(q);
    body.insertAdjacentHTML('beforeend', userMsg(q, isAr));
    document.getElementById('chatInput').value = '';
    body.scrollTop = body.scrollHeight;
    var typ = document.createElement('div');
    typ.className = 'msg bot'; typ.innerHTML = '<div class="m-av">AI</div><div class="m-bubble"><span class="typing"><i></i><i></i><i></i></span></div>';
    body.appendChild(typ); body.scrollTop = body.scrollHeight;

    setTimeout(function () {
      typ.remove();
      var ql = q.toLowerCase();
      var hit = D.QA.find(function (item) { return item.match.some(function (m) { return ql.indexOf(String(m).toLowerCase()) !== -1; }); });
      var ansLang = isAr ? 'ar' : lg;
      var ans = hit ? (hit[ansLang] || hit.en) : (D.DEFAULT_ANSWER[ansLang] || D.DEFAULT_ANSWER.en);
      ans = ans.replace(/\*\*(.+?)\*\*/g, '<b style="color:var(--teal)">$1</b>');
      var chartId = hit && hit.chart ? 'qa_' + Date.now() : null;
      var chartHtml = chartId ? '<div class="mini-chart"><canvas id="' + chartId + '"></canvas></div>' : '';
      body.insertAdjacentHTML('beforeend', '<div class="msg bot"><div class="m-av">AI</div><div class="m-bubble' + (ansLang === 'ar' ? ' ar' : '') + '">' + ans + chartHtml + '</div></div>');
      body.scrollTop = body.scrollHeight;
      if (chartId) drawQAChart(chartId, hit.chart);
    }, 900);
  }
  function drawQAChart(id, type) {
    var ctx = document.getElementById(id); if (!ctx) return;
    var labels = IB.trendLabels();
    var cfg;
    if (type === 'recovery') cfg = { type: 'line', data: { labels: labels, datasets: [{ data: D.TREND.recovery, borderColor: COLORS.green, backgroundColor: rgba(COLORS.green, 0.15), fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2 }] }, options: IB.chartOpts({ hideLegend: true, ysuffix: '%', ymin: 74, ymax: 92 }) };
    else if (type === 'automation') cfg = { type: 'line', data: { labels: labels, datasets: [{ data: D.TREND.automation, borderColor: COLORS.teal, backgroundColor: rgba(COLORS.teal, 0.15), fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2 }] }, options: IB.chartOpts({ hideLegend: true, ysuffix: '%', ymin: 85, ymax: 100 }) };
    else cfg = { type: 'doughnut', data: { labels: D.SOURCES.map(function (s) { return s.name; }), datasets: [{ data: D.SOURCES.map(function (s) { return s.count; }), backgroundColor: D.SOURCES.map(function (s) { return COLORS[s.color]; }), borderWidth: 0 }] }, options: { cutout: '60%', plugins: { legend: { position: 'right', labels: { boxWidth: 9, font: { size: 10 } } } } } };
    new Chart(ctx, cfg);
  }

  /* ======================================================================
     视图 8：Agent 编排中心
     ====================================================================== */
  function viewAgents() {
    var cards = D.AGENTS.map(function (a) {
      var col = COLORS[a.color];
      return '<div class="card agent-card">' +
        '<div class="agent-top"><div class="agent-tag" style="background:' + rgba(col, 0.16) + ';color:' + col + '">' + a.id + '</div>' +
          '<div><h4>' + T(a, 'name') + '</h4><div class="a-en">' + a.en + ' · ' + T(a, 'form') + '</div></div>' +
          '<span class="badge b-green" style="margin-' + (lang() === 'ar' ? 'right' : 'left') + ':auto">' + t('online') + '</span></div>' +
        '<div class="a-desc">' + T(a, 'desc') + '</div>' +
        '<div class="agent-stats"><div><b>' + money(a.calls) + '</b><span>' + t('agent_calls') + '</span></div><div><b style="color:' + col + '">' + a.acc + '%</b><span>' + t('agent_acc') + '</span></div></div>' +
        '<div class="agent-meta"><span class="meta-pill">' + a.uc + '</span><span class="meta-pill">' + T(a, 'model') + '</span></div>' +
        '</div>';
    }).join('');
    VIEW.innerHTML =
      '<div class="hitl-banner" style="margin-bottom:18px"><div class="h-ico">' + svg('play') + '</div>' +
        '<div><b>' + t('agent_center_banner') + '</b>　—　' + t('agent_center_desc') + '</div></div>' +
      '<div class="grid g-3 fade-list">' + cards + '</div>';
  }

  /* ---------- 注册视图 & 启动 ---------- */
  IB.setViews({ viewProcess: viewProcess, viewInvoices: viewInvoices, viewApprovals: viewApprovals, viewRisk: viewRisk, viewCollection: viewCollection, viewAssistant: viewAssistant, viewAgents: viewAgents });
  window.__IB_BOOT();
})();

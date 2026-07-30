/* ==========================================================================
   智能账单管理平台 · 应用逻辑 (SPA)
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DEMO;
  var I18N = window.I18N;
  var t = function (k) { return I18N.t(k); };
  var T = function (obj, field) { return I18N.get(obj, field); };
  var charts = {};

  /* ---------- 会话校验 ---------- */
  var user = null;
  try { user = JSON.parse(sessionStorage.getItem('ib_user')); } catch (e) {}
  if (!user) { window.location.href = 'index.html'; return; }

  /* ---------- 机构上下文 ---------- */
  var org = (user && user.org) || D.ORGS[0];
  window.__IB_ORG = org;
  function orgScale() { return (window.__IB_ORG && window.__IB_ORG.scale) || 1; }
  function scaleVal(id, v) {
    var s = orgScale();
    if (s === 1) return v;
    if (id === 'amount') return Number((v * s).toFixed(2));
    if (id === 'processed' || id === 'anomaly' || id === 'count') return Math.round(v * s);
    return v;
  }

  /* ---------- 图标库 ---------- */
  var ICON = {
    file: '<path d="M6 3h8l4 4v14H6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 3v4h4" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    bolt: '<path d="M13 3L5 13h6l-1 8 8-11h-6l1-7z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    coins: '<ellipse cx="9" cy="7" rx="5" ry="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M4 7v5c0 1.4 2.2 2.5 5 2.5" stroke="currentColor" stroke-width="1.6"/><ellipse cx="15" cy="15" rx="5" ry="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M10 15v2c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-2" stroke="currentColor" stroke-width="1.6"/>',
    trend: '<path d="M4 17l5-5 3 3 8-8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h5v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    shield: '<path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z" stroke="currentColor" stroke-width="1.6"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    clock: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    upload: '<path d="M12 4v11m0-11l-4 4m4-4l4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 16v3a1 1 0 001 1h12a1 1 0 001-1v-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    send: '<path d="M4 12l16-8-6 16-3-6-7-2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    check: '<path d="M5 12l4 4L19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    x: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    warn: '<path d="M12 3l9 16H3l9-16z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9v4m0 3v.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    play: '<path d="M7 5l12 7-12 7V5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
  };
  function svg(name, cls) { return '<svg viewBox="0 0 24 24" fill="none" class="' + (cls || '') + '">' + (ICON[name] || '') + '</svg>'; }

  var COLORS = { teal: '#17c9b8', indigo: '#6d8bff', gold: '#f5b445', green: '#35d07f', red: '#ff6a6a', orange: '#ff9f43', purple: '#b48bff', blue: '#4aa8ff', grey: '#7c89ad' };
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',') + ',' + a + ')';
  }

  /* ---------- toast ---------- */
  function toast(msg, type) {
    var w = document.getElementById('toast');
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'ok');
    var ic = type === 'err' ? svg('x') : type === 'warn' ? svg('warn') : svg('check');
    el.innerHTML = ic + '<span>' + msg + '</span>';
    w.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; setTimeout(function () { el.remove(); }, 300); }, 2600);
  }

  /* ---------- 用户信息（多语言） ---------- */
  function refreshUserInfo() {
    document.getElementById('uAvatar').textContent = user.avatar;
    document.getElementById('uName').textContent = T(user, 'name') || user.name;
    document.getElementById('uRole').textContent = T(user, 'role') || user.role;
    document.getElementById('logoutBtn').title = t('logout');
  }
  document.getElementById('logoutBtn').addEventListener('click', function () {
    sessionStorage.removeItem('ib_user');
    window.location.href = 'index.html';
  });
  document.getElementById('notifBtn').addEventListener('click', function () {
    toast(t('notif_msg'), 'warn');
  });

  /* ---------- 语言切换 ---------- */
  function highlightLang() {
    var lang = I18N.getLang();
    document.querySelectorAll('#langToggle button').forEach(function (x) {
      x.classList.toggle('active', x.getAttribute('data-lang') === lang);
    });
  }
  document.getElementById('langToggle').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var lang = b.getAttribute('data-lang');
    if (lang === I18N.getLang()) return;
    I18N.setLang(lang); /* triggers __IB_RELOAD */
    toast(t('switched_' + lang), 'ok');
  });

  /* ---------- 侧边栏 & 顶栏文案（多语言重建） ---------- */
  var NAV_GROUPS = {
    dashboard: 'nav_overview',
    process: 'nav_proc', invoices: 'nav_proc', approvals: 'nav_proc',
    risk: 'nav_risk', collection: 'nav_risk',
    assistant: 'nav_hub', agents: 'nav_hub'
  };
  /* ---------- 机构切换器 ---------- */
  function populateOrgSwitch() {
    var sel = document.getElementById('orgSwitch');
    if (!sel) return;
    var groups = { central: [], local: [] };
    D.ORGS.forEach(function (o) { (groups[o.tier] || (groups[o.tier] = [])).push(o); });
    sel.innerHTML = ['central', 'local'].map(function (tier) {
      return '<optgroup label="' + t(tier === 'central' ? 'tier_central' : 'tier_local') + '">' +
        groups[tier].map(function (o) { return '<option value="' + o.id + '">' + T(o, 'name') + '</option>'; }).join('') +
        '</optgroup>';
    }).join('');
    sel.value = window.__IB_ORG.id;
    if (!sel.__bound) {
      sel.__bound = true;
      sel.addEventListener('change', function () {
        var o = D.ORGS.find(function (x) { return x.id === sel.value; }) || D.ORGS[0];
        window.__IB_ORG = o; user.org = o;
        try { sessionStorage.setItem('ib_user', JSON.stringify(user)); } catch (e) {}
        toast(t('org_switched') + ' · ' + T(o, 'name'), 'ok');
        updateTitle(); render();
      });
    }
  }

  function refreshChrome() {
    document.querySelectorAll('.nav-item[data-route]').forEach(function (n) {
      var r = n.getAttribute('data-route');
      var svgEl = n.querySelector('svg');
      var badge = n.querySelector('.nav-badge');
      // remove existing text nodes only
      Array.prototype.slice.call(n.childNodes).forEach(function (node) {
        if (node.nodeType === 3) n.removeChild(node);
      });
      var label = document.createTextNode(' ' + t(r) + ' ');
      if (svgEl && svgEl.nextSibling) n.insertBefore(label, svgEl.nextSibling);
      else if (svgEl) n.appendChild(label);
      else n.insertBefore(label, n.firstChild);
      if (badge) n.appendChild(badge);
    });
    document.querySelectorAll('.nav-group-label').forEach(function (g) {
      var key = g.getAttribute('data-i18n');
      if (key) g.textContent = t(key);
    });
    // topbar brand small stays as-is (proper noun); pill + notif
    var pill = document.querySelector('.topbar .pill-live');
    if (pill) pill.innerHTML = '<span class="dot-live"></span> 7 ' + t('agents_online');
    var notif = document.getElementById('notifBtn');
    if (notif) notif.title = t('notif');
    var sideBrand = document.getElementById('sideBrand');
    if (sideBrand) sideBrand.textContent = t('side_brand');
    refreshUserInfo();
    highlightLang();
    populateOrgSwitch();
  }

  /* ---------- 路由 ---------- */
  var CRUMB = {
    dashboard: ['nav_overview'],
    process: ['nav_proc', 'process'],
    invoices: ['nav_proc', 'invoices'],
    approvals: ['nav_proc', 'approvals'],
    risk: ['nav_risk', 'risk'],
    collection: ['nav_risk', 'collection'],
    assistant: ['nav_hub', 'assistant'],
    agents: ['nav_hub', 'agents']
  };
  var currentRoute = 'dashboard';
  var VIEW = document.getElementById('view');

  function setRoute(r) {
    if (!CRUMB[r]) r = 'dashboard';
    currentRoute = r;
    document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.toggle('active', n.getAttribute('data-route') === r); });
    updateTitle();
    Object.keys(charts).forEach(function (k) { if (charts[k]) { charts[k].destroy(); delete charts[k]; } });
    render();
    VIEW.scrollTop = 0; window.scrollTo(0, 0);
  }
  function updateTitle() {
    document.getElementById('pageTitle').textContent = t(currentRoute);
    var parts = CRUMB[currentRoute].map(function (k) { return t(k); });
    document.getElementById('pageCrumb').textContent = crumbBrand() + ' / ' + parts.join(' / ');
  }
  function crumbBrand() {
    var lang = I18N.getLang();
    return lang === 'zh' ? '智能账单管理平台' : (lang === 'en' ? 'INTELLIBILL' : 'INTELLIBILL');
  }
  document.querySelectorAll('.nav-item').forEach(function (n) {
    n.addEventListener('click', function () { location.hash = n.getAttribute('data-route'); });
  });
  window.addEventListener('hashchange', function () { setRoute(location.hash.replace('#', '')); });

  function render() {
    switch (currentRoute) {
      case 'dashboard': viewDashboard(); break;
      case 'process': viewProcess(); break;
      case 'invoices': viewInvoices(); break;
      case 'approvals': viewApprovals(); break;
      case 'risk': viewRisk(); break;
      case 'collection': viewCollection(); break;
      case 'assistant': viewAssistant(); break;
      case 'agents': viewAgents(); break;
    }
  }

  /* ---------- 语言切换后全量刷新 ---------- */
  window.__IB_RELOAD = function () {
    Object.keys(charts).forEach(function (k) { if (charts[k]) { charts[k].destroy(); delete charts[k]; } });
    refreshChrome();
    updateTitle();
    render();
  };

  /* ---------- 通用渲染工具 ---------- */
  function statusBadge(st) {
    var s = D.STATUS[st] || { label: st, color: 'grey' };
    return '<span class="badge b-' + s.color + '">' + (T(s, 'label') || s.label) + '</span>';
  }
  function money(n) { return D.fmtMoney(n); }
  function trendLabels() { return T(D.TREND, 'labels') || D.TREND.labels; }

  /* ======================================================================
     视图 1：经营仪表盘
     ====================================================================== */
  function viewDashboard() {
    var kpiHtml = D.KPIS.map(function (k) {
      var up = k.delta >= 0;
      var deltaCls = (k.id === 'cycle') ? 'down' : (up ? 'up' : 'down');
      var arrow = k.delta >= 0 ? '▲' : '▼';
      var target = k.target ? '<div class="k-target">' + t('kpi_target') + ' ' + k.target + '%　·　' + (k.value >= k.target ? '<span style="color:var(--green)">' + t('kpi_achieved') + '</span>' : t('kpi_not_achieved')) + '</div>' : '';
      var unit = T(k, 'unit');
      var val = scaleVal(k.id, k.value);
      return '<div class="card kpi">' +
        '<div class="k-ico" style="background:' + rgba(COLORS[k.color], 0.14) + ';color:' + COLORS[k.color] + '">' + svg(k.icon) + '</div>' +
        '<div class="k-delta ' + deltaCls + '">' + arrow + ' ' + Math.abs(k.delta) + '%</div>' +
        '<div class="k-val">' + money(val) + '<span class="u">' + unit + '</span></div>' +
        '<div class="k-lab">' + T(k, 'label') + '</div>' + target +
        '</div>';
    }).join('');

    var srcHtml = D.SOURCES.map(function (s) {
      return '<div class="card src-card">' +
        '<div class="src-ico" style="background:' + rgba(COLORS[s.color], 0.15) + ';color:' + COLORS[s.color] + '">' + s.name.slice(0, 2) + '</div>' +
        '<div><b>' + money(scaleVal('count', s.count)) + '</b><div class="s-name">' + s.name + '</div><div class="s-desc">' + T(s, 'desc') + '</div></div>' +
        '</div>';
    }).join('');

    var tierLabel = t(window.__IB_ORG.tier === 'central' ? 'tier_central' : 'tier_local');
    var scopeBanner =
      '<div class="scope-bar">' +
        '<div class="scope-ico">' + svg('shield') + '</div>' +
        '<div class="scope-txt"><b>' + t('org_scope') + '：' + T(window.__IB_ORG, 'name') + '</b>' +
          '<span class="scope-tier">' + tierLabel + ' · ' + window.__IB_ORG.code + '</span>' +
          '<div class="scope-note">' + t('org_scope_note') + '</div></div>' +
      '</div>';

    var proHtml = D.PROACTIVE.map(function (p) {
      return '<div class="pro-item">' +
        '<div class="pro-ico" style="background:' + rgba(COLORS[p.color], 0.14) + ';color:' + COLORS[p.color] + '">' + svg(p.icon) + '</div>' +
        '<div class="pro-body"><div class="pro-title">' + T(p, 'title') + '</div><div class="pro-desc">' + T(p, 'desc') + '</div></div>' +
        '<button class="btn btn-ghost pro-btn">' + T(p, 'act') + '</button>' +
        '</div>';
    }).join('');
    var proPanel =
      '<div class="card panel pro-panel" style="margin-bottom:20px">' +
        '<div class="section-head"><div><h3>' + t('proactive_title') + '</h3><div class="p-sub">' + t('proactive_sub') + '</div></div></div>' +
        '<div class="pro-list">' + proHtml + '</div>' +
      '</div>';

    VIEW.innerHTML =
      scopeBanner +
      '<div class="hitl-banner" style="margin-bottom:20px">' +
        '<div class="h-ico">' + svg('shield') + '</div>' +
        '<div><b>' + t('hitl_banner') + '</b>　—　' + t('hitl_desc') + '</div>' +
      '</div>' +
      proPanel +
      '<div class="grid g-6" style="margin-bottom:20px">' + kpiHtml + '</div>' +
      '<div class="grid g-3" style="margin-bottom:20px">' +
        '<div class="card panel" style="grid-column:span 2">' +
          '<div class="section-head"><div><h3>' + t('trend_title') + '</h3><div class="p-sub">' + t('trend_sub') + '</div></div></div>' +
          '<div class="chart-box"><canvas id="trendChart"></canvas></div>' +
        '</div>' +
        '<div class="card panel">' +
          '<h3>' + t('src_title') + '</h3><div class="p-sub">Tahseel / Makin / Efa / Sanad</div>' +
          '<div class="chart-box"><canvas id="srcChart"></canvas></div>' +
        '</div>' +
      '</div>' +
      '<div class="grid g-4" style="margin-bottom:20px">' + srcHtml + '</div>' +
      '<div class="grid g-3">' +
        '<div class="card panel" style="grid-column:span 2">' +
          '<div class="section-head"><div><h3>' + t('recent_title') + '</h3><div class="p-sub">' + t('recent_sub') + '</div></div>' +
            '<a class="btn btn-ghost" href="#invoices">' + t('view_all') + '</a></div>' +
          recentInvoicesTable() +
        '</div>' +
        '<div class="card panel">' +
          '<h3>' + t('recovery_title') + '</h3><div class="p-sub">' + t('recovery_sub') + '</div>' +
          '<div class="chart-box sm"><canvas id="recChart"></canvas></div>' +
        '</div>' +
      '</div>';

    drawTrend(); drawSource('srcChart'); drawRecovery();
  }

  function recentInvoicesTable() {
    var rows = D.INVOICES.slice(0, 6).map(function (v) {
      return '<tr><td class="mono">' + v.id + '</td><td>' + T(v, 'entity') + '</td>' +
        '<td class="mono">' + money(v.amount) + ' ' + v.currency + '</td>' +
        '<td><span class="badge b-' + D.SOURCES.find(function (s) { return s.name === v.source; }).color + '">' + v.source + '</span></td>' +
        '<td>' + statusBadge(v.status) + '</td></tr>';
    }).join('');
    return '<table class="tbl"><thead><tr><th>' + t('th_id') + '</th><th>' + t('th_vendor') + '</th><th>' + t('th_amount') + '</th><th>' + t('th_source') + '</th><th>' + t('th_status') + '</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ---------- 图表 ---------- */
  Chart.defaults.color = '#9aa8c7';
  Chart.defaults.font.family = 'Outfit, Inter, sans-serif';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';

  function drawTrend() {
    var ctx = document.getElementById('trendChart'); if (!ctx) return;
    charts.trend = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: trendLabels(),
        datasets: [
          { type: 'bar', label: t('chart_volume'), data: D.TREND.processed, backgroundColor: rgba(COLORS.indigo, 0.55), borderRadius: 6, yAxisID: 'y', maxBarThickness: 26 },
          { type: 'line', label: t('chart_automation'), data: D.TREND.automation, borderColor: COLORS.teal, backgroundColor: rgba(COLORS.teal, 0.1), borderWidth: 2.5, tension: 0.4, pointRadius: 3, pointBackgroundColor: COLORS.teal, yAxisID: 'y1', fill: true }
        ]
      },
      options: chartOpts({ dualAxis: true, y1suffix: '%', y1min: 80, y1max: 100 })
    });
  }
  function drawSource(id) {
    var ctx = document.getElementById(id); if (!ctx) return;
    charts[id] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: D.SOURCES.map(function (s) { return s.name; }),
        datasets: [{ data: D.SOURCES.map(function (s) { return s.count; }), backgroundColor: D.SOURCES.map(function (s) { return COLORS[s.color]; }), borderWidth: 0, hoverOffset: 8 }]
      },
      options: { cutout: '64%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 12 } } } } }
    });
  }
  function drawRecovery() {
    var ctx = document.getElementById('recChart'); if (!ctx) return;
    charts.rec = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trendLabels(),
        datasets: [{ label: t('col_rate'), data: D.TREND.recovery, borderColor: COLORS.green, backgroundColor: rgba(COLORS.green, 0.14), borderWidth: 2.5, tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: COLORS.green }]
      },
      options: chartOpts({ ysuffix: '%', ymin: 74, ymax: 92, hideLegend: true })
    });
  }
  function chartOpts(o) {
    o = o || {};
    var rtl = I18N.getLang() === 'ar';
    var opt = {
      responsive: true, maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: { legend: { display: !o.hideLegend, position: 'top', align: 'end', rtl: rtl, labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
        tooltip: { rtl: rtl, backgroundColor: '#131d38', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, padding: 11, cornerRadius: 9, titleColor: '#fff', bodyColor: '#cbd5f0' } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 11.5 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 11 }, callback: function (v) { return o.ysuffix ? v + o.ysuffix : v; } }, min: o.ymin, max: o.ymax } }
    };
    if (o.dualAxis) {
      opt.scales.y1 = { position: 'right', grid: { drawOnChartArea: false }, min: o.y1min, max: o.y1max, ticks: { font: { size: 11 }, callback: function (v) { return v + (o.y1suffix || ''); } } };
    }
    return opt;
  }

  /* 暴露给后续文件 */
  window.__IB = { D: D, VIEW: VIEW, svg: svg, ICON: ICON, COLORS: COLORS, rgba: rgba, toast: toast, charts: charts,
    statusBadge: statusBadge, money: money, drawSource: drawSource, chartOpts: chartOpts,
    getLang: function () { return I18N.getLang(); }, t: t, T: T, trendLabels: trendLabels, user: user,
    setViews: function (v) { Object.assign(window.__IBV, v); } };
  window.__IBV = {};

  /* ---------- 视图占位（由 app2.js 实现，boot 时确保就绪） ---------- */
  function viewProcess() { window.__IBV.viewProcess && window.__IBV.viewProcess(); }
  function viewInvoices() { window.__IBV.viewInvoices && window.__IBV.viewInvoices(); }
  function viewApprovals() { window.__IBV.viewApprovals && window.__IBV.viewApprovals(); }
  function viewRisk() { window.__IBV.viewRisk && window.__IBV.viewRisk(); }
  function viewCollection() { window.__IBV.viewCollection && window.__IBV.viewCollection(); }
  function viewAssistant() { window.__IBV.viewAssistant && window.__IBV.viewAssistant(); }
  function viewAgents() { window.__IBV.viewAgents && window.__IBV.viewAgents(); }

  /* ---------- 启动 ---------- */
  window.__IB_BOOT = function () {
    refreshChrome();
    setRoute(location.hash.replace('#', '') || 'dashboard');
  };
})();

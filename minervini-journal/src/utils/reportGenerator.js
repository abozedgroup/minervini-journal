/** Generate a printable HTML report for a stock card */

function tiptapToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  if (Array.isArray(node.content)) {
    const text = node.content.map(tiptapToText).join('');
    const blockTypes = ['paragraph', 'heading', 'listItem', 'blockquote', 'bulletList', 'orderedList'];
    return blockTypes.includes(node.type) ? text + '\n' : text;
  }
  return '';
}

function extractNoteText(note) {
  if (!note) return '';
  if (typeof note === 'string') return note.trim();
  if (note.type === 'doc') return tiptapToText(note).trim();
  return '';
}

const SENTIMENT_LABELS = {
  very_bullish: '🔥 متفائل جداً',
  bullish: '👍 إيجابي',
  neutral: '😐 محايد',
  cautious: '😟 متردد',
  bearish: '🚫 لا أدخل',
};

const STATUS_LABELS = {
  watching: 'قيد المراقبة',
  ready: 'جاهز للدخول',
  open: 'صفقة مفتوحة',
  closed: 'مغلقة',
};

function renderHashtags(text) {
  return text.replace(/#([\u0600-\u06FFa-zA-Z0-9_]+)/g, '<span class="hashtag">#$1</span>');
}

function checkRow(checked, label) {
  return `<li class="${checked ? 'checked' : 'unchecked'}"><span>${checked ? '✓' : '○'}</span> ${label}</li>`;
}

export function generateStockReport(stock, strategies = [], currentPrice = null) {
  const plan = stock.plan || {};
  const trade = stock.trade || {};
  const close = stock.close || {};
  const notes = stock.notes || {};
  const diary = Array.isArray(stock.diary) ? stock.diary : [];
  const phases = stock.phases || {};
  const linkedStrats = (stock.strategies || [])
    .map((sid) => strategies.find((s) => String(s.id) === String(sid)))
    .filter(Boolean);

  const chartNote = extractNoteText(notes.chart);
  const financialNote = extractNoteText(notes.financial);
  const sourcesNote = extractNoteText(notes.sources);

  const trigger = plan.pivot ?? stock.trigger ?? 0;
  const stop = plan.stop ?? stock.stop ?? 0;
  const riskPerShare = trigger > 0 && stop < trigger ? (trigger - stop).toFixed(2) : null;

  const entryPrice = trade.entryPrice ?? 0;
  const originalStop = trade.originalStop ?? plan.stop ?? 0;
  const currentStop = trade.currentStop ?? originalStop;
  const sharesActual = trade.remainingShares ?? trade.sharesActual ?? trade.shares ?? 0;
  const riskPerShareTrade = entryPrice > 0 && originalStop < entryPrice ? entryPrice - originalStop : null;
  const currentR = currentPrice != null && riskPerShareTrade ? ((currentPrice - entryPrice) / riskPerShareTrade).toFixed(2) : null;
  const daysIn = trade.entryDate ? Math.floor((Date.now() - new Date(trade.entryDate).getTime()) / 86400000) : null;
  const finalR = close.finalR ?? trade.finalR ?? null;
  const pnlUSD = close.pnlUSD ?? null;

  // Build checklist HTML sections
  const buildPhaseHtml = (phase, title, color) => {
    if (!phase?.items?.length) return '';
    const items = phase.items.map((label, i) => checkRow(!!phase.checks?.[i], label)).join('');
    const done = (phase.checks || []).filter(Boolean).length;
    const total = phase.items.length;
    return `
      <div class="card card-${color}">
        <h3>${title} <span style="font-size:11px; color:#888;">${done}/${total}</span></h3>
        <ul class="checklist">${items}</ul>
      </div>`;
  };

  // Trade data section
  let tradeSection = '';
  if (stock.status === 'open' && entryPrice > 0) {
    const rColor = currentR != null ? (parseFloat(currentR) >= 2 ? '#10b981' : parseFloat(currentR) >= 0 ? '#f0b429' : '#ef4444') : '#888';
    tradeSection = `
      <h2>📈 بيانات الصفقة المفتوحة</h2>
      <div class="grid-3">
        <div class="card card-teal">
          <div class="stat-label">سعر الدخول</div>
          <div class="stat-value">$${entryPrice.toFixed(2)}</div>
        </div>
        <div class="card">
          <div class="stat-label">الوقف الحالي</div>
          <div class="stat-value" style="color:#ef4444">$${currentStop > 0 ? currentStop.toFixed(2) : '—'}</div>
        </div>
        <div class="card">
          <div class="stat-label">R الحالي</div>
          <div class="stat-value" style="color:${rColor}">${currentR != null ? (parseFloat(currentR) >= 0 ? '+' : '') + currentR + 'R' : '—'}</div>
        </div>
        <div class="card">
          <div class="stat-label">الأسهم المتبقية</div>
          <div class="stat-value">${sharesActual}</div>
        </div>
        <div class="card">
          <div class="stat-label">أيام في الصفقة</div>
          <div class="stat-value">${daysIn ?? '—'}</div>
        </div>
        <div class="card">
          <div class="stat-label">تاريخ الدخول</div>
          <div class="stat-value" style="font-size:12px">${trade.entryDate ? new Date(trade.entryDate).toLocaleDateString('ar-SA') : '—'}</div>
        </div>
      </div>
      ${trade.stopHistory?.length ? `
        <h3 style="margin-top:12px; color:#888; font-size:12px;">تاريخ تحريك الوقف:</h3>
        <table class="data-table"><tr><th>التاريخ</th><th>الوقف</th></tr>${trade.stopHistory.map((sh, i) => `<tr><td>${sh.date ? new Date(sh.date).toLocaleDateString('ar-SA') : '#' + (i + 1)}</td><td style="font-family:monospace">$${typeof sh.stop === 'number' ? sh.stop.toFixed(2) : sh.stop ?? '—'}</td></tr>`).join('')}</table>
      ` : ''}`;
  } else if (stock.status === 'closed' && entryPrice > 0) {
    const rColor = finalR != null ? (finalR >= 2 ? '#10b981' : finalR >= 0 ? '#f0b429' : '#ef4444') : '#888';
    tradeSection = `
      <h2>📊 نتيجة الصفقة المغلقة</h2>
      <div class="grid-3">
        <div class="card card-teal"><div class="stat-label">سعر الدخول</div><div class="stat-value">$${entryPrice.toFixed(2)}</div></div>
        <div class="card"><div class="stat-label">سعر الإغلاق</div><div class="stat-value">$${close.closePrice ? Number(close.closePrice).toFixed(2) : '—'}</div></div>
        <div class="card"><div class="stat-label">R المحقق</div><div class="stat-value" style="color:${rColor}">${finalR != null ? (finalR >= 0 ? '+' : '') + Number(finalR).toFixed(2) + 'R' : '—'}</div></div>
        ${pnlUSD != null ? `<div class="card"><div class="stat-label">PnL</div><div class="stat-value" style="color:${pnlUSD >= 0 ? '#10b981' : '#ef4444'}">${pnlUSD >= 0 ? '+' : ''}$${Number(pnlUSD).toFixed(0)}</div></div>` : ''}
        ${close.grade ? `<div class="card card-gold"><div class="stat-label">التقييم</div><div class="stat-value">${close.grade}</div></div>` : ''}
        ${daysIn != null ? `<div class="card"><div class="stat-label">مدة الصفقة</div><div class="stat-value">${daysIn} يوم</div></div>` : ''}
      </div>
      ${close.lessons ? `<div class="note-text" style="margin-top:12px;">${renderHashtags(String(close.lessons))}</div>` : ''}`;
  }

  // Entry plan section
  let planSection = '';
  if (trigger > 0 || (stock.status === 'ready')) {
    planSection = `
      <h2>🎯 خطة الدخول</h2>
      <div class="grid-3">
        <div class="card card-gold"><div class="stat-label">Trigger / Pivot</div><div class="stat-value">$${trigger || '—'}</div></div>
        <div class="card"><div class="stat-label">Stop Loss</div><div class="stat-value" style="color:#ef4444">$${stop || '—'}</div></div>
        <div class="card"><div class="stat-label">Risk / Share</div><div class="stat-value">${riskPerShare ? '$' + riskPerShare : '—'}</div></div>
      </div>`;
  }

  // Checklist section
  const exitPhaseHtml = phases.exit ? buildPhaseHtml(phases.exit, 'الخروج', 'red') : '';
  const checklistSection = `
    <h2>📋 قائمة الشروط</h2>
    <div class="grid-3">
      ${buildPhaseHtml(phases.trend, 'الاتجاه', 'teal')}
      ${buildPhaseHtml(phases.pattern, 'النموذج', 'gold')}
      ${buildPhaseHtml(phases.entry, 'الدخول', 'blue')}
    </div>
    ${exitPhaseHtml ? `<div class="grid-3" style="margin-top:12px">${exitPhaseHtml}</div>` : ''}`;

  // Notes sections
  const notesSection = [
    chartNote ? `<h2>📊 تحليل الشارت</h2><div class="note-text">${chartNote.replace(/\n/g, '<br>')}</div>` : '',
    financialNote ? `<h2>💰 التحليل المالي</h2><div class="note-text">${financialNote.replace(/\n/g, '<br>')}</div>` : '',
    sourcesNote ? `<h2>🔗 المصادر</h2><div class="note-text">${sourcesNote.replace(/\n/g, '<br>')}</div>` : '',
  ].filter(Boolean).join('\n');

  // Diary section
  const diarySection = diary.length ? `
    <h2>📅 يوميات السهم (${diary.length} مدخل)</h2>
    <div class="diary-list">
      ${diary.map((e) => `
        <div class="diary-entry">
          <div class="diary-date">${new Date(e.date).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div class="diary-text">${renderHashtags(e.text.replace(/\n/g, '<br>'))}</div>
        </div>`).join('')}
    </div>` : '';

  // Strategy section
  const stratSection = linkedStrats.length ? `
    <h2>📐 الاستراتيجيات المرتبطة</h2>
    ${linkedStrats.map((s) => `<span class="tag">${s.icon || ''} ${s.name}</span>`).join(' ')}` : '';

  // Attachments
  const attSection = stock.attachments?.length ? `
    <h2>📎 المرفقات (${stock.attachments.length})</h2>
    <ul style="list-style:disc; padding-right:20px; font-size:12px; color:#555;">
      ${stock.attachments.map((a) => `<li>${a.name} — ${(a.size / 1024).toFixed(0)}KB</li>`).join('')}
    </ul>` : '';

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير ${stock.ticker} — ${stock.company || ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #1a1a2e; background: #fff; padding: 28px 32px; font-size: 13px; line-height: 1.7; max-width: 960px; margin: 0 auto; }
    .report-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; padding-bottom: 18px; border-bottom: 3px solid #f0b429; }
    .ticker { font-size: 38px; font-weight: 900; color: #f0b429; font-family: 'Courier New', monospace; letter-spacing: 2px; }
    .company-name { font-size: 18px; font-weight: 600; margin: 4px 0 2px; }
    .meta { font-size: 11px; color: #888; }
    .badges { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; background: #f0b42918; color: #f0b429; border: 1px solid #f0b42960; }
    .readiness-circle { text-align: center; }
    .readiness-num { font-size: 28px; font-weight: 800; color: #10b981; }
    .readiness-label { font-size: 10px; color: #888; }
    .report-date { font-size: 10px; color: #aaa; margin-top: 4px; }
    h2 { font-size: 14px; font-weight: 700; color: #1a1a2e; border-bottom: 2px solid #f0b429; padding-bottom: 5px; margin: 22px 0 12px; letter-spacing: 0.3px; }
    h3 { font-size: 12px; color: #555; margin-bottom: 6px; font-weight: 600; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .card { background: #f8f9fa; border: 1px solid #e8e8e8; border-radius: 8px; padding: 10px 14px; }
    .card-teal { border-right: 4px solid #10b981; }
    .card-gold { border-right: 4px solid #f0b429; }
    .card-blue { border-right: 4px solid #3b82f6; }
    .card-red { border-right: 4px solid #ef4444; }
    .stat-label { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px; }
    .stat-value { font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace; color: #1a1a2e; }
    .checklist { list-style: none; margin-top: 4px; }
    .checklist li { padding: 2px 0; font-size: 12px; display: flex; align-items: center; gap: 6px; }
    .checked { color: #10b981; }
    .unchecked { color: #ccc; }
    .note-text { white-space: pre-wrap; font-size: 12px; color: #333; background: #fafafa; border-right: 3px solid #f0b429; padding: 10px 14px; border-radius: 4px; line-height: 1.8; }
    .diary-list { border-top: 1px solid #eee; }
    .diary-entry { border-bottom: 1px solid #f0f0f0; padding: 10px 0; }
    .diary-date { font-size: 10px; color: #aaa; font-family: monospace; margin-bottom: 4px; }
    .diary-text { font-size: 12px; color: #333; line-height: 1.8; }
    .hashtag { color: #f0b429; font-weight: 600; }
    .tag { display: inline-block; background: #f0b42915; color: #c8880a; border: 1px solid #f0b42940; border-radius: 20px; padding: 2px 10px; font-size: 12px; margin-left: 4px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    .data-table th { background: #f5f5f5; padding: 4px 10px; text-align: right; font-weight: 600; color: #555; border-bottom: 1px solid #e0e0e0; }
    .data-table td { padding: 4px 10px; border-bottom: 1px solid #f0f0f0; }
    .page-break { page-break-before: always; }
    @media print { body { padding: 12px 16px; font-size: 11px; } h2 { font-size: 12px; } .stat-value { font-size: 15px; } }
  </style>
</head>
<body>

  <div class="report-header">
    <div>
      <div class="ticker">${stock.ticker}</div>
      <div class="company-name">${stock.company || ''}</div>
      <div class="meta">${[stock.sector, stock.addedDate ? 'أضيف ' + new Date(stock.addedDate).toLocaleDateString('ar-SA') : ''].filter(Boolean).join(' · ')}</div>
      <div class="badges">
        <span class="badge">${STATUS_LABELS[stock.status] || stock.status}</span>
        ${stock.sentiment ? `<span style="font-size:14px;">${SENTIMENT_LABELS[stock.sentiment] || ''}</span>` : ''}
        ${stock.discoveredFrom ? `<span style="font-size:11px; color:#888;">المصدر: ${stock.discoveredFrom}</span>` : ''}
        ${linkedStrats.map((s) => `<span class="tag">${s.icon || ''} ${s.name}</span>`).join('')}
      </div>
    </div>
    <div class="readiness-circle">
      <div class="readiness-num">${stock.readiness ?? 0}%</div>
      <div class="readiness-label">الجاهزية</div>
      <div class="report-date">${new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  </div>

  ${tradeSection}
  ${planSection}
  ${checklistSection}
  ${notesSection}
  ${diarySection}
  ${attSection}

  <div style="margin-top:40px; border-top:1px solid #eee; padding-top:10px; font-size:10px; color:#bbb; text-align:center;">
    Minervini Trading Journal · ${stock.ticker} · ${new Date().toLocaleDateString('ar-SA')}
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`;

  return html;
}

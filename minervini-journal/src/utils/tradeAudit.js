const FIELD_LABELS = {
  ticker: 'الرمز',
  company: 'الشركة',
  setup: 'Setup',
  strategy: 'الاستراتيجية',
  entryPrice: 'سعر الدخول',
  stopLoss: 'وقف الخسارة',
  target: 'الهدف',
  shares: 'الأسهم',
  closePrice: 'سعر الخروج',
  closeDate: 'تاريخ الخروج',
  entryDate: 'تاريخ الدخول',
  entryNote: 'ملاحظة الدخول',
  closeNote: 'ملاحظات الخروج',
  grade: 'الدرجة',
};

const EDIT_FIELDS = ['ticker', 'company', 'setup', 'strategy', 'entryPrice', 'stopLoss', 'target', 'shares', 'closePrice', 'closeDate', 'entryDate', 'entryNote', 'closeNote', 'grade'];

export function pickEditFields(trade) {
  if (!trade) return {};
  const o = {};
  EDIT_FIELDS.forEach((k) => { if (trade[k] !== undefined) o[k] = trade[k]; });
  return o;
}

export function getEditDiff(before, after) {
  const changes = [];
  for (const key of EDIT_FIELDS) {
    const b = before[key];
    const a = after[key];
    if (b === a) continue;
    if (b == null && a == null) continue;
    const label = FIELD_LABELS[key] || key;
    const beforeStr = b != null ? (typeof b === 'number' ? (Number.isInteger(b) ? b : b.toFixed(2)) : String(b).slice(0, 50)) : '—';
    const afterStr = a != null ? (typeof a === 'number' ? (Number.isInteger(a) ? a : a.toFixed(2)) : String(a).slice(0, 50)) : '—';
    changes.push({ field: label, before: beforeStr, after: afterStr });
  }
  return changes;
}

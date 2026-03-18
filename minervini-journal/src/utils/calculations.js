export const calcRR = (entry, stop, target) => {
  const risk = entry - stop;
  const reward = target - entry;
  if (risk <= 0) return 0;
  return parseFloat((reward / risk).toFixed(2));
};

/** R:R from resistance percentage (no price target). rr = resistancePct / riskPct */
export const calcRRFromResistance = (trigger, stop, resistancePct) => {
  if (!trigger || trigger <= 0 || resistancePct == null) return 0;
  const riskPct = stop < trigger ? ((trigger - stop) / trigger) * 100 : 0;
  if (riskPct <= 0) return 0;
  return parseFloat((Number(resistancePct) / riskPct).toFixed(2));
};

/** R:R from resistance price. rr = (resistancePrice - trigger) / (trigger - stop), rounded to 1 decimal */
export const calcRRFromResistancePrice = (trigger, stop, resistancePrice) => {
  if (trigger <= 0 || stop >= trigger || resistancePrice == null) return null;
  const risk = trigger - stop;
  if (risk <= 0) return null;
  const reward = resistancePrice - trigger;
  return parseFloat((reward / risk).toFixed(1));
};

/** Risk % from trigger and stop */
export const calcRiskPctFromTriggerStop = (trigger, stop) => {
  if (!trigger || trigger <= 0 || stop >= trigger) return 0;
  return parseFloat((((trigger - stop) / trigger) * 100).toFixed(2));
};

export const calcShares = (portfolioSize, riskPct, entry, stop) => {
  const riskAmount = portfolioSize * (riskPct / 100);
  const riskPerShare = entry - stop;
  if (riskPerShare <= 0) return 0;
  return Math.floor(riskAmount / riskPerShare);
};

/** Risk amount in dollars: portfolioSize × (riskPct / 100) */
export const calcRiskAmount = (portfolioSize, riskPct) => {
  if (!portfolioSize || riskPct == null) return 0;
  return portfolioSize * (riskPct / 100);
};

export const calcPositionValue = (shares, price) => shares * price;

export const calcRMultiple = (entry, exit, stop) => {
  const riskPerShare = entry - stop;
  if (riskPerShare <= 0) return 0;
  return parseFloat(((exit - entry) / riskPerShare).toFixed(2));
};

/** تنسيق قيمة R للعرض: منزلتان عشريتان، حد أقصى ±999 لتجنب أرقام طويلة */
export function formatR(n) {
  if (n == null || n === undefined || Number.isNaN(n) || !Number.isFinite(n)) return '—';
  const num = Number(n);
  if (num > 999) return '>999R';
  if (num < -999) return '<-999R';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}R`;
}

/** تنسيق R مختصر للرسوم والتسميات (منزلة واحدة، حد ±999) */
export function formatRShort(n) {
  if (n == null || n === undefined || Number.isNaN(n) || !Number.isFinite(n)) return '';
  const num = Number(n);
  if (num > 999) return '>999';
  if (num < -999) return '<-999';
  return (num >= 0 ? '+' : '') + num.toFixed(1);
}

export const calcSlippage = (planned, actual) => {
  const diff = actual - planned;
  const pct = planned > 0 ? (diff / planned) * 100 : 0;
  return {
    diff: parseFloat(diff.toFixed(2)),
    pct: parseFloat(pct.toFixed(2)),
    isAcceptable: Math.abs(pct) < 0.5,
  };
};

/**
 * Smart position sizing from portfolio intelligence.
 * @param {{ pivot, stop, settings, intelligence, liveData? }} opts
 * @returns {object} shares, positionValue, warnings, etc.
 */
export function calcSmartPosition({ pivot, stop, settings, intelligence, liveData }) {
  const portfolioSize = settings?.portfolioSize ?? 0;
  const maxPositionPctRaw = settings?.maxPositionPct ?? 25;
  const maxPositionPct = maxPositionPctRaw > 1 ? maxPositionPctRaw / 100 : maxPositionPctRaw;
  const riskPerShare = pivot - stop;

  if (!portfolioSize || portfolioSize <= 0 || !riskPerShare || riskPerShare <= 0) {
    return {
      riskPct: 0,
      riskAmount: 0,
      riskPerShare: riskPerShare || 0,
      shares: 0,
      positionValue: 0,
      positionPct: 0,
      historicalTarget: pivot,
      rrWithTarget: 0,
      portfolioRiskAfter: intelligence?.committedRiskPct ?? 0,
      warnings: [{ type: 'error', msg: 'أدخل حجم المحفظة أو تحقق من Pivot و Stop' }],
      adjustedRiskPctUsed: 0,
      wasCapped: false,
    };
  }

  const { adjustedRiskPct, avgRR, committedRiskPct } = intelligence || {};
  const defaultRisk = settings?.defaultRiskPct != null
    ? (settings.defaultRiskPct > 1 ? settings.defaultRiskPct / 100 : settings.defaultRiskPct)
    : 0.015;
  const riskPct = adjustedRiskPct ?? defaultRisk;
  const riskAmount = portfolioSize * riskPct;

  const sharesRaw = riskAmount / riskPerShare;
  const shares = Math.floor(sharesRaw);
  const positionValue = shares * pivot;
  const positionPct = positionValue / portfolioSize;

  const cappedShares =
    positionPct > maxPositionPct
      ? Math.floor((portfolioSize * maxPositionPct) / pivot)
      : shares;
  const cappedPosition = cappedShares * pivot;
  const cappedPct = cappedPosition / portfolioSize;
  const actualRisk = cappedShares * riskPerShare;
  const actualRiskPct = actualRisk / portfolioSize;

  const historicalTarget = pivot + (avgRR ?? 2) * riskPerShare;
  const rrWithTarget = (historicalTarget - pivot) / riskPerShare;
  const portfolioRiskAfter = (committedRiskPct ?? 0) + actualRiskPct;

  const warnings = [];
  if (rrWithTarget < 2) warnings.push({ type: 'error', msg: 'R:R أقل من 2:1 — الحد الأدنى غير مكتمل' });
  if (positionPct > maxPositionPct)
    warnings.push({
      type: 'warn',
      msg: `تم تحديد المركز عند ${(maxPositionPct * 100).toFixed(0)}% (الحد الأقصى)`,
    });
  if (portfolioRiskAfter > 0.08)
    warnings.push({ type: 'error', msg: 'خطر: المحفظة ستتعرض لمخاطر عالية جداً' });
  else if (portfolioRiskAfter > 0.06)
    warnings.push({ type: 'warn', msg: 'إجمالي مخاطر المحفظة سيتجاوز 6%' });
  if (intelligence?.consecutiveLosses >= 3)
    warnings.push({
      type: 'warn',
      msg: `${intelligence.consecutiveLosses} خسائر متتالية — حجم المركز مخفّض تلقائياً`,
    });

  return {
    riskPct: actualRiskPct,
    riskAmount: actualRisk,
    riskPerShare,
    shares: cappedShares,
    positionValue: cappedPosition,
    positionPct: cappedPct,
    historicalTarget,
    rrWithTarget,
    portfolioRiskAfter,
    warnings,
    adjustedRiskPctUsed: riskPct,
    wasCapped: positionPct > maxPositionPct,
  };
}

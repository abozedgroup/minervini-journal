const PREFIX = 'mj_';

export const createId = () =>
  's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

export const defaultPhases = {
  trend: {
    label: 'الاتجاه',
    items: [
      'السعر فوق المتوسط 200',
      'المتوسط 200 في اتجاه صاعد',
      'المتوسط 50 فوق 150 و 200',
      'السعر فوق المتوسط 50',
      'RS Rating مناسب (≥70)',
    ],
    checks: [false, false, false, false, false],
  },
  pattern: {
    label: 'النموذج',
    items: [
      'النموذج المحدد واضح',
      'Volume Dry-Up مكتمل',
      'التضيقات واضحة',
      'المقاومة محددة بدقة',
      'الوقت الكافي للتكوين',
    ],
    checks: [false, false, false, false, false],
  },
  entry: {
    label: 'الدخول',
    items: [
      'الاختراق بحجم 2x+',
      'السوق العام داعم',
      'الوقت مناسب (أول ساعة)',
      'لا إعلانات أرباح قريبة',
      'حجم المركز محسوب',
    ],
    checks: [false, false, false, false, false],
  },
  exit: {
    label: 'الخروج',
    items: [
      'Stop Loss محرك لنقطة التعادل بعد +1R',
      'خروج جزئي 33% عند +2R',
      'أغلق تحت EMA 21 بحجم مرتفع',
      'تراجع 10% من أعلى سعر (Peak Drop)',
      'أغلق قبل إعلان الأرباح بيومين',
    ],
    checks: [false, false, false, false, false],
  },
};

export const defaultNotes = () => ({
  chart: null,
  financial: null,
  daily: null,
  sources: null,
});

/** Default exit conditions (behavioral — plan phase) */
export const defaultExitConditions = () => ({
  ema21Break: true,
  volumeSell: true,
  pctFromPeak: 10,
  earningsGuard: 14,
  stopHit: true,
  customCondition: null,
});

/** Default plan (Phase 2) — inputs + computed + behavioral exit conditions */
export const defaultPlan = () => ({
  pivot: null,
  stop: null,
  resistance: null,
  rrManual: null,
  rrMode: 'resistance',
  riskPct: null,
  notes: null,
  riskPerShare: null,
  shares: null,
  positionValue: null,
  positionPct: null,
  riskUSD: null,
  riskPctUsed: null,
  marketCondition: null,
  target2R: null,
  targetAvgR: null,
  target3R: null,
  rrRatio: null,
  exitConditions: defaultExitConditions(),
  plannedDate: null,
});

/** Default trade (Phase 3) */
export const defaultTrade = () => ({
  entryPrice: null,
  entryDate: null,
  sharesActual: null,
  slippage: null,
  slippagePct: null,
  slippageUSD: null,
  actualRisk: null,
  actualRiskPct: null,
  originalStop: null,
  currentStop: null,
  stopHistory: [],
  partialExits: [],
  remainingShares: null,
  highWaterMark: null,
  lastKnownPrice: null,
  pyramid: { enabled: false, stages: [] },
  dailyNotes: [],
});

/** Default close (Phase 4) — behavioral exits */
export const defaultClose = () => ({
  closePrice: null,
  closeDate: null,
  closeReason: null,
  sharesExited: null,
  exitReason: null,
  exitTriggerDetail: null,
  finalR: null,
  pnlUSD: null,
  pnlPct: null,
  grade: null,
  gradeReasons: [],
  lessons: null,
  notes: '',
});

/** Default watch (Phase 1 — hybrid schema) */
export const defaultWatch = () => ({
  reason: null,
  sepaScore: null,
  chartNote: null,
  chartImage: null,
  tags: [],
  sentiment: null,
  discoveredFrom: null,
  attachments: [],
});

/** Auto-grade closed trade: A/B/C/D + reasons */
export function autoGrade(stock) {
  const r = stock.close?.finalR ?? 0;
  const reason = stock.close?.exitReason;
  const slippage = stock.trade?.slippagePct != null ? stock.trade.slippagePct / 100 : 0;
  let grade = 'C';
  const reasons = [];

  if (r >= 3) {
    grade = 'A';
    reasons.push('ربح ممتاز +3R');
  } else if (r >= 2) {
    grade = 'A';
    reasons.push('ربح جيد +2R');
  } else if (r >= 1) {
    grade = 'B';
    reasons.push('ربح معقول');
  } else if (r >= 0) {
    grade = 'C';
    reasons.push('ربح بسيط');
  } else if (r > -1) {
    grade = 'C';
    reasons.push('خسارة جزئية');
  } else {
    grade = 'D';
    reasons.push('خسارة كاملة');
  }

  if (reason && reason !== 'stop_hit') reasons.push('خروج سلوكي صحيح ✅');
  if (slippage > 0.03) reasons.push('⚠️ دخول متأخر');
  if (reason === 'target_reached') reasons.push('وصل الهدف 🎯');

  return { grade, gradeReasons: reasons };
}

/** Single stock object — one source of truth for all phases */
export const defaultStock = () => ({
  id: createId(),
  ticker: '',
  name: '',
  company: '',
  sector: '',
  addedDate: new Date().toISOString(),
  status: 'watching',
  style: 'both',
  stars: 2,
  notes: defaultNotes(),
  phases: JSON.parse(JSON.stringify(defaultPhases)),
  strategies: [],
  readiness: 0,
  sentiment: null,
  discoveredFrom: null,
  attachments: [],
  diary: [],
  watch: defaultWatch(),
  plan: defaultPlan(),
  trade: defaultTrade(),
  close: defaultClose(),
});

/** Settings key: mj_{username}_settings. Load via loadData(username, 'settings', defaultSettings()). */
export const defaultSettings = () => ({
  portfolioSize: 0,
  defaultRiskPct: 1.5,
  maxPositionPct: 25,
  maxTotalRiskPct: 6,
  updatedAt: null,
});

/** Run on every watchlist load to migrate items to new structure */
export const migrateStock = (stock) => {
  const hasNewPhases =
    stock.phases?.trend?.items && Array.isArray(stock.phases.trend.items);
  const rawPhases = hasNewPhases
    ? stock.phases
    : JSON.parse(JSON.stringify(defaultPhases));
  // Ensure exit phase exists for older stocks
  const phases = rawPhases.exit
    ? rawPhases
    : { ...rawPhases, exit: JSON.parse(JSON.stringify(defaultPhases.exit)) };
  const notes =
    stock.notes && typeof stock.notes === 'object'
      ? {
          chart: stock.notes?.chart ?? null,
          financial: stock.notes?.financial ?? null,
          daily: stock.notes?.daily ?? null,
          sources: stock.notes?.sources ?? null,
        }
      : defaultNotes();
  const plan = stock.plan
    ? {
        ...defaultPlan(),
        pivot: stock.plan?.pivot ?? stock.trigger ?? null,
        stop: stock.plan?.stop ?? stock.stop ?? null,
        resistance: stock.plan?.resistance ?? stock.resistancePrice ?? null,
        rrManual: stock.plan?.rrManual ?? stock.plan?.rr ?? null,
        rrMode: stock.plan?.rrMode ?? 'resistance',
        riskPct: stock.plan?.riskPct ?? stock.riskPct ?? null,
        exitConditions: stock.plan?.exitConditions
          ? { ...defaultExitConditions(), ...stock.plan.exitConditions }
          : defaultExitConditions(),
        ...stock.plan,
      }
    : {
        ...defaultPlan(),
        pivot: stock.trigger ?? null,
        stop: stock.stop ?? null,
        resistance: stock.resistancePrice ?? null,
        rrManual: stock.rrManual ?? null,
        riskPct: stock.riskPct ?? null,
      };
  const trade = stock.trade
    ? {
        ...defaultTrade(),
        ...stock.trade,
        entryPrice: stock.trade?.entryPrice ?? null,
        entryDate: stock.trade?.entryDate ?? null,
        sharesActual:
          stock.trade?.sharesActual ?? stock.trade?.shares ?? null,
        originalStop: stock.trade?.originalStop ?? stock.plan?.stop ?? stock.trade?.stopLoss ?? null,
        currentStop:
          stock.trade?.currentStop ?? stock.trade?.stopLoss ?? stock.plan?.stop ?? null,
        stopHistory: stock.trade?.stopHistory ?? [],
        partialExits: stock.trade?.partialExits ?? [],
        remainingShares:
          stock.trade?.remainingShares ?? stock.trade?.shares ?? stock.trade?.sharesActual ?? null,
        dailyNotes: stock.trade?.dailyNotes ?? [],
        pyramid: stock.trade?.pyramid ?? defaultTrade().pyramid,
      }
    : defaultTrade();
  const close = stock.close
    ? { ...defaultClose(), ...stock.close }
    : stock.status === 'closed' && stock.trade
    ? {
        ...defaultClose(),
        closePrice: stock.trade?.closePrice ?? null,
        closeDate: stock.trade?.closeDate ?? null,
        closeReason: stock.trade?.closeReason ?? null,
        exitReason: stock.trade?.closeReason ?? null,
        finalR: stock.trade?.finalR ?? stock.trade?.rMultiple ?? null,
        grade: stock.trade?.grade ?? null,
        notes: stock.trade?.closeNote ?? '',
      }
    : defaultClose();
  const watch = stock.watch && typeof stock.watch === 'object'
    ? { ...defaultWatch(), ...stock.watch }
    : defaultWatch();
  return {
    ...stock,
    name: stock.name ?? stock.company ?? '',
    company: stock.company ?? stock.name ?? '',
    style: stock.style ?? 'both',
    stars: stock.stars ?? 2,
    watch,
    strategies: stock.strategies || [stock.strategy].filter(Boolean),
    notes,
    phases,
    status: stock.status || 'watching',
    readiness: stock.readiness ?? 0,
    diary: Array.isArray(stock.diary) ? stock.diary : [],
    plan,
    trade,
    close,
  };
};

export const saveUser = (username, data) =>
  localStorage.setItem(PREFIX + 'user_' + username, JSON.stringify(data));

export const loadUser = (username) => {
  const d = localStorage.getItem(PREFIX + 'user_' + username);
  if (!d) return null;
  try {
    return JSON.parse(d);
  } catch {
    return null;
  }
};

export const setCurrentUser = (username) =>
  localStorage.setItem(PREFIX + 'current', username);

export const getCurrentUser = () =>
  localStorage.getItem(PREFIX + 'current');

export const clearCurrentUser = () =>
  localStorage.removeItem(PREFIX + 'current');

export const saveData = (username, key, data) => {
  if (data === undefined) return;
  localStorage.setItem(PREFIX + username + '_' + key, JSON.stringify(data));
};

export const loadData = (username, key, fallback = []) => {
  const d = localStorage.getItem(PREFIX + username + '_' + key);
  if (!d) return fallback;
  try {
    return JSON.parse(d);
  } catch {
    return fallback;
  }
};

/** Load watchlist with migration applied on every load */
export const loadWatchlist = (username) => {
  const raw = loadData(username, 'watchlist', []) || [];
  return raw.map(migrateStock);
};

/** All stocks for portfolio intelligence. No args = use current user. */
export const getAllStocks = (username) => {
  const u = username ?? getCurrentUser();
  return u ? loadWatchlist(u) : [];
};

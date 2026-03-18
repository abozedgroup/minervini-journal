/**
 * Smart hints for open positions — based on current R, targets, and price action.
 * Each hint: { type, priority, icon, message, action }
 * type: 'success' | 'warning' | 'danger' | 'info'
 * priority: 1 (highest) → 5 (lowest) — show top 3 only
 */

export function generateHints({
  currentR,
  currentPrice,
  entry,
  currentStop,
  originalStop,
  target2R,
  target3R,
  userTarget,
  shares,
  unrealizedPnL,
  isProtected,
  daysSinceEntry,
  changePct,
  volume_ratio,
}) {
  const hints = [];

  if (currentR <= -0.7 && currentR > -1) {
    hints.push({
      type: 'danger',
      priority: 1,
      icon: '🚨',
      message: `اقتربت من وقف الخسارة — ${(Math.abs(currentR) * 100).toFixed(0)}% من الخسارة الكاملة`,
      action: 'راجع الصفقة الآن — هل لا تزال الفكرة صحيحة؟',
    });
  }

  if (changePct != null && changePct <= -3) {
    hints.push({
      type: 'danger',
      priority: 1,
      icon: '📉',
      message: `انخفاض حاد ${Number(changePct).toFixed(1)}% اليوم`,
      action: 'راقب الحجم — هل هناك بيع مؤسسي؟',
    });
  }

  if (volume_ratio > 2 && changePct != null && changePct < 0) {
    hints.push({
      type: 'danger',
      priority: 1,
      icon: '🚨',
      message: 'بيع بحجم ضعف المعتاد — انتبه',
      action: 'راقب — قد يكون ضغط بيع قوي',
    });
  }

  if (volume_ratio > 2 && changePct != null && changePct > 0) {
    hints.push({
      type: 'success',
      priority: 3,
      icon: '💪',
      message: 'صعود بحجم قوي — اتجاه قوي',
      action: 'الحجم يؤيد الحركة',
    });
  }

  if (currentR > 0 && currentR < 1 && !isProtected && daysSinceEntry > 10) {
    hints.push({
      type: 'warning',
      priority: 2,
      icon: '⏳',
      message: `الصفقة عمرها ${daysSinceEntry} يوم بدون تقدم كافٍ`,
      action: 'فكر في الخروج — رأس المال يمكن استغلاله بفرصة أفضل',
    });
  }

  if (!isProtected && currentR > 1) {
    const suggestedStop = entry + 0.5 * (entry - (originalStop || currentStop));
    hints.push({
      type: 'warning',
      priority: 2,
      icon: '⚡',
      message: `الوقف لم يُحرَّك رغم +${Number(currentR).toFixed(1)}R ربح`,
      action: `ارفع الوقف إلى ${suggestedStop.toFixed(2)} على الأقل`,
    });
  }

  if (currentR >= 1 && !isProtected) {
    hints.push({
      type: 'success',
      priority: 3,
      icon: '🛡️',
      message: `وصلت +${Number(currentR).toFixed(1)}R — حان وقت حماية الصفقة`,
      action: `ارفع الوقف إلى نقطة التعادل: $${Number(entry).toFixed(2)}`,
    });
  }

  if (currentR >= 2 && currentStop < entry) {
    hints.push({
      type: 'success',
      priority: 2,
      icon: '✅',
      message: `+${Number(currentR).toFixed(1)}R — الوقف يجب أن يكون فوق سعر الدخول`,
      action: `ارفع الوقف إلى $${(entry * 1.01).toFixed(2)} للحد الأدنى`,
    });
  }

  if (target2R > 0 && currentPrice > 0 && Math.abs(currentPrice - target2R) / target2R < 0.015) {
    hints.push({
      type: 'info',
      priority: 3,
      icon: '🎯',
      message: `على بُعد 1.5% من هدف 2R ($${Number(target2R).toFixed(2)})`,
      action: 'هل تريد تثبيت جزء من الأرباح؟',
    });
  }

  if (userTarget > 0 && currentPrice > 0 && Math.abs(currentPrice - userTarget) / userTarget < 0.02) {
    hints.push({
      type: 'success',
      priority: 2,
      icon: '🏆',
      message: `اقتربت من هدفك ($${Number(userTarget).toFixed(2)})`,
      action: 'فكر في أخذ 50-75% من المركز هنا',
    });
  }

  if (currentR >= 3) {
    hints.push({
      type: 'success',
      priority: 3,
      icon: '🔥',
      message: `+${Number(currentR).toFixed(1)}R — صفقة استثنائية!`,
      action: 'ثبّت جزءاً وابقِ بالباقي — دع الأرباح تجري',
    });
  }

  if (isProtected && currentR > 0 && entry != null && currentStop != null && shares > 0) {
    const locked = Math.abs((currentStop - entry) * shares);
    hints.push({
      type: 'info',
      priority: 4,
      icon: '🔒',
      message: 'الصفقة محمية — الوقف فوق سعر الدخول',
      action: `ربح مضمون: $${locked.toFixed(0)} على الأقل`,
    });
  }

  return hints.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

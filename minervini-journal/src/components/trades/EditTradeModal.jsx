import { useState } from 'react';
import { calcRMultiple, formatR } from '../../utils/calculations';
import { pickEditFields } from '../../utils/tradeAudit';
import Modal from '../ui/Modal';

export default function EditTradeModal({ trade, username, onSave, onClose }) {
  const isClosed = trade?.status === 'closed';
  const [form, setForm] = useState({
    ticker: trade?.ticker || '',
    company: trade?.company || '',
    setup: trade?.setup || 'Minervini Core',
    strategy: trade?.strategy || 'Minervini Core',
    entryPrice: trade?.entryPrice ?? '',
    stopLoss: trade?.currentStop ?? trade?.stopLoss ?? '',       // يقرأ currentStop أولاً
    target: trade?.target ?? '',
    shares: trade?.sharesActual ?? trade?.shares ?? '',          // يقرأ sharesActual أولاً
    closePrice: trade?.closePrice ?? '',
    closeDate: trade?.closeDate ? trade.closeDate.slice(0, 10) : '',
    entryDate: trade?.entryDate ? trade.entryDate.slice(0, 10) : '',
    entryNote: trade?.entryNote || '',
    closeNote: trade?.closeNote || '',
    grade: trade?.grade || '',
    editReason: '',
  });
  const [reasonError, setReasonError] = useState(false);

  const entry = parseFloat(form.entryPrice) || 0;
  const exit = parseFloat(form.closePrice) || 0;
  const stop = parseFloat(form.stopLoss) || 0;
  const rMultiple = isClosed && entry && exit && stop ? calcRMultiple(entry, exit, stop) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const reason = (form.editReason || '').trim();
    if (!reason) {
      setReasonError(true);
      return;
    }
    setReasonError(false);
    const before = { ...trade };
    const updated = {
      ...trade,
      ticker: (form.ticker || '').toUpperCase().trim(),
      company: (form.company || '').trim() || (form.ticker || '').toUpperCase().trim(),
      setup: form.setup || '',
      strategy: form.strategy || '',
      entryPrice: entry,
      currentStop: stop,                                          // يحفظ في currentStop
      stopLoss: stop,                                             // للتوافق مع الكود القديم
      // قواعد تحديث originalStop:
      // 1) إذا كان originalStop = 0 أو غير معيّن (بيانات ناقصة) → حدّثه دائماً
      // 2) إذا كان الوقف الجديد أصغر من الأصلي → تصحيح خطأ إدخال، حدّث الأصلي
      // 3) إذا كان الوقف الجديد أكبر → trailing stop، احتفظ بالأصلي
      originalStop: (() => {
        const existing = trade?.originalStop ?? 0;
        if (existing <= 0) return stop;          // حالة 1: أوّل ضبط أو بيانات ناقصة
        if (stop < existing) return stop;        // حالة 2: تصحيح خطأ
        return existing;                         // حالة 3: trailing → لا تغيير
      })(),
      target: parseFloat(form.target) || trade?.target,
      sharesActual: parseInt(form.shares, 10) || 0,              // يحفظ في sharesActual
      shares: parseInt(form.shares, 10) || 0,                    // للتوافق مع الكود القديم
      entryDate: form.entryDate ? form.entryDate + 'T09:00:00.000Z' : trade?.entryDate,
      entryNote: form.entryNote || '',
    };
    if (isClosed) {
      updated.closePrice = exit;
      updated.closeDate = form.closeDate ? form.closeDate + 'T12:00:00.000Z' : trade?.closeDate;
      updated.closeNote = form.closeNote || '';
      updated.grade = form.grade || null;
      updated.rMultiple = rMultiple != null ? rMultiple : trade?.rMultiple;
    }
    updated.editHistory = Array.isArray(trade?.editHistory) ? [...trade.editHistory] : [];
    updated.editHistory.push({
      editedAt: new Date().toISOString(),
      editedBy: username || '',
      reason,
      before: pickEditFields(before),
      after: pickEditFields(updated),
    });
    onSave(updated);
  };

  return (
    <Modal open={!!trade} onClose={onClose} title="تعديل الصفقة" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-muted text-sm mb-1">الرمز</label>
            <input value={form.ticker} onChange={(e) => setForm((p) => ({ ...p, ticker: e.target.value }))} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" required />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">الشركة</label>
            <input value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="rtl" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-muted text-sm mb-1">Setup</label>
            <input value={form.setup} onChange={(e) => setForm((p) => ({ ...p, setup: e.target.value }))} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">الاستراتيجية</label>
            <input value={form.strategy} onChange={(e) => setForm((p) => ({ ...p, strategy: e.target.value }))} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-muted text-sm mb-1">سعر الدخول</label>
            <input type="number" step="0.01" value={form.entryPrice} onChange={(e) => setForm((p) => ({ ...p, entryPrice: e.target.value }))} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" required />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">وقف الخسارة</label>
            <input type="number" step="0.01" value={form.stopLoss} onChange={(e) => setForm((p) => ({ ...p, stopLoss: e.target.value }))} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" required />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">الهدف</label>
            <input type="number" step="0.01" value={form.target} onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">الأسهم</label>
            <input type="number" min="1" value={form.shares} onChange={(e) => setForm((p) => ({ ...p, shares: e.target.value }))} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-muted text-sm mb-1">تاريخ الدخول</label>
            <input type="date" value={form.entryDate} onChange={(e) => setForm((p) => ({ ...p, entryDate: e.target.value }))} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
          </div>
          {isClosed && (
            <>
              <div>
                <label className="block text-muted text-sm mb-1">سعر الخروج</label>
                <input type="number" step="0.01" value={form.closePrice} onChange={(e) => setForm((p) => ({ ...p, closePrice: e.target.value }))} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
              </div>
              <div>
                <label className="block text-muted text-sm mb-1">تاريخ الخروج</label>
                <input type="date" value={form.closeDate} onChange={(e) => setForm((p) => ({ ...p, closeDate: e.target.value }))} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
              </div>
            </>
          )}
        </div>
        <div>
          <label className="block text-muted text-sm mb-1">ملاحظة الدخول</label>
          <textarea value={form.entryNote} onChange={(e) => setForm((p) => ({ ...p, entryNote: e.target.value }))} rows={2} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="rtl" />
        </div>
        {isClosed && (
          <>
            <div>
              <label className="block text-muted text-sm mb-1">ملاحظات الخروج</label>
              <textarea value={form.closeNote} onChange={(e) => setForm((p) => ({ ...p, closeNote: e.target.value }))} rows={2} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="rtl" />
            </div>
            <div>
              <label className="block text-muted text-sm mb-2">الدرجة</label>
              <div className="flex gap-2">
                {['A', 'B', 'C'].map((g) => (
                  <button key={g} type="button" onClick={() => setForm((p) => ({ ...p, grade: g }))} className={`px-4 py-2 rounded-lg border font-bold ${form.grade === g ? 'bg-gold text-black border-gold' : 'border-border text-muted hover:bg-s2'}`}>{g}</button>
                ))}
              </div>
            </div>
            {rMultiple != null && (
              <div className="bg-s2 rounded-lg p-3">
                <span className="text-muted text-sm">R-Multiple (محسوب): </span>
                <span className={`font-mono font-medium ${rMultiple >= 0 ? 'text-teal' : 'text-red'}`}>{formatR(rMultiple)}</span>
              </div>
            )}
          </>
        )}
        <div>
          <label className="block text-muted text-sm mb-1">سبب التعديل <span className="text-red">*</span></label>
          <input value={form.editReason} onChange={(e) => { setForm((p) => ({ ...p, editReason: e.target.value })); setReasonError(false); }} className={`w-full bg-s2 border rounded-lg px-3 py-2 text-fg ${reasonError ? 'border-red' : 'border-border'}`} placeholder="مثال: خطأ في سعر الدخول / تصحيح عدد الأسهم..." dir="rtl" required />
          {reasonError && <p className="text-red text-sm mt-1">أدخل سبب التعديل</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-fg hover:bg-s2">إلغاء</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-gold text-black font-bold">حفظ</button>
        </div>
      </form>
    </Modal>
  );
}

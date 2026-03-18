import { useState } from 'react';
import Modal from '../ui/Modal';
import { formatR } from '../../utils/calculations';

export default function DeleteTradeModal({ trade, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);

  const handleConfirm = (e) => {
    e.preventDefault();
    const r = (reason || '').trim();
    if (!r) {
      setError(true);
      return;
    }
    setError(false);
    onConfirm(r);
  };

  return (
    <Modal open={!!trade} onClose={onClose} title="حذف الصفقة" size="md">
      <div className="space-y-4">
        <div className="bg-s2 rounded-lg p-3">
          <p className="text-fg font-medium">{trade?.ticker} — {trade?.entryDate ? new Date(trade.entryDate).toLocaleDateString('ar-SA') : '—'}</p>
          <p className="text-muted text-sm mt-1">R-Multiple: {trade?.status === 'closed' && trade?.rMultiple != null ? formatR(trade.rMultiple) : '—'}</p>
        </div>
        <p className="text-red font-medium">⚠️ هذا الإجراء لا يمكن التراجع عنه</p>
        <form onSubmit={handleConfirm}>
          <label className="block text-muted text-sm mb-1">سبب الحذف <span className="text-red">*</span></label>
          <input value={reason} onChange={(e) => { setReason(e.target.value); setError(false); }} className={`w-full bg-s2 border rounded-lg px-3 py-2 text-fg ${error ? 'border-red' : 'border-border'}`} placeholder="مثال: صفقة مكررة / خطأ في الإدخال..." dir="rtl" required />
          {error && <p className="text-red text-sm mt-1">أدخل سبب الحذف</p>}
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-fg hover:bg-s2">إلغاء</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-red text-white font-bold hover:bg-red/90">🗑 تأكيد الحذف</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

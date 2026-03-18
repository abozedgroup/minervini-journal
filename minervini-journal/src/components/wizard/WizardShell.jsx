/**
 * WizardShell — حاوية Wizard قابلة لإعادة الاستخدام (RTL)
 *
 * Props:
 *   steps        StepConfig[]  — [{ id, title, subtitle, icon }]
 *   currentStep  number        — 0-based، تديره المكوّن الأب
 *   onNext       () => void
 *   onBack       () => void
 *   onConfirm    () => void    — يُستدعى فقط في الخطوة الأخيرة
 *   canNext      boolean       — تفعيل/تعطيل زر "التالي"
 *   confirmLabel string?       — افتراضي "تأكيد ✓"
 *   children     ReactNode     — محتوى الخطوة الحالية
 */
export default function WizardShell({
  steps,
  currentStep,
  onNext,
  onBack,
  onConfirm,
  canNext = true,
  confirmLabel = 'تأكيد ✓',
  children,
}) {
  const total      = steps.length;
  const isFirst    = currentStep === 0;
  const isLast     = currentStep === total - 1;

  return (
    <div className="flex flex-col gap-5" dir="rtl">

      {/* ── Progress Bar ─────────────────────────────────── */}
      <div className="flex items-center justify-center gap-0">
        {steps.map((step, idx) => {
          const done    = idx < currentStep;
          const active  = idx === currentStep;
          const future  = idx > currentStep;

          return (
            <div key={step.id} className="flex items-center">
              {/* Step node */}
              <div className="flex flex-col items-center gap-1">
                {/* Circle */}
                <div className={`
                  w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all duration-300
                  ${done   ? 'bg-[#f0b429] text-black'       : ''}
                  ${active ? 'bg-[#06d6a0] text-black ring-2 ring-[#06d6a0]/40' : ''}
                  ${future ? 'bg-[#1e2438] text-gray-500'    : ''}
                `}>
                  {done ? '✓' : active ? step.icon : <span className="text-xs">{idx + 1}</span>}
                </div>
                {/* Label */}
                <div className={`text-center max-w-[70px] transition-colors duration-200 ${
                  active  ? 'text-[#06d6a0] font-semibold text-xs'
                  : done  ? 'text-[#f0b429] text-xs'
                  : 'text-gray-600 text-xs'
                }`}>
                  {step.title}
                </div>
              </div>

              {/* Connector line (not after last step) */}
              {idx < total - 1 && (
                <div className={`
                  h-px w-12 sm:w-16 mx-1 mb-5 transition-colors duration-300
                  ${idx < currentStep ? 'bg-[#f0b429]' : 'bg-[#1e2438]'}
                `} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Subtitle for current step ─────────────────────── */}
      <p className="text-center text-sm text-gray-400 -mt-1">
        {steps[currentStep]?.subtitle}
      </p>

      {/* ── Step Content ─────────────────────────────────── */}
      <div className="flex-1">
        {children}
      </div>

      {/* ── Navigation Footer ────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1e2438] gap-3">
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          disabled={isFirst}
          className={`
            flex items-center gap-1 px-4 py-2.5 rounded-lg border text-sm font-medium
            transition-colors
            ${isFirst
              ? 'border-[#1e2438] text-gray-600 cursor-not-allowed'
              : 'border-[#1e2438] text-gray-400 hover:text-white hover:border-gray-500'
            }
          `}
        >
          → رجوع
        </button>

        {/* Step counter */}
        <span className="text-xs text-gray-600">
          {currentStep + 1} / {total}
        </span>

        {/* Next / Confirm button */}
        {isLast ? (
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 bg-[#f0b429] text-black font-bold rounded-lg
                       hover:bg-[#f0b429]/90 transition-colors text-sm"
          >
            {confirmLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className={`
              flex items-center gap-1 px-5 py-2.5 rounded-lg text-sm font-bold
              transition-colors
              ${canNext
                ? 'bg-[#f0b429] text-black hover:bg-[#f0b429]/90'
                : 'bg-[#1e2438] text-gray-600 cursor-not-allowed'
              }
            `}
          >
            التالي ←
          </button>
        )}
      </div>

    </div>
  );
}

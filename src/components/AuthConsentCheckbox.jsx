const CONSENT_COPY =
  'I consent to securely share my personal information with trusted partners and allow the Bio-AI system to use my health data for personalized health insights.';

const AuthConsentCheckbox = ({ checked, onChange, error }) => (
  <div className="w-full">
    <label className="flex w-full items-center gap-[6px] cursor-pointer">
      <span
        className="flex-1 min-w-0 text-[#C4C4C4] text-[12px] font-medium tracking-[0.3px] leading-[19.5px]"
        style={{
          fontFamily: '"DM Sans", sans-serif',
          fontOpticalSizing: 'none',
          fontVariationSettings: '"opsz" 14',
        }}
      >
        {CONSENT_COPY}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-invalid={error ? 'true' : undefined}
      />
      <span
        className={`box-border shrink-0 size-5 rounded-[4px] border border-solid ${
          error ? 'border-[#E95D5C]' : 'border-[#C4C4C4]'
        } ${checked ? 'bg-[#90DF9E] border-[#90DF9E]' : 'bg-transparent'}`}
        aria-hidden="true"
      >
        {checked ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 10.2L8.2 13.4L15 6.6" stroke="#071210" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
    </label>
    {error ? (
      <p className="mt-1 text-[10px] leading-[14px] text-[#E95D5C]">{error}</p>
    ) : null}
  </div>
);

export default AuthConsentCheckbox;

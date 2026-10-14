import nextChevronIcon from '../../assets/family-history/next-chevron.svg'
import { APP_COLUMN_MAX } from './mcqLayout'

const NAV_BUTTON_CLASS =
  'flex size-[50px] items-center justify-center rounded-full border border-solid border-[#969696] p-px disabled:cursor-not-allowed disabled:opacity-40'

type QuestionnaireFooterProps = {
  onBack?: () => void
  onNext?: () => void
  backDisabled?: boolean
  nextDisabled?: boolean
  nextAriaLabel?: string
  preview?: string
  buttonGradient: string
  buttonShadowClass: string
}

export function QuestionnaireFooter({
  onBack,
  onNext,
  backDisabled = false,
  nextDisabled = false,
  nextAriaLabel = 'Next question',
  preview = '',
  buttonGradient,
  buttonShadowClass,
}: QuestionnaireFooterProps) {
  const previewText = preview.replace(/\s+/g, ' ').trim()

  return (
    <footer className="fixed inset-x-0 bottom-0 z-10 bg-[rgba(255,255,255,0.05)] backdrop-blur-[25px]">
      <div className={`mx-auto flex w-full ${APP_COLUMN_MAX} items-center justify-between p-6`}>
        {previewText ? (
          <div className="flex h-[60px] max-h-[60px] w-[180px] max-w-[180px] shrink-0 flex-col">
            <p className="font-['DM_Sans'] text-[11px] font-medium uppercase leading-[16.5px] tracking-[1.1px] text-[rgba(255,255,255,0.4)] [font-optical-sizing:none] [font-variation-settings:'opsz'_14]">
              NEXT QUESTION
            </p>
            <p className="mt-[3.5px] overflow-hidden text-ellipsis whitespace-nowrap font-['DM_Sans'] text-[14px] font-medium leading-[19.25px] text-[rgba(255,255,255,0.6)] [font-optical-sizing:none] [font-variation-settings:'opsz'_14]">
              {previewText}
            </p>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={backDisabled}
            className={`${NAV_BUTTON_CLASS} ${buttonShadowClass}`}
            style={{ backgroundImage: buttonGradient }}
            aria-label="Go back"
          >
            <img src={nextChevronIcon} alt="" className="size-6 -scale-x-100" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={`${NAV_BUTTON_CLASS} ${buttonShadowClass}`}
            style={{ backgroundImage: buttonGradient }}
            aria-label={nextAriaLabel}
          >
            <img src={nextChevronIcon} alt="" className="size-6" aria-hidden />
          </button>
        </div>
      </div>
    </footer>
  )
}

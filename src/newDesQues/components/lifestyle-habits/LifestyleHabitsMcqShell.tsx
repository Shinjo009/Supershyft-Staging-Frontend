import type { ReactNode } from 'react'
import type { LifestyleQuestionPreview } from '../../data/lifestyleHabitsQuestions'
import {
  MCQ_HEADER_CLASS,
  MCQ_SHELL_CLASS,
  MCQ_SHELL_SCROLL_CLASS,
  PAGE_GUTTER_X,
} from '../mcq/mcqLayout'
import { McqProgressBar } from '../mcq/McqProgressBar'
import { QuestionnaireFooter } from '../mcq/QuestionnaireFooter'

const NEXT_BUTTON_GRADIENT =
  "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.3'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(2.5 0 0 2.5 25 25)'><stop stop-color='rgba(255,136,0,1)' offset='0'/><stop stop-color='rgba(233,93,92,1)' offset='1'/></radialGradient></defs></svg>\")"

/** Shared Lifestyle & Habits MCQ chrome — Figma 5629:14250 */
export function LifestyleHabitsMcqShell({
  children,
  onBack,
  onNext,
  nextQuestionPreview,
  progressPercent = 10,
  isLastQuestion = false,
}: {
  children: ReactNode
  onBack?: () => void
  onNext?: () => void
  nextQuestionPreview: LifestyleQuestionPreview
  progressPercent?: number
  isLastQuestion?: boolean
}) {
  const clampedPercent = Math.min(100, Math.max(0, progressPercent))

  return (
    <div className={MCQ_SHELL_CLASS}>
      <header className={MCQ_HEADER_CLASS}>
        <h1 className="shrink-0 whitespace-nowrap text-[19px] tracking-[0.095px] text-white">
          Lifestyle & Habits
        </h1>
      </header>

      <div className="flex shrink-0 flex-col gap-2 px-[16px] py-1">
        <div className="flex w-full items-center justify-end">
          <p className="text-right text-[11px] font-normal uppercase tracking-[0.3px] text-[#8e8ca3] leading-[13.5px]">
            {clampedPercent}% COMPLETED
          </p>
        </div>
        <McqProgressBar percent={clampedPercent} color="#FF8800" />
      </div>

      <div className={MCQ_SHELL_SCROLL_CLASS}>
        <div className={PAGE_GUTTER_X}>{children}</div>
      </div>

      <QuestionnaireFooter
        onBack={onBack}
        onNext={onNext}
        nextAriaLabel={isLastQuestion ? 'Continue' : 'Next question'}
        preview={
          isLastQuestion
            ? ''
            : [nextQuestionPreview.line1, nextQuestionPreview.line2].filter(Boolean).join(' ')
        }
        buttonGradient={NEXT_BUTTON_GRADIENT}
        buttonShadowClass="shadow-[0_8px_32px_0_rgba(255,136,0,0.25)]"
      />
    </div>
  )
}

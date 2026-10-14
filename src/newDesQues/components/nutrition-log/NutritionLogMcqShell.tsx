import type { ReactNode } from 'react'
import type { NutritionQuestionPreview } from '../../data/nutritionLogQuestions'
import {
  MCQ_HEADER_CLASS,
  MCQ_SHELL_CLASS,
  MCQ_SHELL_SCROLL_CLASS,
  PAGE_GUTTER_X,
} from '../mcq/mcqLayout'
import { McqProgressBar } from '../mcq/McqProgressBar'
import { QuestionnaireFooter } from '../mcq/QuestionnaireFooter'
import { NUTRITION_NEXT_BUTTON_GRADIENT } from './nutritionLogConfig'

/** Shared Nutrition Log MCQ chrome — Figma 5627:12757 */
export function NutritionLogMcqShell({
  children,
  onBack,
  onNext,
  nextQuestionPreview,
  progressPercent = 7,
  isLastQuestion = false,
}: {
  children: ReactNode
  onBack?: () => void
  onNext?: () => void
  nextQuestionPreview: NutritionQuestionPreview
  progressPercent?: number
  isLastQuestion?: boolean
}) {
  const clampedPercent = Math.min(100, Math.max(0, progressPercent))

  return (
    <div className={MCQ_SHELL_CLASS}>
      <header className={MCQ_HEADER_CLASS}>
        <h1 className="shrink-0 whitespace-nowrap text-[19px] tracking-[0.095px] text-white">
          Nutrition Log
        </h1>
      </header>

      <div className="flex shrink-0 flex-col gap-2 px-[16px] py-1">
        <div className="flex w-full items-center justify-end">
          <p className="text-right text-[11px] font-normal uppercase tracking-[0.3px] text-[#8e8ca3] leading-[13.5px]">
            {clampedPercent}% COMPLETED
          </p>
        </div>
        <McqProgressBar percent={clampedPercent} color="#3F9CFF" />
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
        buttonGradient={NUTRITION_NEXT_BUTTON_GRADIENT}
        buttonShadowClass="shadow-[0_8px_32px_0_rgba(79,172,254,0.2)]"
      />
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { QuestionnaireFooter } from './mcq/QuestionnaireFooter'
import tickCircleIcon from '../assets/family-history/tick-circle-outline.svg'
import {
  buildQuestionnaireResponses,
  getOptionLabel,
  getOptionValue,
  isMultiChoiceType,
  isSingleChoiceType,
  isTextType,
  submitQuestionnaireResponses,
  type QuestionnaireQuestion,
} from '../api/questionnaire'
import { getAccessToken } from '../lib/authStorage'
import {
  filterOutInlinedOtherQuestions,
  findOtherFollowUpForParent,
  isOtherOption,
  orderOptionsWithSelectedOtherLast,
  selectedIncludesOther,
} from '../lib/apiOtherFollowUps'
import {
  isFamilyHistoryLocationQuestion,
  isLifestyleActivityIntensityQuestion,
  isLifestyleAlcoholConsumptionQuestion,
  isLifestyleCommitmentQuestion,
  isLifestyleDailyWalkingQuestion,
  isLifestylePhysicalActivityQuestion,
  isLifestyleSitDurationQuestion,
  isLifestyleSleepDurationQuestion,
  isLifestyleSmokingFrequencyQuestion,
  isLifestyleWeeklyLeisureQuestion,
  isLifestyleWellnessPrioritiesQuestion,
  isNutritionBreakfastFrequencyQuestion,
  isNutritionCoffeeTeaIntakeQuestion,
  isNutritionCoffeeTeaTypeQuestion,
  isNutritionConsumptionFrequencyQuestion,
  isNutritionDailyFoodGroupsQuestion,
  isNutritionDietTypeQuestion,
  isNutritionExtraSaltQuestion,
  isNutritionIllnessFrequencyQuestion,
  isNutritionIodizedSaltQuestion,
  isNutritionWaterIntakeQuestion,
  nutritionMeterIdForQuestion,
} from '../lib/apiQuestionLayouts'
import { parseHelpTextToInfoItems } from '../lib/parseHelpTextToInfoItems'
import { filterFoodGroupOptionsByDiet } from '../lib/filterFoodGroupsByDiet'
import {
  filterVisibleQuestions,
  seedAnswersFromQuestions,
  type AnswerValue,
} from '../lib/questionnaireVisibility'
import { FamilyHistoryLocationOptions } from './family-history/FamilyHistoryLocationOptions'
import { LifestyleActivityIntensityQuestion } from './lifestyle-habits/LifestyleActivityIntensityQuestion'
import { LifestyleAlcoholConsumptionQuestion } from './lifestyle-habits/LifestyleAlcoholConsumptionQuestion'
import { LifestyleCommitmentQuestion } from './lifestyle-habits/LifestyleCommitmentQuestion'
import { LifestyleDailyWalkingQuestion } from './lifestyle-habits/LifestyleDailyWalkingQuestion'
import { LifestylePhysicalActivityQuestion } from './lifestyle-habits/LifestylePhysicalActivityQuestion'
import { LifestyleSitDurationQuestion } from './lifestyle-habits/LifestyleSitDurationQuestion'
import { LifestyleSleepDurationQuestion } from './lifestyle-habits/LifestyleSleepDurationQuestion'
import { LifestyleSmokingFrequencyQuestion } from './lifestyle-habits/LifestyleSmokingFrequencyQuestion'
import { LifestyleWeeklyLeisureQuestion } from './lifestyle-habits/LifestyleWeeklyLeisureQuestion'
import { LifestyleWellnessPrioritiesQuestion } from './lifestyle-habits/LifestyleWellnessPrioritiesQuestion'
import {
  NutritionApiCircularMeterQuestion,
  NutritionApiConsumptionFrequencyQuestion,
} from './nutrition-log/NutritionApiCircularMeterQuestion'
import { NutritionApiMultiSelectQuestion } from './nutrition-log/NutritionApiMultiSelectQuestion'
import { NutritionApiPillRowQuestion } from './nutrition-log/NutritionApiPillRowQuestion'
import { NutritionApiWaterIntakeQuestion } from './nutrition-log/NutritionApiWaterIntakeQuestion'
import { NutritionDietTypeQuestion } from './nutrition-log/NutritionDietTypeQuestion'
import { NUTRITION_NEXT_BUTTON_GRADIENT, NUTRITION_PILL_GRADIENT } from './nutrition-log/nutritionLogConfig'
import {
  MCQ_HEADER_CLASS,
  MCQ_PILL_BORDER_IDLE,
  MCQ_PILL_BORDER_SELECTED,
  MCQ_PILL_CHIP_CLASS,
  MCQ_SHELL_CLASS,
  MCQ_SHELL_SCROLL_CLASS,
} from './mcq/mcqLayout'
import { McqInfoOverlay } from './mcq/McqInfoOverlay'
import { McqProgressBar } from './mcq/McqProgressBar'
import { McqQuestionHeader } from './mcq/McqQuestionHeader'

const FAMILY_NEXT_BUTTON_GRADIENT =
  "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.3'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(2.5 0 0 2.5 25 25)'><stop stop-color='rgba(164,86,234,1)' offset='0'/><stop stop-color='rgba(134,69,194,1)' offset='0.25'/><stop stop-color='rgba(103,52,153,1)' offset='0.5'/><stop stop-color='rgba(73,35,113,1)' offset='0.75'/><stop stop-color='rgba(42,18,72,1)' offset='1'/></radialGradient></defs></svg>\")"

const LIFESTYLE_NEXT_BUTTON_GRADIENT =
  "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.3'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(2.5 0 0 2.5 25 25)'><stop stop-color='rgba(255,136,0,1)' offset='0'/><stop stop-color='rgba(233,93,92,1)' offset='1'/></radialGradient></defs></svg>\")"

const FAMILY_CHIP_SELECTED_GRADIENT =
  "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 155 36' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.35'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(7.75 0 0 1.8 77.5 18)'><stop stop-color='rgba(164,86,234,1)' offset='0'/><stop stop-color='rgba(134,69,194,1)' offset='0.25'/><stop stop-color='rgba(103,52,153,1)' offset='0.5'/><stop stop-color='rgba(73,35,113,1)' offset='0.75'/><stop stop-color='rgba(42,18,72,1)' offset='1'/></radialGradient></defs></svg>\")"

const LIFESTYLE_CHIP_SELECTED_GRADIENT =
  "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 155 36' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.35'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(7.75 0 0 1.8 77.5 18)'><stop stop-color='rgba(255,136,0,1)' offset='0.46635'/><stop stop-color='rgba(233,93,92,0.5)' offset='1'/></radialGradient></defs></svg>\")"

const FAMILY_OTHER_EXPANDED_GRADIENT =
  "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 296 64' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.35'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(14.8 0 0 3.2 148 32)'><stop stop-color='rgba(164,86,234,1)' offset='0'/><stop stop-color='rgba(134,69,194,1)' offset='0.25'/><stop stop-color='rgba(103,52,153,1)' offset='0.5'/><stop stop-color='rgba(73,35,113,1)' offset='0.75'/><stop stop-color='rgba(42,18,72,1)' offset='1'/></radialGradient></defs></svg>\")"

const LIFESTYLE_OTHER_EXPANDED_GRADIENT =
  "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 296 64' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.35'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(14.8 0 0 3.2 148 32)'><stop stop-color='rgba(255,136,0,1)' offset='0'/><stop stop-color='rgba(233,93,92,0.5)' offset='1'/></radialGradient></defs></svg>\")"

const NUTRITION_OTHER_EXPANDED_GRADIENT =
  "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 296 64' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.35'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(14.8 0 0 3.2 148 32)'><stop stop-color='rgba(222,245,255,1)' offset='0'/><stop stop-color='rgba(143,200,255,1)' offset='0.5'/><stop stop-color='rgba(63,156,255,1)' offset='1'/></radialGradient></defs></svg>\")"

type QuestionnaireTheme = 'family' | 'lifestyle' | 'nutrition'

const THEME_OTHER_EXPANDED_GRADIENT: Record<QuestionnaireTheme, string> = {
  family: FAMILY_OTHER_EXPANDED_GRADIENT,
  lifestyle: LIFESTYLE_OTHER_EXPANDED_GRADIENT,
  nutrition: NUTRITION_OTHER_EXPANDED_GRADIENT,
}

const THEME_PROGRESS_COLOR: Record<QuestionnaireTheme, string> = {
  family: '#9D50BB',
  lifestyle: '#FF8800',
  nutrition: '#3F9CFF',
}

const THEME_NEXT_GRADIENT: Record<QuestionnaireTheme, string> = {
  family: FAMILY_NEXT_BUTTON_GRADIENT,
  lifestyle: LIFESTYLE_NEXT_BUTTON_GRADIENT,
  nutrition: NUTRITION_NEXT_BUTTON_GRADIENT,
}

const THEME_CHIP_GRADIENT: Record<QuestionnaireTheme, string> = {
  family: FAMILY_CHIP_SELECTED_GRADIENT,
  lifestyle: LIFESTYLE_CHIP_SELECTED_GRADIENT,
  nutrition: NUTRITION_PILL_GRADIENT,
}

const THEME_NEXT_SHADOW: Record<QuestionnaireTheme, string> = {
  family: 'shadow-[0_8px_32px_0_rgba(164,86,234,0.25)]',
  lifestyle: 'shadow-[0_8px_32px_0_rgba(255,136,0,0.25)]',
  nutrition: 'shadow-[0_8px_32px_0_rgba(79,172,254,0.2)]',
}

function progressPercent(index: number, total: number, answered: boolean): number {
  if (total <= 0) return 0
  const completed = index + (answered ? 1 : 0)
  return Math.round((completed / total) * 100)
}

function toggleMulti(current: string[], value: string): string[] {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'none') {
    return current.includes(value) ? [] : [value]
  }
  const withoutNone = current.filter((item) => item.trim().toLowerCase() !== 'none')
  if (withoutNone.includes(value)) {
    return withoutNone.filter((item) => item !== value)
  }
  return [...withoutNone, value]
}

function toggleWellnessPriorities(current: string[], value: string, maxSelections = 2): string[] {
  if (current.includes(value)) {
    return current.filter((item) => item !== value)
  }
  if (current.length >= maxSelections) {
    return current
  }
  return [...current, value]
}

function isAnswered(question: QuestionnaireQuestion, answer: AnswerValue | undefined): boolean {
  if (answer == null) return !question.is_required
  if (Array.isArray(answer)) return answer.length > 0 || !question.is_required
  if (typeof answer === 'object') return Object.keys(answer).length > 0 || !question.is_required
  return String(answer).trim().length > 0 || !question.is_required
}

function hasFilledAnswer(answer: AnswerValue | undefined): boolean {
  if (answer == null) return false
  if (Array.isArray(answer)) return answer.length > 0
  if (typeof answer === 'object') {
    const value = (answer as { value?: unknown }).value
    if (value != null && String(value).trim() !== '') return true
    return Object.keys(answer).length > 0
  }
  return String(answer).trim().length > 0
}

export function ApiQuestionnaireStep({
  title,
  questions,
  assessmentInstanceId,
  categoryId,
  theme = 'family',
  onBack,
  onComplete,
  /** When set, drafts are persisted via this callback instead of newDesQues HTTP (keeps Health Assessment API path). */
  onPersistResponses,
}: {
  title: string
  questions: QuestionnaireQuestion[]
  assessmentInstanceId: number
  categoryId: number
  theme?: QuestionnaireTheme
  onBack?: () => void
  onComplete?: (answers: Record<number, AnswerValue>) => void
  onPersistResponses?: (
    responses: ReturnType<typeof buildQuestionnaireResponses>,
  ) => void | Promise<void>
}) {
  const [visibleIndex, setVisibleIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>(() =>
    seedAnswersFromQuestions(questions),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [infoOpen, setInfoOpen] = useState(false)

  /** Stable category identity — do not reset progress when parent only refreshes draft answers on the same questions. */
  const questionIdentity = useMemo(
    () =>
      questions
        .map((item) => Number(item.question_id) || 0)
        .filter((id) => id > 0)
        .join(','),
    [questions],
  )

  useEffect(() => {
    setAnswers(seedAnswersFromQuestions(questions))
    setVisibleIndex(0)
    setSaveError('')
    setInfoOpen(false)
    // Only re-seed when the question set itself changes (new category), not on every draft-driven questions array rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: questionIdentity gates reset
  }, [questionIdentity])

  const visibleQuestions = useMemo(
    () => filterOutInlinedOtherQuestions(filterVisibleQuestions(questions, answers), questions),
    [questions, answers],
  )

  useEffect(() => {
    if (visibleQuestions.length === 0) {
      setVisibleIndex(0)
      return
    }
    setVisibleIndex((current) => Math.min(current, visibleQuestions.length - 1))
  }, [visibleQuestions])

  useEffect(() => {
    setInfoOpen(false)
  }, [visibleIndex])

  const total = visibleQuestions.length
  const question = visibleQuestions[visibleIndex]
  const nextQuestion = visibleQuestions[visibleIndex + 1]
  const answer = question ? answers[question.question_id] : undefined
  const answered = question
    ? isLifestyleWellnessPrioritiesQuestion(question)
      ? (Array.isArray(answer)
          ? answer.length >= 1
          : typeof answer === 'string' || typeof answer === 'number'
            ? String(answer).trim().length > 0
            : false)
      : isAnswered(question, answer)
    : false
  const percent = progressPercent(visibleIndex, total, answered)
  const isLast = visibleIndex >= total - 1
  const nextQuestionPreview = String(nextQuestion?.question_text || '').replace(/\s+/g, ' ').trim()
  const infoItems = useMemo(
    () => parseHelpTextToInfoItems(question?.help_text),
    [question?.help_text],
  )
  const openInfo = infoItems.length > 0 ? () => setInfoOpen(true) : undefined

  const otherFollowUp = useMemo(
    () => (question ? findOtherFollowUpForParent(question, questions) : null),
    [question, questions],
  )
  const otherAnswer = otherFollowUp ? answers[otherFollowUp.question_id] : undefined
  const otherText =
    typeof otherAnswer === 'string' || typeof otherAnswer === 'number' ? String(otherAnswer) : ''
  const selectedForOther = Array.isArray(answer)
    ? answer.map(String)
    : typeof answer === 'string' || typeof answer === 'number'
      ? [String(answer)]
      : []
  const otherNeedsText = Boolean(
    question
    && otherFollowUp
    && selectedIncludesOther(selectedForOther, Array.isArray(question.options) ? question.options : []),
  )
  const canGoNext = Boolean(question?.is_read_only) || ((
    isLifestyleWellnessPrioritiesQuestion(question)
      ? answered
      : hasFilledAnswer(answer)
  ) && (!otherNeedsText || otherText.trim().length > 0))

  const collectSaveIds = (throughIndex: number): number[] => {
    const ids: number[] = []
    for (const item of visibleQuestions.slice(0, throughIndex + 1)) {
      ids.push(item.question_id)
      const followUp = findOtherFollowUpForParent(item, questions)
      if (!followUp) continue
      const parentAnswer = answers[item.question_id]
      const selected = Array.isArray(parentAnswer)
        ? parentAnswer.map(String)
        : typeof parentAnswer === 'string' || typeof parentAnswer === 'number'
          ? [String(parentAnswer)]
          : []
      if (selectedIncludesOther(selected, Array.isArray(item.options) ? item.options : [])) {
        ids.push(followUp.question_id)
      }
    }
    return ids
  }

  const saveCurrentProgress = async () => {
    const answeredThroughIndex = Math.min(visibleIndex, visibleQuestions.length - 1)
    const idsToSave = collectSaveIds(answeredThroughIndex)
    const responses = buildQuestionnaireResponses(answers, idsToSave)

    if (responses.length === 0) return

    if (onPersistResponses) {
      await onPersistResponses(responses)
      return
    }

    const accessToken = getAccessToken()
    await submitQuestionnaireResponses(
      accessToken,
      assessmentInstanceId,
      categoryId,
      responses,
    )
  }

  const handleBack = () => {
    if (isSaving) return
    if (infoOpen) {
      setInfoOpen(false)
      return
    }
    setSaveError('')
    if (visibleIndex > 0) {
      setVisibleIndex((index) => index - 1)
      return
    }
    onBack?.()
  }

  const handleNext = async () => {
    if (isSaving || !question || !canGoNext) return

    if (isLifestyleWellnessPrioritiesQuestion(question)) {
      const selectionCount = Array.isArray(answer)
        ? answer.length
        : typeof answer === 'string' || typeof answer === 'number'
          ? (String(answer).trim() ? 1 : 0)
          : 0
      if (selectionCount < 1) {
        setSaveError('Please choose at least one priority.')
        return
      }
    }

    setSaveError('')
    setIsSaving(true)

    try {
      await saveCurrentProgress()

      if (!isLast) {
        setVisibleIndex((index) => index + 1)
        return
      }

      const visibleIds = new Set(collectSaveIds(visibleQuestions.length - 1))
      const pruned: Record<number, AnswerValue> = {}
      for (const [id, value] of Object.entries(answers)) {
        const questionId = Number(id)
        if (visibleIds.has(questionId)) pruned[questionId] = value as AnswerValue
      }
      onComplete?.(pruned)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save your answer.')
    } finally {
      setIsSaving(false)
    }
  }

  const dietTypeAnswer = useMemo(() => {
    const dietQuestion = questions.find((item) => isNutritionDietTypeQuestion(item))
    if (!dietQuestion) return { dietQuestion: null as QuestionnaireQuestion | null, answer: null as unknown }
    return { dietQuestion, answer: answers[dietQuestion.question_id] ?? null }
  }, [questions, answers])

  const isCurrentFoodGroups = Boolean(question && isNutritionDailyFoodGroupsQuestion(question))
  const rawOptions = Array.isArray(question?.options) ? question.options : []
  const displayedOptions = useMemo(() => {
    if (!isCurrentFoodGroups) return rawOptions
    return filterFoodGroupOptionsByDiet(
      rawOptions,
      dietTypeAnswer.answer,
      dietTypeAnswer.dietQuestion,
    )
  }, [isCurrentFoodGroups, rawOptions, dietTypeAnswer])

  // Drop food-group answers that are no longer allowed for the selected diet.
  useEffect(() => {
    if (!question || !isCurrentFoodGroups) return
    const questionId = question.question_id
    const allowed = new Set(
      displayedOptions.map((option) => getOptionValue(option)).filter(Boolean),
    )
    setAnswers((prev) => {
      const current = prev[questionId]
      if (!Array.isArray(current)) return prev
      const next = current.map(String).filter((value) => allowed.has(value))
      if (next.length === current.length) return prev
      return { ...prev, [questionId]: next }
    })
  }, [question, isCurrentFoodGroups, displayedOptions])

  if (!question || total === 0) {
    return (
      <div className={MCQ_SHELL_CLASS}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-[16px] text-center">
          <p className="text-sm text-[#9a9a9a]">No questions available for this category.</p>
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  const options = displayedOptions
  const multi = isMultiChoiceType(question.question_type)
  const single =
    isSingleChoiceType(question.question_type) ||
    (options.length > 0 && !multi && !isTextType(question.question_type))
  const text = isTextType(question.question_type) || (!single && !multi && options.length === 0)
  const useLocationLayout = isFamilyHistoryLocationQuestion(question)
  const useSitDurationLayout = isLifestyleSitDurationQuestion(question)
  const usePhysicalActivityLayout = isLifestylePhysicalActivityQuestion(question)
  const useWeeklyLeisureLayout = isLifestyleWeeklyLeisureQuestion(question)
  const useActivityIntensityLayout = isLifestyleActivityIntensityQuestion(question)
  const useDailyWalkingLayout = isLifestyleDailyWalkingQuestion(question)
  const useSleepDurationLayout = isLifestyleSleepDurationQuestion(question)
  const useAlcoholConsumptionLayout = isLifestyleAlcoholConsumptionQuestion(question)
  const useSmokingFrequencyLayout = isLifestyleSmokingFrequencyQuestion(question)
  const useWellnessPrioritiesLayout = isLifestyleWellnessPrioritiesQuestion(question)
  const useLifestyleCommitmentLayout = isLifestyleCommitmentQuestion(question)
  const useDietTypeLayout = isNutritionDietTypeQuestion(question)
  const useDailyFoodGroupsLayout = isNutritionDailyFoodGroupsQuestion(question)
  const useBreakfastFrequencyLayout = isNutritionBreakfastFrequencyQuestion(question)
  const useIllnessFrequencyLayout = isNutritionIllnessFrequencyQuestion(question)
  const useWaterIntakeLayout = isNutritionWaterIntakeQuestion(question)
  const useCoffeeTeaTypeLayout = isNutritionCoffeeTeaTypeQuestion(question)
  const useCoffeeTeaIntakeLayout = isNutritionCoffeeTeaIntakeQuestion(question)
  const useIodizedSaltLayout = isNutritionIodizedSaltQuestion(question)
  const useExtraSaltLayout = isNutritionExtraSaltQuestion(question)
  const useConsumptionFrequencyLayout =
    !useBreakfastFrequencyLayout &&
    !useIllnessFrequencyLayout &&
    !useWaterIntakeLayout &&
    isNutritionConsumptionFrequencyQuestion(question)
  const progressColor = THEME_PROGRESS_COLOR[theme]
  const nextGradient = THEME_NEXT_GRADIENT[theme]
  const chipGradient = THEME_CHIP_GRADIENT[theme]
  const otherExpandedGradient = THEME_OTHER_EXPANDED_GRADIENT[theme]
  const nextShadow = THEME_NEXT_SHADOW[theme]
  const questionLabel = `Question ${visibleIndex + 1} of ${total}`
  const questionSubText = String(question.sub_text || '').trim() || undefined

  const selectedValues = Array.isArray(answer)
    ? answer.map(String)
    : typeof answer === 'string' || typeof answer === 'number'
      ? [String(answer)]
      : []
  const orderedOptions = orderOptionsWithSelectedOtherLast(options, selectedValues)

  const applyChoiceSelection = (nextSelected: string[]) => {
    setSaveError('')
    setAnswers((prev) => {
      const next: Record<number, AnswerValue> = {
        ...prev,
        [question.question_id]: multi ? nextSelected : (nextSelected[0] ?? ''),
      }

      // Keep typed Other text while Other stays selected; clear only when Other is off.
      if (otherFollowUp && !selectedIncludesOther(nextSelected, options)) {
        delete next[otherFollowUp.question_id]
      }

      return next
    })
  }

  return (
    <div className={MCQ_SHELL_CLASS}>
      <header className={MCQ_HEADER_CLASS}>
        <h1 className="shrink-0 whitespace-nowrap text-[19px] tracking-[0.095px] text-white">{title}</h1>
      </header>

      <div className="flex shrink-0 flex-col gap-2 px-[16px] py-1">
        <div className="flex w-full items-center justify-end">
          <p className="text-right text-[11px] font-normal uppercase tracking-[0.3px] text-[#8e8ca3] leading-[13.5px]">
            {percent}% COMPLETED
          </p>
        </div>
        <McqProgressBar percent={percent} color={progressColor} />
      </div>

      <div className={MCQ_SHELL_SCROLL_CLASS}>
        <div className="flex flex-col gap-5 px-[16px] pb-4 pt-2">
          {saveError ? (
            <div className="rounded-lg border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 px-3 py-2 text-sm text-[#ffd1d1]">
              {saveError}
            </div>
          ) : null}

          {useLocationLayout ? (
            <FamilyHistoryLocationOptions
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              disabled={Boolean(question.is_read_only) || isSaving}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useSitDurationLayout ? (
            <LifestyleSitDurationQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : usePhysicalActivityLayout ? (
            <LifestylePhysicalActivityQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useWeeklyLeisureLayout ? (
            <LifestyleWeeklyLeisureQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useActivityIntensityLayout ? (
            <LifestyleActivityIntensityQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useDailyWalkingLayout ? (
            <LifestyleDailyWalkingQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useSleepDurationLayout ? (
            <LifestyleSleepDurationQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useSmokingFrequencyLayout ? (
            <LifestyleSmokingFrequencyQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useAlcoholConsumptionLayout ? (
            <LifestyleAlcoholConsumptionQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useWellnessPrioritiesLayout ? (
            <LifestyleWellnessPrioritiesQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValues={selectedValues}
              onInfoClick={openInfo}
              onToggle={(value) => {
                setSaveError('')
                setAnswers((prev) => {
                  const stored = prev[question.question_id]
                  const current = Array.isArray(stored)
                    ? stored.map(String)
                    : typeof stored === 'string' || typeof stored === 'number'
                      ? [String(stored)]
                      : []
                  return {
                    ...prev,
                    [question.question_id]: toggleWellnessPriorities(current, value, 2),
                  }
                })
              }}
            />
          ) : useLifestyleCommitmentLayout ? (
            <LifestyleCommitmentQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useDietTypeLayout ? (
            <NutritionDietTypeQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              disabled={Boolean(question.is_read_only) || isSaving}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useDailyFoodGroupsLayout || useCoffeeTeaTypeLayout ? (
            <NutritionApiMultiSelectQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValues={selectedValues}
              onInfoClick={openInfo}
              reserveTickSpaceForSelectedLabels={useCoffeeTeaTypeLayout}
              showFullOptionLabels={useCoffeeTeaTypeLayout}
              onToggle={(value) => {
                setSaveError('')
                applyChoiceSelection(toggleMulti(selectedValues, value))
              }}
            />
          ) : useBreakfastFrequencyLayout ? (
            <NutritionApiCircularMeterQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              meterId={nutritionMeterIdForQuestion(question)}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              variant="breakfast"
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useIllnessFrequencyLayout ? (
            <NutritionApiCircularMeterQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              meterId={nutritionMeterIdForQuestion(question)}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              variant="illness"
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useWaterIntakeLayout ? (
            <NutritionApiWaterIntakeQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useConsumptionFrequencyLayout ? (
            <NutritionApiConsumptionFrequencyQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              meterId={nutritionMeterIdForQuestion(question)}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useIodizedSaltLayout ? (
            <NutritionApiPillRowQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              layout="row"
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : useExtraSaltLayout || useCoffeeTeaIntakeLayout ? (
            <NutritionApiPillRowQuestion
              questionLabel={questionLabel}
              questionText={question.question_text}
              questionSubText={questionSubText}
              options={orderedOptions}
              selectedValue={selectedValues[0] ?? null}
              layout={useCoffeeTeaIntakeLayout ? 'coffee-intake' : 'wrap'}
              onInfoClick={openInfo}
              onSelect={(value) => {
                setSaveError('')
                setAnswers((prev) => ({
                  ...prev,
                  [question.question_id]: value,
                }))
              }}
            />
          ) : (
            <>
              <McqQuestionHeader
                theme={theme}
                questionLabel={questionLabel}
                subText={questionSubText}
                onInfoClick={openInfo}
                titleClassName="mt-2 text-[16px] font-semibold leading-6 tracking-[0.2px] text-white"
              >
                <p>{question.question_text}</p>
              </McqQuestionHeader>

              {single || multi ? (
                <div className="flex flex-wrap gap-2.5">
                  {orderedOptions.map((option) => {
                    const value = getOptionValue(option)
                    const label = getOptionLabel(option) || value
                    if (!value && !label) return null
                    const selected = selectedValues.includes(value)
                    const isOther = isOtherOption(option)
                    const isOtherExpanded = Boolean(isOther && selected && otherFollowUp)

                    if (isOtherExpanded && otherFollowUp) {
                      return (
                        <div
                          key={`${question.question_id}-${value}`}
                          className="flex w-full basis-full flex-col rounded-[24px] border border-solid border-[#d0d0d0] px-6 pb-3 pt-1"
                          style={{ backgroundImage: otherExpandedGradient }}
                        >
                          <button
                            type="button"
                            disabled={question.is_read_only || isSaving}
                            onClick={() => {
                              if (multi) {
                                applyChoiceSelection(toggleMulti(selectedValues, value))
                                return
                              }
                              applyChoiceSelection([])
                            }}
                            className="flex items-center gap-2.5 py-0.5 text-left disabled:opacity-60"
                            aria-pressed
                          >
                            <img src={tickCircleIcon} alt="" className="size-3 shrink-0" aria-hidden />
                            <span className="text-[12px] font-semibold leading-6 text-white">
                              {label || 'Other'}
                            </span>
                          </button>
                          <input
                            type="text"
                            value={otherText}
                            disabled={question.is_read_only || isSaving}
                            onChange={(event) => {
                              setSaveError('')
                              setAnswers((prev) => ({
                                ...prev,
                                [otherFollowUp.question_id]: event.target.value,
                              }))
                            }}
                            placeholder="Please specify"
                            className="ml-[22px] w-[calc(100%-22px)] border-0 border-b border-[rgba(255,255,255,0.35)] bg-transparent py-0.5 text-[16px] font-light leading-6 text-white outline-none placeholder:text-[#9a9a9a] disabled:opacity-60"
                            aria-label={`Please specify for ${otherFollowUp.question_text}`}
                          />
                        </div>
                      )
                    }

                    return (
                      <button
                        key={`${question.question_id}-${value}`}
                        type="button"
                        disabled={question.is_read_only || isSaving}
                        onClick={() => {
                          if (multi) {
                            applyChoiceSelection(toggleMulti(selectedValues, value))
                            return
                          }
                          applyChoiceSelection([value])
                        }}
                        className={`${MCQ_PILL_CHIP_CLASS} flex items-center justify-center gap-2.5 rounded-full border px-3 py-2 text-left text-[12px] font-medium leading-4 text-white transition disabled:opacity-60`}
                        style={{
                          borderColor: selected ? MCQ_PILL_BORDER_SELECTED : MCQ_PILL_BORDER_IDLE,
                          backgroundImage: selected ? chipGradient : undefined,
                          backgroundColor: selected ? undefined : 'rgba(255,255,255,0.05)',
                        }}
                      >
                        {selected ? (
                          <img src={tickCircleIcon} alt="" className="size-3 shrink-0" aria-hidden />
                        ) : null}
                        <span>{label}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {text ? (
                <textarea
                  value={
                    typeof answer === 'string' || typeof answer === 'number' ? String(answer) : ''
                  }
                  disabled={question.is_read_only || isSaving}
                  onChange={(event) => {
                    setSaveError('')
                    setAnswers((prev) => ({
                      ...prev,
                      [question.question_id]: event.target.value,
                    }))
                  }}
                  rows={4}
                  placeholder="Type your answer"
                  className="w-full resize-none rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-[16px] text-white outline-none placeholder:text-white/35 focus:ring-1 focus:ring-[#9D50BB] disabled:opacity-60"
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      <McqInfoOverlay
        open={infoOpen}
        items={infoItems}
        theme={theme}
        onClose={() => setInfoOpen(false)}
      />

      <QuestionnaireFooter
        onBack={handleBack}
        onNext={handleNext}
        backDisabled={isSaving}
        nextDisabled={isSaving || !canGoNext}
        nextAriaLabel={isSaving ? 'Saving answer' : isLast ? 'Continue' : 'Next question'}
        preview={isLast ? '' : nextQuestionPreview}
        buttonGradient={nextGradient}
        buttonShadowClass={nextShadow}
      />
    </div>
  )
}

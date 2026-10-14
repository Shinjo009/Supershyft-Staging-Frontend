import {
  getOptionLabel,
  getOptionValue,
  isMultiChoiceType,
  isSingleChoiceType,
  isTextType,
  type QuestionnaireOption,
  type QuestionnaireQuestion,
} from '../api/questionnaire'

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

/** Option values/labels that mean "Other" on an MCQ. */
export function isOtherOption(option: QuestionnaireOption): boolean {
  const value = normalizeKey(getOptionValue(option))
  const label = normalizeKey(getOptionLabel(option))
  return (
    value === 'other' ||
    label === 'other' ||
    value === 'others' ||
    label === 'others' ||
    value.endsWith('_other') ||
    label.endsWith(' (other)')
  )
}

/** When Other is selected, keep every other choice in place and render Other last. */
export function orderOptionsWithSelectedOtherLast(
  options: QuestionnaireOption[],
  selectedValues: string[],
): QuestionnaireOption[] {
  if (!selectedIncludesOther(selectedValues, options)) return options
  return [
    ...options.filter((option) => !isOtherOption(option)),
    ...options.filter((option) => isOtherOption(option)),
  ]
}

export function questionHasOtherOption(question: QuestionnaireQuestion): boolean {
  const options = Array.isArray(question.options) ? question.options : []
  return options.some(isOtherOption)
}

/** True when the current selection still includes the MCQ's Other option. */
export function selectedIncludesOther(
  selectedValues: string[],
  options: QuestionnaireOption[] = [],
): boolean {
  if (selectedValues.length === 0) return false

  if (options.length > 0) {
    return selectedValues.some((selected) => {
      const matched = options.find((option) => {
        const value = getOptionValue(option)
        const label = getOptionLabel(option)
        return value === selected || label === selected
      })
      return matched ? isOtherOption(matched) : normalizeKey(selected) === 'other'
    })
  }

  return selectedValues.some((value) => {
    const normalized = normalizeKey(value)
    return normalized === 'other' || normalized === 'others' || normalized.endsWith('_other')
  })
}

function isChoiceQuestion(question: QuestionnaireQuestion): boolean {
  const type = String(question.question_type || '')
  return (
    isMultiChoiceType(type) ||
    isSingleChoiceType(type) ||
    (Array.isArray(question.options) && (question.options?.length || 0) > 0)
  )
}

function looksLikeOtherTextQuestion(question: QuestionnaireQuestion): boolean {
  if (!isTextType(question.question_type)) return false
  const key = normalizeKey(question.question_key)
  const text = normalizeKey(question.question_text)
  return (
    key.endsWith('_other') ||
    key.endsWith('.other') ||
    key.includes('_other_') ||
    /\(\s*other\s*\)\s*$/i.test(question.question_text || '') ||
    text.endsWith(' other') ||
    text.includes('(other)')
  )
}

function visibilityPointsToParentOther(
  followUp: QuestionnaireQuestion,
  parent: QuestionnaireQuestion,
): boolean {
  const parentKey = normalizeKey(parent.question_key)
  if (!parentKey) return false

  const conditions = followUp.visibility_rules?.conditions
  if (!Array.isArray(conditions) || conditions.length === 0) return false

  return conditions.some((condition) => {
    const type = normalizeKey(condition.type)
    if (type && type !== 'question_answer') return false
    if (normalizeKey(condition.question_key) !== parentKey) return false

    const expected = normalizeKey(condition.value)
    return expected === 'other' || expected.includes('other')
  })
}

function keySuggestsParentOther(
  followUp: QuestionnaireQuestion,
  parent: QuestionnaireQuestion,
): boolean {
  const parentKey = normalizeKey(parent.question_key)
  const followKey = normalizeKey(followUp.question_key)
  if (!parentKey || !followKey) return false
  return (
    followKey === `${parentKey}_other` ||
    followKey === `${parentKey}.other` ||
    followKey.startsWith(`${parentKey}_other`)
  )
}

/**
 * Find the free-text "(other)" question that belongs to a parent MCQ.
 * Prefer visibility_rules / question_key, then nearest later text titled "(other)".
 */
export function findOtherFollowUpForParent(
  parent: QuestionnaireQuestion,
  allQuestions: QuestionnaireQuestion[],
): QuestionnaireQuestion | null {
  if (!questionHasOtherOption(parent)) return null

  const parentIndex = allQuestions.findIndex((q) => q.question_id === parent.question_id)
  if (parentIndex < 0) return null

  const byRulesOrKey = allQuestions.find(
    (candidate) =>
      candidate.question_id !== parent.question_id &&
      isTextType(candidate.question_type) &&
      (visibilityPointsToParentOther(candidate, parent) ||
        keySuggestsParentOther(candidate, parent)),
  )
  if (byRulesOrKey) return byRulesOrKey

  // Fallback: next standalone "(other)" text after this parent, before the next choice Q with Other.
  for (let i = parentIndex + 1; i < allQuestions.length; i += 1) {
    const candidate = allQuestions[i]
    if (
      isChoiceQuestion(candidate) &&
      questionHasOtherOption(candidate) &&
      !looksLikeOtherTextQuestion(candidate)
    ) {
      break
    }
    if (looksLikeOtherTextQuestion(candidate)) return candidate
  }

  return null
}

/** Parent MCQ for a standalone "(other)" text question, if any. */
export function findParentForOtherFollowUp(
  followUp: QuestionnaireQuestion,
  allQuestions: QuestionnaireQuestion[],
): QuestionnaireQuestion | null {
  if (!isTextType(followUp.question_type)) return null

  for (const parent of allQuestions) {
    if (parent.question_id === followUp.question_id) continue
    if (!isChoiceQuestion(parent) || !questionHasOtherOption(parent)) continue
    if (
      visibilityPointsToParentOther(followUp, parent) ||
      keySuggestsParentOther(followUp, parent)
    ) {
      return parent
    }
  }

  if (!looksLikeOtherTextQuestion(followUp)) return null

  const followIndex = allQuestions.findIndex((q) => q.question_id === followUp.question_id)
  if (followIndex <= 0) return null

  for (let i = followIndex - 1; i >= 0; i -= 1) {
    const parent = allQuestions[i]
    if (isChoiceQuestion(parent) && questionHasOtherOption(parent)) return parent
  }

  return null
}

/** Hide these from one-question-at-a-time navigation; they render inline on the parent MCQ. */
export function isInlinedOtherTextQuestion(
  question: QuestionnaireQuestion,
  allQuestions: QuestionnaireQuestion[],
): boolean {
  return findParentForOtherFollowUp(question, allQuestions) != null
}

export function filterOutInlinedOtherQuestions(
  questions: QuestionnaireQuestion[],
  allQuestions: QuestionnaireQuestion[],
): QuestionnaireQuestion[] {
  return questions.filter((question) => !isInlinedOtherTextQuestion(question, allQuestions))
}

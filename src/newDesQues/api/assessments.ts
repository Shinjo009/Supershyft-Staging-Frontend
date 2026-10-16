import { isFrontendOnly } from '../lib/frontendOnly'
import { authorizedGet, authorizedPost } from './http'
import { mapCategoryToRouteId, markFitprintGapQuestionnaireSubmitted } from '../../services/questionnaireService'

export type AssessmentRow = {
  assessment_instance_id?: number
  package_id?: number
  package_code?: string
  package_display_name?: string
  engagement_id?: number
  status?: string
  metsights_record_id?: string
  assigned_at?: string
  completed_at?: string | null
}

export type AssessmentCategoryStatus = {
  id: number
  category_id: number
  category_key: string
  display_name: string
  category_of?: string
  status?: string
}

type AssessmentsMeResponse = {
  data?: AssessmentRow[]
}

type AssessmentStatusResponse = {
  data?: AssessmentCategoryStatus[]
}

const EXCLUDED_CATEGORY_KEYS = new Set(['anthropometry', 'health_vitals', 'vitals'])

const QUESTIONNAIRE_UI_ROUTE_ORDER = [
  'family-history',
  'lifestyle-habits',
  'nutrition-log',
  'anthropometry',
  'vitals',
] as const

const sortAssessmentCategoriesForUi = (
  categories: AssessmentCategoryStatus[],
): AssessmentCategoryStatus[] => (
  [...categories].sort((a, b) => {
    const aRoute = mapCategoryToRouteId(a)
    const bRoute = mapCategoryToRouteId(b)
    const aIndex = QUESTIONNAIRE_UI_ROUTE_ORDER.indexOf(
      aRoute as (typeof QUESTIONNAIRE_UI_ROUTE_ORDER)[number],
    )
    const bIndex = QUESTIONNAIRE_UI_ROUTE_ORDER.indexOf(
      bRoute as (typeof QUESTIONNAIRE_UI_ROUTE_ORDER)[number],
    )
    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex
    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex
    if (safeA !== safeB) {
      return safeA - safeB
    }
    return Number(a.category_id || 0) - Number(b.category_id || 0)
  })
)

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  anthropometry: 'Your measurements power our AI to generate accurate metabolic and wellness scores.',
  family_history:
    "Knowing your family's health patterns helps us predict risks more accurately.",
  lifestyle_habits:
    'Your routines help our system decode how your habits influence your health.',
  nutrition_log:
    'Your food patterns help us understand nutrition habits that shape long-term health.',
  vitals: 'Enter your blood pressure reading to track your vitals.',
  health_vitals: 'Your blood pressure readings help us understand heart and metabolic risk.',
}

const INTRO_SHORT_LABELS: { match: string; label: string }[] = [
  { match: 'anthro', label: 'Anthro' },
  { match: 'family', label: 'Family' },
  { match: 'lifestyle', label: 'Lifestyle' },
  { match: 'nutrition', label: 'Nutrition' },
  { match: 'vital', label: 'Vitals' },
]

export function categoryDescriptionForKey(categoryKey: string): string | undefined {
  return CATEGORY_DESCRIPTIONS[String(categoryKey || '').trim().toLowerCase()]
}

export function normalizeCategoryKey(categoryKey: string): string {
  return String(categoryKey || '')
    .trim()
    .toLowerCase()
}

export function isAnthropometryCategory(categoryKey: string): boolean {
  return normalizeCategoryKey(categoryKey).includes('anthro')
}

export function isVitalsCategory(categoryKey: string): boolean {
  return normalizeCategoryKey(categoryKey).includes('vital')
}

/** Family / Lifestyle / Nutrition — the three redesigned questionnaire UIs. */
export function isRedesignedQuestionnaireCategory(category: AssessmentCategoryStatus): boolean {
  const key = normalizeCategoryKey(category.category_key)
  return key.includes('family') || key.includes('lifestyle') || key.includes('nutrition')
}

export function hasAnthropometryAndVitals(categories: AssessmentCategoryStatus[]): boolean {
  return (
    categories.some((category) => isAnthropometryCategory(category.category_key)) &&
    categories.some((category) => isVitalsCategory(category.category_key))
  )
}

export function introShortLabelForCategory(category: AssessmentCategoryStatus): string {
  const key = normalizeCategoryKey(category.category_key)
  const match = INTRO_SHORT_LABELS.find((entry) => key.includes(entry.match))
  if (match) return match.label
  const name = String(category.display_name || category.category_key || '').trim()
  return name.split(/\s+/)[0] || 'Section'
}

export function isCategoryCompleted(
  category: AssessmentCategoryStatus,
  completedCategoryIds: number[],
): boolean {
  if (String(category?.status || '').trim().toLowerCase() === 'complete') {
    return true
  }
  return completedCategoryIds.includes(Number(category.category_id))
}

function toTimestamp(value: unknown): number {
  if (typeof value !== 'string' || !value.trim()) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizePackageCode(row: AssessmentRow): string {
  return String(row.package_code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
}

/** Metsights Pro or Essentials only (Basic legacy) — excludes FitPrint / Fitness Print. */
export function isMetsightsProOrBasic(row: AssessmentRow): boolean {
  const code = normalizePackageCode(row)
  const display = String(row.package_display_name || '')
    .trim()
    .toLowerCase()

  if (isFitprintAssessment(row)) {
    return false
  }

  if (
    code.includes('METSIGHTS')
    && (code.includes('PRO') || code.includes('ESSENTIALS') || code.includes('BASIC'))
  ) {
    return true
  }

  if (
    display.includes('metsights')
    && (display.includes('pro') || display.includes('essentials') || display.includes('basic'))
  ) {
    return true
  }

  return false
}

export function isFitprintAssessment(row: AssessmentRow): boolean {
  const code = normalizePackageCode(row)
  const display = String(row.package_display_name || '')
    .trim()
    .toLowerCase()

  return (
    code === 'MY_FITNESS_PRINT' ||
    code.includes('FITPRINT') ||
    code.includes('FITNESS_PRINT') ||
    display.includes('fitprint') ||
    display.includes('fit print') ||
    display.includes('fitness print')
  )
}

function sortLatestFirst(rows: AssessmentRow[]): AssessmentRow[] {
  return [...rows].sort((a, b) => {
    const byAssigned = toTimestamp(b.assigned_at) - toTimestamp(a.assigned_at)
    if (byAssigned !== 0) return byAssigned
    return (b.assessment_instance_id || 0) - (a.assessment_instance_id || 0)
  })
}

export function pickLatestMetsightsProOrBasicId(rows: AssessmentRow[]): number | null {
  const latest = sortLatestFirst(rows.filter(isMetsightsProOrBasic))[0]
  const id = Number(latest?.assessment_instance_id || 0)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function pickLatestFitprintId(
  rows: AssessmentRow[],
  preferredEngagementId?: number | null,
): number | null {
  const fitprintRows = rows.filter(isFitprintAssessment)
  const preferred = Number(preferredEngagementId || 0)
  const scoped =
    Number.isFinite(preferred) && preferred > 0
      ? fitprintRows.filter((row) => Number(row.engagement_id || 0) === preferred)
      : fitprintRows
  const latest = sortLatestFirst(scoped.length > 0 ? scoped : fitprintRows)[0]
  const id = Number(latest?.assessment_instance_id || 0)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function getAssessmentEngagementId(
  rows: AssessmentRow[],
  assessmentInstanceId: number,
): number | null {
  const match = rows.find(
    (row) => Number(row.assessment_instance_id || 0) === Number(assessmentInstanceId),
  )
  const engagementId = Number(match?.engagement_id || 0)
  return Number.isFinite(engagementId) && engagementId > 0 ? engagementId : null
}

export async function submitAssessmentCategory(
  accessToken: string,
  assessmentInstanceId: number,
  category: 'diet-lifestyle-parameters' | 'fitness-parameters',
): Promise<unknown> {
  const id = Number(assessmentInstanceId)
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Invalid assessment instance id.')
  }

  if (isFrontendOnly()) {
    console.info('[frontend-only] skipped assessment category submit', {
      assessmentInstanceId: id,
      category,
    })
    return null
  }

  return authorizedPost(`/assessments/${id}/submit`, accessToken, { category })
}

/**
 * Finalize diet/lifestyle on Metsights Pro/Basic, and fitness on FitPrint when present.
 */
export async function submitCompletedAssessmentFlow(
  accessToken: string,
  metsightsAssessmentInstanceId: number,
): Promise<{ metsightsSubmitted: boolean; fitprintSubmitted: boolean }> {
  if (isFrontendOnly()) {
    console.info('[frontend-only] skipped completed assessment submit', {
      metsightsAssessmentInstanceId,
    })
    return { metsightsSubmitted: true, fitprintSubmitted: false }
  }

  const rows = await listMyAssessments(accessToken)
  const metsightsId = Number(metsightsAssessmentInstanceId)
  if (!Number.isFinite(metsightsId) || metsightsId <= 0) {
    throw new Error('Missing Metsights assessment instance id.')
  }

  await submitAssessmentCategory(accessToken, metsightsId, 'diet-lifestyle-parameters')

  const engagementId = getAssessmentEngagementId(rows, metsightsId)
  const fitprintId = pickLatestFitprintId(rows, engagementId)
  let fitprintSubmitted = false

  if (fitprintId) {
    await submitAssessmentCategory(accessToken, fitprintId, 'fitness-parameters')
    markFitprintGapQuestionnaireSubmitted(fitprintId)
    fitprintSubmitted = true
  }

  return { metsightsSubmitted: true, fitprintSubmitted }
}

export function filterAssessmentCategoriesForUi(
  categories: AssessmentCategoryStatus[],
): AssessmentCategoryStatus[] {
  return sortAssessmentCategoriesForUi(
    categories.filter((category) => {
      const key = String(category.category_key || '')
        .trim()
        .toLowerCase()
      return key.length > 0 && !EXCLUDED_CATEGORY_KEYS.has(key)
    }),
  )
}

export async function listMyAssessments(accessToken: string): Promise<AssessmentRow[]> {
  const response = await authorizedGet<AssessmentsMeResponse>('/assessments/me', accessToken, {
    page: 1,
    limit: 50,
  })
  return Array.isArray(response?.data) ? response.data : []
}

export async function getAssessmentCategoryStatuses(
  accessToken: string,
  assessmentInstanceId: number,
): Promise<AssessmentCategoryStatus[]> {
  const response = await authorizedGet<AssessmentStatusResponse>(
    `/assessments/${assessmentInstanceId}/status`,
    accessToken,
  )
  return Array.isArray(response?.data) ? response.data : []
}

export type AssessmentBootstrapResult = {
  assessmentInstanceId: number
  categories: AssessmentCategoryStatus[]
}

export type NewDesQuesScenario = 1 | 2 | 3

const MOCK_ASSESSMENT_CATEGORIES: AssessmentCategoryStatus[] = [
  {
    id: 2,
    category_id: 2,
    category_key: 'family_history',
    display_name: 'Family History',
    status: 'pending',
  },
  {
    id: 3,
    category_id: 3,
    category_key: 'lifestyle_habits',
    display_name: 'Lifestyle & Habits',
    status: 'pending',
  },
  {
    id: 4,
    category_id: 4,
    category_key: 'nutrition_log',
    display_name: 'Nutrition Log',
    status: 'pending',
  },
  {
    id: 1,
    category_id: 1,
    category_key: 'anthropometry',
    display_name: 'Anthropometry',
    status: 'pending',
  },
  {
    id: 5,
    category_id: 5,
    category_key: 'vitals',
    display_name: 'Vitals',
    status: 'pending',
  },
]

export function mockCategoriesForScenario(scenario: NewDesQuesScenario = 2): AssessmentCategoryStatus[] {
  if (scenario === 1) {
    return MOCK_ASSESSMENT_CATEGORIES.filter((category) => {
      const key = normalizeCategoryKey(category.category_key)
      return key.includes('family') || key.includes('lifestyle') || key.includes('nutrition')
    })
  }
  if (scenario === 3) {
    return MOCK_ASSESSMENT_CATEGORIES.filter((category) => {
      const key = normalizeCategoryKey(category.category_key)
      return isAnthropometryCategory(key) || isVitalsCategory(key)
    })
  }
  return MOCK_ASSESSMENT_CATEGORIES
}

/** Resolve latest Metsights Pro/Basic assessment and questionnaire categories for Step 2. */
export async function loadAssessmentCategoriesForStep2(
  accessToken: string,
  scenario: NewDesQuesScenario = 2,
): Promise<AssessmentBootstrapResult> {
  if (isFrontendOnly()) {
    console.info('[frontend-only] using local mock assessment categories', { scenario })
    return {
      assessmentInstanceId: 1,
      categories: mockCategoriesForScenario(scenario),
    }
  }

  const rows = await listMyAssessments(accessToken)
  const assessmentInstanceId = pickLatestMetsightsProOrBasicId(rows)

  if (!assessmentInstanceId) {
    throw new Error('No Metsights Pro or Essentials assessment found for this account.')
  }

  const allCategories = await getAssessmentCategoryStatuses(accessToken, assessmentInstanceId)
  const categories = filterAssessmentCategoriesForUi(allCategories)

  if (categories.length === 0) {
    throw new Error('No assessment categories available to continue.')
  }

  return { assessmentInstanceId, categories }
}

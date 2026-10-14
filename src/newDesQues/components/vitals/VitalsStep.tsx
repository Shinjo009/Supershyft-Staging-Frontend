import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { QuestionnaireQuestion } from '../../api/questionnaire'
import { McqProgressBar } from '../mcq/McqProgressBar'
import {
  MCQ_HEADER_CLASS,
  MCQ_SHELL_CLASS,
  MCQ_SHELL_SCROLL_CLASS,
} from '../mcq/mcqLayout'
import { QuestionnaireFooter } from '../mcq/QuestionnaireFooter'
import {
  clampBloodPressure,
  formatVitalsTwoDigits,
  getVitalsQuestionSubText,
  getVitalsQuestionText,
  MAX_BP,
  MIN_BP,
  normalizeStoredVitalReading,
  VITALS_PROGRESS_COLOR,
  type VitalsValues,
} from './vitalsConfig'
import { QuestionSubText } from '../mcq/QuestionSubText'
import './vitals.css'

const VITALS_NEXT_BUTTON_GRADIENT =
  "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.3'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(2.5 0 0 2.5 25 25)'><stop stop-color='rgba(144,223,158,1)' offset='0'/><stop stop-color='rgba(74,222,128,1)' offset='1'/></radialGradient></defs></svg>\")"

export function VitalsStep({
  questions = [],
  onBack,
  onComplete,
  initialValues,
  title = 'Vitals',
}: {
  questions?: QuestionnaireQuestion[]
  onBack: () => void
  onComplete: (values: VitalsValues) => void
  initialValues?: Partial<VitalsValues>
  title?: string
}) {
  const [systolic, setSystolic] = useState(() =>
    normalizeStoredVitalReading(initialValues?.systolic),
  )
  const [diastolic, setDiastolic] = useState(() =>
    normalizeStoredVitalReading(initialValues?.diastolic),
  )

  const systolicLabel = useMemo(
    () =>
      getVitalsQuestionText(
        questions,
        ['systolic_blood_pressure', 'systolic'],
        'Systolic Blood Pressure',
      ),
    [questions],
  )
  const diastolicLabel = useMemo(
    () =>
      getVitalsQuestionText(
        questions,
        ['diastolic_blood_pressure', 'diastolic'],
        'Diastolic Blood Pressure',
      ),
    [questions],
  )
  const systolicSubText = useMemo(
    () => getVitalsQuestionSubText(questions, ['systolic_blood_pressure', 'systolic']),
    [questions],
  )
  const diastolicSubText = useMemo(
    () => getVitalsQuestionSubText(questions, ['diastolic_blood_pressure', 'diastolic']),
    [questions],
  )

  const finish = (values: VitalsValues) => {
    onComplete(values)
  }

  return (
    <div className={MCQ_SHELL_CLASS}>
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(at_-94%_-56%,rgba(74,222,128,0.72),#030712_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed bottom-0 right-0 z-0 h-72 w-48 rounded-full bg-cyan-400/40 blur-[100px]"
        aria-hidden
      />

      <header className={`relative z-[1] ${MCQ_HEADER_CLASS}`}>
        <h1 className="shrink-0 whitespace-nowrap text-lg font-normal tracking-tight text-white">
          {title}
        </h1>
      </header>

      <div className="relative z-[1] flex shrink-0 flex-col gap-3 px-[16px] py-2">
        <div className="flex w-full items-center justify-end">
          <p className="text-right font-['DM_Sans'] text-xs font-normal uppercase leading-3 tracking-tight text-zinc-400">
            100% COMPLETED
          </p>
        </div>
        <McqProgressBar percent={100} color={VITALS_PROGRESS_COLOR} />
      </div>

      <div className={`relative z-[1] ${MCQ_SHELL_SCROLL_CLASS}`}>
        <div className="flex w-full flex-col items-center gap-6 px-[16px] pb-4 pt-6">
          <VitalsReadingField
            label={systolicLabel}
            subText={systolicSubText}
            value={systolic}
            onChange={setSystolic}
            ariaLabel="Systolic blood pressure"
          />
          <VitalsReadingField
            label={diastolicLabel}
            subText={diastolicSubText}
            value={diastolic}
            onChange={setDiastolic}
            ariaLabel="Diastolic blood pressure"
          />
          <button
            type="button"
            className="text-sm font-normal tracking-tight text-zinc-400 underline"
            onClick={() => finish({ systolic: null, diastolic: null })}
          >
            Skip
          </button>
        </div>
      </div>

      <QuestionnaireFooter
        onBack={onBack}
        onNext={() => finish({ systolic, diastolic })}
        nextAriaLabel="Continue"
        buttonGradient={VITALS_NEXT_BUTTON_GRADIENT}
        buttonShadowClass="shadow-[0_8px_32px_0_rgba(144,223,158,0.5)]"
      />
    </div>
  )
}

function VitalsReadingField({
  label,
  subText,
  value,
  onChange,
  ariaLabel,
}: {
  label: string
  subText?: string | null
  value: number | null
  onChange: (next: number | null) => void
  ariaLabel: string
}) {
  const display = value == null ? 0 : value
  const empty = value == null

  const handleNumberInput = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = String(event.target.value || '').trim()
    if (raw === '') {
      onChange(null)
      return
    }
    const next = Number(raw)
    onChange(clampBloodPressure(Number.isNaN(next) ? 0 : next))
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full flex-col items-center gap-1">
        <p className="w-full text-center text-base font-normal tracking-tight text-white">{label}</p>
        <QuestionSubText text={subText} className="text-center" />
      </div>
      <div className="relative flex h-36 w-full items-center justify-center rounded-2xl bg-teal-400/5 outline outline-[0.84px] outline-offset-[-0.84px] outline-zinc-300/10">
        <div className="flex items-center gap-3">
          <div className="relative flex min-w-12 items-center justify-center rounded-lg border border-white/20 bg-black/20 px-2 py-3">
            <input
              className="ndq-vitals__score-input"
              type="number"
              inputMode="numeric"
              min={MIN_BP}
              max={MAX_BP}
              value={value ?? ''}
              onChange={handleNumberInput}
              aria-label={ariaLabel}
            />
            <span
              className={`text-center font-['DM_Sans'] text-2xl leading-6 ${
                empty ? 'font-normal text-zinc-400' : 'font-bold text-white'
              }`}
              aria-hidden
            >
              {formatVitalsTwoDigits(display)}
            </span>
          </div>
          <span className="text-sm font-normal tracking-tight text-white">mmHg</span>
        </div>
      </div>
    </div>
  )
}

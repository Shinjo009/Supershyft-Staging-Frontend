/** Responsive layout tokens — phones fill the screen with a 25px side gutter. */

/** 25px from the left and right edges of the page on phones. */
export const PAGE_GUTTER_X = 'px-[16px]'

/**
 * Match Profile “My Profile” header: content padding-top 20px + header top 20px.
 * Keeps back arrow / section title clear of the PWA status bar the same way Profile does.
 */
export const MCQ_HEADER_CLASS = `flex shrink-0 items-center ${PAGE_GUTTER_X} pb-0 pt-[50px]`

/**
 * Extra room around glowing cards so box-shadow is not clipped by overflow-y.
 * 10px matches the featured-card glow (`0 0 10px`).
 */
export const GLOW_SAFE_BOX_CLASS = 'p-2.5 -m-2.5'

const SCROLL_HIDE =
  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [overflow-clip-margin:32px]'

export const APP_COLUMN_MAX = 'lg:max-w-[480px] xl:max-w-[520px]'
export const ANTHRO_COLUMN_MAX = 'lg:max-w-[560px] xl:max-w-[680px]'

export const APP_COLUMN_CLASS = `mx-auto h-full w-full ${APP_COLUMN_MAX}`

export const MCQ_SHELL_CLASS =
  'relative mx-auto flex h-full min-h-0 w-full flex-col pb-[108px]'

/** Anthropometry fills the column and grows on large screens. */
export const ANTHRO_SHELL_CLASS =
  'relative mx-auto flex h-full min-h-0 w-full flex-col pb-[108px]'

export const ANTHRO_COLUMN_CLASS = `mx-auto h-full w-full ${ANTHRO_COLUMN_MAX}`

export const ANTHRO_FOOTER_INNER_CLASS = `mx-auto flex w-full ${ANTHRO_COLUMN_MAX} items-center justify-between gap-3 ${PAGE_GUTTER_X} py-2`

export const MCQ_SHELL_SCROLL_CLASS = `mt-2 min-h-0 flex-1 overflow-y-auto ${SCROLL_HIDE}`

export const MCQ_SHELL_FOOTER_INNER_CLASS = `mx-auto flex w-full ${APP_COLUMN_MAX} items-center justify-between gap-3 ${PAGE_GUTTER_X} py-2`

export const MCQ_CHROME_X_CLASS = PAGE_GUTTER_X

/** One-line next-question preview; truncates with ".." when too long. */
export function formatNextQuestionPreview(line1: string, line2: string, maxChars = 28): string {
  const text = [line1, line2].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trimEnd()}..`
}

export const MCQ_INFO_CARD_CLASS =
  'relative w-full overflow-hidden rounded-[24px] border border-[rgba(255,255,255,0.5)] bg-[rgba(0,0,0,0.5)] px-5 py-[31px] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] backdrop-blur-[5px] lg:max-w-[420px] lg:px-7 lg:py-9'

export const ASSESSMENT_CARD_STACK_CLASS = `mx-auto flex w-full flex-col gap-[18px] ${GLOW_SAFE_BOX_CLASS}`

/** Tighter stack for the 5-section Health Assessment intro. */
export const ASSESSMENT_FIVE_CARD_STACK_CLASS = `mx-auto flex w-full flex-col gap-3 ${GLOW_SAFE_BOX_CLASS}`

export const ASSESSMENT_CONTENT_MAX_CLASS = 'w-full'

export const ASSESSMENT_SUBTITLE_CLASS =
  'mt-1.5 w-full text-center text-[12px] leading-4 text-[#9a9a9a] lg:text-[13px]'

export const JOURNEY_COMPLETE_CONTENT_CLASS = 'flex w-full flex-col items-center gap-6'

export const MCQ_PILL_CHIP_CLASS = 'min-w-0 w-[calc(50%-8px)]'

/** Helper / example line under a question title (! overrides parent text-white) */
export const MCQ_QUESTION_HINT_CLASS = 'mt-0 text-[12px] !text-[#9a9a9a]'

/** Solid borders — avoids 0.25/0.5px anti-alias fade by position on dark gradients */
export const MCQ_PILL_BORDER_IDLE = '#969696'
export const MCQ_PILL_BORDER_SELECTED = '#d0d0d0'

export const MCQ_DIAL_DESKTOP_CLASS = 'lg:scale-110 lg:origin-center'

export interface SchoolPeriod {
  value: string
  label: string
  start: string // "HH:MM"
  end: string
}

export const SCHOOL_PERIODS: SchoolPeriod[] = [
  { value: 'p1', label: '1교시', start: '08:20', end: '09:10' },
  { value: 'p2', label: '2교시', start: '09:20', end: '10:10' },
  { value: 'p3', label: '3교시', start: '10:20', end: '11:10' },
  { value: 'p4', label: '4교시', start: '11:20', end: '12:10' },
  { value: 'lunch', label: '점심시간', start: '12:10', end: '13:10' },
  { value: 'p5', label: '5교시', start: '13:10', end: '14:00' },
  { value: 'p6', label: '6교시', start: '14:10', end: '15:00' },
  { value: 'clean', label: '청소시간', start: '15:00', end: '15:20' },
  { value: 'p7', label: '7교시', start: '15:20', end: '16:10' },
  { value: 'p8', label: '8교시', start: '16:20', end: '17:10' },
  { value: 'p9', label: '9교시', start: '17:20', end: '18:10' },
  { value: 'dinner', label: '저녁시간', start: '18:10', end: '19:10' },
  { value: 'study1', label: '1자습', start: '19:10', end: '21:00' },
  { value: 'break', label: '쉬는시간', start: '21:00', end: '21:30' },
  { value: 'study2', label: '2자습', start: '21:30', end: '22:20' },
  { value: 'study3', label: '3자습', start: '22:40', end: '23:30' },
]

export function findPeriodByValue(value: string | null | undefined): SchoolPeriod | undefined {
  if (!value) return undefined
  return SCHOOL_PERIODS.find((p) => p.value === value)
}

export const CLASS_OPTIONS = [1, 2, 3, 4, 5, 6] as const

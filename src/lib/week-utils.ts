const SEMESTER_START = new Date('2026-03-02')

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function getWeekTypeForDate(date: Date): 'odd' | 'even' {
  const diffDays = Math.floor(
    (startOfDay(date).getTime() - startOfDay(SEMESTER_START).getTime()) /
      (1000 * 60 * 60 * 24)
  )
  const weekNumber = Math.floor(diffDays / 7) + 1
  return weekNumber % 2 === 1 ? 'odd' : 'even'
}

export function getCurrentWeekType(): 'odd' | 'even' {
  return getWeekTypeForDate(new Date())
}

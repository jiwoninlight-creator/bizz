export function getGradeFromEmail(email: string): number | null {
    const match = email.match(/^(\d{2})/)
    if (!match) return null
    
    const cohort = parseInt(match[1])
    const currentFirstYearCohort = 43
    const grade = currentFirstYearCohort - cohort + 1
    
    if (grade < 1 || grade > 3) return null
    return grade
  }
  
  export function isTeacherEmail(email: string): boolean {
    return !/^\d{2}/.test(email)
  }
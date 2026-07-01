/**
 * 학교 이메일 형식(앞 2자리 숫자)에서 학년을 유추한다.
 * - 숫자로 시작하지 않으면 null
 * - 학년 범위(1~3)를 벗어나면 null
 */
export function getGradeFromEmail(email: string): number | null {
  const match = email.match(/^(\d{2})/)
  if (!match) return null

  const cohort = parseInt(match[1])
  const currentFirstYearCohort = 43
  const grade = currentFirstYearCohort - cohort + 1

  if (grade < 1 || grade > 3) return null
  return grade
}

/**
 * 이메일이 학생 학번 형식이 아닐 때 true.
 * 자동으로 선생님 role을 지정하는 데는 사용하지 않는다.
 * (모든 유저는 처음에 'student'로 시작하며, 선생님 전환은 설정 페이지에서 신청)
 */
export function isNonStudentEmail(email: string): boolean {
  return !/^\d{2}/.test(email)
}

/**
 * @deprecated 이 함수는 이제 role 자동 지정에 사용하지 않는다.
 * 하위 호환을 위해 남겨두었으며 내부적으로 isNonStudentEmail 을 호출한다.
 */
export function isTeacherEmail(email: string): boolean {
  return isNonStudentEmail(email)
}

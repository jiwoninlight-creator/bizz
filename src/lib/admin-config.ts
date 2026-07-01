export const ADMIN_EMAILS = [
  '43th68@djshs.djsch.kr',
  '43th07@djshs.djsch.kr',
  '43th06@djshs.djsch.kr',
]

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

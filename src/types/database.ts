export type UserRole = 'student' | 'teacher' | 'admin'

export type User = {
  id: string
  email: string
  name: string
  role: UserRole
  grade: number | null
  avatar_url: string | null
  created_at: string
}

export type TeacherStatus =
  | 'available'
  | 'in_class'
  | 'meeting'
  | 'out'
  | 'unknown'

export type Teacher = {
  id: string
  user_id: string | null
  name: string
  subject: string
  office_location: string
  photo_url: string | null
  current_status: TeacherStatus
  updated_at: string
}

export type TeacherSchedule = {
  id: string
  teacher_id: string
  day_of_week: number
  period: number
  classroom: string
  grade: number
  class_number: number
}

export type EventType = 'assignment' | 'exam' | 'personal'

export type Event = {
  id: string
  user_id: string
  title: string
  subject: string | null
  event_date: string
  event_type: EventType
  memo: string | null
  grade: number | null
  created_at: string
}

export type MaterialFileType = 'pdf' | 'hwp' | 'image' | 'other'
export type MaterialStatus = 'pending' | 'approved' | 'rejected'

export type Material = {
  id: string
  title: string
  subject: string
  teacher_id: string | null
  grade: number
  file_url: string
  file_type: MaterialFileType
  file_size: number
  uploaded_by: string
  status: MaterialStatus
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export type MaterialWithTeacher = Material & {
  teacher: Pick<Teacher, 'id' | 'name'> | null
}

export type MessageTone = 'formal' | 'casual'
export type MessagePurpose = 'question' | 'counsel' | 'report' | 'research'

export type Message = {
  id: string
  sender_id: string
  receiver_id: string
  tone: MessageTone
  purpose: MessagePurpose
  title: string
  body: string
  is_read: boolean
  created_at: string
}

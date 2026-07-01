export type UserRole = 'student' | 'teacher' | 'admin' | 'class_leader'
export type ClassLeaderType = 'leader' | 'vice_leader'
export type ClassLeaderStatus = 'none' | 'pending' | 'approved' | 'rejected'
export type TeacherApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected'

export type User = {
  id: string
  email: string
  name: string
  role: UserRole
  grade: number | null
  class_number: number | null
  class_leader_type: ClassLeaderType | null
  class_leader_status: ClassLeaderStatus
  teacher_status: TeacherApplicationStatus
  onboarded: boolean
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
  is_self_registered: boolean
  managed_grades: number[]
  managed_classes: number[]
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
export type EventScope = 'personal' | 'class' | 'grade' | 'schoolwide'
export type EventApprovalStatus = 'approved' | 'pending' | 'rejected'

export type Event = {
  id: string
  user_id: string
  title: string
  subject: string | null
  event_date: string
  event_type: EventType
  memo: string | null
  grade: number | null
  class_number: number | null
  period: string | null
  start_time: string | null
  end_time: string | null
  is_completed: boolean
  completed_at: string | null
  approval_status: EventApprovalStatus
  approved_by: string | null
  scope: EventScope
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
  class_number: number | null
  category: string | null
  file_url: string
  file_type: MaterialFileType
  file_size: number
  original_filename: string | null
  uploaded_by: string
  status: MaterialStatus
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export type MaterialWithTeacher = Material & {
  teacher: Pick<Teacher, 'id' | 'name'> | null
}

export type MaterialWithUploader = Material & {
  teacher: Pick<Teacher, 'id' | 'name'> | null
  uploader: Pick<User, 'id' | 'name' | 'email'> | null
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

export type DailyMemo = {
  id: string
  user_id: string
  memo_date: string
  content: string
  created_at: string
  updated_at: string
}

export type EventCompletion = {
  id: string
  event_id: string
  user_id: string
  completed_at: string
}

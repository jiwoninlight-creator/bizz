'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
  LayoutGridIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import { getErrorMessage, cn } from '@/lib/utils'
import type {
  MaterialFileType,
  MaterialWithTeacher,
  Teacher,
} from '@/types/database'
import MaterialCard from '@/components/MaterialCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const SUBJECT_OPTIONS = [
  '국어',
  '영어',
  '수학',
  '과학',
  '사회',
  '역사',
  '기타',
] as const

const CATEGORY_OPTIONS = [
  '수업자료',
  '교과서',
  '시험지',
  '참고자료',
  '기타',
] as const

const MAX_FILE_SIZE = 50 * 1024 * 1024

function getFileType(filename: string): MaterialFileType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'hwp' || ext === 'hwpx') return 'hwp'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
  return 'other'
}

function sanitizeStorageFilename(name: string): string {
  const lastDot = name.lastIndexOf('.')
  const hasExt = lastDot > 0 && lastDot < name.length - 1
  const rawBase = hasExt ? name.slice(0, lastDot) : name
  const rawExt = hasExt ? name.slice(lastDot + 1) : ''

  let safeBase = rawBase
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (safeBase.length === 0) safeBase = 'file'

  const safeExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '')
  return safeExt ? `${safeBase}.${safeExt}` : safeBase
}

type ViewMode = 'all' | 'by-teacher'

export default function MaterialsPage() {
  const {
    user,
    profile,
    loading: userLoading,
    isAdmin,
    isClassLeader,
    isTeacher,
  } = useUser()

  const [materials, setMaterials] = useState<MaterialWithTeacher[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [myTeacher, setMyTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [gradeFilter, setGradeFilter] = useState<'all' | '1' | '2' | '3'>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [gradeFilterInitialized, setGradeFilterInitialized] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formSubject, setFormSubject] = useState<string>('')
  const [formTeacherId, setFormTeacherId] = useState<string>('')
  const [formGrade, setFormGrade] = useState<string>('1')
  const [formClassNumber, setFormClassNumber] = useState<string>('')
  const [formCategory, setFormCategory] = useState<string>('수업자료')
  const [formFile, setFormFile] = useState<File | null>(null)

  useEffect(() => {
    if (gradeFilterInitialized) return
    if (profile?.grade && [1, 2, 3].includes(profile.grade)) {
      setGradeFilter(String(profile.grade) as '1' | '2' | '3')
    }
    if (profile) setGradeFilterInitialized(true)
  }, [profile, gradeFilterInitialized])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('teachers')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load teachers:', error)
          return
        }
        setTeachers((data ?? []) as Teacher[])
      })
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setMyTeacher(null)
      return
    }
    const supabase = createClient()
    supabase
      .from('teachers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle<Teacher>()
      .then(({ data }) => setMyTeacher(data ?? null))
  }, [user?.id])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchMaterials = useCallback(async () => {
    if (userLoading) return
    setLoading(true)

    const supabase = createClient()
    let query = supabase
      .from('materials')
      .select('*, teacher:teachers(id, name, subject)')
      .order('created_at', { ascending: false })

    if (isAdmin || isClassLeader) {
      query = query.in('status', ['approved', 'pending'])
    } else if (user?.id) {
      query = query.or(
        `status.eq.approved,and(uploaded_by.eq.${user.id},status.eq.pending)`
      )
    } else {
      query = query.eq('status', 'approved')
    }

    if (gradeFilter !== 'all') {
      query = query.eq('grade', Number(gradeFilter))
    }

    if (debouncedSearch) {
      query = query.ilike('title', `%${debouncedSearch}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error('Failed to load materials:', error)
      setMaterials([])
    } else {
      setMaterials((data ?? []) as MaterialWithTeacher[])
    }
    setLoading(false)
  }, [
    debouncedSearch,
    gradeFilter,
    user?.id,
    userLoading,
    isAdmin,
    isClassLeader,
  ])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  const openDialog = () => {
    if (isTeacher && myTeacher) {
      setFormTitle('')
      setFormSubject(myTeacher.subject)
      setFormTeacherId(myTeacher.id)
      const grades = myTeacher.managed_grades ?? []
      setFormGrade(String(grades[0] ?? profile?.grade ?? 1))
      setFormClassNumber('')
      setFormCategory('수업자료')
      setFormFile(null)
    } else if (isAdmin) {
      setFormTitle('')
      setFormSubject('')
      setFormTeacherId('')
      setFormGrade(String(profile?.grade ?? 1))
      setFormClassNumber('')
      setFormCategory('수업자료')
      setFormFile(null)
    } else {
      setFormTitle('')
      setFormSubject('')
      setFormTeacherId('')
      setFormGrade(profile?.grade ? String(profile.grade) : '1')
      setFormClassNumber('')
      setFormCategory('수업자료')
      setFormFile(null)
    }
    setDialogOpen(true)
  }

  const canSubmit = useMemo(() => {
    if (submitting) return false
    if (formTitle.trim().length === 0) return false
    if (formSubject.length === 0) return false
    if (formGrade.length === 0) return false
    if (formFile === null) return false
    return true
  }, [formTitle, formSubject, formGrade, formFile, submitting])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formFile) return

    if (formFile.size > MAX_FILE_SIZE) {
      alert('50MB 이하 파일만 업로드할 수 있습니다')
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const safeName = sanitizeStorageFilename(formFile.name)
      const path = `${user.id}/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(path, formFile, {
          cacheControl: '3600',
          upsert: false,
        })
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('materials').getPublicUrl(path)

      const willAutoApprove = isAdmin || isTeacher

      const { error: insertError } = await supabase.from('materials').insert({
        title: formTitle.trim(),
        subject: formSubject,
        teacher_id: formTeacherId || null,
        grade: Number(formGrade),
        class_number: formClassNumber ? Number(formClassNumber) : null,
        category: formCategory || null,
        file_url: publicUrl,
        file_type: getFileType(formFile.name),
        file_size: formFile.size,
        original_filename: formFile.name,
        uploaded_by: user.id,
        status: willAutoApprove ? 'approved' : 'pending',
        approved_by: willAutoApprove ? user.id : null,
        approved_at: willAutoApprove ? new Date().toISOString() : null,
      })
      if (insertError) throw insertError

      setDialogOpen(false)
      alert(
        willAutoApprove
          ? '자료가 등록되었습니다.'
          : '관리자 승인 후 공개됩니다.'
      )
      await fetchMaterials()
    } catch (err) {
      console.error('Upload failed:', err)
      alert(`업로드에 실패했습니다: ${getErrorMessage(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const canDeleteMaterial = useCallback(
    (m: MaterialWithTeacher): boolean => {
      if (!user) return false
      if (isAdmin) return true
      if (m.uploaded_by === user.id) {
        if (m.status === 'pending') return true
        return isTeacher
      }
      return false
    },
    [user, isAdmin, isTeacher]
  )

  const handleDelete = async (m: MaterialWithTeacher) => {
    if (!confirm(`"${m.title}" 자료를 삭제할까요?`)) return
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', m.id)
      if (error) throw error
      await fetchMaterials()
    } catch (err) {
      console.error('Delete material failed:', err)
      alert(`삭제 실패: ${getErrorMessage(err)}`)
    }
  }

  // ---------------- Derived data for by-teacher view ----------------

  const uniqueSubjects = useMemo(() => {
    const set = new Set<string>()
    for (const t of teachers) set.add(t.subject)
    for (const m of materials) if (m.subject) set.add(m.subject)
    return Array.from(set).sort()
  }, [teachers, materials])

  const teachersBySubject = useMemo(() => {
    const map = new Map<string, Teacher[]>()
    for (const t of teachers) {
      const arr = map.get(t.subject) ?? []
      arr.push(t)
      map.set(t.subject, arr)
    }
    return map
  }, [teachers])

  const materialsByTeacher = useMemo(() => {
    const map = new Map<string, MaterialWithTeacher[]>()
    const commonKey = '__common__'
    for (const m of materials) {
      if (m.status !== 'approved') continue
      if (debouncedSearch) {
        if (!m.title.toLowerCase().includes(debouncedSearch.toLowerCase())) {
          continue
        }
      }
      const key = m.teacher_id ?? commonKey
      const arr = map.get(key) ?? []
      arr.push(m)
      map.set(key, arr)
    }
    return map
  }, [materials, debouncedSearch])

  const visibleSubjects = useMemo(
    () =>
      subjectFilter === 'all'
        ? uniqueSubjects
        : uniqueSubjects.filter((s) => s === subjectFilter),
    [uniqueSubjects, subjectFilter]
  )

  const commonMaterials = materialsByTeacher.get('__common__') ?? []

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-900">수업 자료</h1>

        <div className="flex w-full rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <LayoutGridIcon className="h-4 w-4" />
            전체 보기
          </button>
          <button
            type="button"
            onClick={() => setViewMode('by-teacher')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'by-teacher'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <UsersIcon className="h-4 w-4" />
            선생님별
          </button>
        </div>

        <div className="flex gap-2">
          <Select
            value={gradeFilter}
            onValueChange={(v) =>
              setGradeFilter(v as 'all' | '1' | '2' | '3')
            }
          >
            <SelectTrigger className="w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="1">1학년</SelectItem>
              <SelectItem value="2">2학년</SelectItem>
              <SelectItem value="3">3학년</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="제목으로 검색"
              className="h-9 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {viewMode === 'by-teacher' && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
            <SubjectChip
              label="전체"
              active={subjectFilter === 'all'}
              onClick={() => setSubjectFilter('all')}
            />
            {uniqueSubjects.map((s) => (
              <SubjectChip
                key={s}
                label={s}
                active={subjectFilter === s}
                onClick={() => setSubjectFilter(s)}
              />
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-sm">불러오는 중…</span>
        </div>
      ) : viewMode === 'all' ? (
        materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-slate-500">등록된 자료가 없습니다</p>
            <p className="mt-1 text-xs text-slate-400">
              우측 하단 버튼으로 자료를 등록해보세요
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {materials.map((m) => (
              <MaterialCard
                key={m.id}
                material={m}
                currentUserId={user?.id}
                canDelete={canDeleteMaterial(m)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-5">
          {visibleSubjects.map((subj) => {
            const list = teachersBySubject.get(subj) ?? []
            const applicable = list.filter((t) => {
              const items = materialsByTeacher.get(t.id) ?? []
              if (items.length === 0) return false
              if (gradeFilter === 'all') return true
              return items.some((m) => m.grade === Number(gradeFilter))
            })
            if (applicable.length === 0) return null
            return (
              <section key={subj} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-800">
                    {subj}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {applicable.length}명
                  </span>
                </div>
                {applicable.map((t) => {
                  const list = (materialsByTeacher.get(t.id) ?? []).filter(
                    (m) =>
                      gradeFilter === 'all' ||
                      m.grade === Number(gradeFilter)
                  )
                  if (list.length === 0) return null
                  return (
                    <TeacherSection
                      key={t.id}
                      teacher={t}
                      materials={list}
                      currentUserId={user?.id}
                      canDelete={canDeleteMaterial}
                      onDelete={handleDelete}
                    />
                  )
                })}
              </section>
            )
          })}

          {commonMaterials.length > 0 && subjectFilter === 'all' && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-800">공통</h2>
                <span className="text-xs text-slate-400">
                  교과서 · 공통자료
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {commonMaterials
                  .filter(
                    (m) =>
                      gradeFilter === 'all' ||
                      m.grade === Number(gradeFilter)
                  )
                  .map((m) => (
                    <MaterialCard
                      key={m.id}
                      material={m}
                      currentUserId={user?.id}
                      canDelete={canDeleteMaterial(m)}
                      onDelete={handleDelete}
                    />
                  ))}
              </div>
            </section>
          )}

          {visibleSubjects.every((s) => {
            const list = teachersBySubject.get(s) ?? []
            return list.every(
              (t) => (materialsByTeacher.get(t.id) ?? []).length === 0
            )
          }) &&
            commonMaterials.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-slate-500">등록된 자료가 없어요</p>
              </div>
            )}
        </div>
      )}

      <Button
        onClick={openDialog}
        size="lg"
        className={cn(
          'fixed bottom-24 right-4 z-40 h-14 rounded-full px-5 shadow-lg',
          isAdmin && 'bg-red-600 hover:bg-red-700',
          isTeacher && !isAdmin && 'bg-purple-600 hover:bg-purple-700'
        )}
      >
        <PlusIcon className="h-5 w-5" />
        <span className="ml-1 text-sm font-semibold">자료 등록</span>
      </Button>

      <UploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        handleSubmit={handleSubmit}
        submitting={submitting}
        canSubmit={canSubmit}
        role={isAdmin ? 'admin' : isTeacher ? 'teacher' : 'student'}
        myTeacher={myTeacher}
        teachers={teachers}
        formTitle={formTitle}
        setFormTitle={setFormTitle}
        formSubject={formSubject}
        setFormSubject={setFormSubject}
        formTeacherId={formTeacherId}
        setFormTeacherId={setFormTeacherId}
        formGrade={formGrade}
        setFormGrade={setFormGrade}
        formClassNumber={formClassNumber}
        setFormClassNumber={setFormClassNumber}
        formCategory={formCategory}
        setFormCategory={setFormCategory}
        formFile={formFile}
        setFormFile={setFormFile}
      />
    </div>
  )
}

/* ------------------------------ Subcomponents ------------------------------ */

function SubjectChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-blue-600 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      )}
    >
      {label}
    </button>
  )
}

function TeacherSection({
  teacher,
  materials,
  currentUserId,
  canDelete,
  onDelete,
}: {
  teacher: Teacher
  materials: MaterialWithTeacher[]
  currentUserId?: string
  canDelete: (m: MaterialWithTeacher) => boolean
  onDelete: (m: MaterialWithTeacher) => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <Avatar className="h-8 w-8">
          {teacher.photo_url ? (
            <AvatarImage src={teacher.photo_url} alt={teacher.name} />
          ) : null}
          <AvatarFallback className="bg-purple-100 text-xs font-semibold text-purple-700">
            {teacher.name.trim().slice(0, 1) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-900">
              {teacher.name} 선생님
            </span>
            <Badge
              variant="secondary"
              className="h-4 bg-purple-50 px-1.5 text-[10px] text-purple-700"
            >
              {teacher.subject}
            </Badge>
          </div>
        </div>
        <span className="text-xs text-slate-400">{materials.length}개</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {materials.map((m) => (
          <MaterialCard
            key={m.id}
            material={m}
            currentUserId={currentUserId}
            canDelete={canDelete(m)}
            onDelete={onDelete}
            compact
          />
        ))}
      </div>
    </div>
  )
}

/* --------------------------- Upload dialog ---------------------------------- */

type UploadDialogProps = {
  open: boolean
  onOpenChange: (o: boolean) => void
  handleSubmit: (e: React.FormEvent) => void
  submitting: boolean
  canSubmit: boolean
  role: 'admin' | 'teacher' | 'student'
  myTeacher: Teacher | null
  teachers: Teacher[]
  formTitle: string
  setFormTitle: (v: string) => void
  formSubject: string
  setFormSubject: (v: string) => void
  formTeacherId: string
  setFormTeacherId: (v: string) => void
  formGrade: string
  setFormGrade: (v: string) => void
  formClassNumber: string
  setFormClassNumber: (v: string) => void
  formCategory: string
  setFormCategory: (v: string) => void
  formFile: File | null
  setFormFile: (v: File | null) => void
}

function UploadDialog(props: UploadDialogProps) {
  const {
    open,
    onOpenChange,
    handleSubmit,
    submitting,
    canSubmit,
    role,
    myTeacher,
    teachers,
    formTitle,
    setFormTitle,
    formSubject,
    setFormSubject,
    formTeacherId,
    setFormTeacherId,
    formGrade,
    setFormGrade,
    formClassNumber,
    setFormClassNumber,
    formCategory,
    setFormCategory,
    formFile,
    setFormFile,
  } = props

  const managedGrades =
    role === 'teacher' && myTeacher
      ? myTeacher.managed_grades && myTeacher.managed_grades.length > 0
        ? myTeacher.managed_grades
        : [1, 2, 3]
      : [1, 2, 3]

  const description =
    role === 'admin'
      ? '관리자 권한으로 즉시 공개돼요.'
      : role === 'teacher'
        ? '선생님 권한으로 즉시 공개돼요.'
        : '업로드한 자료는 관리자 승인 후 해당 학년에 공개돼요.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>자료 등록하기</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="material-title">제목</Label>
            <Input
              id="material-title"
              placeholder="예: 3단원 요약 정리"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="material-subject">과목</Label>
              {role === 'teacher' ? (
                <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                  {formSubject}
                </div>
              ) : (
                <Select
                  value={formSubject}
                  onValueChange={setFormSubject}
                >
                  <SelectTrigger id="material-subject" className="w-full h-9">
                    <SelectValue placeholder="과목 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="material-category">카테고리</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger id="material-category" className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="material-grade">학년</Label>
              <Select value={formGrade} onValueChange={setFormGrade}>
                <SelectTrigger id="material-grade" className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {managedGrades.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      {g}학년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="material-class">반 (선택)</Label>
              <Select
                value={formClassNumber || 'all'}
                onValueChange={(v) =>
                  setFormClassNumber(v === 'all' ? '' : v)
                }
              >
                <SelectTrigger id="material-class" className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 반</SelectItem>
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {c}반
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {role !== 'teacher' && (
            <div className="space-y-1.5">
              <Label htmlFor="material-teacher">선생님 (선택)</Label>
              <Select
                value={formTeacherId || 'none'}
                onValueChange={(v) =>
                  setFormTeacherId(v === 'none' ? '' : v)
                }
              >
                <SelectTrigger id="material-teacher" className="w-full h-9">
                  <SelectValue placeholder="선생님 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">공통 · 교과서</SelectItem>
                  {teachers.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-slate-400">
                      등록된 선생님이 없습니다
                    </div>
                  ) : (
                    teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} · {t.subject}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="material-file">
              파일 (PDF · HWP · 이미지, 50MB 이하)
            </Label>
            <Input
              id="material-file"
              type="file"
              accept=".pdf,.hwp,.hwpx,.jpg,.jpeg,.png"
              onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
              required
              className="h-auto py-1.5"
            />
            {formFile && (
              <p className="text-xs text-slate-500">
                {formFile.name} · {(formFile.size / 1024 / 1024).toFixed(2)}MB
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  <span className="ml-1">업로드 중…</span>
                </>
              ) : (
                '등록'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

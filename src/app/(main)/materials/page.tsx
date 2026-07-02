'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FileXIcon,
  LayersIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import { getErrorMessage, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getSubjectColor, SUBJECT_ORDER } from '@/lib/subject-colors'
import type {
  MaterialFileType,
  MaterialWithTeacher,
  Teacher,
} from '@/types/database'
import MaterialCard from '@/components/MaterialCard'
import EmptyState from '@/components/EmptyState'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

const SUBJECT_OPTIONS = [
  '국어',
  '영어',
  '수학',
  '과학',
  '사회',
  '역사',
  '물리',
  '화학',
  '생물',
  '지구과학',
  '기타',
] as const

const CATEGORY_OPTIONS = [
  '수업자료',
  '교과서',
  '시험지',
  '참고자료',
  '기타',
  '추가자료',
] as const

const SUPPLEMENTARY_CATEGORY = '추가자료'

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

/**
 * publicUrl(...materials/<userId>/<timestamp>_<name>.ext) 에서 storage 내부 경로만 추출.
 * 예: https://xxx.supabase.co/storage/v1/object/public/materials/abc/123_file.pdf
 *   → 'abc/123_file.pdf'
 */
function extractStoragePath(url: string): string | null {
  try {
    const marker = '/object/public/materials/'
    const idx = url.indexOf(marker)
    if (idx < 0) return null
    return decodeURIComponent(url.slice(idx + marker.length))
  } catch {
    return null
  }
}

type ViewMode = 'curriculum' | 'additional'
type UploadMode = 'file' | 'link'

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
  const [viewMode, setViewMode] = useState<ViewMode>('curriculum')
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
  const [uploadMode, setUploadMode] = useState<UploadMode>('file')
  const [formLinkUrl, setFormLinkUrl] = useState<string>('')

  const [editingMaterial, setEditingMaterial] = useState<MaterialWithTeacher | null>(
    null
  )
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())

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
      const term = debouncedSearch.replace(/[%,]/g, '')
      query = query.or(`title.ilike.%${term}%,subject.ilike.%${term}%`)
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
    setFormFile(null)
    setUploadMode('file')
    setFormLinkUrl('')
    setFormCategory('수업자료')
    setFormClassNumber('')
    setFormTitle('')

    if (isTeacher && myTeacher) {
      setFormSubject(myTeacher.subject)
      setFormTeacherId(myTeacher.id)
      const grades = myTeacher.managed_grades ?? []
      setFormGrade(String(grades[0] ?? profile?.grade ?? 1))
    } else if (isAdmin) {
      setFormSubject('')
      setFormTeacherId('')
      setFormGrade(String(profile?.grade ?? 1))
    } else {
      setFormSubject('')
      setFormTeacherId('')
      setFormGrade(profile?.grade ? String(profile.grade) : '1')
    }
    setDialogOpen(true)
  }

  const isSupplementary = formCategory === SUPPLEMENTARY_CATEGORY
  const isLinkMode = isSupplementary && uploadMode === 'link'

  const canSubmit = useMemo(() => {
    if (submitting) return false
    if (formTitle.trim().length === 0) return false
    if (formSubject.length === 0) return false
    if (formGrade.length === 0) return false
    if (isLinkMode) {
      if (formLinkUrl.trim().length === 0) return false
    } else {
      if (formFile === null) return false
    }
    return true
  }, [
    formTitle,
    formSubject,
    formGrade,
    formFile,
    formLinkUrl,
    isLinkMode,
    submitting,
  ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSubmitting(true)
    try {
      const supabase = createClient()
      const willAutoApprove = isAdmin || isTeacher
      const isTextbook = formCategory === '교과서'

      const commonPayload = {
        title: formTitle.trim(),
        subject: formSubject,
        // 교과서는 선생님 무관
        teacher_id: isTextbook ? null : formTeacherId || null,
        grade: Number(formGrade),
        class_number: formClassNumber ? Number(formClassNumber) : null,
        category: formCategory || null,
        uploaded_by: user.id,
        status: willAutoApprove ? 'approved' : 'pending',
        approved_by: willAutoApprove ? user.id : null,
        approved_at: willAutoApprove ? new Date().toISOString() : null,
        is_supplementary: isSupplementary,
      }

      if (isLinkMode) {
        const url = formLinkUrl.trim()
        try {
          new URL(url)
        } catch {
          toast.error('올바른 링크 주소를 입력해주세요 (http/https).')
          setSubmitting(false)
          return
        }
        const { error: insertError } = await supabase.from('materials').insert({
          ...commonPayload,
          file_url: url,
          file_type: 'link',
          file_size: 0,
          original_filename: null,
          link_url: url,
        })
        if (insertError) throw insertError
      } else {
        if (!formFile) return
        if (formFile.size > MAX_FILE_SIZE) {
          toast.error('50MB 이하 파일만 업로드할 수 있어요')
          setSubmitting(false)
          return
        }
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

        const { error: insertError } = await supabase.from('materials').insert({
          ...commonPayload,
          file_url: publicUrl,
          file_type: getFileType(formFile.name),
          file_size: formFile.size,
          original_filename: formFile.name,
          link_url: null,
        })
        if (insertError) throw insertError
      }

      setDialogOpen(false)
      toast.success(
        willAutoApprove
          ? '자료가 등록되었어요'
          : '관리자 승인을 기다려주세요'
      )
      await fetchMaterials()
    } catch (err) {
      console.error('Upload failed:', err)
      toast.error(`업로드에 실패했어요: ${getErrorMessage(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const canDeleteMaterial = useCallback(
    (m: MaterialWithTeacher): boolean => {
      if (!user) return false
      // 관리자: 모든 자료 삭제 가능
      if (isAdmin) return true
      // 본인 업로드
      if (m.uploaded_by === user.id) {
        // 선생님: 승인 여부 무관하게 본인 자료 삭제 가능
        if (isTeacher) return true
        // 일반/학생/반장: pending 상태에서만 삭제 가능. approved 후에는 불가.
        return m.status === 'pending'
      }
      return false
    },
    [user, isAdmin, isTeacher]
  )

  const canEditMaterial = useCallback(
    (m: MaterialWithTeacher): boolean => {
      if (!user) return false
      // 관리자: 모든 자료 수정 가능
      if (isAdmin) return true
      // 선생님: 본인이 올린 approved/pending 자료 수정 가능
      if (isTeacher && m.uploaded_by === user.id) return true
      return false
    },
    [user, isAdmin, isTeacher]
  )

  const handleDelete = async (m: MaterialWithTeacher) => {
    const isLink = m.file_type === 'link'
    if (
      !confirm(
        isLink
          ? `"${m.title}" 링크를 삭제할까요?`
          : `"${m.title}" 자료를 삭제할까요?\n\nStorage의 파일도 함께 삭제돼요.`
      )
    )
      return

    const prevMaterials = materials
    setExitingIds((prev) => new Set(prev).add(m.id))
    await new Promise((r) => setTimeout(r, 200))
    setMaterials((prev) => prev.filter((x) => x.id !== m.id))
    setExitingIds((prev) => {
      const next = new Set(prev)
      next.delete(m.id)
      return next
    })

    try {
      const supabase = createClient()

      if (!isLink) {
        const storagePath = extractStoragePath(m.file_url)
        if (storagePath) {
          const { error: storageErr } = await supabase.storage
            .from('materials')
            .remove([storagePath])
          if (storageErr) {
            console.warn('Storage delete failed (continuing):', storageErr)
          }
        }
      }

      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', m.id)
      if (error) throw error
      toast.success('자료가 삭제되었어요')
    } catch (err) {
      console.error('Delete material failed:', err)
      setMaterials(prevMaterials)
      toast.error(`삭제 실패: ${getErrorMessage(err)}`)
    }
  }

  const handleEdit = (m: MaterialWithTeacher) => {
    setEditingMaterial(m)
  }

  // ---------------- Derived data ----------------

  // 교과자료 / 추가자료 분리
  const curriculumMaterials = useMemo(
    () => materials.filter((m) => !m.is_supplementary),
    [materials]
  )
  const additionalMaterials = useMemo(
    () => materials.filter((m) => m.is_supplementary),
    [materials]
  )

  const teachersBySubject = useMemo(() => {
    const map = new Map<string, Teacher[]>()
    for (const t of teachers) {
      const arr = map.get(t.subject) ?? []
      arr.push(t)
      map.set(t.subject, arr)
    }
    return map
  }, [teachers])

  // 교과자료: subject 선택 시 표시할 그룹 데이터 구성
  const curriculumBySubject = useMemo(() => {
    if (subjectFilter === 'all') return null
    const subj = subjectFilter
    // 이 과목과 매칭되는 자료 (subject 일치)
    const relevant = curriculumMaterials.filter(
      (m) =>
        m.subject === subj &&
        (m.status === 'approved' ||
          m.uploaded_by === user?.id ||
          isAdmin ||
          isClassLeader)
    )
    // 교과서/공통(teacher_id 없거나 category='교과서') 은 별도 섹션
    const commonList = relevant.filter(
      (m) => !m.teacher_id || m.category === '교과서'
    )
    const teacherIds = Array.from(
      new Set(relevant.filter((m) => !!m.teacher_id).map((m) => m.teacher_id!))
    )
    // 이 과목 소속 선생님 목록에 자료가 있는 선생님만
    const subjectTeachers = teachers.filter((t) => teacherIds.includes(t.id))
    const materialsByTeacherMap = new Map<string, MaterialWithTeacher[]>()
    for (const m of relevant) {
      if (!m.teacher_id || m.category === '교과서') continue
      const arr = materialsByTeacherMap.get(m.teacher_id) ?? []
      arr.push(m)
      materialsByTeacherMap.set(m.teacher_id, arr)
    }
    return {
      commonList,
      teachers: subjectTeachers,
      byTeacher: materialsByTeacherMap,
    }
  }, [
    subjectFilter,
    curriculumMaterials,
    teachers,
    user?.id,
    isAdmin,
    isClassLeader,
  ])

  const linkMaterials = useMemo(
    () => additionalMaterials.filter((m) => m.file_type === 'link'),
    [additionalMaterials]
  )
  const supplementaryFiles = useMemo(
    () => additionalMaterials.filter((m) => m.file_type !== 'link'),
    [additionalMaterials]
  )

  const gradeFilteredCurriculum = useMemo(
    () =>
      curriculumMaterials.filter(
        (m) => gradeFilter === 'all' || m.grade === Number(gradeFilter)
      ),
    [curriculumMaterials, gradeFilter]
  )

  // 사이드바에 보여줄 과목별 개수 (해당 학년 필터 반영). 존재하는 과목만 표시.
  const subjectCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of gradeFilteredCurriculum) {
      map.set(m.subject, (map.get(m.subject) ?? 0) + 1)
    }
    return map
  }, [gradeFilteredCurriculum])

  const additionalCount = useMemo(
    () =>
      additionalMaterials.filter(
        (m) => gradeFilter === 'all' || m.grade === Number(gradeFilter)
      ).length,
    [additionalMaterials, gradeFilter]
  )

  const availableSubjects = useMemo(() => {
    const ordered = SUBJECT_ORDER.filter((s) => (subjectCounts.get(s) ?? 0) > 0)
    return ordered
  }, [subjectCounts])

  // 사이드바 선택 상태를 viewMode + subjectFilter로부터 파생
  const sidebarKey: string =
    viewMode === 'additional' ? '__additional__' : subjectFilter
  const selectAll = () => {
    setViewMode('curriculum')
    setSubjectFilter('all')
  }
  const selectSubject = (s: string) => {
    setViewMode('curriculum')
    setSubjectFilter(s)
  }
  const selectAdditional = () => {
    setViewMode('additional')
  }

  const canRegisterMaterial = !!user

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16 text-zinc-400">
          <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-sm">불러오는 중…</span>
        </div>
      )
    }
    if (viewMode === 'additional') {
      const links = linkMaterials.filter(
        (m) => gradeFilter === 'all' || m.grade === Number(gradeFilter)
      )
      const files = supplementaryFiles.filter(
        (m) => gradeFilter === 'all' || m.grade === Number(gradeFilter)
      )
      if (links.length === 0 && files.length === 0) {
        return (
          <EmptyState
            icon={FileXIcon}
            title="등록된 추가자료가 없어요"
            description="🔗 링크나 📎 참고 파일을 등록해보세요. 학년 필터를 낮춰보는 것도 방법이에요."
            action={
              canRegisterMaterial
                ? {
                    label: '자료 등록',
                    onClick: openDialog,
                    icon: PlusIcon,
                  }
                : undefined
            }
          />
        )
      }
      return (
        <AdditionalTab
          links={links}
          files={files}
          currentUserId={user?.id}
          canDelete={canDeleteMaterial}
          onDelete={handleDelete}
          canEdit={canEditMaterial}
          onEdit={handleEdit}
        />
      )
    }
    // curriculum
    if (subjectFilter === 'all') {
      if (gradeFilteredCurriculum.length === 0) {
        return (
          <EmptyState
            icon={FileXIcon}
            title="등록된 교과자료가 없어요"
            description="첫 자료를 등록해서 학생/동료들과 공유해보세요."
            action={
              canRegisterMaterial
                ? {
                    label: '자료 등록',
                    onClick: openDialog,
                    icon: PlusIcon,
                  }
                : undefined
            }
          />
        )
      }
      return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {gradeFilteredCurriculum.map((m) => (
            <MaterialCardWrap key={m.id} id={m.id} exiting={exitingIds}>
              <MaterialCard
                material={m}
                currentUserId={user?.id}
                canDelete={canDeleteMaterial(m)}
                onDelete={handleDelete}
                canEdit={canEditMaterial(m)}
                onEdit={handleEdit}
              />
            </MaterialCardWrap>
          ))}
        </div>
      )
    }
    // curriculum + specific subject
    const data = curriculumBySubject
    const commonFiltered = (data?.commonList ?? []).filter(
      (m) => gradeFilter === 'all' || m.grade === Number(gradeFilter)
    )
    const teacherEntries = (data?.teachers ?? []).map((t) => {
      const list = (data?.byTeacher.get(t.id) ?? []).filter(
        (m) => gradeFilter === 'all' || m.grade === Number(gradeFilter)
      )
      return { teacher: t, list }
    })
    const teachersFiltered = teacherEntries.filter((x) => x.list.length > 0)
    if (commonFiltered.length === 0 && teachersFiltered.length === 0) {
      return (
        <EmptyState
          icon={FileXIcon}
          title={`${subjectFilter} 자료가 아직 없어요`}
          description="다른 과목을 둘러보거나 첫 자료를 등록해보세요."
          action={
            canRegisterMaterial
              ? {
                  label: '자료 등록',
                  onClick: openDialog,
                  icon: PlusIcon,
                }
              : undefined
          }
        />
      )
    }
    return (
      <CurriculumBySubject
        subject={subjectFilter}
        commonList={commonFiltered}
        teachersFiltered={teachersFiltered}
        currentUserId={user?.id}
        canDelete={canDeleteMaterial}
        onDelete={handleDelete}
        canEdit={canEditMaterial}
        onEdit={handleEdit}
      />
    )
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          수업 자료
        </h1>
      </div>

      {/* Mobile: horizontal subject chips (sticky) */}
      <div className="-mx-4 sticky top-14 z-10 mb-3 border-b border-zinc-100 bg-white/95 px-4 pb-2 backdrop-blur md:hidden">
        <div className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-zinc-100 p-0.5 py-1">
          <SidebarChipButton
            active={sidebarKey === 'all'}
            onClick={selectAll}
            label="전체"
            icon={<LayersIcon className="h-3.5 w-3.5" />}
          />
          {availableSubjects.map((s) => (
            <SidebarChipButton
              key={s}
              subject={s}
              active={sidebarKey === s}
              onClick={() => selectSubject(s)}
              label={s}
              count={subjectCounts.get(s)}
            />
          ))}
          <span className="mx-1 h-6 w-px shrink-0 self-center bg-zinc-200" />
          <SidebarChipButton
            active={sidebarKey === '__additional__'}
            onClick={selectAdditional}
            label="🔗 추가자료"
            count={additionalCount}
          />
        </div>
      </div>

      <div className="flex gap-6 md:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden md:block md:sticky md:top-16 md:h-fit md:w-44 md:shrink-0">
          <nav className="space-y-0.5">
            <SidebarRow
              active={sidebarKey === 'all'}
              onClick={selectAll}
              icon={<LayersIcon className="h-3.5 w-3.5" strokeWidth={1.75} />}
              label="전체"
              count={gradeFilteredCurriculum.length}
            />
            {availableSubjects.length > 0 && (
              <div className="my-1 border-t border-zinc-100" />
            )}
            {availableSubjects.map((s) => (
              <SidebarRow
                key={s}
                active={sidebarKey === s}
                onClick={() => selectSubject(s)}
                subject={s}
                label={s}
                count={subjectCounts.get(s) ?? 0}
              />
            ))}
            <div className="my-1 border-t border-zinc-100" />
            <SidebarRow
              active={sidebarKey === '__additional__'}
              onClick={selectAdditional}
              label="🔗 추가자료"
              count={additionalCount}
            />
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          {/* Sticky filter bar */}
          <div className="sticky top-14 z-10 -mx-4 border-b border-zinc-100 bg-white/95 px-4 py-2 backdrop-blur md:top-16 md:mx-0 md:rounded-lg md:border md:border-zinc-200 md:bg-white md:px-3 md:backdrop-blur-none">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  type="search"
                  placeholder="제목·과목으로 검색"
                  className="h-9 pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select
                value={gradeFilter}
                onValueChange={(v) =>
                  setGradeFilter(v as 'all' | '1' | '2' | '3')
                }
              >
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="1">1학년</SelectItem>
                  <SelectItem value="2">2학년</SelectItem>
                  <SelectItem value="3">3학년</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {renderContent()}
        </main>
      </div>

      <Button
        onClick={openDialog}
        size="lg"
        className={cn(
          'fixed bottom-20 right-4 z-40 h-12 rounded-lg border border-zinc-900 bg-zinc-900 px-4 text-white shadow-lg shadow-zinc-900/20 hover:bg-zinc-800',
          isAdmin && 'border-red-600 bg-red-600 hover:bg-red-700 shadow-red-600/20',
          isTeacher && !isAdmin && 'border-indigo-600 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
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
        uploadMode={uploadMode}
        setUploadMode={setUploadMode}
        formLinkUrl={formLinkUrl}
        setFormLinkUrl={setFormLinkUrl}
      />

      <MaterialEditDialog
        material={editingMaterial}
        teachers={teachers}
        onOpenChange={(v) => {
          if (!v) setEditingMaterial(null)
        }}
        onSaved={async () => {
          setEditingMaterial(null)
          await fetchMaterials()
        }}
      />
    </div>
  )
}

/* ------------------------------ Subcomponents ------------------------------ */

function MaterialCardWrap({
  id,
  exiting,
  children,
}: {
  id: string
  exiting: Set<string>
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'transition-all duration-200',
        exiting.has(id) && 'scale-95 opacity-0'
      )}
    >
      {children}
    </div>
  )
}

function SidebarRow({
  active,
  onClick,
  label,
  icon,
  subject,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon?: React.ReactNode
  subject?: string
  count?: number
}) {
  const color = subject ? getSubjectColor(subject) : null
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors duration-150',
        active
          ? 'bg-zinc-100 font-medium text-zinc-900'
          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
      )}
    >
      {icon}
      {color && (
        <span
          className={cn(
            'inline-block h-2 w-2 shrink-0 rounded-full',
            color.dot
          )}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={cn(
            'ml-1 shrink-0 text-[10px] font-medium tabular-nums',
            active ? 'text-zinc-500' : 'text-zinc-400'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function SidebarChipButton({
  active,
  onClick,
  label,
  icon,
  subject,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon?: React.ReactNode
  subject?: string
  count?: number
}) {
  const color = subject ? getSubjectColor(subject) : null
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150',
        active
          ? 'bg-white text-zinc-900 shadow-sm'
          : 'text-zinc-500 hover:text-zinc-700'
      )}
    >
      {icon}
      {color && !active && (
        <span
          className={cn('inline-block h-1.5 w-1.5 rounded-full', color.dot)}
        />
      )}
      <span>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={cn(
            'text-[10px] font-normal tabular-nums',
            active ? 'text-white/70' : 'text-zinc-400'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function TeacherSection({
  teacher,
  materials,
  currentUserId,
  canDelete,
  onDelete,
  canEdit,
  onEdit,
}: {
  teacher: Teacher
  materials: MaterialWithTeacher[]
  currentUserId?: string
  canDelete: (m: MaterialWithTeacher) => boolean
  onDelete: (m: MaterialWithTeacher) => void
  canEdit: (m: MaterialWithTeacher) => boolean
  onEdit: (m: MaterialWithTeacher) => void
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <Avatar className="h-8 w-8">
          {teacher.photo_url ? (
            <AvatarImage src={teacher.photo_url} alt={teacher.name} />
          ) : null}
          <AvatarFallback className="bg-zinc-100 text-xs font-semibold text-zinc-700">
            {teacher.name.trim().slice(0, 1) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-zinc-900">
              {teacher.name} 선생님
            </span>
            <span className="inline-flex h-4 items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 text-[10px] font-medium text-indigo-700">
              {teacher.subject}
            </span>
          </div>
        </div>
        <span className="text-xs text-zinc-400">{materials.length}개</span>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {materials.map((m) => (
          <div key={m.id} className="w-64 shrink-0">
            <MaterialCard
              material={m}
              currentUserId={currentUserId}
              canDelete={canDelete(m)}
              onDelete={onDelete}
              canEdit={canEdit(m)}
              onEdit={onEdit}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function CurriculumBySubject({
  subject,
  commonList,
  teachersFiltered,
  currentUserId,
  canDelete,
  onDelete,
  canEdit,
  onEdit,
}: {
  subject: string
  commonList: MaterialWithTeacher[]
  teachersFiltered: { teacher: Teacher; list: MaterialWithTeacher[] }[]
  currentUserId?: string
  canDelete: (m: MaterialWithTeacher) => boolean
  onDelete: (m: MaterialWithTeacher) => void
  canEdit: (m: MaterialWithTeacher) => boolean
  onEdit: (m: MaterialWithTeacher) => void
}) {
  const color = getSubjectColor(subject)
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className={cn('inline-block h-2 w-2 rounded-full', color.dot)} />
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          {subject}
        </h2>
      </div>
      {commonList.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-800">
              📘 공통 · 교과서
            </h3>
            <span className="text-xs text-zinc-400">{commonList.length}개</span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {commonList.map((m) => (
              <MaterialCard
                key={m.id}
                material={m}
                currentUserId={currentUserId}
                canDelete={canDelete(m)}
                onDelete={onDelete}
                canEdit={canEdit(m)}
                onEdit={onEdit}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {teachersFiltered.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-800">선생님별</h3>
            <span className="text-xs text-zinc-400">
              {teachersFiltered.length}명
            </span>
          </div>
          <div className="space-y-3">
            {teachersFiltered.map(({ teacher, list }) => (
              <TeacherSection
                key={teacher.id}
                teacher={teacher}
                materials={list}
                currentUserId={currentUserId}
                canDelete={canDelete}
                onDelete={onDelete}
                canEdit={canEdit}
                onEdit={onEdit}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AdditionalTab({
  links,
  files,
  currentUserId,
  canDelete,
  onDelete,
  canEdit,
  onEdit,
}: {
  links: MaterialWithTeacher[]
  files: MaterialWithTeacher[]
  currentUserId?: string
  canDelete: (m: MaterialWithTeacher) => boolean
  onDelete: (m: MaterialWithTeacher) => void
  canEdit: (m: MaterialWithTeacher) => boolean
  onEdit: (m: MaterialWithTeacher) => void
}) {
  if (links.length === 0 && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-zinc-500">등록된 추가자료가 없어요</p>
        <p className="mt-1 text-xs text-zinc-400">
          링크나 참고 파일을 등록해보세요
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      {links.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-800">
              🔗 링크 자료
            </h2>
            <span className="text-xs text-zinc-400">{links.length}개</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {links.map((m) => (
              <MaterialCard
                key={m.id}
                material={m}
                currentUserId={currentUserId}
                canDelete={canDelete(m)}
                onDelete={onDelete}
                canEdit={canEdit(m)}
                onEdit={onEdit}
              />
            ))}
          </div>
        </section>
      )}
      {files.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-800">
              📎 추가 파일
            </h2>
            <span className="text-xs text-zinc-400">{files.length}개</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {files.map((m) => (
              <MaterialCard
                key={m.id}
                material={m}
                currentUserId={currentUserId}
                canDelete={canDelete(m)}
                onDelete={onDelete}
                canEdit={canEdit(m)}
                onEdit={onEdit}
              />
            ))}
          </div>
        </section>
      )}
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
  uploadMode: UploadMode
  setUploadMode: (v: UploadMode) => void
  formLinkUrl: string
  setFormLinkUrl: (v: string) => void
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
    uploadMode,
    setUploadMode,
    formLinkUrl,
    setFormLinkUrl,
  } = props

  const managedGrades =
    role === 'teacher' && myTeacher
      ? myTeacher.managed_grades && myTeacher.managed_grades.length > 0
        ? myTeacher.managed_grades
        : [1, 2, 3]
      : [1, 2, 3]

  const isSupplementary = formCategory === SUPPLEMENTARY_CATEGORY
  const isTextbook = formCategory === '교과서'
  const isLinkMode = isSupplementary && uploadMode === 'link'

  const description =
    role === 'admin'
      ? '관리자 권한으로 즉시 공개돼요.'
      : role === 'teacher'
        ? '선생님 권한으로 즉시 공개돼요.'
        : '업로드한 자료는 관리자 승인 후 해당 학년에 공개돼요.'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>자료 등록하기</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

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
                <div className="flex h-9 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
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

          {role !== 'teacher' && !isTextbook && (
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
                  <SelectItem value="none">공통 자료</SelectItem>
                  {teachers.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-zinc-400">
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
          {isTextbook && (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              교과서는 선생님 무관 공통 자료로 등록돼요.
            </div>
          )}

          {isSupplementary && (
            <div className="space-y-1.5">
              <Label>업로드 형식</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={cn(
                    'rounded-md border py-2 text-xs font-medium transition-colors',
                    uploadMode === 'file'
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  )}
                >
                  파일
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('link')}
                  className={cn(
                    'rounded-md border py-2 text-xs font-medium transition-colors',
                    uploadMode === 'link'
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  )}
                >
                  링크
                </button>
              </div>
            </div>
          )}

          {isLinkMode ? (
            <div className="space-y-1.5">
              <Label htmlFor="material-link">링크 주소</Label>
              <Input
                id="material-link"
                type="url"
                placeholder="https://…"
                value={formLinkUrl}
                onChange={(e) => setFormLinkUrl(e.target.value)}
                required
              />
              <p className="text-xs text-zinc-500">
                외부 사이트/구글드라이브/영상 등 어떤 URL이든 등록할 수 있어요.
              </p>
            </div>
          ) : (
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
                <p className="text-xs text-zinc-500">
                  {formFile.name} · {(formFile.size / 1024 / 1024).toFixed(2)}MB
                </p>
              )}
            </div>
          )}

          <SheetFooter>
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
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/* --------------------------- Material edit dialog ------------------------- */

function MaterialEditDialog({
  material,
  teachers,
  onOpenChange,
  onSaved,
}: {
  material: MaterialWithTeacher | null
  teachers: Teacher[]
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void> | void
}) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [grade, setGrade] = useState('')
  const [classNumber, setClassNumber] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!material) return
    setTitle(material.title)
    setSubject(material.subject)
    setTeacherId(material.teacher_id ?? '')
    setGrade(String(material.grade))
    setClassNumber(material.class_number ? String(material.class_number) : '')
    setCategory(material.category ?? '')
  }, [material])

  if (!material) return null

  const save = async () => {
    if (!title.trim()) {
      toast.error('제목을 입력해주세요.')
      return
    }
    if (!subject || !grade) {
      toast.error('과목과 학년을 선택해주세요.')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('materials')
        .update({
          title: title.trim(),
          subject,
          teacher_id: teacherId || null,
          grade: Number(grade),
          class_number: classNumber ? Number(classNumber) : null,
          category: category || null,
        })
        .eq('id', material.id)
      if (error) throw error
      toast.success('저장되었어요')
      await onSaved()
    } catch (err) {
      console.error('edit material failed:', err)
      toast.error(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={!!material} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>자료 수정</SheetTitle>
          <SheetDescription>
            제목·과목·선생님·학년·반·카테고리를 수정할 수 있어요. 파일은
            바꿀 수 없어요.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">제목</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-subject">과목</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger id="edit-subject" className="h-9 w-full">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-category">카테고리</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="edit-category" className="h-9 w-full">
                  <SelectValue placeholder="선택" />
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
              <Label htmlFor="edit-grade">학년</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger id="edit-grade" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3].map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      {g}학년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-class">공개 범위 (반)</Label>
              <Select
                value={classNumber || 'all'}
                onValueChange={(v) => setClassNumber(v === 'all' ? '' : v)}
              >
                <SelectTrigger id="edit-class" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">학년 전체</SelectItem>
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {c}반
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-teacher">선생님 (선택)</Label>
            <Select
              value={teacherId || 'none'}
              onValueChange={(v) => setTeacherId(v === 'none' ? '' : v)}
            >
              <SelectTrigger id="edit-teacher" className="h-9 w-full">
                <SelectValue placeholder="선생님" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">공통 · 교과서</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {t.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            취소
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2Icon className="h-4 w-4 animate-spin" />
                <span className="ml-1.5">저장 중…</span>
              </>
            ) : (
              '저장'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

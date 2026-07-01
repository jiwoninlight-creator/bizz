'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PlusIcon, SearchIcon, Loader2Icon } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import type {
  MaterialFileType,
  MaterialWithTeacher,
  Teacher,
} from '@/types/database'
import MaterialCard from '@/components/MaterialCard'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const SUBJECTS = ['국어', '영어', '수학', '과학', '사회', '기타'] as const
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

export default function MaterialsPage() {
  const { user, profile, loading: userLoading } = useUser()

  const [materials, setMaterials] = useState<MaterialWithTeacher[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [gradeFilter, setGradeFilter] = useState<'all' | '1' | '2' | '3'>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formSubject, setFormSubject] = useState<string>('')
  const [formTeacherId, setFormTeacherId] = useState<string>('')
  const [formGrade, setFormGrade] = useState<string>('1')
  const [formFile, setFormFile] = useState<File | null>(null)

  useEffect(() => {
    if (profile?.grade) {
      setFormGrade(String(profile.grade))
    }
  }, [profile?.grade])

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
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchMaterials = useCallback(async () => {
    if (userLoading) return
    setLoading(true)

    const supabase = createClient()
    let query = supabase
      .from('materials')
      .select('*, teacher:teachers(id, name)')
      .order('created_at', { ascending: false })

    if (user?.id) {
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
  }, [debouncedSearch, gradeFilter, user?.id, userLoading])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  const resetForm = () => {
    setFormTitle('')
    setFormSubject('')
    setFormTeacherId('')
    setFormFile(null)
    setFormGrade(profile?.grade ? String(profile.grade) : '1')
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) resetForm()
  }

  const canSubmit = useMemo(
    () =>
      formTitle.trim().length > 0 &&
      formSubject.length > 0 &&
      formGrade.length > 0 &&
      formFile !== null &&
      !submitting,
    [formTitle, formSubject, formGrade, formFile, submitting]
  )

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

      const { error: insertError } = await supabase.from('materials').insert({
        title: formTitle.trim(),
        subject: formSubject,
        teacher_id: formTeacherId || null,
        grade: Number(formGrade),
        file_url: publicUrl,
        file_type: getFileType(formFile.name),
        file_size: formFile.size,
        uploaded_by: user.id,
        status: 'pending',
      })
      if (insertError) throw insertError

      setDialogOpen(false)
      resetForm()
      alert('관리자 승인 후 공개됩니다')
      await fetchMaterials()
    } catch (err) {
      console.error('Upload failed:', err)
      const message = err instanceof Error ? err.message : String(err)
      alert(`업로드에 실패했습니다: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-900">수업 자료</h1>

        <div className="flex gap-2">
          <Select
            value={gradeFilter}
            onValueChange={(v) =>
              setGradeFilter(v as 'all' | '1' | '2' | '3')
            }
          >
            <SelectTrigger className="w-28 h-9">
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-sm">불러오는 중…</span>
        </div>
      ) : materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-slate-500">등록된 자료가 없습니다</p>
          <p className="mt-1 text-xs text-slate-400">
            우측 하단 버튼으로 자료를 등록해보세요
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {materials.map((m) => (
            <MaterialCard key={m.id} material={m} currentUserId={user?.id} />
          ))}
        </div>
      )}

      <Button
        onClick={() => setDialogOpen(true)}
        size="lg"
        className="fixed bottom-24 right-4 z-40 h-14 rounded-full px-5 shadow-lg"
      >
        <PlusIcon className="h-5 w-5" />
        <span className="ml-1 text-sm font-semibold">자료 등록</span>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>자료 등록하기</DialogTitle>
            <DialogDescription>
              업로드한 자료는 관리자 승인 후 해당 학년에 공개돼요.
            </DialogDescription>
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
                <Select value={formSubject} onValueChange={setFormSubject}>
                  <SelectTrigger id="material-subject" className="w-full h-9">
                    <SelectValue placeholder="과목 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="material-grade">학년</Label>
                <Select value={formGrade} onValueChange={setFormGrade}>
                  <SelectTrigger id="material-grade" className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1학년</SelectItem>
                    <SelectItem value="2">2학년</SelectItem>
                    <SelectItem value="3">3학년</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="material-teacher">선생님 (선택)</Label>
              <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                <SelectTrigger id="material-teacher" className="w-full h-9">
                  <SelectValue placeholder="선생님 선택" />
                </SelectTrigger>
                <SelectContent>
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

            <div className="space-y-1.5">
              <Label htmlFor="material-file">파일 (PDF · HWP · 이미지, 50MB 이하)</Label>
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
                onClick={() => handleDialogChange(false)}
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
    </div>
  )
}

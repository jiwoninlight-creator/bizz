'use client'

import type { MouseEvent } from 'react'
import {
  FileTextIcon,
  FileIcon,
  ImageIcon,
  DownloadIcon,
  ExternalLinkIcon,
  Trash2Icon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MaterialFileType, MaterialWithTeacher } from '@/types/database'

type FileTypeStyle = {
  Icon: typeof FileIcon
  label: string
  bg: string
  fg: string
  ext: string
}

const FILE_TYPE_STYLES: Record<MaterialFileType, FileTypeStyle> = {
  pdf: {
    Icon: FileTextIcon,
    label: 'PDF',
    bg: 'bg-red-100',
    fg: 'text-red-600',
    ext: 'pdf',
  },
  hwp: {
    Icon: FileIcon,
    label: 'HWP',
    bg: 'bg-blue-100',
    fg: 'text-blue-600',
    ext: 'hwp',
  },
  image: {
    Icon: ImageIcon,
    label: 'IMG',
    bg: 'bg-green-100',
    fg: 'text-green-600',
    ext: 'jpg',
  },
  other: {
    Icon: FileIcon,
    label: 'FILE',
    bg: 'bg-slate-100',
    fg: 'text-slate-600',
    ext: '',
  },
}

function isNew(createdAt: string): boolean {
  const created = new Date(createdAt).getTime()
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return Date.now() - created < sevenDays
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function inferFilename(url: string): string {
  try {
    const path = new URL(url).pathname
    const last = path.split('/').pop() || 'file'
    return decodeURIComponent(last).replace(/^\d+_/, '')
  } catch {
    return 'file'
  }
}

function extFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname
    const last = path.split('/').pop() || ''
    const dot = last.lastIndexOf('.')
    if (dot < 0) return ''
    return last.slice(dot + 1).toLowerCase()
  } catch {
    return ''
  }
}

function resolveDownloadName(material: MaterialWithTeacher): string {
  if (material.original_filename && material.original_filename.trim()) {
    return material.original_filename
  }
  const styleExt = FILE_TYPE_STYLES[material.file_type]?.ext ?? ''
  const urlExt = extFromUrl(material.file_url)
  const ext = urlExt || styleExt
  if (material.title) {
    return ext ? `${material.title}.${ext}` : material.title
  }
  return inferFilename(material.file_url)
}

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (err) {
    console.error('Download failed:', err)
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

type Props = {
  material: MaterialWithTeacher
  currentUserId?: string
  canDelete?: boolean
  onDelete?: (m: MaterialWithTeacher) => void
  compact?: boolean
}

export default function MaterialCard({
  material,
  currentUserId,
  canDelete,
  onDelete,
  compact,
}: Props) {
  const style = FILE_TYPE_STYLES[material.file_type] ?? FILE_TYPE_STYLES.other
  const { Icon } = style
  const isOwnPending =
    material.status === 'pending' && material.uploaded_by === currentUserId
  const isPending = material.status === 'pending'
  const isInline = material.file_type === 'pdf' || material.file_type === 'image'
  const displayFilename = material.original_filename ?? null
  const showOriginal =
    !!displayFilename && displayFilename.trim() !== material.title.trim()

  const handleClick = () => {
    if (isInline) {
      window.open(material.file_url, '_blank', 'noopener,noreferrer')
    } else {
      downloadFile(material.file_url, resolveDownloadName(material))
    }
  }

  const handleDeleteClick = (e: MouseEvent) => {
    e.stopPropagation()
    onDelete?.(material)
  }

  return (
    <Card
      size="sm"
      onClick={handleClick}
      title={displayFilename ?? undefined}
      className="cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 active:scale-[0.98]"
    >
      <div className="flex items-start gap-3 px-3">
        <div
          className={`flex ${compact ? 'h-10 w-10' : 'h-12 w-12'} shrink-0 items-center justify-center rounded-lg ${style.bg}`}
        >
          <Icon className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} ${style.fg}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">
              {material.title}
            </h3>
            <div className="flex shrink-0 items-start gap-1">
              {isNew(material.created_at) && material.status === 'approved' && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  NEW
                </Badge>
              )}
              {isOwnPending && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  승인 대기
                </Badge>
              )}
              {isPending && !isOwnPending && (
                <Badge
                  className="h-5 bg-amber-100 px-1.5 text-[10px] text-amber-700 hover:bg-amber-100"
                >
                  대기
                </Badge>
              )}
              {canDelete && onDelete && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-slate-400 hover:text-red-600"
                  onClick={handleDeleteClick}
                  aria-label="자료 삭제"
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{material.subject}</span>
            {material.teacher?.name && (
              <>
                <span>·</span>
                <span>{material.teacher.name} 선생님</span>
              </>
            )}
            {material.category && material.category !== material.subject && (
              <>
                <span>·</span>
                <span className="text-slate-500">{material.category}</span>
              </>
            )}
          </div>
          {(material.class_number || material.grade) && (
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge
                variant="outline"
                className="h-4 px-1.5 text-[10px] border-slate-200"
              >
                {material.grade}학년
                {material.class_number ? ` ${material.class_number}반` : ''}
              </Badge>
            </div>
          )}
          {showOriginal && (
            <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
              {displayFilename}
            </p>
          )}
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{formatDate(material.created_at)}</span>
            <span className="flex items-center gap-1 text-slate-500">
              {isInline ? (
                <>
                  <ExternalLinkIcon className="h-3 w-3" />
                  열기
                </>
              ) : (
                <>
                  <DownloadIcon className="h-3 w-3" />
                  다운로드
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

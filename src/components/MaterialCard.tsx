'use client'

import type { MouseEvent } from 'react'
import {
  FileTextIcon,
  FileIcon,
  ImageIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LinkIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getSubjectColor } from '@/lib/subject-colors'
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
    bg: 'bg-red-50 border border-red-100',
    fg: 'text-red-600',
    ext: 'pdf',
  },
  hwp: {
    Icon: FileIcon,
    label: 'HWP',
    bg: 'bg-indigo-50 border border-indigo-100',
    fg: 'text-indigo-600',
    ext: 'hwp',
  },
  image: {
    Icon: ImageIcon,
    label: 'IMG',
    bg: 'bg-emerald-50 border border-emerald-100',
    fg: 'text-emerald-600',
    ext: 'jpg',
  },
  other: {
    Icon: FileIcon,
    label: 'FILE',
    bg: 'bg-zinc-100 border border-zinc-200',
    fg: 'text-zinc-600',
    ext: '',
  },
  link: {
    Icon: LinkIcon,
    label: 'LINK',
    bg: 'bg-blue-50 border border-blue-100',
    fg: 'text-blue-600',
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
  canEdit?: boolean
  onEdit?: (m: MaterialWithTeacher) => void
  compact?: boolean
}

export default function MaterialCard({
  material,
  currentUserId,
  canDelete,
  onDelete,
  canEdit,
  onEdit,
  compact,
}: Props) {
  const style = FILE_TYPE_STYLES[material.file_type] ?? FILE_TYPE_STYLES.other
  const { Icon } = style
  const isOwnPending =
    material.status === 'pending' && material.uploaded_by === currentUserId
  const isPending = material.status === 'pending'
  const isLink = material.file_type === 'link'
  const isInline =
    !isLink && (material.file_type === 'pdf' || material.file_type === 'image')
  const displayFilename = material.original_filename ?? null
  const showOriginal =
    !isLink &&
    !!displayFilename &&
    displayFilename.trim() !== material.title.trim()

  const handleClick = () => {
    if (isLink) {
      const url = material.link_url || material.file_url
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
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

  const handleEditClick = (e: MouseEvent) => {
    e.stopPropagation()
    onEdit?.(material)
  }

  return (
    <Card
      size="sm"
      onClick={handleClick}
      title={displayFilename ?? undefined}
      className="cursor-pointer border border-zinc-200 bg-white shadow-none transition-colors hover:border-zinc-300"
    >
      <div className="flex items-start gap-3 px-3">
        <div
          className={`flex ${compact ? 'h-10 w-10' : 'h-11 w-11'} shrink-0 items-center justify-center rounded-md ${style.bg}`}
        >
          <Icon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} ${style.fg}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold tracking-tight text-zinc-900">
              {material.title}
            </h3>
            <div className="flex shrink-0 items-start gap-1">
              {isNew(material.created_at) && material.status === 'approved' && (
                <Badge className="h-5 rounded-md border border-red-200 bg-red-50 px-1.5 text-[10px] font-semibold text-red-600 hover:bg-red-50">
                  NEW
                </Badge>
              )}
              {isOwnPending && (
                <Badge className="h-5 rounded-md border border-amber-200 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700 hover:bg-amber-50">
                  승인 대기
                </Badge>
              )}
              {isPending && !isOwnPending && (
                <Badge className="h-5 rounded-md border border-amber-200 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700 hover:bg-amber-50">
                  대기
                </Badge>
              )}
              {canEdit && onEdit && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-zinc-400 hover:bg-zinc-100 hover:text-indigo-600"
                  onClick={handleEditClick}
                  aria-label="자료 수정"
                >
                  <PencilIcon />
                </Button>
              )}
              {canDelete && onDelete && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                  onClick={handleDeleteClick}
                  aria-label="자료 삭제"
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500">
            {(() => {
              const c = getSubjectColor(material.subject)
              return (
                <span
                  className={cn(
                    'inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium',
                    c.bg,
                    c.text,
                    c.border
                  )}
                >
                  {material.subject}
                </span>
              )
            })()}
            {material.teacher?.name && (
              <span className="text-zinc-500">
                {material.teacher.name} 선생님
              </span>
            )}
            {material.category && material.category !== material.subject && (
              <>
                <span className="text-zinc-300">·</span>
                <span className="text-zinc-500">{material.category}</span>
              </>
            )}
          </div>
          {(material.class_number || material.grade) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="inline-flex h-4 items-center rounded-md border border-zinc-200 bg-white px-1.5 text-[10px] font-medium text-zinc-600">
                {material.grade}학년
                {material.class_number ? ` ${material.class_number}반` : ''}
              </span>
            </div>
          )}
          {showOriginal && (
            <p className="mt-0.5 line-clamp-1 text-[10px] text-zinc-400">
              {displayFilename}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-1.5 text-[11px] text-zinc-400">
            <span className="font-mono tabular-nums">
              {formatDate(material.created_at)}
            </span>
            <span
              className={cn(
                'flex items-center gap-1',
                isLink ? 'text-blue-600' : 'text-zinc-500'
              )}
            >
              {isLink ? (
                <>
                  <LinkIcon className="h-3 w-3" />
                  링크 열기
                </>
              ) : isInline ? (
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

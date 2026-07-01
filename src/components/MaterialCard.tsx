'use client'

import { FileTextIcon, FileIcon, ImageIcon, DownloadIcon, ExternalLinkIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { MaterialFileType, MaterialWithTeacher } from '@/types/database'

type FileTypeStyle = {
  Icon: typeof FileIcon
  label: string
  bg: string
  fg: string
}

const FILE_TYPE_STYLES: Record<MaterialFileType, FileTypeStyle> = {
  pdf: {
    Icon: FileTextIcon,
    label: 'PDF',
    bg: 'bg-red-100',
    fg: 'text-red-600',
  },
  hwp: {
    Icon: FileIcon,
    label: 'HWP',
    bg: 'bg-blue-100',
    fg: 'text-blue-600',
  },
  image: {
    Icon: ImageIcon,
    label: 'IMG',
    bg: 'bg-green-100',
    fg: 'text-green-600',
  },
  other: {
    Icon: FileIcon,
    label: 'FILE',
    bg: 'bg-slate-100',
    fg: 'text-slate-600',
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

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url)
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
}

export default function MaterialCard({ material, currentUserId }: Props) {
  const style = FILE_TYPE_STYLES[material.file_type] ?? FILE_TYPE_STYLES.other
  const { Icon } = style
  const isOwnPending =
    material.status === 'pending' && material.uploaded_by === currentUserId
  const isInline = material.file_type === 'pdf' || material.file_type === 'image'

  const handleClick = () => {
    if (isInline) {
      window.open(material.file_url, '_blank', 'noopener,noreferrer')
    } else {
      const filename = inferFilename(material.file_url)
      downloadFile(material.file_url, filename)
    }
  }

  return (
    <Card
      size="sm"
      onClick={handleClick}
      className="cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 active:scale-[0.98]"
    >
      <div className="flex items-start gap-3 px-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${style.bg}`}
        >
          <Icon className={`h-6 w-6 ${style.fg}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">
              {material.title}
            </h3>
            <div className="flex shrink-0 gap-1">
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
          </div>
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

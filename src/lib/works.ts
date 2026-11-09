import { isSupabaseConfigured, supabase } from './supabase'

// 封面地址：相对路径按站点根解析，绝对地址原样返回
const ASSET_BASE = './'

export function coverSrc(cover?: string | null): string {
  if (!cover) return ''
  if (/^(https?:|data:|blob:)/i.test(cover)) return cover
  return new URL(`${ASSET_BASE}${cover}`, document.baseURI).href
}

export type Milestone = { date: string; title: string; desc: string }

export type Work = {
  id: string
  title: string
  cover: string
  uploadedAt: string
  period?: string
  role?: string
  summary?: string
  result?: string
  tags: string[]
  url?: string
  milestones: Milestone[]
  sort: number
  published: boolean
}

export type WorkDraft = Omit<Work, 'id'> & { id?: string }

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined)

function toWork(row: Record<string, unknown>): Work {
  return {
    id: String(row.id),
    title: asString(row.title) ?? '未命名作品',
    cover: asString(row.cover) ?? '',
    uploadedAt: asString(row.uploaded_at) ?? '',
    period: asString(row.period),
    role: asString(row.role),
    summary: asString(row.summary),
    result: asString(row.result),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    url: asString(row.url),
    milestones: Array.isArray(row.milestones) ? (row.milestones as Milestone[]) : [],
    sort: typeof row.sort === 'number' ? row.sort : 0,
    published: row.published !== false,
  }
}

function toRow(draft: WorkDraft) {
  return {
    title: draft.title.trim(),
    cover: draft.cover?.trim() || null,
    uploaded_at: draft.uploadedAt || new Date().toISOString().slice(0, 10),
    period: draft.period?.trim() || null,
    role: draft.role?.trim() || null,
    summary: draft.summary?.trim() || null,
    result: draft.result?.trim() || null,
    tags: draft.tags.filter(Boolean),
    url: draft.url?.trim() || null,
    milestones: draft.milestones ?? [],
    sort: draft.sort,
    published: draft.published,
  }
}

export function sortWorks(list: Work[]): Work[] {
  return [...list].sort((a, b) =>
    a.sort === b.sort
      ? (b.uploadedAt || '').localeCompare(a.uploadedAt || '')
      : a.sort - b.sort,
  )
}

export async function listAllWorks(): Promise<{ works: Work[]; error?: string }> {
  if (!isSupabaseConfigured) return { works: [], error: '还没有配置 Supabase' }
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .order('sort', { ascending: true })
    .order('uploaded_at', { ascending: false })
  if (error) return { works: [], error: error.message }
  return { works: sortWorks((data ?? []).map(toWork)) }
}

function makeId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${slug || 'work'}-${Date.now().toString(36)}`
}

export async function saveWork(draft: WorkDraft): Promise<{ error?: string }> {
  const row = toRow(draft)
  if (!row.title) return { error: '标题不能为空' }
  if (draft.id) {
    const { error } = await supabase.from('works').update(row).eq('id', draft.id)
    return { error: error?.message }
  }
  const { error } = await supabase
    .from('works')
    .insert({ ...row, id: makeId(row.title) })
  return { error: error?.message }
}

export async function deleteWork(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('works').delete().eq('id', id)
  return { error: error?.message }
}

export async function moveWork(
  works: Work[],
  id: string,
  dir: -1 | 1,
): Promise<{ error?: string }> {
  const ordered = sortWorks(works)
  const from = ordered.findIndex((work) => work.id === id)
  const to = from + dir
  if (from < 0 || to < 0 || to >= ordered.length) return {}
  const next = [...ordered]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  const results = await Promise.all(
    next.map((work, index) => supabase.from('works').update({ sort: index }).eq('id', work.id)),
  )
  return { error: results.find((result) => result.error)?.error?.message }
}

export async function uploadCover(file: File): Promise<{ url?: string; error?: string }> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `works/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext || 'jpg'}`
  const { error } = await supabase.storage
    .from('covers')
    .upload(path, file, { cacheControl: '31536000', contentType: file.type || undefined, upsert: false })
  if (error) return { error: error.message }
  const { data } = supabase.storage.from('covers').getPublicUrl(path)
  return { url: data.publicUrl }
}

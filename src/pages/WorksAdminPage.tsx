import { useCallback, useEffect, useState } from 'react'
import {
  coverSrc,
  deleteWork,
  listAllWorks,
  moveWork,
  saveWork,
  uploadCover,
  type Work,
  type WorkDraft,
} from '../lib/works'
import { peek, put } from '../lib/cache'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Textarea } from '../components/ui'
// 建表脚本直接打进包里：还没执行迁移时，页面上就能复制去 Supabase 跑
import setupSql from '../../supabase/migrations/0003_works.sql?raw'

const emptyDraft = (sort: number): WorkDraft => ({
  title: '',
  cover: '',
  uploadedAt: new Date().toISOString().slice(0, 10),
  period: '',
  role: '',
  summary: '',
  result: '',
  tags: [],
  url: '',
  milestones: [],
  sort,
  published: true,
})

export default function WorksAdminPage() {
  // 游客也能进后台：作品库公开可读，改动保存才需要登录
  const { session } = useAuth()
  // 切走再切回来时先用上次的列表，别又白一次
  const [works, setWorks] = useState<Work[]>(() => peek<Work[]>('works') ?? [])
  const [loading, setLoading] = useState(() => !peek('works'))
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState<WorkDraft>(emptyDraft(0))
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    const { works: list, error: loadError } = await listAllWorks()
    setWorks(list)
    put('works', list)
    setError(loadError ?? '')
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    if (!session) return
    setDraft(emptyDraft(works.length))
    setModalOpen(true)
  }

  function openEdit(work: Work) {
    if (!session) return
    const { id, ...rest } = work
    setDraft({ ...rest, id })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!session) return
    if (!draft.title.trim()) {
      setError('标题不能为空')
      return
    }
    setSaving(true)
    const { error: saveError } = await saveWork(draft)
    setSaving(false)
    if (saveError) {
      setError(saveError)
      return
    }
    setError('')
    setModalOpen(false)
    await load(true)
  }

  async function handleDelete(work: Work) {
    if (!session) return
    if (!window.confirm(`删除「${work.title}」？作品集会立刻少一件，删掉就找不回来了。`)) return
    const { error: deleteError } = await deleteWork(work.id)
    if (deleteError) setError(deleteError)
    else await load(true)
  }

  async function handleMove(work: Work, dir: -1 | 1) {
    if (!session) return
    const { error: moveError } = await moveWork(works, work.id, dir)
    if (moveError) setError(moveError)
    else await load(true)
  }

  const dbReady = !error

  return (
    <>
      <PageHeader
        title="作品集"
        description="作品档案数据。放映页现在放的是演示片，还没接这张表 —— 等素材齐了再把它接上去。"
        action={
          <div className="page-action-row">
            <a className="btn-secondary" href="showcase.html" target="_blank" rel="noreferrer">
              前台看看
            </a>
            <Button onClick={openCreate} disabled={!dbReady || !session}>
              新增作品
            </Button>
          </div>
        }
      />

      {!dbReady ? <SetupCard message={error} onDone={load} /> : null}

      {!session && dbReady ? (
        <Card className="guest-card">
          <b>游客模式</b>
          <p>
            作品库可以随便看。要新增、编辑或删除，先到右上角「登录」一次 ——
            这台设备记住你之后，以后进来就再也不用登了。
          </p>
        </Card>
      ) : null}

      <Card>
        {loading && works.length === 0 ? (
          <EmptyState title="正在读取作品…" />
        ) : works.length === 0 ? (
          <EmptyState
            title="还没有作品"
            description="新增第一件，它会立刻出现在作品集那一页。"
            action={dbReady && session ? <Button onClick={openCreate}>新增作品</Button> : undefined}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table works-table">
              <thead>
                <tr>
                  <th>作品</th>
                  <th>时间</th>
                  <th>状态</th>
                  <th>顺序</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {works.map((work, i) => (
                  <tr key={work.id}>
                    <td>
                      <div className="work-cell">
                        {work.cover ? (
                          <img className="work-thumb" src={coverSrc(work.cover)} alt="" />
                        ) : (
                          <span className="work-thumb is-empty">无封面</span>
                        )}
                        <div>
                          <strong className="table-primary">{work.title}</strong>
                          <small>{work.summary || work.role || '未填写简介'}</small>
                        </div>
                      </div>
                    </td>
                    <td>{work.period || work.uploadedAt}</td>
                    <td>
                      <Badge tone={work.published ? 'green' : 'amber'}>{work.published ? '已发布' : '草稿'}</Badge>
                    </td>
                    <td className="work-sort">
                      <button type="button" onClick={() => handleMove(work, -1)} disabled={i === 0 || !session} aria-label="上移">
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(work, 1)}
                        disabled={i === works.length - 1 || !session}
                        aria-label="下移"
                      >
                        ↓
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" onClick={() => openEdit(work)} disabled={!session}>编辑</button>
                        <button type="button" className="danger-text" onClick={() => handleDelete(work)} disabled={!session}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} title={draft.id ? '编辑作品' : '新增作品'} onClose={() => setModalOpen(false)}>
        <WorkForm draft={draft} onChange={setDraft} />
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSave} loading={saving}>
            保存
          </Button>
        </div>
      </Modal>
    </>
  )
}

function SetupCard({ message, onDone }: { message: string; onDone: () => Promise<void> }) {
  const [copied, setCopied] = useState(false)

  async function copySql() {
    try {
      await navigator.clipboard.writeText(setupSql)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Card className="setup-card">
      <h2>还差最后一步：建一张作品表</h2>
      <p>
        作品现在存在 Supabase 里，这样你在这里改完，网站上的作品集会立刻跟着变。
        执行下面这段 SQL 就会建好表、读写权限，并把这四件作品搬进去。
      </p>
      <ol className="setup-steps">
        <li>复制下面的 SQL</li>
        <li>到 Supabase 的 SQL Editor 粘贴并 Run</li>
        <li>回来点「刷新」</li>
      </ol>
      <div className="setup-actions">
        <Button onClick={copySql}>{copied ? '已复制' : '复制 SQL'}</Button>
        <a
          className="btn-secondary"
          href="https://supabase.com/dashboard/project/bkiqrhlthjodswqivdsn/sql/new"
          target="_blank"
          rel="noreferrer"
        >
          打开 SQL Editor
        </a>
        <Button variant="ghost" onClick={() => void onDone()}>
          刷新
        </Button>
      </div>
      <details className="setup-sql">
        <summary>看看要执行什么</summary>
        <pre>{setupSql}</pre>
      </details>
      <small className="setup-error">数据库返回：{message}</small>
    </Card>
  )
}

function WorkForm({ draft, onChange }: { draft: WorkDraft; onChange: (next: WorkDraft) => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const set = <K extends keyof WorkDraft>(key: K, value: WorkDraft[K]) => onChange({ ...draft, [key]: value })

  async function pickCover(file: File) {
    setUploading(true)
    setUploadError('')
    const { url, error } = await uploadCover(file)
    setUploading(false)
    if (error || !url) {
      setUploadError(error ?? '上传失败')
      return
    }
    set('cover', url)
  }

  return (
    <div className="work-form">
      <Field label="标题">
        <Input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="作品名称" />
      </Field>

      <Field label="封面" hint="竖图/横图都行，前台会按比例裁切">
        <div className="cover-row">
          {draft.cover ? <img className="cover-preview" src={coverSrc(draft.cover)} alt="" /> : <span className="cover-preview is-empty">无</span>}
          <div className="cover-actions">
            <label className="btn-secondary cover-upload">
              {uploading ? '上传中…' : '上传图片'}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void pickCover(file)
                  e.target.value = ''
                }}
              />
            </label>
            <Input
              value={draft.cover ?? ''}
              onChange={(e) => set('cover', e.target.value)}
              placeholder="或直接填图片地址"
            />
          </div>
        </div>
        {uploadError ? <small className="danger-text">{uploadError}</small> : null}
      </Field>

      <div className="form-grid-2">
        <Field label="时间">
          <Input value={draft.period ?? ''} onChange={(e) => set('period', e.target.value)} placeholder="2026.10" />
        </Field>
        <Field label="角色">
          <Input value={draft.role ?? ''} onChange={(e) => set('role', e.target.value)} placeholder="独立完成 / 全栈开发" />
        </Field>
      </div>

      <Field label="简介">
        <Textarea
          value={draft.summary ?? ''}
          onChange={(e) => set('summary', e.target.value)}
          rows={2}
          placeholder="一句话说清这件事是什么"
        />
      </Field>

      <Field label="结果">
        <Textarea
          value={draft.result ?? ''}
          onChange={(e) => set('result', e.target.value)}
          rows={2}
          placeholder="做成了什么，有没有被用起来"
        />
      </Field>

      <Field label="标签" hint="用逗号分开，比如：React, 数据可视化">
        <Input
          value={draft.tags.join(', ')}
          onChange={(e) => set('tags', e.target.value.split(/[,，]/).map((t) => t.trim()).filter(Boolean))}
        />
      </Field>

      <div className="form-grid-2">
        <Field label="链接" hint="站内用 #/ 开头，站外用 https://">
          <Input value={draft.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="#/app 或 https://…" />
        </Field>
        <Field label="日期" hint="影响同类作品的先后">
          <Input type="date" value={draft.uploadedAt} onChange={(e) => set('uploadedAt', e.target.value)} />
        </Field>
      </div>

      <label className="check-row">
        <input type="checkbox" checked={draft.published} onChange={(e) => set('published', e.target.checked)} />
        <span>发布到作品集（取消勾选就只在后台可见）</span>
      </label>
    </div>
  )
}

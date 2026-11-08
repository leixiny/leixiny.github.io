import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type {
  ActivityLog,
  Contact,
  Customer,
  CustomerDocument,
  CustomerTag,
  Profile,
  Tag,
  Task,
  TaskPriority,
  TaskStatus,
} from '../types'
import { customerStatusLabels, taskPriorityLabels, taskStatusLabels } from '../types'
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select } from '../components/ui'
import CustomerForm from '../components/CustomerForm'
import { formatCurrency, formatDateTime, formatDate, formatFileSize } from '../lib/format'

interface ContactForm {
  name: string
  title: string
  email: string
  phone: string
  is_primary: boolean
}

interface TaskForm {
  title: string
  priority: TaskPriority
  due_at: string
  assignee_id: string
}

const emptyContact: ContactForm = { name: '', title: '', email: '', phone: '', is_primary: false }
const emptyTask: TaskForm = { title: '', priority: 'medium', due_at: '', assignee_id: '' }

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile, role } = useAuth()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [documents, setDocuments] = useState<CustomerDocument[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContact)
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTask)
  const [newTagName, setNewTagName] = useState('')

  const canDelete = role === 'owner' || role === 'admin'

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const [
      customerResult,
      contactsResult,
      tasksResult,
      tagsResult,
      selectedTagsResult,
      documentsResult,
      activitiesResult,
      profilesResult,
    ] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single<Customer>(),
      supabase.from('contacts').select('*').eq('customer_id', id).order('is_primary', { ascending: false }).order('created_at').returns<Contact[]>(),
      supabase.from('tasks').select('*').eq('customer_id', id).order('due_at', { ascending: true, nullsFirst: false }).returns<Task[]>(),
      supabase.from('tags').select('*').order('name').returns<Tag[]>(),
      supabase.from('customer_tags').select('*').eq('customer_id', id).returns<CustomerTag[]>(),
      supabase.from('customer_documents').select('*').eq('customer_id', id).order('created_at', { ascending: false }).returns<CustomerDocument[]>(),
      supabase.from('activity_logs').select('*, actor:profiles!activity_logs_actor_id_fkey(id, full_name)').eq('customer_id', id).order('created_at', { ascending: false }).limit(12).returns<ActivityLog[]>(),
      supabase.from('profiles').select('*').order('full_name').returns<Profile[]>(),
    ])

    if (customerResult.error) {
      setError(customerResult.error.message)
      setCustomer(null)
    } else {
      setError('')
      setCustomer(customerResult.data)
    }

    setContacts(contactsResult.data ?? [])
    setTasks(tasksResult.data ?? [])
    setTags(tagsResult.data ?? [])
    setSelectedTagIds(new Set((selectedTagsResult.data ?? []).map((item) => item.tag_id)))
    setDocuments(documentsResult.data ?? [])
    setActivities(activitiesResult.data ?? [])
    setProfiles(profilesResult.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`customer-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `customer_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `customer_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_tags', filter: `customer_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_documents', filter: `customer_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs', filter: `customer_id=eq.${id}` }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, load])

  const assigneeName = useMemo(() => {
    return new Map(profiles.map((item) => [item.id, item.full_name]))
  }, [profiles])

  async function saveCustomer(values: Omit<Customer, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'created_by'>) {
    if (!customer) return
    setSavingCustomer(true)
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        ...values,
        industry: values.industry || null,
        website: values.website || null,
        notes: values.notes || null,
        owner_id: values.owner_id || null,
      })
      .eq('id', customer.id)

    setSavingCustomer(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setEditOpen(false)
    await load()
  }

  async function deleteCustomer() {
    if (!customer || !canDelete) return
    if (!window.confirm(`确定删除项目「${customer.company_name}」吗？`)) return
    const { error: deleteError } = await supabase.from('customers').delete().eq('id', customer.id)
    if (deleteError) setError(deleteError.message)
    else navigate('/app/customers')
  }

  async function addContact(event: React.FormEvent) {
    event.preventDefault()
    if (!customer || !profile?.organization_id) return

    if (contactForm.is_primary) {
      await supabase.from('contacts').update({ is_primary: false }).eq('customer_id', customer.id)
    }

    const { error: insertError } = await supabase.from('contacts').insert({
      organization_id: profile.organization_id,
      customer_id: customer.id,
      name: contactForm.name,
      title: contactForm.title || null,
      email: contactForm.email || null,
      phone: contactForm.phone || null,
      is_primary: contactForm.is_primary,
    })

    if (!insertError) setContactForm(emptyContact)
    else setError(insertError.message)
  }

  async function togglePrimary(contact: Contact) {
    if (!customer) return
    if (contact.is_primary) {
      await supabase.from('contacts').update({ is_primary: false }).eq('id', contact.id)
    } else {
      await supabase.from('contacts').update({ is_primary: false }).eq('customer_id', customer.id)
      await supabase.from('contacts').update({ is_primary: true }).eq('id', contact.id)
    }
  }

  async function deleteContact(contactId: string) {
    await supabase.from('contacts').delete().eq('id', contactId)
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault()
    if (!customer || !profile?.organization_id) return

    const { error: insertError } = await supabase.from('tasks').insert({
      organization_id: profile.organization_id,
      customer_id: customer.id,
      created_by: profile.id,
      assignee_id: taskForm.assignee_id || null,
      title: taskForm.title,
      priority: taskForm.priority,
      due_at: taskForm.due_at ? new Date(`${taskForm.due_at}T09:00:00`).toISOString() : null,
    })

    if (!insertError) setTaskForm(emptyTask)
    else setError(insertError.message)
  }

  async function changeTaskStatus(taskId: string, status: TaskStatus) {
    const { error: updateError } = await supabase.from('tasks').update({ status }).eq('id', taskId)
    if (updateError) setError(updateError.message)
  }

  async function deleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId)
  }

  async function createTag(event: React.FormEvent) {
    event.preventDefault()
    if (!profile?.organization_id || !newTagName.trim()) return

    const { error: insertError } = await supabase.from('tags').insert({
      organization_id: profile.organization_id,
      name: newTagName.trim(),
      color: '#4f46e5',
    })

    if (!insertError) setNewTagName('')
    else setError(insertError.message)
  }

  async function toggleTag(tag: Tag) {
    if (!customer) return
    if (selectedTagIds.has(tag.id)) {
      await supabase.from('customer_tags').delete().eq('customer_id', customer.id).eq('tag_id', tag.id)
    } else {
      const { error: insertError } = await supabase.from('customer_tags').insert({
        customer_id: customer.id,
        tag_id: tag.id,
      })
      if (insertError) setError(insertError.message)
    }
  }

  async function uploadDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !customer || !profile?.organization_id) return
    if (file.size > 10 * 1024 * 1024) {
      setError('文件不能超过 10MB')
      return
    }

    const documentId = crypto.randomUUID()
    const storagePath = `${profile.organization_id}/${customer.id}/${documentId}/${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('customer-files')
      .upload(storagePath, file, { cacheControl: '3600', upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      return
    }

    const { error: documentError } = await supabase.from('customer_documents').insert({
      id: documentId,
      organization_id: profile.organization_id,
      customer_id: customer.id,
      uploaded_by: profile.id,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    })

    if (documentError) {
      await supabase.storage.from('customer-files').remove([storagePath])
      setError(documentError.message)
    }
  }

  async function openDocument(document: CustomerDocument) {
    const { data, error: signedUrlError } = await supabase.storage
      .from('customer-files')
      .createSignedUrl(document.storage_path, 60)

    if (signedUrlError) {
      setError(signedUrlError.message)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function deleteDocument(document: CustomerDocument) {
    if (!window.confirm(`确定删除附件「${document.file_name}」吗？`)) return
    await supabase.storage.from('customer-files').remove([document.storage_path])
    await supabase.from('customer_documents').delete().eq('id', document.id)
  }

  if (loading) return <PageHeader title="加载项目详情..." />
  if (!customer) return <EmptyState title="项目不存在或你没有访问权限" action={<Link className="btn-primary" to="/app/customers">返回项目列表</Link>} />

  return (
    <>
      <div className="detail-topline">
        <Link to="/app/customers" className="back-link">← 项目列表</Link>
        <div className="detail-actions">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>编辑资料</Button>
          {canDelete ? <Button variant="danger" onClick={deleteCustomer}>删除</Button> : null}
        </div>
      </div>

      <PageHeader
        title={customer.company_name}
        description={`${customer.industry || '未设置分类'} · 创建于 ${formatDate(customer.created_at)}`}
        action={<Badge tone={customer.status === 'active' ? 'green' : customer.status === 'lead' ? 'blue' : customer.status === 'paused' ? 'amber' : 'red'}>
          {customerStatusLabels[customer.status]}
        </Badge>}
      />

      {error ? <Card className="error-card">{error}</Card> : null}

      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="section-title"><h2>项目资料</h2><strong>{formatCurrency(customer.expected_value)}</strong></div>
            <p className="detail-notes">{customer.notes || '暂无备注'}</p>
            {customer.website ? <a className="external-link" href={customer.website} target="_blank" rel="noreferrer">访问链接 ↗</a> : null}
          </Card>

          <Card>
            <div className="section-title"><h2>参与人</h2><span>{contacts.length} 人</span></div>
            <div className="entity-list">
              {contacts.length === 0 ? <EmptyState title="暂无参与人" /> : contacts.map((contact) => (
                <div key={contact.id} className="entity-row">
                  <div>
                    <strong>{contact.name} {contact.is_primary ? <Badge tone="purple">主要负责人</Badge> : null}</strong>
                    <span>{contact.title || '未设置职位'} · {contact.email || '无邮箱'} · {contact.phone || '无电话'}</span>
                  </div>
                  <div className="row-actions">
                    <button type="button" onClick={() => togglePrimary(contact)}>{contact.is_primary ? '取消主要' : '设为主要'}</button>
                    <button type="button" className="danger-text" onClick={() => deleteContact(contact.id)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
            <form className="inline-form" onSubmit={addContact}>
              <Input placeholder="姓名 *" required value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} />
              <Input placeholder="职位" value={contactForm.title} onChange={(event) => setContactForm({ ...contactForm, title: event.target.value })} />
              <Input placeholder="邮箱" type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} />
              <Input placeholder="电话" value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} />
              <label className="check-line"><input type="checkbox" checked={contactForm.is_primary} onChange={(event) => setContactForm({ ...contactForm, is_primary: event.target.checked })} />主要</label>
              <Button>添加</Button>
            </form>
          </Card>

          <Card>
            <div className="section-title"><h2>相关任务</h2><span>{tasks.length} 个</span></div>
            <div className="entity-list">
              {tasks.length === 0 ? <EmptyState title="暂无任务" /> : tasks.map((task) => (
                <div key={task.id} className="entity-row task-row">
                  <div>
                    <strong>{task.title}</strong>
                    <span>
                      <Badge tone={task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'amber' : 'neutral'}>{taskPriorityLabels[task.priority]}</Badge>
                      {' '}{assigneeName.get(task.assignee_id ?? '') ?? '未分配'} · 截止 {formatDate(task.due_at)}
                    </span>
                    {task.description ? <p>{task.description}</p> : null}
                  </div>
                  <div className="task-controls">
                    <Select value={task.status} onChange={(event) => changeTaskStatus(task.id, event.target.value as TaskStatus)}>
                      {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                    <button type="button" className="danger-text" onClick={() => deleteTask(task.id)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
            <form className="inline-form task-form" onSubmit={addTask}>
              <Input placeholder="任务标题 *" required value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} />
              <Select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value as TaskPriority })}>
                {Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}优先级</option>)}
              </Select>
              <Select value={taskForm.assignee_id} onChange={(event) => setTaskForm({ ...taskForm, assignee_id: event.target.value })}>
                <option value="">未分配</option>
                {profiles.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
              </Select>
              <Input type="date" value={taskForm.due_at} onChange={(event) => setTaskForm({ ...taskForm, due_at: event.target.value })} />
              <Button>添加任务</Button>
            </form>
          </Card>
        </div>

        <aside className="detail-side">
          <Card>
            <div className="section-title"><h2>标签</h2></div>
            <div className="tag-editor">
              {tags.map((tag) => (
                <button key={tag.id} type="button" className={`tag-pill ${selectedTagIds.has(tag.id) ? 'selected' : ''}`} onClick={() => toggleTag(tag)}>
                  <i style={{ backgroundColor: tag.color }} />{tag.name}
                </button>
              ))}
              {tags.length === 0 ? <p className="muted">还没有标签。</p> : null}
              <form className="tag-create" onSubmit={createTag}>
                <Input placeholder="新标签" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} />
                <Button variant="secondary">创建</Button>
              </form>
            </div>
          </Card>

          <Card>
            <div className="section-title">
              <h2>附件</h2>
              <label className="upload-button">
                上传文件
                <input type="file" onChange={uploadDocument} hidden />
              </label>
            </div>
            <div className="entity-list">
              {documents.length === 0 ? <EmptyState title="暂无附件" description="单个文件最大 10MB，文件保存在私有 Storage Bucket。" /> : documents.map((document) => (
                <div key={document.id} className="entity-row document-row">
                  <button type="button" onClick={() => openDocument(document)}>
                    <strong>{document.file_name}</strong>
                    <span>{formatFileSize(document.size_bytes)} · {formatDate(document.created_at)}</span>
                  </button>
                  <button type="button" className="danger-text" onClick={() => deleteDocument(document)}>删除</button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="section-title"><h2>活动轨迹</h2><span className="live-pill"><i />实时</span></div>
            <div className="timeline compact">
              {activities.length === 0 ? <EmptyState title="暂无活动" /> : activities.map((activity) => (
                <div key={activity.id} className="timeline-item">
                  <div className="timeline-dot" />
                  <div>
                    <strong>{activity.actor?.full_name ?? '系统'}</strong>
                    <span>{activity.action === 'insert' ? '创建' : '更新'}了{activity.entity_type === 'customer' ? '项目' : '任务'}</span>
                    <time>{formatDateTime(activity.created_at)}</time>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>

      <Modal open={editOpen} title="编辑项目" onClose={() => setEditOpen(false)}>
        <CustomerForm
          initial={customer}
          profiles={profiles}
          submitting={savingCustomer}
          onSubmit={saveCustomer}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </>
  )
}

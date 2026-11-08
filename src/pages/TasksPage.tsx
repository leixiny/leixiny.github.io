import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Customer, Profile, Task, TaskPriority, TaskStatus, TaskWithRelations } from '../types'
import { taskPriorityLabels, taskStatusLabels } from '../types'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from '../components/ui'
import { formatDate } from '../lib/format'
import { debounce, peek, put } from '../lib/cache'

interface TaskFormValues {
  title: string
  customer_id: string
  assignee_id: string
  priority: TaskPriority
  due_at: string
}

const emptyForm: TaskFormValues = {
  title: '',
  customer_id: '',
  assignee_id: '',
  priority: 'medium',
  due_at: '',
}

export default function TasksPage() {
  const { profile } = useAuth()
  // 先铺上次的看板，切回来立刻是满的
  const [tasks, setTasks] = useState<TaskWithRelations[]>(() => peek<TaskWithRelations[]>('tasks|all') ?? [])
  const [customers, setCustomers] = useState<Customer[]>(() => peek<Customer[]>('task-customers') ?? [])
  const [profiles, setProfiles] = useState<Profile[]>(() => peek<Profile[]>('task-profiles') ?? [])
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'mine'>('all')
  const [form, setForm] = useState<TaskFormValues>(emptyForm)
  const [error, setError] = useState('')

  /* 当前筛选放进 ref：加载函数不再随输入变化重建，实时订阅也就不用跟着重连 */
  const filters = useRef({ mine: false, profileId: '' })
  filters.current = { mine: assigneeFilter === 'mine', profileId: profile?.id ?? '' }

  const load = useCallback(async () => {
    const { mine, profileId } = filters.current
    let taskQuery = supabase.from('tasks').select('*').order('created_at', { ascending: false })
    if (mine) {
      taskQuery = taskQuery.eq('assignee_id', profileId || '')
    }

    const [tasksResult, customersResult, profilesResult] = await Promise.all([
      taskQuery.returns<Task[]>(),
      supabase.from('customers').select('id, company_name, status').order('company_name').returns<Pick<Customer, 'id' | 'company_name' | 'status'>[]>(),
      supabase.from('profiles').select('id, full_name').returns<Pick<Profile, 'id' | 'full_name'>[]>(),
    ])

    if (tasksResult.error) {
      setError(tasksResult.error.message)
      return
    }

    const customerMap = new Map((customersResult.data ?? []).map((customer) => [customer.id, customer]))
    const profileMap = new Map((profilesResult.data ?? []).map((member) => [member.id, member]))

    const board = (tasksResult.data ?? []).map((task) => ({
      ...task,
      customers: task.customer_id ? customerMap.get(task.customer_id) ?? null : null,
      assignee: task.assignee_id ? profileMap.get(task.assignee_id) ?? null : null,
    }))
    setTasks(board)
    put(mine ? 'tasks|mine' : 'tasks|all', board)
    setCustomers((customersResult.data ?? []) as Customer[])
    setProfiles((profilesResult.data ?? []) as Profile[])
    put('task-customers', customersResult.data ?? [])
    put('task-profiles', profilesResult.data ?? [])
  }, [])

  /* 订阅只建一次；实时事件攒 300ms 刷一次，拖拽状态或批量改的时候不会连刷十遍 */
  const reload = useMemo(() => debounce(() => void load(), 300), [load])

  useEffect(() => {
    const channel = supabase
      .channel('tasks-board-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => reload())
      .subscribe()

    return () => {
      reload.cancel()
      supabase.removeChannel(channel)
    }
  }, [reload])

  // 换「全部 / 分配给我」时重新取一次
  useEffect(() => {
    void load()
  }, [assigneeFilter, load])

  const columns = useMemo(() => {
    return (Object.keys(taskStatusLabels) as TaskStatus[]).map((status) => ({
      status,
      label: taskStatusLabels[status],
      tasks: tasks.filter((task) => task.status === status),
    }))
  }, [tasks])

  async function createTask(event: React.FormEvent) {
    event.preventDefault()
    if (!profile?.organization_id) return

    const { error: insertError } = await supabase.from('tasks').insert({
      organization_id: profile.organization_id,
      created_by: profile.id,
      customer_id: form.customer_id || null,
      assignee_id: form.assignee_id || null,
      title: form.title,
      priority: form.priority,
      due_at: form.due_at ? new Date(`${form.due_at}T09:00:00`).toISOString() : null,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setForm(emptyForm)
    }
  }

  async function changeStatus(taskId: string, status: TaskStatus) {
    const { error: updateError } = await supabase.from('tasks').update({ status }).eq('id', taskId)
    if (updateError) setError(updateError.message)
  }

  async function deleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId)
  }

  return (
    <>
      <PageHeader title="任务协作" description="任务可独立存在，也可通过 customer_id 关联项目；状态变更会通过 Realtime 同步。" />

      <Card className="task-create-card">
        <form className="task-create-form" onSubmit={createTask}>
          <Field label="任务标题">
            <Input required placeholder="写文档 / 画原型 / 复习总结" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </Field>
          <Field label="关联项目">
            <Select value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })}>
              <option value="">不关联</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company_name}</option>)}
            </Select>
          </Field>
          <Field label="负责人">
            <Select value={form.assignee_id} onChange={(event) => setForm({ ...form, assignee_id: event.target.value })}>
              <option value="">未分配</option>
              {profiles.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
            </Select>
          </Field>
          <Field label="优先级">
            <Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}>
              {Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="截止日期">
            <Input type="date" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
          </Field>
          <Button className="task-create-button">创建任务</Button>
        </form>
        {error ? <p className="inline-error">{error}</p> : null}
      </Card>

      <div className="task-filters">
        <button className={assigneeFilter === 'all' ? 'active' : ''} type="button" onClick={() => setAssigneeFilter('all')}>全部任务</button>
        <button className={assigneeFilter === 'mine' ? 'active' : ''} type="button" onClick={() => setAssigneeFilter('mine')}>分配给我</button>
      </div>

      <div className="kanban-grid">
        {columns.map((column) => (
          <Card key={column.status} className="kanban-column">
            <div className="kanban-title">
              <h2>{column.label}</h2>
              <span>{column.tasks.length}</span>
            </div>
            {column.tasks.length === 0 ? (
              <EmptyState title="暂无任务" />
            ) : column.tasks.map((task) => (
              <article key={task.id} className="task-card">
                <div className="task-card-heading">
                  <strong>{task.title}</strong>
                  <button type="button" className="danger-text" onClick={() => deleteTask(task.id)}>×</button>
                </div>
                {task.customers ? (
                  <Link className="task-customer" to={`/app/customers/${task.customers.id}`}>{task.customers.company_name}</Link>
                ) : (
                  <span className="muted">独立任务</span>
                )}
                <div className="task-meta">
                  <Badge tone={task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'amber' : 'neutral'}>
                    {taskPriorityLabels[task.priority]}
                  </Badge>
                  <span>{task.assignee?.full_name ?? '未分配'}</span>
                  <span>{task.due_at ? formatDate(task.due_at) : '无日期'}</span>
                </div>
                <Select value={task.status} onChange={(event) => changeStatus(task.id, event.target.value as TaskStatus)}>
                  {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </article>
            ))}
          </Card>
        ))}
      </div>
    </>
  )
}

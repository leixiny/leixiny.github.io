import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Customer, Profile, Task, TaskPriority, TaskStatus, TaskWithRelations } from '../types'
import { taskPriorityLabels, taskStatusLabels } from '../types'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from '../components/ui'
import { formatDate } from '../lib/format'

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
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'mine'>('all')
  const [form, setForm] = useState<TaskFormValues>(emptyForm)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    let taskQuery = supabase.from('tasks').select('*').order('created_at', { ascending: false })
    if (assigneeFilter === 'mine') {
      taskQuery = taskQuery.eq('assignee_id', profile?.id ?? '')
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

    setTasks((tasksResult.data ?? []).map((task) => ({
      ...task,
      customers: task.customer_id ? customerMap.get(task.customer_id) ?? null : null,
      assignee: task.assignee_id ? profileMap.get(task.assignee_id) ?? null : null,
    })))
    setCustomers((customersResult.data ?? []) as Customer[])
    setProfiles((profilesResult.data ?? []) as Profile[])
  }, [assigneeFilter, profile?.id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('tasks-board-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

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

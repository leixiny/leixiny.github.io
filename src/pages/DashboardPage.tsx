import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ActivityLog, CustomerSummary, DashboardStats, Task } from '../types'
import { customerStatusLabels, taskPriorityLabels } from '../types'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui'
import { formatCurrency, formatDateTime, formatDate } from '../lib/format'

const emptyStats: DashboardStats = {
  customers_total: 0,
  active_customers: 0,
  open_tasks: 0,
  due_today: 0,
  overdue_tasks: 0,
  documents_total: 0,
  team_members_total: 0,
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])

  const load = useCallback(async () => {
    const [statsResult, customersResult, tasksResult, activitiesResult] = await Promise.all([
      supabase.rpc('get_dashboard_stats'),
      supabase
        .from('v_customer_summary')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(6)
        .returns<CustomerSummary[]>(),
      supabase
        .from('tasks')
        .select('*')
        .neq('status', 'done')
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(6)
        .returns<Task[]>(),
      supabase
        .from('activity_logs')
        .select('*, actor:profiles!activity_logs_actor_id_fkey(id, full_name)')
        .order('created_at', { ascending: false })
        .limit(8)
        .returns<ActivityLog[]>(),
    ])

    if (Array.isArray(statsResult.data)) setStats((statsResult.data[0] as DashboardStats) ?? emptyStats)
    if (customersResult.data) setCustomers(customersResult.data)
    if (tasksResult.data) setTasks(tasksResult.data)
    if (activitiesResult.data) setActivities(activitiesResult.data)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const statCards = [
    { label: '项目总数', value: stats.customers_total, tone: 'blue' as const },
    { label: '进行中项目', value: stats.active_customers, tone: 'green' as const },
    { label: '未完成任务', value: stats.open_tasks, tone: 'purple' as const },
    { label: '今日到期', value: stats.due_today, tone: 'amber' as const },
    { label: '已逾期', value: stats.overdue_tasks, tone: 'red' as const },
    { label: '附件数量', value: stats.documents_total, tone: 'neutral' as const },
  ]

  return (
    <>
      <PageHeader
        title="仪表盘"
        description="关键指标、最近项目、待办任务和实时活动会自动同步。"
        action={<Link className="btn-primary" to="/customers">新增项目</Link>}
      />

      <div className="stats-grid">
        {statCards.map((item) => (
          <Card key={item.label} className="stat-card">
            <span>{item.label}</span>
            <strong className={`stat-number stat-${item.tone}`}>{item.value}</strong>
          </Card>
        ))}
      </div>

      <div className="dashboard-grid">
        <Card>
          <div className="section-title">
            <h2>最近项目</h2>
            <Link to="/customers">查看全部</Link>
          </div>
          {customers.length === 0 ? (
            <EmptyState title="还没有项目" description="创建第一个项目，开始记录参与人和任务。" />
          ) : (
            <div className="list-stack">
              {customers.map((customer) => (
                <Link key={customer.id} to={`/customers/${customer.id}`} className="list-row">
                  <div>
                    <strong>{customer.company_name}</strong>
                    <span>{customer.industry || '未设置分类'} · {customer.contact_count} 位参与人 · {customer.open_task_count} 个待办</span>
                  </div>
                  <div className="list-row-meta">
                    <Badge tone={customer.status === 'active' ? 'green' : customer.status === 'lead' ? 'blue' : customer.status === 'paused' ? 'amber' : 'red'}>
                      {customerStatusLabels[customer.status]}
                    </Badge>
                    <em>{formatCurrency(customer.expected_value)}</em>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="section-title">
            <h2>即将到期</h2>
            <Link to="/tasks">任务看板</Link>
          </div>
          {tasks.length === 0 ? (
            <EmptyState title="没有待办任务" description="可以在项目详情页创建相关任务。" />
          ) : (
            <div className="list-stack">
              {tasks.map((task) => (
                <Link key={task.id} to={task.customer_id ? `/customers/${task.customer_id}` : '/tasks'} className="list-row compact">
                  <div>
                    <strong>{task.title}</strong>
                    <span>{taskPriorityLabels[task.priority]}优先级</span>
                  </div>
                  <Badge tone={new Date(task.due_at ?? 0) < new Date() ? 'red' : 'amber'}>
                    {task.due_at ? formatDate(task.due_at) : '无日期'}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="activity-card">
        <div className="section-title">
          <h2>实时活动</h2>
          <span className="live-pill"><i /> Realtime</span>
        </div>
        {activities.length === 0 ? (
          <EmptyState title="暂无活动" description="新增或修改项目、任务后，触发器会自动写入活动日志。" />
        ) : (
          <div className="timeline">
            {activities.map((activity) => (
              <div key={activity.id} className="timeline-item">
                <div className="timeline-dot" />
                <div>
                  <strong>{activity.actor?.full_name ?? '系统'}</strong>
                  <span>
                    {activity.action === 'insert' ? '创建' : activity.action === 'update' ? '更新' : '删除'}
                    {activity.entity_type === 'customer' ? '了项目' : '了任务'}
                  </span>
                  <time>{formatDateTime(activity.created_at)}</time>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}

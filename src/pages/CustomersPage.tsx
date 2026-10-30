import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Customer, CustomerStatus, CustomerSummary, Profile } from '../types'
import { customerStatusLabels } from '../types'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from '../components/ui'
import CustomerForm from '../components/CustomerForm'
import { formatCurrency, formatDate } from '../lib/format'

export default function CustomersPage() {
  const { profile, role } = useAuth()
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | CustomerStatus>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerSummary | null>(null)
  const [saving, setSaving] = useState(false)

  const canManage = role === 'owner' || role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('v_customer_summary')
      .select('*')
      .order('updated_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const keyword = search.trim().replace(/[,()\\]/g, ' ')
    if (keyword) {
      const pattern = `%${keyword}%`
      query = query.or(`company_name.ilike.${pattern},industry.ilike.${pattern},notes.ilike.${pattern}`)
    }

    const [{ data: customerData, error: customerError }, { data: profileData }] = await Promise.all([
      query.returns<CustomerSummary[]>(),
      supabase.from('profiles').select('*').order('full_name').returns<Profile[]>(),
    ])

    if (customerError) {
      setError(customerError.message)
    } else {
      setError('')
      setCustomers(customerData ?? [])
    }
    setProfiles(profileData ?? [])
    setLoading(false)
  }, [search, status])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('customers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const initialCustomer = useMemo(() => editing as Customer | null, [editing])

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(customer: CustomerSummary) {
    setEditing(customer)
    setModalOpen(true)
  }

  async function handleSubmit(values: Omit<Customer, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'created_by'>) {
    if (!profile?.organization_id) return
    setSaving(true)
    setError('')

    const payload = {
      ...values,
      industry: values.industry || null,
      website: values.website || null,
      notes: values.notes || null,
      owner_id: values.owner_id || null,
    }

    const { error: saveError } = editing
      ? await supabase.from('customers').update(payload).eq('id', editing.id)
      : await supabase.from('customers').insert({
          ...payload,
          organization_id: profile.organization_id,
          created_by: profile.id,
        })

    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }

    setModalOpen(false)
    setEditing(null)
    await load()
  }

  async function handleDelete(customer: CustomerSummary) {
    if (!canManage) return
    if (!window.confirm(`确定删除项目「${customer.company_name}」吗？参与人和任务会一起删除。`)) return

    const { error: deleteError } = await supabase.from('customers').delete().eq('id', customer.id)
    if (deleteError) setError(deleteError.message)
    else await load()
  }

  return (
    <>
      <PageHeader
        title="项目管理"
        description="项目表通过 organization_id 做租户隔离，并使用全文索引和状态索引支持搜索和筛选。"
        action={<Button onClick={openCreate}>新增项目</Button>}
      />

      <Card className="filter-card">
        <Field label="关键词">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索名称、分类或备注" />
        </Field>
        <Field label="阶段">
          <Select value={status} onChange={(event) => setStatus(event.target.value as 'all' | CustomerStatus)}>
            <option value="all">全部阶段</option>
            {Object.entries(customerStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
      </Card>

      {error ? <Card className="error-card">{error}</Card> : null}

      <Card>
        {loading ? (
          <EmptyState title="正在加载项目..." />
        ) : customers.length === 0 ? (
          <EmptyState
            title="没有符合条件的项目"
            description="新增项目后，可以继续维护参与人、标签、任务和附件。"
            action={<Button onClick={openCreate}>新增项目</Button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>阶段</th>
                  <th>负责人</th>
                  <th>预算</th>
                  <th>待办</th>
                  <th>最近活动</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link className="table-primary" to={`/customers/${customer.id}`}>{customer.company_name}</Link>
                      <small>{customer.industry || '未设置分类'}</small>
                    </td>
                    <td>
                      <Badge tone={customer.status === 'active' ? 'green' : customer.status === 'lead' ? 'blue' : customer.status === 'paused' ? 'amber' : 'red'}>
                        {customerStatusLabels[customer.status]}
                      </Badge>
                    </td>
                    <td>{customer.owner_name ?? '未分配'}</td>
                    <td>{formatCurrency(customer.expected_value)}</td>
                    <td>{customer.open_task_count}</td>
                    <td>{formatDate(customer.last_activity_at)}</td>
                    <td className="row-actions">
                      <button type="button" onClick={() => openEdit(customer)}>编辑</button>
                      {canManage ? (
                        <button type="button" className="danger-text" onClick={() => handleDelete(customer)}>删除</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} title={editing ? '编辑项目' : '新增项目'} onClose={() => setModalOpen(false)}>
        <CustomerForm
          initial={initialCustomer}
          profiles={profiles}
          submitting={saving}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </>
  )
}

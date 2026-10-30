export type Role = 'owner' | 'admin' | 'member'
export type CustomerStatus = 'lead' | 'active' | 'paused' | 'churned'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Organization {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  organization_id: string | null
  email: string
  full_name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationMember extends Profile {
  role: Role
}

export interface Customer {
  id: string
  organization_id: string
  company_name: string
  industry: string | null
  website: string | null
  status: CustomerStatus
  expected_value: number
  notes: string | null
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CustomerSummary extends Customer {
  owner_name: string | null
  contact_count: number
  open_task_count: number
  document_count: number
  last_activity_at: string | null
}

export interface Contact {
  id: string
  organization_id: string
  customer_id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  organization_id: string
  name: string
  color: string
  created_at: string
}

export interface CustomerTag {
  customer_id: string
  tag_id: string
  created_at: string
}

export interface Task {
  id: string
  organization_id: string
  customer_id: string | null
  assignee_id: string | null
  created_by: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskWithRelations extends Task {
  customers?: Pick<Customer, 'id' | 'company_name'> | null
  assignee?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface CustomerDocument {
  id: string
  organization_id: string
  customer_id: string
  uploaded_by: string | null
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number
  created_at: string
}

export interface ActivityLog {
  id: string
  organization_id: string
  customer_id: string | null
  actor_id: string | null
  action: 'insert' | 'update' | 'delete'
  entity_type: 'customer' | 'task'
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
  actor?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface DashboardStats {
  customers_total: number
  active_customers: number
  open_tasks: number
  due_today: number
  overdue_tasks: number
  documents_total: number
  team_members_total: number
}

export const customerStatusLabels: Record<CustomerStatus, string> = {
  lead: '计划中',
  active: '进行中',
  paused: '暂停',
  churned: '已完结',
}

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: '待处理',
  in_progress: '进行中',
  done: '已完成',
}

export const taskPriorityLabels: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

export const roleLabels: Record<Role, string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
}

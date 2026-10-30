import { useState } from 'react'
import type { Customer, CustomerStatus, Profile } from '../types'
import { customerStatusLabels } from '../types'
import { Button, Field, Input, Select, Textarea } from './ui'

interface CustomerFormValues {
  company_name: string
  industry: string
  website: string
  status: CustomerStatus
  expected_value: number
  notes: string
  owner_id: string | null
}

interface CustomerFormProps {
  initial?: Customer | null
  profiles: Profile[]
  submitting: boolean
  onSubmit: (values: CustomerFormValues) => void
  onCancel: () => void
}

export default function CustomerForm({ initial, profiles, submitting, onSubmit, onCancel }: CustomerFormProps) {
  const [values, setValues] = useState<CustomerFormValues>({
    company_name: initial?.company_name ?? '',
    industry: initial?.industry ?? '',
    website: initial?.website ?? '',
    status: initial?.status ?? 'lead',
    expected_value: Number(initial?.expected_value ?? 0),
    notes: initial?.notes ?? '',
    owner_id: initial?.owner_id ?? null,
  })

  function update<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(values)
      }}
    >
      <Field label="项目名称 *">
        <Input
          value={values.company_name}
          onChange={(event) => update('company_name', event.target.value)}
          required
          placeholder="项目名称"
        />
      </Field>
      <Field label="分类">
        <Input value={values.industry} onChange={(event) => update('industry', event.target.value)} placeholder="开发 / 设计 / 学习" />
      </Field>
      <Field label="链接">
        <Input type="url" value={values.website} onChange={(event) => update('website', event.target.value)} placeholder="https://example.com" />
      </Field>
      <Field label="阶段">
        <Select value={values.status} onChange={(event) => update('status', event.target.value as CustomerStatus)}>
          {Object.entries(customerStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </Field>
      <Field label="预算（元）">
        <Input
          type="number"
          min="0"
          step="100"
          value={values.expected_value}
          onChange={(event) => update('expected_value', Number(event.target.value))}
        />
      </Field>
      <Field label="负责人">
        <Select value={values.owner_id ?? ''} onChange={(event) => update('owner_id', event.target.value || null)}>
          <option value="">未分配</option>
          {profiles.map((member) => (
            <option key={member.id} value={member.id}>{member.full_name}</option>
          ))}
        </Select>
      </Field>
      <div className="form-wide">
        <Field label="备注">
          <Textarea rows={4} value={values.notes} onChange={(event) => update('notes', event.target.value)} placeholder="项目背景、关键需求、下一步动作..." />
        </Field>
      </div>
      <div className="form-actions form-wide">
        <Button type="button" variant="secondary" onClick={onCancel}>取消</Button>
        <Button loading={submitting}>{initial ? '保存修改' : '创建项目'}</Button>
      </div>
    </form>
  )
}

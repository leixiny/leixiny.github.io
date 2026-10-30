import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { OrganizationMember, Profile, Role } from '../types'
import { roleLabels } from '../types'
import { Badge, Card, EmptyState, PageHeader, Select } from '../components/ui'
import { formatDate, initials } from '../lib/format'

interface MembershipRole {
  organization_id: string
  profile_id: string
  role: Role
}

export default function TeamPage() {
  const { role, organization } = useAuth()
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [profilesResult, rolesResult] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at').returns<Profile[]>(),
      supabase.from('organization_members').select('*').returns<MembershipRole[]>(),
    ])

    if (profilesResult.error || rolesResult.error) {
      setError(profilesResult.error?.message ?? rolesResult.error?.message ?? '加载团队失败')
      return
    }

    const roleMap = new Map((rolesResult.data ?? []).map((item) => [item.profile_id, item.role]))
    setMembers(
      (profilesResult.data ?? [])
        .filter((profile) => profile.organization_id === organization?.id)
        .map((profile) => ({ ...profile, role: roleMap.get(profile.id) ?? 'member' })),
    )
  }, [organization?.id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('team-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organization_members' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  async function changeRole(profileId: string, nextRole: Role) {
    setError('')
    const { error: rpcError } = await supabase.rpc('change_member_role', {
      p_profile_id: profileId,
      p_role: nextRole,
    })
    if (rpcError) setError(rpcError.message)
    await load()
  }

  return (
    <>
      <PageHeader
        title="成员与权限"
        description="organization_members 使用联合主键，一个用户属于一个个人空间，角色由所有者通过安全 RPC 调整。"
      />

      {error ? <Card className="error-card">{error}</Card> : null}

      <Card>
        {members.length === 0 ? (
          <EmptyState title="暂无成员" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>成员</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th>加入时间</th>
                  <th>权限操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="member-cell">
                        <div className="avatar small">{initials(member.full_name)}</div>
                        <strong>{member.full_name}</strong>
                      </div>
                    </td>
                    <td>{member.email}</td>
                    <td>
                      <Badge tone={member.role === 'owner' ? 'purple' : member.role === 'admin' ? 'blue' : 'neutral'}>
                        {roleLabels[member.role]}
                      </Badge>
                    </td>
                    <td>{formatDate(member.created_at)}</td>
                    <td>
                      {role === 'owner' ? (
                        <Select value={member.role} onChange={(event) => changeRole(member.id, event.target.value as Role)}>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </Select>
                      ) : (
                        <span className="muted">仅所有者可调整</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

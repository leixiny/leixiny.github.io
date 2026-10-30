import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Alert, Button, Card, Field, Input, PageHeader } from '../components/ui'
import { roleLabels } from '../types'

export default function ProfilePage() {
  const { profile, role, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    setFullName(profile?.full_name ?? '')
    setAvatarUrl(profile?.avatar_url ?? '')
  }, [profile])

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    setSavingProfile(true)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        avatar_url: avatarUrl || null,
      })
      .eq('id', profile?.id)

    setSavingProfile(false)
    if (updateError) {
      setError(updateError.message)
      return
    }

    await supabase.auth.updateUser({ data: { full_name: fullName, avatar_url: avatarUrl || null } })
    await refreshProfile()
    setMessage('资料已保存')
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    setSavingPassword(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSavingPassword(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setPassword('')
    setMessage('密码已更新')
  }

  return (
    <>
      <PageHeader title="个人资料" description="profiles.id 与 auth.users.id 完全一致，认证信息和业务资料一对一关联。" />

      {error ? <Alert>{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="profile-grid">
        <Card>
          <h2>业务资料</h2>
          <p className="muted">当前角色：{role ? roleLabels[role] : '未加入空间'}</p>
          <form className="stack-form" onSubmit={saveProfile}>
            <Field label="邮箱">
              <Input value={profile?.email ?? ''} disabled />
            </Field>
            <Field label="姓名">
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </Field>
            <Field label="头像 URL" hint="也可以后续扩展为 Storage 上传头像。">
              <Input type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." />
            </Field>
            <Button loading={savingProfile}>保存资料</Button>
          </form>
        </Card>

        <Card>
          <h2>安全设置</h2>
          <p className="muted">密码由 Supabase Auth 管理，业务表不保存密码。</p>
          <form className="stack-form" onSubmit={savePassword}>
            <Field label="新密码" hint="至少 6 位。修改密码邮件策略可能要求重新登录。">
              <Input type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
            <Button variant="secondary" loading={savingPassword}>更新密码</Button>
          </form>
        </Card>
      </div>
    </>
  )
}

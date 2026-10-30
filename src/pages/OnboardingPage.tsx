import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Alert, Button, Field, Input } from '../components/ui'

export default function OnboardingPage() {
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [organizationName, setOrganizationName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreateOrganization(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error: rpcError } = await supabase.rpc('create_organization', {
      p_name: organizationName,
    })

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    await refreshProfile()
    navigate('/')
  }

  return (
    <div className="auth-page">
      <section className="auth-panel narrow">
        <div className="auth-brand">
          <div className="brand-mark large">S</div>
          <h1>创建个人空间</h1>
          <p>个人空间是数据隔离边界。项目、参与人和任务都会归属到你的空间。</p>
        </div>

        <form className="auth-form" onSubmit={handleCreateOrganization}>
          <Field label="空间名称">
            <Input
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="例如：毕业设计"
              required
              autoFocus
            />
          </Field>
          {error ? <Alert>{error}</Alert> : null}
          <Button loading={loading}>创建并进入系统</Button>
        </form>
      </section>
    </div>
  )
}

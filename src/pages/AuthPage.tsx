import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Alert, Button, Field, Input } from '../components/ui'
import WaterRipple from '../components/WaterRipple'

type Mode = 'signin' | 'signup' | 'forgot'

export default function AuthPage() {
  const { session, configured } = useAuth()
  const navigate = useNavigate()
  const here = useLocation()
  // 从「进入管理系统」被拦下来的，登录完回到原来要去的那页
  const next =
    (here.state as { from?: { pathname?: string; search?: string } } | null)?.from?.pathname ?? '/app'
  const [mode, setMode] = useState<Mode>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to={next} replace />

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    // 防止 React StrictMode 或连点导致的重复提交
    if (loading) return
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        navigate(next)
      }

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })
        if (signUpError) throw signUpError
        if (data.session) {
          navigate(next)
        } else {
          setMessage('注册成功，请先到邮箱中确认链接，然后再登录。')
        }
      }

      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${window.location.pathname}#/profile`,
        })
        if (resetError) throw resetError
        setMessage('如果邮箱存在，重置密码邮件已发送。')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    setError('')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
    })
    if (oauthError) setError(oauthError.message)
  }

  return (
    <div className="auth-page">
      {/* 游客只是被管理系统挡下来的，得有一条回首页的路 */}
      <Link className="auth-back" to="/">
        ← 回到首页
      </Link>

      <section className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark large">S</div>
          <h1>SupaProject</h1>
          <p>基于 Supabase 的个人项目与任务管理系统</p>
        </div>

        {!configured ? (
          <Alert tone="info">
            请先复制 <code>.env.example</code> 为 <code>.env.local</code>，填入 Supabase 项目地址和 anon public key，然后重启开发服务器。
          </Alert>
        ) : null}

        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'active' : ''} type="button" onClick={() => setMode('signin')}>
            登录
          </button>
          <button className={mode === 'signup' ? 'active' : ''} type="button" onClick={() => setMode('signup')}>
            注册
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>{mode === 'signin' ? '欢迎回来' : mode === 'signup' ? '创建账号' : '找回密码'}</h2>
          <p className="muted">
            {mode === 'signup'
              ? '注册后需要创建一个个人空间，用于隔离你的项目数据。'
              : mode === 'forgot'
                ? '输入邮箱，我们将发送密码重置链接。'
                : '登录后管理项目、参与人、任务和附件。'}
          </p>

          {mode === 'signup' ? (
            <Field label="姓名">
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required placeholder="张三" />
            </Field>
          ) : null}

          <Field label="邮箱">
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@company.com" />
          </Field>

          {mode !== 'forgot' ? (
            <Field label="密码" hint={mode === 'signup' ? '至少 6 位' : undefined}>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
            </Field>
          ) : null}

          {error ? <Alert>{error}</Alert> : null}
          {message ? <Alert tone="success">{message}</Alert> : null}

          <Button type="submit" loading={loading} disabled={!configured}>
            {mode === 'signin' ? '登录' : mode === 'signup' ? '注册并继续' : '发送重置邮件'}
          </Button>
        </form>

        <div className="auth-divider"><span>或</span></div>
        <Button variant="secondary" type="button" onClick={signInWithGoogle} disabled={!configured}>
          使用 Google 登录
        </Button>
        <button type="button" className="text-button" onClick={() => setMode(mode === 'forgot' ? 'signin' : 'forgot')}>
          {mode === 'forgot' ? '返回登录' : '忘记密码？'}
        </button>
      </section>

      <WaterRipple />
    </div>
  )
}

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * 作品集现在是首页下方的一个独立板块（#works），不再是单独的页面。
 * 老链接 /works 直接送回首页并滚到作品板块，保证旧地址不失效。
 */
export default function WorksPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/home', { replace: true })
    const t = window.setTimeout(() => {
      document.getElementById('skills')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [navigate])

  return null
}

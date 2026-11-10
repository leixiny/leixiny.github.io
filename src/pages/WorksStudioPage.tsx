import { Suspense, lazy } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { WorksManager } from './WorksAdminPage'
import '../components/axon.css'

const AxonField = lazy(() => import('../axon/AxonField'))

/** 新管理系统：只管作品编辑。
 *  以前「编辑作品」挤在旧后台（现在的主页）里当一个小分区；
 *  单独拎出来以后，它有自己的门面：同一片水面，玻璃台上只放作品这一件事。
 *  左上回主页，右上退出，中间就是作品档案的本体。 */
export default function WorksStudioPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="axon works-studio">
      <Suspense fallback={null}>
        <AxonField />
      </Suspense>

      <div className="axon-ui">
        <header className="axon-brand">
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="18.5" fill="none" stroke="#fff" strokeWidth="1.6" />
            <polygon points="20.00,10.80 21.76,15.75 26.51,13.49 24.25,18.24 29.20,20.00 24.25,21.76 26.51,26.51 21.76,24.25 20.00,29.20 18.24,24.25 13.49,26.51 15.75,21.76 10.80,20.00 15.75,18.24 13.49,13.49 18.24,15.75" fill="#fff" />
          </svg>
          <div>
            <b>雷馨怡</b>
            <span>管理系统 · 作品编辑</span>
          </div>
        </header>

        <div className="axon-user">
          <span>{profile?.email}</span>
          <button type="button" onClick={() => navigate('/app')}>返回主页</button>
          <button type="button" onClick={signOut}>退出</button>
        </div>

        <section className="axon-console studio-console">
          <div className="axon-page">
            <WorksManager />
          </div>
        </section>
      </div>
    </div>
  )
}

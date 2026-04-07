import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Home() {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold text-gray-900">¿Qué hay?</h1>
      <p className="text-gray-500">La despensa va aquí (Fase 2)</p>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-700 underline"
      >
        Cerrar sesión
      </button>
    </div>
  )
}

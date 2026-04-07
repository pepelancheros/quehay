import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'

// Protege rutas que requieren estar logueado
function PrivateRoute({ session, children }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}

// Redirige a home si ya está logueado
function PublicRoute({ session, children }) {
  if (session) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = cargando

  useEffect(() => {
    // Obtiene la sesión actual al cargar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Escucha cambios de sesión (login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Mientras verifica la sesión, no renderiza nada
  if (session === undefined) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute session={session}>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute session={session}>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <PrivateRoute session={session}>
              <Home />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

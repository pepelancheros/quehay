import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getUserPantry, getPantryItems, addPantryItem, deletePantryItem, createPantry, joinPantry } from '../lib/pantry'

export default function Home() {
  const [pantry, setPantry] = useState(null)
  const [noPantry, setNoPantry] = useState(false) // usuario sin despensa
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Formulario nuevo ingrediente
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [adding, setAdding] = useState(false)

  // Formulario unirse/crear despensa
  const [inviteCode, setInviteCode] = useState('')
  const [joiningOrCreating, setJoiningOrCreating] = useState(false)
  const [setupError, setSetupError] = useState(null)

  useEffect(() => {
    let attempts = 0

    async function load() {
      try {
        const p = await getUserPantry()
        setPantry(p)
        const i = await getPantryItems(p.id)
        setItems(i)
        setLoading(false)
      } catch (err) {
        // Reintenta hasta 5 veces con 600ms de espera (race condition al registrarse)
        if (attempts < 5) {
          attempts++
          setTimeout(load, 600)
        } else {
          // Después de reintentos, asumimos que el usuario no tiene despensa
          setNoPantry(true)
          setLoading(false)
        }
      }
    }
    load()
  }, [])

  async function handleCreatePantry() {
    setJoiningOrCreating(true)
    setSetupError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await createPantry(user.id)
      const p = await getUserPantry()
      setPantry(p)
      setNoPantry(false)
    } catch (err) {
      setSetupError(err.message)
    } finally {
      setJoiningOrCreating(false)
    }
  }

  async function handleJoinPantry(e) {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setJoiningOrCreating(true)
    setSetupError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await joinPantry(inviteCode.trim(), user.id)
      const p = await getUserPantry()
      const i = await getPantryItems(p.id)
      setPantry(p)
      setItems(i)
      setNoPantry(false)
      setInviteCode('')
    } catch (err) {
      setSetupError(err.message === 'Código inválido' ? 'El código de despensa no existe.' : err.message)
    } finally {
      setJoiningOrCreating(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    try {
      const item = await addPantryItem(pantry.id, name.trim(), quantity, unit)
      setItems((prev) => [...prev, item])
      setName('')
      setQuantity('')
      setUnit('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(itemId) {
    try {
      await deletePantryItem(itemId)
      setItems((prev) => prev.filter((i) => i.id !== itemId))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Cargando despensa...</p>
    </div>
  )

  // Usuario sin despensa — mostrar opciones para crear o unirse
  if (noPantry) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">¿Qué hay?</h1>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">Salir</button>
        </div>
        <p className="text-gray-500 text-sm mb-6">Todavía no tenés una despensa. Podés crear una nueva o unirte a una existente.</p>

        {setupError && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{setupError}</p>
        )}

        {/* Unirse con código */}
        <form onSubmit={handleJoinPantry} className="flex flex-col gap-2 mb-4">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Ingresá el código de despensa"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={joiningOrCreating || !inviteCode.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {joiningOrCreating ? 'Uniéndose...' : 'Unirme a una despensa'}
          </button>
        </form>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">o</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Crear nueva */}
        <button
          onClick={handleCreatePantry}
          disabled={joiningOrCreating}
          className="w-full border border-gray-200 hover:border-gray-300 disabled:opacity-50 text-gray-700 font-medium py-2 rounded-lg text-sm transition-colors"
        >
          {joiningOrCreating ? 'Creando...' : 'Crear despensa nueva'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">¿Qué hay?</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Salir
          </button>
        </div>

        {/* Invite code */}
        {pantry && (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-700 font-medium">Código de tu despensa</p>
              <p className="text-lg font-mono font-bold text-green-800 tracking-widest">{pantry.inviteCode}</p>
            </div>
            <p className="text-xs text-green-600 text-right max-w-[140px]">Compartilo para que otro usuario se una</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
        )}

        {/* Formulario agregar */}
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Agregar ingrediente</p>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre (ej: Arroz)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Cantidad"
                min="0"
                className="w-1/2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Unidad (ej: kg)"
                className="w-1/2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {adding ? 'Agregando...' : 'Agregar'}
            </button>
          </div>
        </form>

        {/* Unirse a otra despensa — solo visible cuando la despensa está vacía */}
        {items.length === 0 && (
          <form onSubmit={handleJoinPantry} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Unirme a otra despensa</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Código de despensa"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={joiningOrCreating || !inviteCode.trim()}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium px-4 rounded-lg text-sm transition-colors"
              >
                {joiningOrCreating ? '...' : 'Unirme'}
              </button>
            </div>
            {setupError && (
              <p className="text-sm text-red-500 mt-2">{setupError}</p>
            )}
          </form>
        )}

        {/* Lista de ingredientes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">La despensa está vacía</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  {(item.quantity || item.unit) && (
                    <p className="text-xs text-gray-400">
                      {item.quantity} {item.unit}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}

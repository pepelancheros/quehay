import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getUserPantry, getPantryItems, addPantryItem, deletePantryItem } from '../lib/pantry'

export default function Home() {
  const [pantry, setPantry] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Formulario nuevo ingrediente
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [adding, setAdding] = useState(false)

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
          setError(err.message)
          setLoading(false)
        }
      }
    }
    load()
  }, [])

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

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getUserPantry, getPantryItems, addPantryItem, deletePantryItem, createPantry, joinPantry, getFavoriteRecipes, addFavoriteRecipe, removeFavoriteRecipe } from '../lib/pantry'

export default function Home() {
  const [pantry, setPantry] = useState(null)
  const [noPantry, setNoPantry] = useState(false)
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

  // Código de despensa minimizado
  const [codeVisible, setCodeVisible] = useState(true)

  // Dictado de voz
  const [listening, setListening] = useState(false)
  const [dictationError, setDictationError] = useState(null)
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const manualStopRef = useRef(false)

  // Recetas
  const [recipes, setRecipes] = useState([])
  const [loadingRecipes, setLoadingRecipes] = useState(false)
  const [recipesError, setRecipesError] = useState(null)
  const [mealType, setMealType] = useState('cualquiera')

  // Favoritos
  const [favorites, setFavorites] = useState([])
  const [showFavorites, setShowFavorites] = useState(false)

  useEffect(() => {
    let attempts = 0

    async function load() {
      try {
        const p = await getUserPantry()
        setPantry(p)
        const i = await getPantryItems(p.id)
        setItems(i)
        const f = await getFavoriteRecipes()
        setFavorites(f)
        setLoading(false)
      } catch (err) {
        if (attempts < 5) {
          attempts++
          setTimeout(load, 600)
        } else {
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
      setRecipes([])
    } catch (err) {
      setError(err.message)
    }
  }

  async function processTranscript(text) {
    if (!text.trim()) return
    try {
      const res = await fetch('/api/parse-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      for (const ing of data.ingredients) {
        const item = await addPantryItem(pantry.id, ing.name, ing.quantity, ing.unit)
        setItems((prev) => [...prev, item])
      }
    } catch (err) {
      setDictationError(err.message || 'Error procesando el dictado.')
    }
  }

  function handleDictate() {
    // Si está grabando, parar manualmente y procesar
    if (listening) {
      manualStopRef.current = true
      recognitionRef.current?.stop()
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setDictationError('Tu navegador no soporta dictado de voz.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'es-ES'
    recognition.interimResults = false
    recognition.continuous = true
    recognitionRef.current = recognition
    transcriptRef.current = ''
    manualStopRef.current = false

    recognition.onstart = () => {
      setListening(true)
      setDictationError(null)
    }

    recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          transcriptRef.current += ' ' + e.results[i][0].transcript
        }
      }
    }

    recognition.onend = () => {
      if (!manualStopRef.current) {
        // El browser paró solo (mobile) — reiniciar para seguir grabando
        try { recognition.start() } catch {}
        return
      }
      setListening(false)
      processTranscript(transcriptRef.current.trim())
      transcriptRef.current = ''
    }

    recognition.onerror = (e) => {
      if (e.error === 'no-speech') return // ignorar silencios intermedios
      setListening(false)
      setDictationError('No se pudo capturar el audio. Intentá de nuevo.')
    }

    recognition.start()
  }

  async function handleGetRecipes() {
    setLoadingRecipes(true)
    setRecipesError(null)
    setRecipes([])
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: items, mealType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error generando recetas')
      setRecipes(data.recipes || [])
    } catch (err) {
      setRecipesError(err.message)
    } finally {
      setLoadingRecipes(false)
    }
  }

  async function handleToggleFavorite(recipe) {
    const existing = favorites.find((f) => f.name === recipe.name)
    if (existing) {
      await removeFavoriteRecipe(existing.id)
      setFavorites((prev) => prev.filter((f) => f.id !== existing.id))
    } else {
      const saved = await addFavoriteRecipe(recipe)
      setFavorites((prev) => [saved, ...prev])
    }
  }

  function isFavorite(recipeName) {
    return favorites.some((f) => f.name === recipeName)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Cargando despensa...</p>
    </div>
  )

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
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">
            Salir
          </button>
        </div>

        {/* Invite code */}
        {pantry && (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-6">
            <button
              onClick={() => setCodeVisible((v) => !v)}
              className="w-full flex items-center justify-between"
            >
              <p className="text-xs text-green-700 font-medium">Código de tu despensa</p>
              <span className={`text-green-600 text-xl inline-block transition-transform ${codeVisible ? '-rotate-90' : 'rotate-90'}`}>›</span>
            </button>
            {codeVisible && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-lg font-mono font-bold text-green-800 tracking-widest">{pantry.inviteCode}</p>
                <p className="text-xs text-green-600 text-right max-w-[140px]">Compartilo para que otro usuario se una</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
        )}

        {/* Formulario agregar */}
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">Agregar ingrediente</p>
            <button
              type="button"
              onClick={handleDictate}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${listening ? 'bg-red-50 border-red-200 text-red-500' : 'border-gray-200 text-gray-400 hover:border-green-300 hover:text-green-600'}`}
              title={listening ? 'Parar grabación' : 'Dictá tus ingredientes'}
            >
              {listening ? '⏹ Parar' : '🎤 Dictár'}
            </button>
          </div>
          {dictationError && (
            <p className="text-xs text-red-500 mb-2">{dictationError}</p>
          )}
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 mb-6">
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

        {/* Filtros + botón sugerir recetas */}
        {items.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 mb-3">
              {['cualquiera', 'desayuno', 'almuerzo', 'cena', 'ensalada'].map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setMealType(tipo)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${mealType === tipo ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'}`}
                >
                  {tipo}
                </button>
              ))}
            </div>
            <button
              onClick={handleGetRecipes}
              disabled={loadingRecipes}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-3 rounded-2xl text-sm transition-colors"
            >
              {loadingRecipes ? 'Generando recetas...' : '¿Qué puedo cocinar?'}
            </button>
          </div>
        )}

        {recipesError && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-4">{recipesError}</p>
        )}

        {/* Recetas sugeridas */}
        {recipes.length > 0 && (
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Recetas sugeridas</p>
              <button
                onClick={handleGetRecipes}
                disabled={loadingRecipes}
                className="text-xs text-green-600 hover:text-green-700 disabled:opacity-50 transition-colors"
              >
                🔄 Otras opciones
              </button>
            </div>
            {recipes.map((recipe, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <p className="font-semibold text-gray-900">{recipe.name}</p>
                  <button
                    onClick={() => handleToggleFavorite(recipe)}
                    className="text-xl leading-none ml-2 shrink-0"
                    title={isFavorite(recipe.name) ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                  >
                    {isFavorite(recipe.name) ? '★' : '☆'}
                  </button>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-medium text-green-700 mb-1">Tenés</p>
                  <div className="flex flex-wrap gap-1">
                    {recipe.have.map((ing, j) => (
                      <span key={j} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{ing}</span>
                    ))}
                  </div>
                </div>

                {recipe.missing.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-amber-600 mb-1">Te falta</p>
                    <div className="flex flex-wrap gap-1">
                      {recipe.missing.map((ing, j) => (
                        <span key={j} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{ing}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Pasos</p>
                  <ol className="flex flex-col gap-1">
                    {recipe.steps.map((step, j) => (
                      <li key={j} className="text-xs text-gray-600">{j + 1}. {step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recetas favoritas */}
        {favorites.length > 0 && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setShowFavorites((v) => !v)}
              className="flex items-center justify-between"
            >
              <p className="text-sm font-medium text-gray-700">Favoritos ({favorites.length})</p>
              <span className={`text-gray-400 text-xl inline-block transition-transform ${showFavorites ? '-rotate-90' : 'rotate-90'}`}>›</span>
            </button>
            {showFavorites && favorites.map((recipe) => (
              <div key={recipe.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <p className="font-semibold text-gray-900">{recipe.name}</p>
                  <button
                    onClick={() => removeFavoriteRecipe(recipe.id).then(() => setFavorites((prev) => prev.filter((f) => f.id !== recipe.id)))}
                    className="text-xl leading-none ml-2 shrink-0 text-yellow-400"
                    title="Quitar de favoritos"
                  >
                    ★
                  </button>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-medium text-green-700 mb-1">Tenés</p>
                  <div className="flex flex-wrap gap-1">
                    {recipe.have.map((ing, j) => (
                      <span key={j} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{ing}</span>
                    ))}
                  </div>
                </div>

                {recipe.missing.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-amber-600 mb-1">Te falta</p>
                    <div className="flex flex-wrap gap-1">
                      {recipe.missing.map((ing, j) => (
                        <span key={j} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{ing}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Pasos</p>
                  <ol className="flex flex-col gap-1">
                    {recipe.steps.map((step, j) => (
                      <li key={j} className="text-xs text-gray-600">{j + 1}. {step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

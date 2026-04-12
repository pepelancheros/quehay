export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { recipeName, ingredients } = req.body

  if (!recipeName || !recipeName.trim()) {
    return res.status(400).json({ error: 'Falta el nombre de la receta' })
  }

  const ingredientList = (ingredients || [])
    .map((i) => i.name)
    .join(', ')

  const prompt = `Quiero hacer "${recipeName}".
${ingredientList ? `Tengo estos ingredientes en mi despensa: ${ingredientList}.` : 'No tengo ingredientes en mi despensa.'}

Respondé en español con esta estructura JSON exacta:
{
  "name": "nombre exacto o corregido de la receta",
  "have": ["ingredientes de la receta que ya tengo"],
  "missing": ["ingredientes de la receta que me faltan"],
  "steps": ["Paso 1", "Paso 2", "Paso 3", "Paso 4"]
}

Reglas:
- "have" solo incluye ingredientes que están en mi despensa
- "missing" incluye todos los demás ingredientes necesarios
- Máximo 5 pasos cortos y claros`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Error de OpenAI' })
    }

    const recipe = JSON.parse(data.choices[0].message.content)
    return res.status(200).json({ recipe })
  } catch (err) {
    return res.status(500).json({ error: 'Error buscando la receta' })
  }
}

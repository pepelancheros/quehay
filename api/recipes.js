export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { ingredients, mealType, excludeRecipes } = req.body

  if (!ingredients || ingredients.length === 0) {
    return res.status(400).json({ error: 'No hay ingredientes en la despensa' })
  }

  const ingredientList = ingredients
    .map((i) => `${i.name}${i.quantity ? ` (${i.quantity} ${i.unit || ''})`.trim() : ''}`)
    .join(', ')

  const mealFilter = mealType && mealType !== 'cualquiera'
    ? `Solo sugerí recetas de tipo "${mealType}".`
    : ''

  const excludeFilter = excludeRecipes && excludeRecipes.length > 0
    ? `No sugieras estas recetas que ya mostraste: ${excludeRecipes.join(', ')}.`
    : ''

  const prompt = `Tengo estos ingredientes en mi despensa: ${ingredientList}.

${mealFilter}
${excludeFilter}
Sugerime 3 recetas que pueda hacer. Para cada receta incluí:
- Nombre de la receta
- Ingredientes que ya tengo (de la lista)
- Ingredientes que me faltan (máximo 3, cosas básicas)
- Pasos resumidos (máximo 4 pasos cortos)

Respondé en español, en formato JSON con esta estructura exacta:
{
  "recipes": [
    {
      "name": "Nombre",
      "have": ["ingrediente1", "ingrediente2"],
      "missing": ["ingrediente3"],
      "steps": ["Paso 1", "Paso 2", "Paso 3"]
    }
  ]
}`

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
        temperature: 0.7,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Error de OpenAI' })
    }

    const recipes = JSON.parse(data.choices[0].message.content)
    return res.status(200).json(recipes)
  } catch (err) {
    return res.status(500).json({ error: 'Error generando recetas' })
  }
}

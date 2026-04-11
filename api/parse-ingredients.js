export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text } = req.body

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No hay texto para procesar' })
  }

  const prompt = `Extraé los ingredientes de este texto y devolvelos como JSON.

Texto: "${text}"

Devolvé solo un JSON con esta estructura exacta:
{
  "ingredients": [
    { "name": "nombre del ingrediente", "quantity": 1, "unit": "unidad o cadena vacía" }
  ]
}

Reglas:
- Si no se menciona cantidad, usá null
- Si no se menciona unidad, usá cadena vacía ""
- Normalizá las unidades: "kilo" → "kg", "gramo" → "g", "litro" → "L"
- El nombre siempre en minúscula singular (ej: "arepa", "manzana", "arroz")`

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

    const parsed = JSON.parse(data.choices[0].message.content)
    return res.status(200).json(parsed)
  } catch (err) {
    return res.status(500).json({ error: 'Error procesando el texto' })
  }
}

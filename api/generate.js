export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { situation, emailType, tone, lang, originalEmail } = req.body;
  if (!situation) return res.status(400).json({ error: 'Missing situation' });

  const isEN = lang === 'en';

  const toneGuides = {
    en: {
      'Formal': 'Formal, structured, respectful. No contractions. Polished and professional.',
      'Friendly': 'Warm and approachable. Conversational but still professional.',
      'Direct': 'Short and to the point. No pleasantries. Gets straight to the matter.',
      'Assertive': 'Confident and firm. Sets clear expectations. Does not apologize unnecessarily.',
      'Empathetic': 'Understanding and human. Acknowledges feelings. Builds rapport.',
    },
    es: {
      'Formal': 'Formal, estructurado, respetuoso. Sin contracciones. Pulido y profesional.',
      'Cercano': 'Cálido y cercano. Conversacional pero profesional.',
      'Directo': 'Corto y al grano. Sin rodeos. Va directamente al asunto.',
      'Asertivo': 'Seguro y firme. Establece expectativas claras. No se disculpa innecesariamente.',
      'Empático': 'Comprensivo y humano. Reconoce los sentimientos. Genera confianza.',
    }
  };

  const emailTypeGuides = {
    en: {
      'Professional': 'A clear, well-structured professional email for a work context.',
      'Sales & Outreach': 'A compelling outreach or sales email that grabs attention, builds interest and has a clear call to action. Not spammy.',
      'Difficult': 'A carefully worded email for a sensitive situation — complaint, rejection, difficult news or conflict. Tactful but honest.',
      'Reply': 'A well-crafted reply to the email provided. Address all points raised. Be complete.',
    },
    es: {
      'Profesional': 'Un email profesional claro y bien estructurado para un contexto laboral.',
      'Ventas y Outreach': 'Un email de contacto o ventas que capta la atención, genera interés y tiene una llamada a la acción clara. Sin spam.',
      'Difícil': 'Un email cuidadosamente redactado para una situación delicada — queja, rechazo, malas noticias o conflicto. Diplomático pero honesto.',
      'Respuesta': 'Una respuesta bien elaborada al email proporcionado. Aborda todos los puntos. Sé completo.',
    }
  };

  const tones = isEN ? toneGuides.en : toneGuides.es;
  const types = isEN ? emailTypeGuides.en : emailTypeGuides.es;
  const toneGuide = tones[tone] || tones[Object.keys(tones)[0]];
  const typeGuide = types[emailType] || types[Object.keys(types)[0]];

  const prompt = isEN
    ? `You are an expert business email writer. You write emails that are clear, effective, and get results.

TASK: Write exactly 2 versions of an email in ENGLISH.

EMAIL TYPE: ${emailType} — ${typeGuide}
TONE: ${tone} — ${toneGuide}

SITUATION DESCRIBED BY USER:
${situation}
${originalEmail ? `\nORIGINAL EMAIL TO REPLY TO:\n${originalEmail}` : ''}

REQUIREMENTS:
- Version A: Standard approach — well-structured, effective, reliable
- Version B: Alternative approach — different angle, different opening, different strategy
- Include a subject line for each version
- Write complete, ready-to-send emails — not templates with placeholders
- Natural, flowing prose — not bullet points inside the email body
- Each version separated by exactly: ---EMAIL---
- Format each version as:
SUBJECT: [subject line here]

[email body here]

Respond ONLY with the 2 email versions separated by ---EMAIL---. No extra text.`
    : `Eres un experto redactor de emails de negocios. Escribes emails claros, efectivos y que obtienen resultados.

TAREA: Escribe exactamente 2 versiones de un email en ESPAÑOL.

TIPO DE EMAIL: ${emailType} — ${typeGuide}
TONO: ${tone} — ${toneGuide}

SITUACIÓN DESCRITA POR EL USUARIO:
${situation}
${originalEmail ? `\nEMAIL ORIGINAL AL QUE RESPONDER:\n${originalEmail}` : ''}

REQUISITOS:
- Versión A: Enfoque estándar — bien estructurado, efectivo, fiable
- Versión B: Enfoque alternativo — ángulo diferente, apertura diferente, estrategia diferente
- Incluye un asunto para cada versión
- Escribe emails completos y listos para enviar — no plantillas con marcadores
- Prosa natural y fluida — sin bullet points dentro del cuerpo del email
- Cada versión separada por exactamente: ---EMAIL---
- Formato de cada versión:
ASUNTO: [asunto aquí]

[cuerpo del email aquí]

Responde ÚNICAMENTE con las 2 versiones separadas por ---EMAIL---. Sin texto extra.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: isEN
              ? 'You are an expert business email writer. Every email you write is clear, purposeful and ready to send. You never use filler phrases or corporate jargon.'
              : 'Eres un experto redactor de emails de negocios. Cada email que escribes es claro, con propósito y listo para enviar. Nunca usas frases de relleno ni jerga corporativa.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.8,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Groq API error');

    const text = data.choices?.[0]?.message?.content || '';
    const emails = text.split('---EMAIL---').map(e => e.trim()).filter(e => e.length > 20);

    if (emails.length === 0) throw new Error('No emails generated');

    res.status(200).json({ emails: emails.slice(0, 2) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const TOPIC_DESCRIPTIONS = {
  football:       'כדורגל עולמי וישראלי - 10 השנים האחרונות. כלול שאלות על הפועל באר שבע (ליגה, גביעים, שחקנים, מאמנים, הישגים אירופיים). גם שחקני עולם, גביע עולם, ליגות אירופיות.',
  music:          'מוזיקה פופ עכשווית - Olivia Rodrigo, Taylor Swift, Sabrina Carpenter, Billie Eilish, Dua Lipa, Ariana Grande, The Weeknd, Harry Styles, BTS וכדומה. שאלות על שירים, אלבומים, פרסים, עובדות.',
  tv:             'סדרות טלוויזיה פופולריות: Stranger Things, Gilmore Girls, Modern Family, Wednesday, Euphoria, Game of Thrones, Breaking Bad, Friends ועוד. שאלות על דמויות, עונות, שחקנים, עלילה.',
  musicals:       'מחזות זמר מחו"ל - ברודווי ווסט אנד: Hamilton, Les Misérables, Phantom of the Opera, Wicked, Mamma Mia, Chicago, The Lion King, Grease ועוד.',
  world_history:  'היסטוריה עולמית - אירועים גדולים ומשמעותיים: מלחמות עולם, מהפכות, גילויים, מנהיגים. רמה בינונית - לא תאריכים של אירועים איזוטריים.',
  israel_history: 'היסטוריה של מדינת ישראל - הקמת המדינה, מלחמות, ראשי ממשלה, אירועים מכוננים, הסכמי שלום. רמה בינונית.',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topics, count = 15 } = req.body;
  if (!topics || topics.length === 0) return res.status(400).json({ error: 'נדרש נושא אחד לפחות' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'מפתח API חסר בהגדרות השרת' });

  const topicDescriptions = topics.map(t => TOPIC_DESCRIPTIONS[t]).filter(Boolean).join('\n');

  const prompt = `אתה יוצר שאלות למשחק טריוויה לבני נוער חכמים עם ידע כללי נרחב.

צור בדיוק ${count} שאלות טריוויה בעברית על הנושאים הבאים:
${topicDescriptions}

תמהיל: כ-60% רב-ברירה (4 אפשרויות), כ-25% נכון/לא נכון, כ-15% פתוחות.
חלק את השאלות בצורה אחידה בין הנושאים שנבחרו.
שאלות מאתגרות אבל לא בלתי אפשריות. תשובות מדויקות ועובדתיות בלבד.

החזר JSON בלבד, ללא טקסט נוסף:
[
  {"type":"multiple_choice","question":"שאלה","options":["א","ב","ג","ד"],"answer":"א","topic":"football"},
  {"type":"true_false","question":"שאלה","options":["נכון","לא נכון"],"answer":"נכון","topic":"music"},
  {"type":"open","question":"שאלה","answer":"תשובה מלאה","topic":"tv"}
]

חשוב: ב-answer של multiple_choice - הכתיב חייב להיות זהה בדיוק לאחת האפשרויות ב-options.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error ${geminiRes.status}: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('תשובה ריקה מ-Gemini');

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('לא נמצא JSON בתשובה');

    const questions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(questions) || questions.length === 0) throw new Error('מבנה שאלות לא תקין');

    const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, count);
    res.status(200).json(shuffled);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

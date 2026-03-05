const { GoogleGenerativeAI } = require('@google/generative-ai');

const TOPIC_DESCRIPTIONS = {
  football: `כדורגל - עולמי וישראלי, 10 השנים האחרונות. כלול שאלות על הפועל באר שבע (ליגה, גביעים, שחקנים בולטים, מאמנים, הישגים אירופיים). גם שחקני עולם, גביע עולם, ליגות אירופיות.`,
  music: `מוזיקה פופ עכשווית - בעיקר אמניות כמו Olivia Rodrigo, Taylor Swift, Sabrina Carpenter, Billie Eilish, Dua Lipa, Ariana Grande, וכדומה. גם אמנים גברים ולהקות באותו סגנון (The Weeknd, Harry Styles, BTS, וכו'). שאלות על שירים, אלבומים, פרסים, עובדות.`,
  tv: `סדרות טלוויזיה - עכשוויות ופופולריות. כלול: Stranger Things, Gilmore Girls, Modern Family, Wednesday, Euphoria, The Crown, Game of Thrones, Breaking Bad, Friends, ועוד. שאלות על דמויות, עונות, שחקנים, עלילה.`,
  musicals: `מחזות זמר מחו"ל - ברודווי ווסט אנד. Hamilton, Les Misérables, Phantom of the Opera, Wicked, Mamma Mia, Chicago, The Lion King, Grease, ועוד. שאלות על שירים, עלילה, שחקנים, עובדות.`,
  world_history: `היסטוריה עולמית - אירועים גדולים ומשמעותיים בלבד. מלחמות עולם, מהפכות, גילויים, מנהיגים גדולים, אירועים ששינו את העולם. רמה בינונית - לא תאריכים ספציפיים של אירועים איזוטריים.`,
  israel_history: `היסטוריה של מדינת ישראל - הקמת המדינה, מלחמות, ראשי ממשלה, אירועים מכוננים, הסכמי שלום. רמה בינונית - אירועים גדולים וידועים, לא פרטים טכניים קטנים.`,
};

const TYPE_MIX = `
צור תמהיל של סוגי שאלות:
- כ-60% שאלות רב-ברירה (4 אפשרויות)
- כ-25% שאלות נכון/לא נכון
- כ-15% שאלות פתוחות
`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topics, count = 15 } = req.body;

  if (!topics || topics.length === 0) {
    return res.status(400).json({ error: 'נדרש לפחות נושא אחד' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'מפתח API חסר' });
  }

  const topicDescriptions = topics
    .map(t => TOPIC_DESCRIPTIONS[t])
    .filter(Boolean)
    .join('\n\n');

  const topicKeys = topics.join(', ');

  const prompt = `אתה יוצר שאלות למשחק טריוויה משפחתי לבני נוער חכמים עם ידע כללי נרחב.

צור בדיוק ${count} שאלות טריוויה בעברית על הנושאים הבאים:
${topicDescriptions}

${TYPE_MIX}

חוקים:
- כל השאלות חייבות להיות בעברית
- שאלות מאתגרות אבל לא בלתי אפשריות לבני נוער חכמים
- תשובות מדויקות ועובדתיות בלבד
- שאלות מגוונות - לא לחזור על אותו נושא/עובדה
- חלק את השאלות בצורה אחידה בין הנושאים שנבחרו: ${topicKeys}

החזר JSON בלבד, ללא טקסט נוסף, במבנה הבא:
[
  {
    "type": "multiple_choice",
    "question": "שאלה כאן",
    "options": ["אפשרות א", "אפשרות ב", "אפשרות ג", "אפשרות ד"],
    "answer": "אפשרות א",
    "topic": "football"
  },
  {
    "type": "true_false",
    "question": "שאלה כאן",
    "options": ["נכון", "לא נכון"],
    "answer": "נכון",
    "topic": "music"
  },
  {
    "type": "open",
    "question": "שאלה כאן",
    "answer": "תשובה מלאה וברורה",
    "topic": "tv"
  }
]

חשוב: ב-answer של multiple_choice - הכתיב חייב להיות זהה בדיוק לאחת האפשרויות ב-options.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('לא נמצא JSON בתשובה');

    const questions = JSON.parse(jsonMatch[0]);

    // Validate basic structure
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('מבנה שאלות לא תקין');
    }

    // Shuffle questions
    const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, count);

    res.status(200).json(shuffled);
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: 'שגיאה בייצור שאלות: ' + err.message });
  }
};

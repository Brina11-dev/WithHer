const Groq = require('groq-sdk');
const db = require('../config/db');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Show symptom checker page
const showSymptoms = (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.render('symptoms');
};

// Handle symptom check
const checkSymptoms = async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

  const { symptoms } = req.body;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are WithHer, a compassionate reproductive health assistant for women in Kenya. 
          Analyse the symptoms described and provide:
          1. A clear, caring explanation of what the symptoms might indicate
          2. A risk level: low, medium, or high
          3. Clear advice on what to do next
          
          Always respond in this exact JSON format:
          {
            "risk_level": "low" or "medium" or "high",
            "response": "Your caring response here"
          }
          
          Rules:
          - High risk: symptoms suggesting ectopic pregnancy, heavy bleeding, severe pain, fever with pelvic pain
          - Medium risk: abnormal bleeding, unusual discharge, mild pelvic pain
          - Low risk: normal period pain, mild discomfort, general questions
          - Always recommend seeing a doctor for anything concerning
          - Be warm, non-judgmental and culturally sensitive
          - Never diagnose — only guide`
        },
        {
          role: 'user',
          content: symptoms
        }
      ]
    });

    const content = response.choices[0].message.content;
    console.log('🔍 Raw Groq response:', content);
    
    const parsed = JSON.parse(content);
    console.log('✅ Parsed response:', parsed);

    // Save to database
    db.query(
      'INSERT INTO symptom_checks (user_id, symptoms, ai_response, risk_level) VALUES (?, ?, ?, ?)',
      [req.session.userId, symptoms, parsed.response, parsed.risk_level],
      (err) => {
        if (err) console.log('Error saving symptom check:', err);
      }
    );

    res.json(parsed);

  } catch (err) {
    console.error('❌ Groq API Error:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ error: `AI service error: ${err.message}` });
  }
};

module.exports = { showSymptoms, checkSymptoms };
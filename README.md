# WithHer 

**A reproductive health platform walking alongside every woman in Kenya before crisis strikes.**

> Submitted to the Moonshot Awards 2026 (Idea Category · AI for Good · Health)

---

## The Problem

In Kenya, women are dying from reproductive health conditions that could have been caught early not because treatment is unavailable, but because awareness and courage are. Stigma silences them. Fear paralyzes them. Ignorance blinds them. By the time most women seek help, the damage is often already done.

**WithHer exists to change that.**

## What WithHer Does

WithHer is a web platform (with a mobile app planned as the next phase) that gives Kenyan women a private, judgment-free space to understand their reproductive health and take action early.

- **AI Symptom Assessment** Powered by Groq's Llama 3.3 (70B) model. A user describes what she's feeling in her own words, and the AI helps identify potential reproductive health risks and recommends whether she needs urgent care, a routine clinic visit, or home monitoring.
- **Education Hub** Stigma-free, searchable information on ectopic pregnancy, abnormal bleeding, PID, STIs, and more, in     **English and Swahili**, enriched with live Wikipedia API search integration.
- **Community Forum** An anonymous space for peer support, built with **Socket.io** for real-time messaging, notifications, comments, and media sharing.
- **Privacy-first design** Built so women can ask questions and seek information without fear of exposure or judgment.

**Planned next:** finishing the SOS receiver-side flow, and a native mobile app for Android/iOS.

## Why It Matters

I've watched two friends face reproductive health crises in silence one rushed into emergency surgery for an ectopic pregnancy, another who has gone weeks without seeking care for abnormal bleeding, held back by fear and cost. WithHer is built from that experience: technology that meets women *before* the emergency not after.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express.js |
| Database | MySQL |
| Templating | EJS, Bootstrap 5 |
| Real-time | Socket.io |
| AI | Groq API (llama-3.3-70b-versatile) |
| External data | Wikipedia API |

## Project Status

**Already Deployed to Render.**
Core MVP features (Education Hub, Community Forum, AI symptom checker, GPS Clinic Locator) are built and functional in local development. Public deployment and pilot testing with women at MMUST and in Nairobi are the next milestones.

## Project Structure

```
WithHer/
├── config/         # App and database configuration
├── controllers/     # Route logic / business logic
├── public/          # Static assets (CSS, client-side JS, images)
├── routes/          # Express route definitions
├── views/           # EJS templates
└── app.js           # Application entry point
```

## Getting Started (Local Development)

```bash
# Clone the repo
git clone https://github.com/Brina11-dev/WithHer.git
cd WithHer

# Install dependencies
npm install

# Set up environment variables
# (create a .env file with your MySQL credentials and GROQ_API_KEY)

# Run the app
npm start
```

## Roadmap

- [x] Core MVP — Education Hub, Community Forum, AI symptom checker, GPS Clinic Locator
- [X] Public deployment
- [X] Pilot testing with women at MMUST and in Nairobi
- [ ] Offline SMS-based SOS alerts
- [ ] Native mobile app (Android/iOS)
- [ ] Partnerships with subsidized clinics and health funds

## About the Builder

Built by **Brina Ojowi**, a Computer Science student at Masinde Muliro University of Science and Technology (MMUST), Kenya.

- GitHub: [@Brina11-dev](https://github.com/Brina11-dev)
- LinkedIn: [brina-ojowi](https://www.linkedin.com/in/brina-ojowi-190850336)
- Email: [ojowibrina@gmail.com](mailto:ojowibrina@gmail.com)

---

*WithHer is entered in the Moonshot Awards 2026 under SDG 3 (Good Health and Well-being).*

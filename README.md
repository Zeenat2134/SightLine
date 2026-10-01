# SightLine: Real-Time Multimodal Accessibility Agent

Built for the **AI Build Challenge 2026 (Track 5: Voice / Multimodal)**.

SightLine acts as a conversational "visual assistant" for the visually impaired. It utilizes the `gemini-3.8-live` model over a bidirectional WebSocket connection to stream live video frames and raw 16kHz PCM audio, providing zero-latency spatial awareness and object recognition.

## 🚀 Live Deployment
- **Frontend URL:** [Insert Your Vercel/Render Link Here]
- **Demo Video:** [Insert YouTube/Drive Link Here]

## 🛠️ Tech Stack
- **Frontend:** Next.js, React, Tailwind CSS, Web Audio API
- **Backend:** Node.js, Express, `ws` (WebSockets)
- **AI Model:** Google Gemini Multimodal Live API (`gemini-3.8-live`)

## ⚙️ Local Setup Instructions (Docker)
1. Clone the repository: `git clone https://github.com/Zeenat2134/sightline-hackathon.git`
2. Navigate to the backend directory and add your API key:
   `cd sightline-backend`
   Create a `.env` file and add: `GEMINI_API_KEY=your_key_here`
3. Return to the root directory and start the containers:
   `docker-compose up --build`
4. Open `http://localhost:3000` in your browser.
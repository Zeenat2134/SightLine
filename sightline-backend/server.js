const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

console.log("API Key loaded:", process.env.GEMINI_API_KEY ? "Yes" : "No, check .env file");

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 5000;

wss.on('connection', (clientWs) => {
    console.log('--- New Frontend Client Connected ---');

    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
    const geminiWs = new WebSocket(geminiUrl);

    geminiWs.on('open', () => {
        console.log('=> Connected to Gemini Live API. Sending Setup Message...');
        
        // The strictly supported model for real-time bidirectional streaming
        const setupMessage = {
            setup: {
                model: 'models/gemini-3.8-live', 
                generationConfig: {
                    responseModalities: ["AUDIO"]
                },
                systemInstruction: {
                    parts: [{
                        text: 'You are SightLine, a real-time assistive agent for a visually impaired user. You will receive video frames and audio commands. Analyze the visual surroundings. Provide concise, spatial awareness instructions and read any text or documents presented clearly. Speak naturally.'
                    }]
                }
            }
        };
        
        geminiWs.send(JSON.stringify(setupMessage));
    });

    clientWs.on('message', (message) => {
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(message.toString());
        }
    });

    geminiWs.on('message', (data) => {
        const msgStr = data.toString();
        
        if (msgStr.includes('setupComplete')) {
            console.log('=> Gemini Setup Complete! Ready for audio/video stream.');
        } else if (msgStr.includes('error')) {
            console.error('=> GEMINI API ERROR PAYLOAD:', msgStr);
        }

        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(msgStr);
        }
    });

    clientWs.on('close', (code, reason) => {
        console.log(`--- Frontend client disconnected. Code: ${code} ---`);
        if (geminiWs.readyState === WebSocket.OPEN) geminiWs.close();
    });

    geminiWs.on('close', (code, reason) => {
        console.log(`=> Gemini Live API disconnected. Code: ${code}, Reason: ${reason.toString() || 'None given'}`);
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
    });
    
    geminiWs.on('error', (error) => {
        console.error('=> Gemini WebSocket Error event:', error.message);
    });
});

server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
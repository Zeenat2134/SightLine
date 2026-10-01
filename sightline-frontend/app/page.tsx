"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Audio playback and recording refs
  const audioOutContextRef = useRef<AudioContext | null>(null);
  const audioInContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:5000");
    
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.serverContent?.modelTurn?.parts) {
          data.serverContent.modelTurn.parts.forEach((part: any) => {
            if (part.inlineData?.mimeType.startsWith("audio/pcm")) {
              playPcmAudio(part.inlineData.data);
            }
          });
        }
      } catch (err) {
        console.error("Failed to parse incoming audio chunk:", err);
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const playPcmAudio = (base64Data: string) => {
    if (!audioOutContextRef.current) return;
    
    const ctx = audioOutContextRef.current;
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    // Schedule audio chunks sequentially to eliminate overlapping
    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
  };

  const startSession = async () => {
    try {
      if (!audioOutContextRef.current) {
        audioOutContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioOutContextRef.current.state === "suspended") {
        await audioOutContextRef.current.resume();
      }
      
      if (!audioInContextRef.current) {
        audioInContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (audioInContextRef.current.state === "suspended") {
        await audioInContextRef.current.resume();
      }

      nextStartTimeRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: true 
      });
      
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      mediaSourceRef.current = audioInContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioInContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        const uint8 = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        
        wsRef.current.send(JSON.stringify({
          realtimeInput: {
            audio: {
              mimeType: "audio/pcm;rate=16000",
              data: btoa(binary),
            },
          },
        }));
      };

      const silentNode = audioInContextRef.current.createGain();
      silentNode.gain.value = 0;
      mediaSourceRef.current.connect(processorRef.current);
      processorRef.current.connect(silentNode);
      silentNode.connect(audioInContextRef.current.destination);

      setIsStreaming(true);
      streamIntervalRef.current = setInterval(sendVideoFrame, 1000);
      
    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  };

  const stopSession = () => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    if (processorRef.current && mediaSourceRef.current) {
      processorRef.current.disconnect();
      mediaSourceRef.current.disconnect();
    }
    
    setIsStreaming(false);
  };

  const sendVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64Image = canvas.toDataURL("image/jpeg").split(",")[1];
    
    wsRef.current.send(JSON.stringify({
      realtimeInput: {
        video: {
          mimeType: "image/jpeg",
          data: base64Image,
        },
      },
    }));
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-2">SightLine</h1>
      <p className="text-gray-400 mb-8">Real-Time Multimodal Accessibility Agent</p>

      <div className="relative bg-black rounded-lg overflow-hidden border-2 border-gray-700 shadow-2xl mb-8 w-full max-w-md aspect-[3/4]">
        <video ref={videoRef} autoPlay playsInline muted className="object-cover w-full h-full" />
        <canvas ref={canvasRef} className="hidden" />
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-gray-400">Camera Offline</span>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <button 
          onClick={startSession}
          disabled={!isConnected || isStreaming}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-semibold rounded-full transition-all"
        >
          {isStreaming ? "Listening..." : "Start SightLine"}
        </button>
        {isStreaming && (
          <button 
            onClick={stopSession}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 font-semibold rounded-full transition-all"
          >
            End Session
          </button>
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        Backend Status: {isConnected ? <span className="text-green-500">Connected</span> : <span className="text-red-500">Disconnected</span>}
      </div>
    </main>
  );
}
"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type RecState = "idle" | "recording" | "processing";

export function useSpeechRecognition(onResult: (text: string) => void, onError?: (error: string) => void) {
  const [recState, setRecState] = useState<RecState>("idle");
  const [isSupported, setIsSupported] = useState(false);
  const didInitRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Runs only on client after hydration — safe to check window
    if (!didInitRef.current) {
      didInitRef.current = true;
      setIsSupported(!!navigator.mediaDevices?.getUserMedia);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.("当前浏览器不支持录音");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 100) {
          setRecState("idle");
          return;
        }

        setRecState("processing");
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const res = await fetch("/api/speech", { method: "POST", body: formData });
          const data = await res.json();

          if (!res.ok) {
            onError?.(data.error || "语音识别失败");
          } else if (data.text) {
            onResult(data.text);
          }
        } catch {
          onError?.("语音识别请求失败");
        } finally {
          setRecState("idle");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecState("recording");
    } catch {
      onError?.("无法访问麦克风");
    }
  }, [onResult, onError]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    recState,
    isSupported,
    startListening,
    stopListening,
    isListening: recState === "recording",
  };
}

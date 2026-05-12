"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function useSpeechRecognition(onResult: (text: string) => void, onError?: (error: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setIsSupported("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) return;
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript) {
        onResult(finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      if (event.error === "network") {
        onError?.("语音服务不可用，请检查网络连接");
      } else if (event.error === "not-allowed") {
        onError?.("请允许麦克风权限后重试");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        onError?.(`语音识别失败: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [isSupported, onResult, onError]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, isSupported, startListening, stopListening };
}

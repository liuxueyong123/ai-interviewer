"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type TTSState = "idle" | "loading" | "playing" | "error";

export function useTTS() {
  const [state, setState] = useState<TTSState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState("idle");
  }, []);

  const speak = useCallback(async (text: string): Promise<void> => {
    stop();

    const abort = new AbortController();
    abortRef.current = abort;
    setState("loading");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "TTS 请求失败");
      }

      const data = await res.json();
      if (!data.audio) throw new Error("TTS 响应缺少音频");

      return new Promise<void>((resolve, reject) => {
        const audio = new Audio(data.audio);
        audioRef.current = audio;

        audio.onplay = () => setState("playing");
        audio.onended = () => {
          setState("idle");
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          setState("error");
          audioRef.current = null;
          reject(new Error("音频播放失败"));
        };

        audio.play().catch((e) => {
          setState("error");
          audioRef.current = null;
          reject(e);
        });
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState("error");
      throw err;
    } finally {
      abortRef.current = null;
    }
  }, [stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { speak, stop, state };
}

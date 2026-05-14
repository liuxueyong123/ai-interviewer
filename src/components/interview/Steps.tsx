"use client";

import { useRef, useCallback } from "react";

export type StepState = "completed" | "evaluating" | "locked";

export interface StepInfo {
  round: number;
  state: StepState;
  score?: number;
  isCurrentPassed: boolean;
}

interface StepsProps {
  steps: StepInfo[];
  selectedRound: number;
  onSelectRound: (round: number) => void;
  onNextRound?: () => void;
  statusMessage?: string;
}

const ROUND_LABELS: Record<number, string> = {
  1: "第一轮",
  2: "第二轮",
  3: "第三轮",
};

function StepCircle({ step, isSelected, onClick }: { step: StepInfo; isSelected: boolean; onClick?: () => void }) {
  if (step.state === "completed") {
    return (
      <button
        onClick={onClick}
        className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 ${
          isSelected ? "ring-[3px] ring-accent/40 ring-offset-2 ring-offset-surface-0" : ""
        }`}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </button>
    );
  }

  if (step.state === "evaluating") {
    return (
      <div className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${isSelected ? "ring-[3px] ring-amber-400/30 ring-offset-2 ring-offset-surface-0" : ""}`}>
        <div className="absolute inset-0 rounded-full border-2 border-surface-3" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-accent animate-pulse" />
      </div>
    );
  }

  // available next round — rendered as plain div, column wrapper handles click
  if (step.isCurrentPassed) {
    return (
      <div
        className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-dashed border-accent/50 flex items-center justify-center transition-all duration-200 group-hover:border-accent group-hover:scale-105 ${
          isSelected ? "ring-[3px] ring-accent/40 ring-offset-2 ring-offset-surface-0" : ""
        }`}
      >
        <span className="font-display text-sm sm:text-base text-accent">{step.round}</span>
      </div>
    );
  }

  // locked
  return (
    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-2 border-2 border-border flex items-center justify-center opacity-60 cursor-not-allowed">
      <span className="font-display text-sm sm:text-base text-text-muted">{step.round}</span>
    </div>
  );
}

function ConnectingLine({ fromState, toState, right = false }: { fromState: StepState; toState: StepState; right?: boolean }) {
  const color = fromState === "completed" && toState === "completed" ? "bg-accent" : fromState === "completed" && right ? "bg-gradient-to-r from-accent to-surface-3" : "bg-surface-3";

  return <div className={`h-0.5 w-8 sm:w-12 lg:w-16 shrink-0 ${color}`} />;
}

function StepLabel({ step }: { step: StepInfo }) {
  if (step.state === "completed") {
    return (
      <div className="mt-2 text-center">
        <p className="text-xs sm:text-sm text-text-secondary">{ROUND_LABELS[step.round] || `第${step.round}轮`}</p>
        {step.score != null && <p className="font-display font-bold text-sm sm:text-base text-accent">{step.score}</p>}
      </div>
    );
  }

  if (step.state === "evaluating") {
    return (
      <div className="mt-2 text-center">
        <p className="text-xs sm:text-sm text-text-secondary">{ROUND_LABELS[step.round] || `第${step.round}轮`}</p>
        <p className="text-xs text-amber-400 font-medium">评估中</p>
      </div>
    );
  }

  // locked (or available next round)
  if (step.isCurrentPassed) {
    return (
      <div className="mt-2 text-center">
        <p className="text-xs sm:text-sm text-text-secondary">{ROUND_LABELS[step.round] || `第${step.round}轮`}</p>
        <p className="text-xs text-accent">点击进入</p>
      </div>
    );
  }

  return (
    <div className="mt-2 text-center">
      <p className="text-xs sm:text-sm text-text-muted">{ROUND_LABELS[step.round] || `第${step.round}轮`}</p>
      <p className="text-xs text-text-muted">未解锁</p>
    </div>
  );
}

export default function Steps({ steps, selectedRound, onSelectRound, onNextRound, statusMessage }: StepsProps) {
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleSelect = useCallback(
    (step: StepInfo) => {
      if (step.isCurrentPassed && onNextRound) {
        onNextRound();
        return;
      }
      if (step.state === "locked" || step.state === "evaluating") return;
      onSelectRound(step.round);
      stepRefs.current[step.round]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    },
    [onSelectRound, onNextRound],
  );

  return (
    <div className="w-full">
      {statusMessage && (
        <div className="text-center mb-4">
          <p className="text-sm text-text-secondary">{statusMessage}</p>
        </div>
      )}

      <div className="overflow-x-auto scrollbar-none snap-x snap-mandatory">
        <div className="flex items-start justify-center min-w-min px-2 py-2">
          {steps.map((step, i) => {
            const circleRow = (
              <div className="flex items-center">
                {i > 0 ? <ConnectingLine fromState={steps[i - 1].state} toState={step.state} /> : <div className="w-8 sm:w-12 lg:w-16 h-0.5 shrink-0 invisible" />}
                <StepCircle step={step} isSelected={step.round === selectedRound} onClick={() => handleSelect(step)} />
                {i < steps.length - 1 ? <ConnectingLine fromState={step.state} toState={steps[i + 1].state} right /> : <div className="w-8 sm:w-12 lg:w-16 h-0.5 shrink-0 invisible" />}
              </div>
            );

            const label = <StepLabel step={step} />;

            if (step.isCurrentPassed && onNextRound) {
              return (
                <button key={step.round} onClick={onNextRound} className="group flex flex-col items-center snap-center w-28 sm:w-36 cursor-pointer">
                  {circleRow}
                  {label}
                </button>
              );
            }

            return (
              <div
                key={step.round}
                ref={(el) => {
                  stepRefs.current[step.round] = el;
                }}
                className="flex flex-col items-center snap-center w-28 sm:w-36"
              >
                {circleRow}
                {label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

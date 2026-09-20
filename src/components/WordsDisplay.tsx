"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface WordsDisplayProps {
  words: string[];
  typedWords: string[];
  currentInput: string;
  currentIndex: number;
}

function Caret() {
  return <span className="caret" aria-hidden="true" />;
}

function renderCurrentWordChars(target: string, typed: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const maxLen = Math.max(target.length, typed.length);

  for (let i = 0; i < maxLen; i++) {
    if (i === typed.length) nodes.push(<Caret key="caret" />);

    if (i < target.length) {
      const isTyped = i < typed.length;
      const correct = isTyped && typed[i] === target[i];
      nodes.push(
        <span
          key={i}
          className={
            !isTyped ? "text-sub" : correct ? "text-text" : "text-error"
          }
        >
          {target[i]}
        </span>
      );
    } else {
      nodes.push(
        <span key={i} className="text-error/70 underline decoration-2">
          {typed[i]}
        </span>
      );
    }
  }

  if (typed.length === maxLen) nodes.push(<Caret key="caret-end" />);

  return nodes;
}

function renderCompletedWordChars(target: string, typed: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const maxLen = Math.max(target.length, typed.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < target.length && i < typed.length) {
      const correct = typed[i] === target[i];
      nodes.push(
        <span key={i} className={correct ? "text-text" : "text-error"}>
          {target[i]}
        </span>
      );
    } else if (i >= typed.length) {
      nodes.push(
        <span key={i} className="text-error/50 underline decoration-2">
          {target[i]}
        </span>
      );
    } else {
      nodes.push(
        <span key={i} className="text-error/70 underline decoration-2">
          {typed[i]}
        </span>
      );
    }
  }

  return nodes;
}

// The box is exactly this many lines tall, so a line is never cut in half at the bottom.
const LINE_HEIGHT = 46;
const VISIBLE_LINES = 4;

export function WordsDisplay({ words, typedWords, currentInput, currentIndex }: WordsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentWordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    currentWordRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentIndex]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden px-1 font-mono text-[28px] tracking-wide"
      style={{ height: LINE_HEIGHT * VISIBLE_LINES, lineHeight: `${LINE_HEIGHT}px` }}
    >
      <div className="flex flex-wrap content-start gap-x-3">
        {words.map((word, wi) => {
          if (wi < currentIndex) {
            return (
              <span key={wi} className="inline-block whitespace-nowrap">
                {renderCompletedWordChars(word, typedWords[wi] ?? "")}
              </span>
            );
          }
          if (wi === currentIndex) {
            return (
              <span key={wi} ref={currentWordRef} className="inline-block whitespace-nowrap">
                {renderCurrentWordChars(word, currentInput)}
              </span>
            );
          }
          return (
            <span key={wi} className="inline-block whitespace-nowrap text-sub">
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
}

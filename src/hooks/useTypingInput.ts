"use client";

import { useCallback, useRef, useState } from "react";

interface UseTypingInputOptions {
  /** Receives the raw text of the current word, including a trailing space when a word is committed. */
  onInput: (value: string) => void;
  /** Called on Backspace in an empty input; returns the previous word to restore, or null. */
  goBack: () => string | null;
  /** Handle extra keys (Tab, Escape...). Return true if the key was handled. */
  onKey?: (event: React.KeyboardEvent<HTMLInputElement>) => boolean;
  /** While true, typing is ignored (e.g. a race that has not started). */
  disabled?: boolean;
}

/**
 * The hidden text field that captures typing for a test or race: clears itself
 * after each word and lets Backspace step back into the previous word.
 */
export function useTypingInput({ onInput, goBack, onKey, disabled = false }: UseTypingInputOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const clearInput = useCallback(() => {
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (disabled) {
      event.target.value = "";
      return;
    }
    onInput(value);
    if (value.endsWith(" ")) event.target.value = "";
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (onKey?.(event)) return;
    if (disabled) return;

    if (event.key === "Backspace" && event.currentTarget.value === "") {
      const previousWord = goBack();
      if (previousWord !== null) {
        event.preventDefault();
        event.currentTarget.value = previousWord;
      }
    }
  }

  return {
    inputRef,
    focused,
    focusInput,
    clearInput,
    inputProps: {
      type: "text",
      autoComplete: "off",
      autoCorrect: "off",
      autoCapitalize: "off",
      spellCheck: false,
      onChange,
      onKeyDown,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    } as const,
  };
}

"use client";

import { useEffect, useState } from "react";

// Shows one word at a time, sliding to the next every few seconds
export function RotatingWords({ words, interval = 2400 }: { words: string[]; interval?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => clearInterval(timer);
  }, [words.length, interval]);

  return (
    <span className="relative inline-grid overflow-hidden align-bottom">
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden={i !== index}
          className={`col-start-1 row-start-1 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text pb-1 text-transparent transition-all duration-500 ease-out ${
            i === index ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
          }`}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

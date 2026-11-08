"use client";

import { useState } from "react";
import { X } from "lucide-react";

type TagInputProps = {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
};

// Type a word and press Enter (or comma) to turn it into a "chip", e.g. Python, SQL
export function TagInput({ id, value, onChange, placeholder }: TagInputProps) {
  const [text, setText] = useState("");

  function addTag() {
    const tag = text.trim().replace(/,$/, "");
    if (tag && !value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      onChange([...value, tag]);
    }
    setText("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault(); // don't submit the form
      addTag();
    }
    // Backspace on an empty box removes the last chip
    if (event.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border bg-background px-2.5 py-1.5 transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pr-1.5 pl-3 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
            className="rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={value.length ? "Add more..." : placeholder}
        className="h-7 min-w-28 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

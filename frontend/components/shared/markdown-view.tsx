// Shows the AI's job description nicely.
// The AI writes simple markdown: "# title", "## heading", "- bullet", "**bold**", "_italic_".
// This small reader turns those lines into styled HTML (no extra library needed).

function inline(text: string) {
  // Split out **bold** and _italic_ parts
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if ((part.startsWith("_") && part.endsWith("_")) || (part.startsWith("*") && part.endsWith("*"))) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function MarkdownView({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  // Bullets that sit next to each other become one list
  function flushBullets() {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  }

  text.split("\n").forEach((raw) => {
    const line = raw.trim();
    if (/^[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•]\s+/, ""));
      return;
    }
    flushBullets();
    if (!line) return;
    const key = `b-${blocks.length}`;
    if (line.startsWith("# ")) {
      blocks.push(<h2 key={key} className="font-display text-2xl font-extrabold tracking-tight">{inline(line.slice(2))}</h2>);
    } else if (line.startsWith("## ")) {
      blocks.push(<h3 key={key} className="mt-5 font-display text-lg font-bold">{inline(line.slice(3))}</h3>);
    } else if (line.startsWith("### ")) {
      blocks.push(<h4 key={key} className="mt-4 font-semibold">{inline(line.slice(4))}</h4>);
    } else {
      blocks.push(<p key={key} className="my-2">{inline(line)}</p>);
    }
  });
  flushBullets();

  return <div className="text-sm leading-relaxed text-foreground/90">{blocks}</div>;
}

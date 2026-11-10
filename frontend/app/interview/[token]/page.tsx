import { Suspense } from "react";

import { InterviewRoom } from "./interview-room";

// Public page (no login): the candidate's voice screening interview (Agent 2)
export default function InterviewPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <Suspense fallback={<div className="h-80 w-full max-w-lg animate-pulse rounded-3xl bg-muted" />}>
        <InterviewRoom />
      </Suspense>
    </main>
  );
}

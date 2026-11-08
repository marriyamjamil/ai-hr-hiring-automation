import { Suspense } from "react";

import { CandidateDetails } from "./candidate-details";

// Wrapper: Next 16 needs Suspense because the candidate id is only known when the page opens
export default function CandidatePage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-5xl animate-pulse rounded-2xl bg-muted" />}>
      <CandidateDetails />
    </Suspense>
  );
}

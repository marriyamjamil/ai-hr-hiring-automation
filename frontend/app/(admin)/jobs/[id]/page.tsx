import { Suspense } from "react";

import { JobDetails } from "./job-details";

// Wrapper: Next 16 needs a Suspense "waiting room" because the job id
// (e.g. the 5 in /jobs/5) is only known when someone opens the page.
export default function JobPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-5xl animate-pulse rounded-2xl bg-muted" />}>
      <JobDetails />
    </Suspense>
  );
}

import { Suspense } from "react";

import { BookingRoom } from "./booking-room";

// Public page (no login): the candidate confirms their interview time or picks another one (Agent 3)
export default function BookingPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <Suspense fallback={<div className="h-80 w-full max-w-lg animate-pulse rounded-3xl bg-muted" />}>
        <BookingRoom />
      </Suspense>
    </main>
  );
}

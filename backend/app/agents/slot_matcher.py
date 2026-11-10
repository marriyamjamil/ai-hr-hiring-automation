"""
Agent 3, step 4: find interview slots.

Pure Python, no AI: comparing times is maths, and Python gets maths right every time.

How it works:
1. Build every free slot of every interviewer for this job (next 3 weeks):
   their weekly free time, minus their days off, minus interviews they already have (+ a break).
2. Try the candidate's options in their order: the first option with a free slot wins.
3. Also pick 3 backup slots (the nearest free times, on different days),
   used when nothing matches or the candidate wants another time.
"""

from datetime import date, datetime, time, timedelta

from app.agents.scheduling_agent import PAKISTAN_TIME

INTERVIEW_MINUTES = 45  # how long one interview is
BUFFER_MINUTES = 15  # a break before and after every interview
STEP_MINUTES = 30  # slots start on the hour or half hour (14:00, 14:30, ...)
LOOK_AHEAD_DAYS = 21  # search up to 3 weeks ahead
MIN_NOTICE_HOURS = 12  # never book an interview less than 12 hours away
BACKUP_COUNT = 3
# These interviews block the interviewer's time (and a candidate can only have one of them)
BUSY_STATUSES = ("proposed", "awaiting_candidate", "scheduled")


def at(day: date, hhmm: str) -> datetime:
    """date + "14:30" → a Pakistan-time datetime."""
    hour, minute = map(int, hhmm.split(":"))
    return datetime.combine(day, time(hour, minute), tzinfo=PAKISTAN_TIME)


def is_on_leave(interviewer, day: date) -> bool:
    return any(off.start_date <= day <= off.end_date for off in interviewer.time_off)


def clashes(start: datetime, end: datetime, busy: list[tuple[datetime, datetime]]) -> bool:
    """True if this slot touches another interview (including the break around it)."""
    gap = timedelta(minutes=BUFFER_MINUTES)
    return any(start < busy_end + gap and busy_start - gap < end for busy_start, busy_end in busy)


def day_slots(interviewer, day: date, busy: list[tuple[datetime, datetime]], earliest: datetime) -> list[dict]:
    """All free interview slots of one interviewer on one day."""
    if is_on_leave(interviewer, day):
        return []
    length = timedelta(minutes=INTERVIEW_MINUTES)
    step = timedelta(minutes=STEP_MINUTES)
    slots = []
    for block in interviewer.availability:
        if block.weekday != day.weekday():
            continue
        start, block_end = at(day, block.start_time), at(day, block.end_time)
        while start + length <= block_end:  # the whole interview must fit inside the free block
            end = start + length
            if start >= earliest and not clashes(start, end, busy):
                slots.append(
                    {"interviewer_id": interviewer.id, "interviewer_name": interviewer.name, "start": start, "end": end}
                )
            start += step
    return slots


def is_slot_free(interviewer, start: datetime, busy: list[tuple[datetime, datetime]], now: datetime) -> bool:
    """Checked again just before booking: is this exact slot STILL free? (someone may have taken it)"""
    start = start.astimezone(PAKISTAN_TIME)
    earliest = now.astimezone(PAKISTAN_TIME) + timedelta(hours=MIN_NOTICE_HOURS)
    return any(slot["start"] == start for slot in day_slots(interviewer, start.date(), busy, earliest))


def workload(slot: dict, busy_by_id: dict) -> int:
    """How many interviews this interviewer already has that day (fewer = fairer to pick)."""
    day = slot["start"].date()
    return sum(1 for busy_start, _ in busy_by_id.get(slot["interviewer_id"], []) if busy_start.date() == day)


def pick_best(slots: list[dict], busy_by_id: dict) -> dict:
    """The earliest slot; if two are at the same time, the interviewer with fewer interviews that day."""
    return min(slots, key=lambda s: (s["start"], workload(s, busy_by_id), s["interviewer_id"]))


def find_slots(
    interviewers: list,
    busy_by_id: dict[int, list[tuple[datetime, datetime]]],
    windows: list[tuple[date, str, str]],
    flexible: bool,
    now: datetime,
    backup_count: int = BACKUP_COUNT,
) -> dict:
    """Agent 3's decision: {status, reason, best, backups}. Times are Pakistan time."""
    if not interviewers:
        return {
            "status": "no_interviewers",
            "reason": "No active interviewer is linked to this job. Add one on the Interviewers page.",
            "best": None,
            "backups": [],
        }

    now = now.astimezone(PAKISTAN_TIME)
    earliest = now + timedelta(hours=MIN_NOTICE_HOURS)
    days = [now.date() + timedelta(days=n) for n in range(1, LOOK_AHEAD_DAYS + 1)]
    every_slot = [
        slot for day in days for person in interviewers
        for slot in day_slots(person, day, busy_by_id.get(person.id, []), earliest)
    ]
    if not every_slot:
        return {
            "status": "no_free_time",
            "reason": f"No interviewer for this job has free time in the next {LOOK_AHEAD_DAYS} days. "
            "Add free time or another interviewer, then try again.",
            "best": None,
            "backups": [],
        }

    # 1. Try the candidate's options, first choice first
    best = None
    status = "no_match"
    reason = "None of the candidate's times are free, so the candidate can pick one of the nearest free times."
    for number, (day, start_text, end_text) in enumerate(windows, start=1):
        window_start, window_end = at(day, start_text), at(day, end_text)
        inside = [s for s in every_slot if s["start"] >= window_start and s["end"] <= window_end]
        if inside:
            best = pick_best(inside, busy_by_id)
            status = "matched"
            reason = f"Matches the candidate's choice {number}: the earliest time {best['interviewer_name']} is free."
            break

    # 2. No options given
    if best is None and not windows:
        if flexible:
            best = pick_best(every_slot, busy_by_id)
            status = "flexible"
            reason = f"The candidate is flexible: the earliest time {best['interviewer_name']} is free."
        else:
            status = "no_times"
            reason = "The candidate did not give any times, so they can pick one of the nearest free times."

    # 3. Backups: the nearest free times, one per day (not the best slot's day), for variety
    best_day = best["start"].date() if best else None
    backups: list[dict] = []
    used_days: set[date] = set()
    for slot in sorted(every_slot, key=lambda s: (s["start"], workload(s, busy_by_id))):
        day = slot["start"].date()
        if day == best_day or day in used_days:
            continue
        backups.append(slot)
        used_days.add(day)
        if len(backups) == backup_count:
            break

    return {"status": status, "reason": reason, "best": best, "backups": backups}

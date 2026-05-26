# Personas — Nailed-it

Date: 2026-05-26
Owner: Carson (product) + Claude (research draft)
Scope: 3 customer personas + 1 merchant persona. Drives all UX/copy/CTA decisions.

These personas are intentionally narrow. If a feature does not serve at least one persona below, it does not ship.

---

## P1 — "Yuki" — Trend-chaser, primary persona

**Demographic**
- 26, single, lives in Tier-1 Chinese city (Shanghai / Shenzhen / Beijing).
- Marketing or media role at mid-size company.
- Disposable income: ¥8k–15k/month after rent.
- Smartphone: iPhone or flagship Android, always on 5G or fast WiFi.

**Tech behavior**
- Lives in WeChat + Xiaohongshu + Douyin.
- Books rides, food, beauty all via 美团 / 大众点评.
- Tolerance for friction: **very low**. Drops apps with > 3 confusing taps.
- Reads reviews and photos before booking anything.

**Nail behavior**
- Books 1–2 sets per month, ¥150–400 per set.
- Discovers styles on Xiaohongshu, saves screenshots, brings them to salon.
- Prefers "show technician a picture" over describing style verbally.
- Switches salons 2–3× per year, loyalty is weak.

**Jobs to be done**
1. "I saved this Xiaohongshu nail pic — find me a salon that can do it, fast."
2. "Show me how much it costs before I commit."
3. "Book a slot tonight or this weekend, near me."

**Pain points with current options**
- Has to message salons one-by-one on WeChat to get quotes.
- Photos get re-saved/re-sent, lose quality, technician interprets wrong.
- Pricing opaque until in-chair.
- Forgets appointments, no reminders.

**What "good UX" means for Yuki**
- Upload picture → price + duration in < 30 sec.
- Tap one slot → confirmed.
- No "what does this button do" moments.

**She rejects the app if**
- Quote takes > 30 sec.
- Has to register before seeing prices.
- Total taps to book > 8.
- Copy reads like a corporate intranet.

---

## P2 — "Mira" — Time-poor professional, secondary persona

**Demographic**
- 33, married, no kids yet, Tier-1 / Tier-2 city.
- Senior individual contributor or junior manager (finance, law, consulting).
- Disposable income: ¥20k+/month.

**Tech behavior**
- Uses smartphone for utility, not entertainment.
- Books beauty appointments around fixed event calendar (weddings, work travel, holidays).
- Will pay premium for predictability.
- Reads cancellation policy before booking.

**Nail behavior**
- Books 1× per 3–6 weeks, ¥300–800 per set.
- Same salon, same technician when possible (relationship-driven).
- Prefers conservative styles: french, single-color, minimal art.
- Books 2–4 weeks ahead.

**Jobs to be done**
1. "Book my usual technician for the Saturday before the wedding."
2. "Reschedule if work travel comes up — no penalty."
3. "Pay in-app, receipt for expense if work-event-related."

**Pain points with current options**
- WeChat back-and-forth wastes lunch hour.
- Last-minute reschedule via WeChat feels unprofessional.
- No history of past appointments / styles / spend.

**What "good UX" means for Mira**
- "Repeat last booking" button.
- Visible cancellation/reschedule rules.
- Calendar conflict warning before confirming.

**She rejects the app if**
- No clear cancellation policy.
- No way to favorite a technician.
- Forces upload when she just wants "same as last time".

---

## P3 — "Linlin" — Budget-conscious student, tertiary persona

**Demographic**
- 21, university student, Tier-2 / Tier-3 city.
- Lives on allowance + part-time work: ¥2k–4k/month total.
- Smartphone: mid-range Android, mixed WiFi/4G.

**Tech behavior**
- Heavy Douyin + Xiaohongshu, light on apps requiring payment.
- Compares 3–5 prices before any non-trivial purchase.
- Sensitive to perceived value, not afraid to walk away.

**Nail behavior**
- Books 1× per 1–2 months, ¥80–180 per set.
- Often books with a friend, splits travel time.
- Hunts for promo codes, group-buy deals, off-peak discounts.
- Will pick a far salon if it's ¥30 cheaper.

**Jobs to be done**
1. "Find me the cheapest nail set in my city that still looks decent."
2. "Show me the reviews — I won't go somewhere with < 4.5 stars."
3. "Book with my friend at the same time."

**Pain points with current options**
- No way to filter by price ascending across salons.
- Reviews fake or thin on small-salon apps.
- Group-bookings impossible.

**What "good UX" means for Linlin**
- Price tag visible on every style card, not behind tap.
- Reviews + photos prominent before commit.
- Can share booking link to invite friend.

**She rejects the app if**
- Hides prices behind login.
- Inflated reviews / no photo evidence.
- No discount/promo surface.

---

## M1 — "Auntie Wang" — Salon owner-operator, merchant persona

**Demographic**
- 38, married, kids in school, owner-operator of one salon.
- 5–10 years salon experience, started as technician.
- Manages 2–4 technicians (often relatives or former apprentices).
- Tech-comfortable but not tech-fluent.

**Tech behavior**
- WeChat is universe. Uses 美团 商家端 reluctantly.
- Phone-first, never opens a desktop dashboard.
- Trusts paper backup. Will write appointments in notebook even if app exists.

**Salon behavior**
- 30–60 customers/week, mostly WeChat-booked.
- Sets prices by experience, not formula. Adjusts per customer relationship.
- Hates surprise no-shows. Hates customer arguing about price after service.

**Jobs to be done**
1. "Show me today's bookings the moment I open the app."
2. "Let me adjust price for individual customer without rewriting rules."
3. "Tell me if anyone cancelled overnight."

**Pain points with current options**
- 美团商家端 too dense, slow to find today's view.
- Cannot quickly mark a slot as "blocked — staff break".
- No view of which technician is free when.

**What "good UX" means for Auntie Wang**
- Open app → see today, this moment.
- 3 taps to add a walk-in booking.
- 1 tap to mark a slot blocked.
- Notifications when customer reschedules, but quiet otherwise.

**She rejects the app if**
- Daily view buried > 2 taps deep.
- Forces complex pricing rule setup before she can take a booking.
- Notifications spam her at 11pm.

---

## How to use these personas

For every patch:

1. Name the primary persona served (Yuki / Mira / Linlin / Auntie Wang).
2. State which JTBD (job-to-be-done) the patch advances.
3. If patch doesn't map to any persona/JTBD, push back — feature creep risk.

For copy decisions:

- Default voice: write for **Yuki**. She is fastest to lose, hardest to keep, highest LTV among customer personas.
- Merchant copy: write for **Auntie Wang**. Calm, dense, no decoration.

For trust signals (reviews, photos, credentials):

- **Linlin** needs them most (price-sensitive, evidence-driven).
- **Mira** uses them as tiebreaker, not gate.
- **Yuki** trusts Xiaohongshu more than in-app reviews.

For backlog prioritization:

- Patches serving Yuki + Linlin = higher reach.
- Patches serving Mira = higher revenue per user.
- Patches serving Auntie Wang = retention of supply side.

---

## Open questions

- Is Yuki right as primary, or should Mira lead given higher LTV? Decide before persona-locked patches ship.
- Do we serve group-bookings (Linlin JTBD #3) in v1, or defer? Affects whether discovery flow supports multi-customer.
- Does merchant persona include chain-salon manager (different from owner-operator)? If yes, add M2.
- Validation: zero of these personas are based on interviews. They are hypothesized. First 5 hallway-test sessions should be used to falsify or refine.

## Validation commitment (2026-05-26)

Carson confirmed personas should be validated, not assumed.

**Plan:**
1. Run first hallway test once `customer/home` + `customer/booking` + `customer/booking/confirm` reach Phase 4 ship-ready state (post first audit batch).
2. Recruit 3 testers per persona slot (3 customers + 1 merchant target). Mix age/income to span Yuki/Mira/Linlin profile.
3. Task: "Book a nail set you'd actually want, then change the time." No script.
4. Screen-record + 5-min debrief per tester. Log to `docs/baselines/2026-MM-DD-persona-validation.md`.
5. Refine or kill personas based on findings. Falsify hard — if no tester matches a persona archetype, delete that persona; don't soften it.

Until validation runs, treat all persona claims as **hypotheses**, not facts. Patches relying on persona signal should annotate `[unvalidated persona]` in PATCHES.md.

# Pinterest Privacy Approval Design

## Goal

Give Pinterest reviewers a public, no-login privacy-policy URL for the MVP while keeping the same policy reachable from customer and merchant account areas.

## Approach

- Add a standalone `src/app/privacy/page.tsx` route that does not depend on role selection, app state, OAuth, or browser storage.
- Keep the route copy narrow to the current MVP: optional Pinterest OAuth, read-only boards/Pins import, no password collection, no cookies, no scraping, and no posting to Pinterest.
- Link to `/privacy` from customer and merchant profile screens so the same policy is visible inside the product later.

## Tradeoffs

This is not a full legal program. It is an MVP disclosure page that is honest about the current product and suitable for a Trial-access review. If the app later stores accounts, payments, production bookings, or Pinterest write actions, the policy must be revised before those features ship.

## Review URLs

- Public app: Vercel production URL after deployment.
- Privacy policy: `/privacy`.
- Future Pinterest callback: `/api/integrations/pinterest/callback`.

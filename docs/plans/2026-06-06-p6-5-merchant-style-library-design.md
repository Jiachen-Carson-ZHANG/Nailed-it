# P6.5 Merchant Style Library and Media Foundation

**Status:** Approved
**Date:** 2026-06-06
**Builds on:** ADR-0005 P6 recognition-to-catalog bridge
**Feeds:** ADR-0005 P7 completed-work style tracking

## Problem

The customer discovery page still reads hardcoded mock styles, while merchants have no way to
manage or publish their own designs. Images are currently external URLs or browser data URLs stored
inside text fields; there is no owned media lifecycle, tenant ownership, review state, or Supabase
Storage integration.

The required product loop is:

`merchant uploads image -> reviews style metadata -> publishes -> customer discovery shows it`

P7 can later create draft entries from completed-booking photos through the same library.

## Scope

P6.5 implements:

- Supabase Storage buckets for private originals and public published images.
- Relational records for media ownership and merchant style publication state.
- Merchant collection preview, upload, edit-title, publish, and archive controls.
- Customer homepage and style-detail reads from published merchant styles.
- Repository/action boundaries with in-memory implementations for tests.
- File validation and server-owned object paths.

P6.5 does not implement:

- Real user authentication or multi-account authorization.
- A new recognition model or pricing engine.
- Collections, campaigns, multi-image variants, drag ordering, or image editing.
- Automatic publication based on AI confidence.

## Decision

Separate the physical media lifecycle from the business style lifecycle.

### `media_asset`

Represents one merchant-owned uploaded file:

- merchant owner
- private original object path
- optional public published object path
- MIME type, byte size, and upload source
- media processing state and timestamps

Postgres stores Storage object paths, never base64 image contents or expiring signed URLs.

### `merchant_style`

Represents one design in a merchant's library:

- merchant owner and primary media asset
- title and publication state
- reviewable discovery facets, recognition result, and catalog breakdown JSONB
- deterministic preview price/duration snapshot for discovery rendering
- published/archive timestamps

The minimal lifecycle is:

`processing -> needs_review -> published -> archived`

`failed` represents media/processing failure. A merchant upload enters `needs_review` in P6.5
because live AI catalog recognition is still incomplete; P6 can later own the
`processing -> needs_review` transition.

### Storage

- `merchant-style-originals`: private bucket. Source uploads are never exposed to customer reads.
- `merchant-style-published`: public bucket. A publish operation copies the reviewed original into
  this bucket and then marks the style published.

The public bucket is appropriate for the discovery feed: style images are intentionally public,
cacheable showcase content. Private originals remain protected.

### Read and Write Boundaries

- Browser uploads call a merchant-scoped server action with `FormData`.
- The server validates type and size, generates object paths, uploads the original, and creates the
  two relational records.
- Publishing runs through one service operation: copy to the public bucket, then update the media
  and style records. If the database update fails, the public object is removed as compensation.
- Customer actions return only `published` records and only public image URLs.
- Merchant actions return the demo merchant's full library. True tenant authorization remains
  blocked on authentication and is documented as such.

## Data Model

```text
merchant 1---* media_asset
merchant 1---* merchant_style
media_asset 1---* merchant_style

media_asset
  id, merchant_id, original_bucket, original_path,
  published_bucket?, published_path?, mime_type, byte_size,
  source, state, created_at, updated_at

merchant_style
  id, merchant_id, primary_media_asset_id, title, status,
  discovery_facets jsonb, recognition jsonb, catalog_breakdown jsonb,
  preview_price_cents, preview_duration_min,
  published_at?, archived_at?, created_at, updated_at
```

The existing `styles` table remains temporarily for migration compatibility. New customer and
merchant surfaces use `merchant_style`; retiring the old table is a later cleanup after no runtime
consumer remains.

## UI Flow

### Merchant

The merchant Me page shows a compact collection preview and links to `/merchant/styles`.
The library page provides:

- upload form
- status-labelled style cards
- title editing while unpublished
- publish and archive commands

P6.5 avoids a separate nested CMS and keeps the repeated management workflow on one page.

### Customer

The customer homepage fetches published merchant styles from the database and renders them through
the existing discovery grid. The customer detail page fetches the published style by id. Draft,
failed, and archived records are treated as not found.

## Invariants

- Customers never receive private original paths.
- A published style must have a public published object path.
- Merchant/style/media merchant ids must agree.
- Uploads accept only supported raster image MIME types and a bounded file size.
- Object paths are generated server-side and cannot be supplied by the browser.
- AI metadata is reviewable input, not authority for price or publication.
- Only published styles appear in the customer feed.

## Verification

- Repository tests prove lifecycle and tenant-scoped reads.
- Action/service tests prove validation, publish compensation, and customer filtering.
- Page tests prove merchant collection preview/library controls and customer published-only feed.
- Migration review proves constraints, indexes, buckets, and no anonymous operational-table writes.
- Full `npm test`, `tsc --noEmit`, and `npm run build` gate completion.


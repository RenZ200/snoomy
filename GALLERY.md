# Galeri bersama

Open `/#gallery`, choose **Simpan momen**, select a file, optionally add a caption, then **Pajang di galeri**. Moreno and Cahya share the album; only the uploader can delete an entry after confirmation. Media endpoints require the existing signed-in session.

- JPG, PNG, WebP, animated GIF, MP4 and WebM. Browser codec support still applies; MP4 H.264 is the most portable video choice. HEIC/MOV must be converted first.
- 3 MiB per file, 60 MiB total original media, at most 300 entries. UI labels use MB. Upload one file at a time. No automatic destructive compression.
- Data is persisted in the existing SQLite (local) or PostgreSQL database (production). No filesystem uploads on Vercel, no new account or paid storage setup. Base64 storage adds approximately 33% overhead. Database backups must include `gallery` and `gallery_quota` together. This is a bounded personal album, not a large video archive.
- The JSON upload stays below Vercel's 4.5 MB request limit. Playback returns at most 3 MiB, supports byte ranges, and uses private/no-store responses. Free database storage, transfer and compute allowances still apply. Limits do not guarantee unlimited free traffic.
- Magic signatures and declared MIME must agree; SVG/HTML/executable uploads are rejected. Text is inserted through `textContent`. Transactional quota reservations serialize writes. Retry keys avoid duplicate media after a lost response. Failed saves roll back their quota allocation.
- Album cards load images lazily. GIF/video playback is opened explicitly in a modal; videos have native controls and no autoplay. Close/Escape releases playback. Mobile uses two columns and five navigation items.

UI UX Pro Max guidance informed touch targets, feedback, lazy loading, keyboard dialogs and responsive layout. HyperFrames' GSAP motion principles are adapted to the interactive website through a finite paused entrance timeline played on display, with reduced-motion support. This is web animation, not a rendered HyperFrames video.

## Validation

`npm test` includes gallery SQLite and PostgreSQL SQL-engine coverage for uploads, signatures, ownership, ranges, quota rollback, retry idempotency and maximum-size payloads. Browser review uses isolated `data/gallery-review.sqlite`; its sample files are not production content.

Production requires the existing `DATABASE_URL` to remain configured. Apply both additive schema updates through the normal server startup. Deploy `gallery.js`, both schemas, `server.js`, `vercel.json`, and the gallery frontend/navigation files together.

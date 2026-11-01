# Real

A BeReal-style daily photo for Moreno and Cahya, at the top of **Galeri** (`#gallery`; `#real` opens Galeri at the Real panel).

## How it works

- Once a day, at a random moment between 09.00 and 21.00 WIB, it is "Waktunya Real". Both phones get the same moment; the server chooses it the first time either phone asks that day and never reveals it before it happens.
- While Snoomy is open on any page, a banner appears with a two-minute countdown, a sound and a short vibration (once per day). The Galeri menu item keeps a red dot until you post. Snoomy has no push notifications, so a phone where Snoomy is closed sees the reminder the next time it is opened.
- **Ambil Real** opens the camera: the back camera first, then the front camera about a second later. Tap the small photo to swap which one is big, add an optional caption (120 characters), then **Kirim Real**. If the browser cannot open the camera directly, the two photos are taken through the phone's own camera app.
- One Real per person per day, and it cannot be changed once sent. Posts within two minutes are "Tepat waktu ⚡"; later ones show how late they were ("Telat 3 jam").
- Your partner's Real stays locked until you post yours: before that you only see that they posted and when. The lock is enforced by the server (the photo itself returns 403).
- After both posted you can react to your partner's Real (😍 😂 🥺 😮 🔥 ❤️, tap again to remove). The streak counts days in a row on which both of you posted.
- **Kenangan Real** shows the last 30 days; tap a day to see both Reals. **Simpan ke galeri** turns a Real into one picture (big photo with the small one in its corner) and adds it to the shared album, where it stays for good within the album's 60 MB.

## Storage

- Photos are compressed in the browser before upload: the big photo up to 1280 px, the small one up to 560 px, plus a 320 px combined preview (limits 700 KB, 250 KB and 60 KB). The server checks the JPEG/WebP bytes and sizes.
- Like the album, everything is stored in the existing database (PostgreSQL in production, SQLite locally) as base64; no new storage service.
- Full-size photos are kept for 60 days; after that only the small preview stays in the memories (the clean-up runs whenever a new Real is posted). Use **Simpan ke galeri** for Reals worth keeping in full.

## Implementation

- `real.js` (server): `GET /api/real/status` (light, polled by every page every 20 s), `GET /api/real` (today, streak, memories), `GET /api/real/:id/:kind` (photo; locked photos are never cached), `POST /api/real` and `POST /api/real/:id/react`. Tables `real_days` (the day's moment) and `real_posts` in both schema files. `/api/real` accepts JSON bodies up to 1.6 MB.
- `public/real.js` draws the panel, runs the reminder, the camera (`getUserMedia`, with file inputs as a fallback) and the gallery save; `public/real.css` styles it. The Real page polls every 8 s while open.
- Tests: `test/real.test.js` (moment window, photo checks, locking, late posts, reactions, memories, clean-up on SQLite) and `test/routes-postgres.test.js` (the same routes on PostgreSQL).

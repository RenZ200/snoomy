# Real

A BeReal-style daily photo for Moreno and Cahya, at the top of **Galeri** (`#gallery`; `#real` opens Galeri at the Real panel).

## How it works

- Once a day there is a hidden random time between 09.00 and 21.00 WIB, chosen by the server and never revealed. Real starts with the first check after that time: the scheduled tick (every five minutes, see below) or a phone that has Snoomy open. That check records the moment and sends the notification, so both of you get the same moment and the two minutes count from the notification itself.
- Phones with notifications on get "⚡ Waktunya Real!" even while Snoomy is closed. While Snoomy is open on any page, a banner also appears with the countdown, a sound and a short vibration (once per day). The Galeri menu item keeps a red dot until you post.
- **Ambil Real** opens the camera: the back camera first, then the front camera about a second later. Tap the small photo to swap which one is big, add an optional caption (120 characters), then **Kirim Real**. If the browser cannot open the camera directly, the two photos are taken through the phone's own camera app.
- One Real per person per day, and it cannot be changed once sent. Posts within two minutes are "Tepat waktu ⚡"; later ones show how late they were ("Telat 3 jam").
- Your partner's Real stays locked until you post yours: before that you only see that they posted and when. The lock is enforced by the server (the photo itself returns 403).
- After both posted you can react to your partner's Real (😍 😂 🥺 😮 🔥 ❤️, tap again to remove). The streak counts days in a row on which both of you posted.
- **Kenangan Real** shows the last 30 days; tap a day to see both Reals. **Simpan ke galeri** turns a Real into one picture (big photo with the small one in its corner) and adds it to the shared album, where it stays for good within the album's 60 MB.

## Notifications

- Turn them on per phone in the Real panel (**Nyalakan notifikasi**), then **Coba kirim** sends a test to your own phones. They tell you when Real starts and when your partner posts ("Posting punyamu untuk melihatnya 🔒" until you have posted).
- Android (Chrome) and desktop browsers work in the browser or the installed app. iPhone needs iOS 16.4 or later and Snoomy added to the Home Screen; notifications are turned on from the installed app.
- Web Push with VAPID keys: taken from `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` when set, otherwise generated once and stored in the `push_keys` table. Subscriptions live in `push_subscriptions` (one per phone; signing in as the other person on that phone moves it). Phones the push service reports as gone are removed.
- The timing: `.github/workflows/real-reminder.yml` calls `GET /api/real/tick` every five minutes from 09.00 to 21.45 WIB (free for this public repository; GitHub may run scheduled jobs a few minutes late, and pauses them after 60 days without any repository activity). Vercel Cron calls the same endpoint once a day at 21.30 WIB as a back-up. The endpoint needs no login: it can only start a Real that is already due, at most once a day, and reveals nothing.

## Storage

- Photos are compressed in the browser before upload: the big photo up to 1280 px, the small one up to 560 px, plus a 320 px combined preview (limits 700 KB, 250 KB and 60 KB). The server checks the JPEG/WebP bytes and sizes.
- Like the album, everything is stored in the existing database (PostgreSQL in production, SQLite locally) as base64; no new storage service.
- Full-size photos are kept for 60 days; after that only the small preview stays in the memories (the clean-up runs whenever a new Real is posted). Use **Simpan ke galeri** for Reals worth keeping in full.

## Implementation

- `real.js` (server): `GET /api/real/status` (light, polled by every page every 20 s), `GET /api/real` (today, streak, memories), `GET /api/real/:id/:kind` (photo; locked photos are never cached), `POST /api/real`, `POST /api/real/:id/react` and the public `GET /api/real/tick`. Tables `real_days` (the hidden time), `real_fired` (when Real actually started) and `real_posts` in both schema files. `/api/real` accepts JSON bodies up to 1.6 MB.
- `push.js` (server): `GET /api/push` (public key, number of your phones), `POST /api/push/subscribe`, `/unsubscribe` and `/test`, and `notify()` used by Real. `public/sw.js` shows the notification and opens Snoomy at Real when it is tapped.
- `public/real.js` draws the panel, runs the reminder, the camera (`getUserMedia`, with file inputs as a fallback) and the gallery save; `public/real.css` styles it. The Real page polls every 8 s while open.
- Tests: `test/real.test.js` (moment window, start on first check, tick, photo checks, locking, late posts, reactions, notifications, memories, clean-up), `test/push.test.js` (stored keys, subscriptions, and a real encrypted message decrypted and signature-checked independently) and `test/routes-postgres.test.js` (the same routes on PostgreSQL).

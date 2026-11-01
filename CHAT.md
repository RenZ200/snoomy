# Chat

One private conversation between Moreno and Cahya, available on every page.

- The **💬 Chat** button sits above the music button (a circle above the tab bar on phones, where the music button steps aside on the card table and Nonton). A red badge counts unread messages. On phones the chat opens full screen.
- Enter sends, Shift+Enter starts a new line; up to 1000 characters per message. Messages are grouped by day ("Hari ini", "Kemarin"), and your last message shows **Terkirim** or **Dibaca**. "Cahya sedang di chat ♡" appears while the other one has it open. Older messages load 50 at a time.
- While the chat is closed, Snoomy checks for new messages every 15 seconds and shows a toast with a sound; while it is open, every 2 seconds, and they are marked read.
- **Notifications:** phones that turned notifications on (Galeri → Real → Nyalakan notifikasi) get "💬 Moreno: …" even while Snoomy is closed. No notification is sent while the partner has the chat open. Messages from the same person replace each other in the notification tray. The chat shows a link to turn notifications on while this phone has them off; tapping a notification opens Snoomy with the chat open.

## Implementation

- `chat.js` (server): `GET /api/chat` (latest 50; `after=<id>` newer only, `before=<id>` older; `open=1` marks you present), `POST /api/chat` and `POST /api/chat/read`. Tables `chat_messages` and `chat_readers` (read position and last time the chat was open) in both schema files. Notifications go through `push.js`.
- `public/chat.js` and `public/chat.css` draw the button and panel; text is always inserted as text, never HTML.
- Tests: `test/chat.test.js` and the chat part of `test/routes-postgres.test.js`.

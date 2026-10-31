# Nonton bareng and Musik kita

Both features use YouTube embeds from `youtube-nocookie.com`. They are controlled through the player's own postMessage protocol (`public/yt.js`), so no YouTube script is loaded and the Content-Security-Policy stays unchanged.

## Nonton bareng (`#watch`)

- Paste a YouTube link (watch, youtu.be, shorts, live, embed; `t=` start times are kept) and press **Putar bareng**. The video loads for both of you.
- The server stores one shared state: video, playing or paused, the position at a moment in time, and who changed it last. Each phone polls every 1.5 s, works out where the video should be on a shared clock, and seeks when it drifts more than 2 s.
- Play, pause and dragging the progress bar on either phone are sent to the server and followed by the other phone. Changes this phone just applied are ignored for 1.5 s, so they do not bounce back.
- Some phones (notably iPhone) block playback until the video itself is tapped; a "Ketuk ▶ di video" hint appears when that happens.
- Extras: reactions (♡ 😂 😮 😭 👏 🔥) that float over the video on both phones, whether your partner has the page open, **Samakan** to resync, **Selesai** to close the video for both, and the last eight videos for quick replay. Starting a shared video pauses Musik kita.
- Videos whose owner disables embedding show a message with a link to open them on YouTube.

## Musik kita (floating ♫ button)

- A shared playlist: paste a YouTube link to add a song (the title comes from YouTube's oEmbed), tap a song to play it, ⏮/⏭ to move through the list, × to remove. Playback is per phone; the list is shared.
- When a song ends the next one starts. Songs that cannot play outside YouTube are marked "tidak bisa diputar di sini" and skipped.
- The previous default track could not be played on snoomy.vercel.app (its owner disallows embedding), so the playlist now starts empty.

## Server

`party.js` mounts `/api/watch` (GET marks you as present and returns the shared state with the server time; POST takes `load`, `play`, `pause`, `seek`, `react` or `clear`) and `/api/music` (GET list, POST add, DELETE remove). Tables: `watch_party`, `watch_presence`, `music_tracks` in both schema files. Set `SNOOMY_OFFLINE=1` to skip the oEmbed title lookup (used by the tests). Tests: `test/party.test.js`.

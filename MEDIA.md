# Nonton bareng and Musik kita

Both features use YouTube embeds from `youtube-nocookie.com`. They are controlled through the player's own postMessage protocol (`public/yt.js`), so no YouTube script is loaded and the Content-Security-Policy stays unchanged.

## Nonton bareng (`#watch`)

- Paste a YouTube link (watch, youtu.be, shorts, live, embed; `t=` start times are kept) and press **Putar bareng**. The video loads for both of you.
- The server stores one shared state: video, playing or paused, the position at a moment in time, and who changed it last. Each phone polls every 1.5 s and works out where the video should be on a shared clock (estimated from the quickest recent round trip, so one slow reply cannot shift it).
- Keeping in step: a gap of more than 0.4 s while playing is closed by playing at 1.25× or 0.75× for a few seconds (no jump, no buffering). Gaps over 2.5 s, paused players more than 1 s off, and videos that refuse another speed are moved with a jump that aims slightly ahead; the phone learns how long its own jumps take to start playing.
- Play, pause, dragging the progress bar and double-tap skips on either phone are sent to the server with the time they happened at, and the other phone follows. Until the server has a tap, the phone that made it is left alone (no flicker on a slow connection), and a tap that failed to send is sent again on the next round. Replies that arrive out of order never step back to an older state.
- Pauses caused by leaving the app or locking the phone are not shared; on return the phone catches up with the other one.
- At the end the video stays on its last frame and both phones show it as finished; pressing play starts it again for both. (The shared clock used to keep running past the end, which made the player restart from 0 in a loop.)
- Some phones (notably iPhone) block playback until the video itself is tapped; a "Ketuk ▶ di video" hint appears when that happens.
- Extras: reactions (♡ 😂 😮 😭 👏 🔥) that float over the video on both phones, whether your partner has the page open, **Samakan** to resync, **Selesai** to close the video for both, and the last eight videos for quick replay. Starting a shared video pauses Musik kita.
- Videos whose owner disables embedding show a message with a link to open them on YouTube; the message now stays until another video is chosen.

## Musik kita (floating ♫ button)

- A shared playlist: paste a YouTube link to add a song (the title comes from YouTube's oEmbed), tap a song to play it, ⏮/⏭ to move through the list, × to remove. Playback is per phone; the list is shared.
- When a song ends the next one starts. Songs that cannot play outside YouTube are marked "tidak bisa diputar di sini" and skipped.
- The previous default track could not be played on snoomy.vercel.app (its owner disallows embedding), so the playlist now starts empty.

## Server

`party.js` mounts `/api/watch` (GET marks you as present and returns the shared state with the server time; POST takes `load`, `play`, `pause`, `seek`, `react` or `clear`, and retries on the row version so a reaction sent at the same moment as a pause cannot undo it) and `/api/music` (GET list, POST add, DELETE remove). Tables: `watch_party`, `watch_presence`, `music_tracks` in both schema files. Set `SNOOMY_OFFLINE=1` to skip the oEmbed title lookup (used by the tests). Tests: `test/party.test.js`.

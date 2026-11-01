# Permainan

The **Permainan** page (`#game`) holds four two-player games. Moreno and Cahya each play from their own phone; every game keeps one shared match in the database.

## Game picker

- The cards at the top switch between **Kartu Snoomy**, **Ludo**, **Empat Sejajar** and **Ular Tangga** (arrow keys work too). Each card shows that game's state: not started, whose turn, or the last winner and score. The choice is remembered per device.
- One reminder covers every game: the red dot on the Permainan tab, "✦ Giliranmu" in the tab title and the Beranda shortcut ("Giliranmu di Ludo ✦"). A game that is not on screen plays the turn sound and vibrates once when it becomes your turn.
- Only the open game polls quickly (1.5 s while waiting for the other player, 5 s on your own turn). The picker checks every game through `/api/games` every 6 s on this page and every 15 s elsewhere, and not at all while the app is in the background.

## Kartu Snoomy

An original shedding card game.

- Deck of 100 cards: four flavours (Matcha, Stroberi, Taro, Vanila) with numbers 1–9 twice, two +2, two Lewati and one Tukar Kartu each, plus four Ganti Rasa and four +4.
- Seven cards each. Play a card that matches the current flavour or the top card's number/symbol. Ganti Rasa and +4 can be played on anything and choose the next flavour.
- Nothing fits: draw one card. A playable drawn card can be played at once or kept (Simpan & lewat).
- +2 and +4 stack. The next player either answers or draws the whole stack and loses the turn. +2 can be answered with +2 or +4; +4 can only be answered with +4. While a stack is open no other card can be played.
- Lewati: the opponent loses a turn. Tukar Kartu: one random card from each hand swaps places.
- Cards sharing a number or symbol can be played together: tap one, tap the others, then **Mainkan**. The first card must fit; the last card's flavour becomes the next flavour. Stacked +2/+4 cards add up, stacked Lewati keeps your turn, stacked Tukar Kartu swaps once per card.
- When a move would leave you with one card, press **Satu lagi ♡** before playing (the button appears then). Forgetting costs two cards.
- Empty hand wins the round. Wins are tallied and the loser starts the next round.

### Card modes

**Main baru** (and **Mulai ulang** mid-round) asks which rule set to play; **Main lagi** keeps the current one. The chip next to the score shows the mode, and **Cara main** shows that mode's rules. The names are Snoomy's own.

| Mode | Deck | Rules |
|---|---|---|
| **Kartu Snoomy** | 100 | The rules above. |
| **Klasik** | 108: 0–9, Lewati, Putar Arah and +2 in each flavour; 4 Ganti Rasa, 4 +4 | +2/+4 are drawn at once and the player goes again (no answering). With two players, Lewati and Putar Arah both mean "go again". |
| **Bolak-balik** | 112 double-sided cards | Light side: matcha/stroberi/taro/vanila with +1, +2 Ganti Rasa, Lewati, Putar Arah, Balik. Dark side: kopi/anggur/jeruk/laut with +5, Lewati Semua, Ambil Sampai Warna (the rival draws until the chosen colour turns up), Balik. **Balik** turns every card over. Each player sees the other side of the partner's cards. Draw cards are drawn at once. |
| **Tanpa Ampun** | 168, with +6, +10, Putar Arah +4, Lewati Semua, Buang Semua, Rolet Warna | Draw cards stack with an equal or bigger draw card. With nothing to play you draw until a card fits. A 7 or 0 swaps whole hands. Buang Semua discards every card of that flavour. Rolet Warna: the rival draws until the chosen colour. Holding 25 cards loses the round. |

**Twins stack in every mode**: tap one card, tap others with the same number or symbol, then **Mainkan**. Their effects add up: two +2 make the rival draw 4 (Klasik, Bolak-balik) or add 4 to the stack (Kartu Snoomy, Tanpa Ampun); each Balik turns the cards over and each 7/0 swaps the hands, so an even number lands back where it started.

On the dark side the table turns to night and wild cards spin in the dark colours.

Card design (2026-11-01): printed-card faces with the value in a tilted oval and the value plus flavour symbol in two corners. Each flavour has its own symbol (matcha flower, stroberi heart, taro sparkle, vanila pearl), so colour is never the only cue. Taro is a lilac (`#a486d6`) and vanila a custard yellow (`#f1db97`) so all four stay apart, and plum ink reads on each. Ganti Rasa and +4 are plum cards with a four-flavour ring. The back has a stitched frame and the mascot on a cream medallion. While it is the other player's turn your hand stays at full colour; on your turn the cards you cannot play step back.

## Ludo

- Moreno plays matcha from the top-left yard, Cahya stroberi from the bottom-right one; four tokens each, moving clockwise round the 52-square loop and then up their own home column.
- A 6 brings a token out and earns another roll, and so do capturing and bringing a token home. Three 6s in a row forfeit the turn. A token needs the exact number to get home.
- Landing on the other player's token sends it back to the yard, except on the start squares and the star squares, which are safe.
- When there is only one real choice the token moves by itself; otherwise the tokens that can move light up. All four home wins; the loser starts the next round.

## Empat Sejajar

Connect Four on a 7×6 frame. Tap a column to drop a disc; four in a row across, down or diagonally wins and stays highlighted. A full board is a draw. The loser starts the next round; after a draw the other player starts.

## Ular Tangga

Snakes and ladders from 1 to 100. Ladders: 3→22, 8→30, 28→55, 36→44, 51→72, 58→77, 71→92, 80→99. Snakes: 17→4, 32→10, 47→26, 62→18, 74→53, 88→69, 95→56, 97→78. A 6 earns another roll. A roll past 100 bounces back by the extra steps; landing exactly on 100 wins. The loser starts the next round.

## Implementation

- `game.js` holds the card rules for all four modes (`buildDeck`, `newMatch`, `play`, `draw`, `pass`, `view`; Bolak-balik cards are `{light, dark}` pairs read through `face`) and its `/api/game…` routes; the match lives in the one-row `card_game` table. Each player only receives their own hand; the draw pile order is never sent.
- `games/ludo.js`, `games/four.js` and `games/snakes.js` hold the other rules as pure functions (`newMatch`, `act`, `view`). `boardgames.js` mounts `GET /api/games` (a short status of all four games for the picker), `GET /api/games/:name`, `POST /api/games/:name/new` and `POST /api/games/:name/move`. Matches are stored as JSON in `board_games` (one row per game, in both schema files).
- Every write checks the row version, so a double tap or a move from the other phone gets 409 and the client reloads. Dice are rolled on the server with `crypto.randomInt`.
- `public/games.js` is the picker, the shared reminders and the small client the board games share (polling, sending moves with their version, score, status, start and result). `public/cards.js`, `public/ludo.js`, `public/four.js` and `public/snakes.js` draw each game; `public/cards.css` and `public/boards.css` style them. Flavour and card symbols come from one SVG sprite at the end of `index.html`.
- Movement is animated with GSAP when it is available and motion is allowed: dice rolls, tokens hopping square by square, captures, ladders and snakes, falling discs. Without it (or with reduced motion) the board simply shows the new position.
- Sound effects are synthesised with Web Audio in `public/sfx.js` (no audio files): card play, draw, dice, your turn, incoming +2/+4, win and lose. The speaker button on the card table mutes them per device.
- Tests: `test/game.test.js` (Kartu Snoomy), `test/modes.test.js` (Klasik, Bolak-balik, Tanpa Ampun, plus full random matches per mode), `test/boardgames.test.js` (Ludo, Empat Sejajar, Ular Tangga rules) and `test/routes-postgres.test.js` (all game routes on PostgreSQL, including stale versions).

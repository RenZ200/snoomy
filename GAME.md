# Kartu Snoomy

An original two-player card game on the **Permainan** page (`#game`). Moreno and Cahya each play from their own phone; one shared match is stored in the database.

## Rules

- Deck of 100 cards: four flavours (Matcha, Stroberi, Taro, Vanila) with numbers 1–9 twice, two +2, two Lewati and one Tukar Kartu each, plus four Ganti Rasa and four +4.
- Seven cards each. Play a card that matches the current flavour or the top card's number/symbol. Ganti Rasa and +4 can be played on anything and choose the next flavour.
- Nothing fits: draw one card. A playable drawn card can be played at once or kept (Simpan & lewat).
- +2 and +4 stack. The next player either answers or draws the whole stack and loses the turn. +2 can be answered with +2 or +4; +4 can only be answered with +4. While a stack is open no other card can be played.
- Lewati: the opponent loses a turn. Tukar Kartu: one random card from each hand swaps places.
- Cards sharing a number or symbol can be played together: tap one, tap the others, then **Mainkan**. The first card must fit; the last card's flavour becomes the next flavour. Stacked +2/+4 cards add up, stacked Lewati keeps your turn, stacked Tukar Kartu swaps once per card.
- When a move would leave you with one card, press **Satu lagi ♡** before playing (the button appears then). Forgetting costs two cards.
- Empty hand wins the round. Wins are tallied and the loser starts the next round.

## Implementation

- `game.js` holds the pure rules (`newMatch`, `play`, `draw`, `pass`, `view`) and mounts `/api/game`, `/api/game/new`, `/api/game/play`, `/api/game/draw` and `/api/game/pass`. Each player only receives their own hand; the draw pile order is never sent.
- The match lives in the one-row `card_game` table as JSON. Writes check the row version, so a double tap or a move from the other phone gets 409 and the client reloads.
- `public/cards.js` renders the table and polls every 1.5 s while waiting for the opponent (5 s on your own turn, 15 s on other pages, where a red dot on the Permainan tab marks your turn). `public/cards.css` styles the cards in the Snoomy palette.
- Sound effects are synthesised with Web Audio in `public/sfx.js` (no audio files): card play, draw, your turn, incoming +2/+4, win and lose. The speaker button mutes them per device.
- `test/game.test.js` covers the deck, matching, special cards, stacking, calling, reshuffling, card conservation across 40 random matches and the API's privacy and version checks.

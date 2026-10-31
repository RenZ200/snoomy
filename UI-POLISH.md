# Snoomy UI refresh

The existing Fredoka/Nunito typography and cream, matcha, plum, pink palette remain the source of truth in `public/style.css`. `public/polish.css` layers responsive layout, controls, focus states, calendar navigation and budgeting styles onto it.

`public/navigation.js` shows one workspace at a time. Beranda contains the summary and Google Calendar connection. Jadwal and To-do have their own views. Budgeting reuses its iframe, and the music player stays in the outer document. Browser back/forward and direct hash links remain supported.

`public/motion.js` uses the locally served GSAP 3.15.0 core for short entrances, dialog transitions and mascot greetings. Content remains usable when GSAP is unavailable. Animations honor `prefers-reduced-motion` and clean up their listeners/tweens when that preference changes. There are no infinite decorative animations or scroll hijacking.

The embedded budgeting page reports modal visibility to the parent through same-origin, source-checked messages. This temporarily hides the floating music controls while a form is open without stopping playback.

No database schema, production records, OAuth configuration or API contract changed. Visual test records live only in the ignored local `data/ui-review.sqlite` database on port 3100.

Validation: all 13 existing Node tests passed; JavaScript syntax checked; local browser checks covered workspace navigation, calendar controls, task completion/filtering, budget wallet isolation, keyboard Harian/Pacaran switching, transaction form, persistent music iframe and reduced-motion behavior. Responsive checks use phone, tablet and desktop widths.

GSAP source/license information is in `public/vendor/README.md` and the unmodified vendor distribution header.

## Mascot refinement

The green backdrop is now a concentric CSS circle with a thin outer ring, replacing the uneven blob and cropped polka-dot field. The hero animation follows the installed HyperFrames animation skill's spring-pop-entrance recipe: finite, explicit from/to states and a short stagger (halo, cup, star, sticker), with power3 easing and reduced-motion support. The web playback adapter remains GSAP; this update does not claim a HyperFrames-rendered video or a separate HyperFrames composition.

## Poster theme and motion (2026-10-31)

`public/poster.css` loads last on both pages. It keeps the original palette tokens from `style.css` and adds grainy poster gradients (with the original Fredoka/Nunito type), glossy pill controls, glass cards and per-day schedule cards.

`public/motion.js` adds a sliding navigation pill (CSS transition), page entrances on every route (banner, heading, details, then cards in a stagger), scroll reveals for content below the fold, a spring mascot entrance and hover greeting, dialog and toast entrances, a sparkle burst when a task is ticked, and a pulse on today's column after "Hari ini". The first data load animates the week and task list; the 10-second refreshes do not. `public/navigation.js` opens the week on today's column when the calendar scrolls horizontally. All motion is finite and switched off by `prefers-reduced-motion`.

## Installable app (2026-11-01)

Snoomy is a Progressive Web App for Android and iPhone: `public/manifest.webmanifest` (name, colours, icons, shortcuts to Jadwal/To-do/Budgeting), icons in `public/icons/` (mascot on the poster gradient, inside the maskable safe zone), and `public/sw.js`, a network-first service worker that caches only same-origin static files so the shell opens offline; `/api/` requests are never cached. `public/pwa.js` registers the worker and shows "Pasang di HP" in the footer: on Android it triggers the browser install prompt, on iPhone it opens the Safari "Tambah ke Layar Utama" steps (`#install-help`). The button stays hidden once installed. An installed app keeps its own login cookie, so each phone signs in once.

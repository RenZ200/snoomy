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

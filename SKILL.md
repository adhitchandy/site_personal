---
name: adhitchandy-site
description: Working notes for adhitchandy.com, Adhit Chandy George's personal site (economist, photographer). Read before changing, building, testing or advising on anything in the adhitchandy site folder.
---

# adhitchandy.com

Personal site of Adhit Chandy George: economist (PhD researcher, Universität Hamburg) and photographer. Hand-built static site, no framework. Read this file first, then `AGENTS.md` (the checklist for adding content, written for any AI agent, with the mistakes not to repeat) and `README.md` (how content is written), both in the same folder.

Keep this file current: when a session settles a new rule or changes how things work, update the relevant line here before finishing.

## Where things are

- Site folder on the Mac: `/Users/adhitchandy/Personal/sites/adhitchandy` (in the Mac shell, with `~/Personal` connected: `$HOME/mnt/Personal/sites/adhitchandy`). It was moved there from `~/Photography/adhitchandy-site` on 8 October 2026. Beside it is `sites/two-readings`, the Two Readings site (its own README), and `sites/push.sh`, which commits and pushes both.
- Every photograph the site shows is in `photos/` inside the site folder: `cards/` (first-page cards and the pictures behind the home sentence), `genres/<slug>/`, `projects/<slug>/` (stories, project and paper covers), each with `edited/` (what the site uses) and `raw/` (the camera's raw file, found by file name and capture time, or capture time and camera for renamed exports; merged HDRs keep their run of frames). `photos/sources.csv` lists for every file where it came from in `~/Photography` and which raw belongs to it; `photos/README.txt` explains the folder to Adhit. A picture used in two sections is copied into both. 79 of 189 have no raw on the Mac (older Fuji and Nikon street and documentary work, To Meet the Ends, the Two Readings screenshot).
- `photoRoot` in `content/site.json` is `photos`, so picture paths in content start there (`genres/landscapes/edited/_DSC1881.jpg`). `~` at its start would mean the home folder; `PHOTO_ROOT` in the environment overrides it. A new picture is first copied into the right `edited/` (and `raw/`), with a line in `sources.csv`, then named in content. Screenshots, charts, faces and portraits stay in `content/`.
- `photos/` is in `.gitignore` (about 5 GB) and Adhit keeps it in Google Drive; the rest of `~/Photography` he backs up to a hard disk himself.
- A picture that cannot be found makes the build end with an error (exit code 1) after listing it, so `npm run deploy` stops before publishing. `ALLOW_MISSING=1` builds anyway (a stand-in test copy needs it).
- `build.mjs` (about 730 lines): the whole generator. Node ESM, uses `sharp` and `exif-reader`.
- `theme/site.css`, `theme/site.js`, `theme/fonts/`: copied into `dist/` as they are.
- `content/`: `site.json`, `projects/*.md`, `stories/<slug>/story.md`, `research/<slug>/{paper.json,body.html,fig/}`, `photography/*.json`, `faces/`, `cv.pdf`, portraits.
- `dist/`: the built site. `.cache/`: image metadata. `unused-images.txt`: written by the build.
- `wrangler.jsonc`: Cloudflare Workers static assets, domains `adhitchandy.com` and `www`.
- A git repository (branch `main`), pushed to the private GitHub repository `adhitchandy/adhitchandy` (remote `origin`). `.gitignore` leaves out `node_modules`, `dist`, `.cache`, `.wrangler`, `unused-images.txt`, `.DS_Store`. Commit as `Adhit Chandy George <mail@adhitchandy.com>` (set in the repository's own config). `photos/` is not in git.

## Build and publish

The site folder has no `node_modules`. Build from a scratch folder on the Mac:

```bash
S="$HOME/mnt/Personal/sites/adhitchandy"
mkdir -p /tmp/t && cd /tmp/t && { [ -d node_modules ] || (cp "$S/package.json" . && npm install --no-audit --no-fund >/dev/null 2>&1); }
cp "$S/build.mjs" . && SITE_ROOT="$S" node build.mjs 2>&1 | tail -2
```

- Expect a last line like `Built 14 pages, 211 images → dist/`. `/tmp/t` can vanish between calls, which is why the line recreates it.
- Images are named by a hash of path, size and date, so unchanged pictures are not rebuilt.
- Adhit publishes himself with `npx wrangler deploy` from the site folder. Never deploy for him; end a change by saying it is built and that this command publishes it.
- Deleting is off by default in the Mac shell. Ask for delete permission only when he asks for something to be removed. With it, the build also clears stale pages and unused images from `dist/`.

## How to work on it

1. Read the part of `build.mjs`, `site.css` or `site.js` you are about to change. They are dense; search by class name.
2. Change code with exact-match replacements that assert the old text occurs once. Do not reformat or re-type files.
3. Build on the Mac, then check the result in `dist/`.
4. Test in a real browser before reporting (next section).
5. Report what changed, what was tested and where, and what was not (usually Safari).

Content-only edits (a link, a cover, a sentence) are made in place in `content/` and need only a build.

## Testing

The cloud workspace is new in every chat; nothing from earlier sessions is there.

- Mirror the real build: on the Mac `tar -cf dist-audit.tar dist` inside the site folder, stage that one file, unpack it in the workspace, serve with `python3 -m http.server`, then delete the tar on the Mac (needs delete permission) or leave it out of `dist`.
- For a quick look, stage only the changed HTML plus `site.css`/`site.js` over an existing mirror.
- Drive it with Playwright (check `/opt/npm-tools/node_modules/playwright` and `/opt/pw-browsers/chromium`). Local servers started in one command may be gone in the next; restart them at the top of each test command.
- Sizes that matter: 390×844 (touch), 1440×900, 1728×1000, 2560×1300. He works on a wide monitor with a mouse, so anything above 1920px wide and anything involving scroll-bar width shows up for him.
- Headless Chromium hides scroll bars. To see scroll-bar bugs, launch with `ignoreDefaultArgs: ['--hide-scrollbars']`.
- For motion, log positions every frame from an init script, or film with repeated screenshots and compare consecutive frames. Measure; do not judge transitions from one still.
- Also check reduced motion and, when layout changes, the dark theme.

## Design rules that are settled

Look: one calm room ruled by hairlines; photographs carry the colour. Light and dark themes. Bricolage Grotesque for text and titles, IBM Plex Mono for small uppercase labels (11px). Gutter `var(--gut)`, top bar 48px, two-column grid 38fr/62fr, hairlines `var(--line)`.

New things must be built from what the site already has: the facts band (`.credits`), the big bold sentence with underlined key words, posters (`.pz pz-a` to `pz-f`), mono labels, the pointer that says Open/Read/Visit/Next/Previous/Close. He rejected a "film strip" page outright for not belonging; reuse before inventing.

Titles
- Titles of pages, papers, projects and stories, and the headings inside a paper, are in Title Case (small words such as and, of, in, among stay lowercase).
- Every page title is the compact row: title (28px on phones, up to 54px) with a 13px grey line beside it, starting at the left window edge at every width. This includes Projects on phones.
- Sub-pages put the way back before the title ("← Projects  Price Lens", "← Photography  Landscapes").
- A genre page also names the other genres in one line at the right end of its title row, in the size of the way back (`.gnav`, built from `types`, so a new genre joins by itself). Below 821px the line drops under the intro, underlined, and scrolls sideways if it ever gets too long.
- "View the code ↗" sits at the right, above the right edge of the content column, not at the window edge.
- The lines beside the titles are fixed sentences ("What I study, why, and the work so far.", "Who I am, where I'm from, and what keeps me busy."). They do not change while scrolling.
- Title rows stay under the top bar while scrolling on Research, About me and a project's page (desktop only). Stories and the thesis are left alone. The "Nothing here" page keeps its large title.
- The menu and every label say "About me", never "About".

Columns on wide screens
- Research, About me and a project's page keep their content in a centred column of at most 1880px, including what follows the text (Academic work, the Next block). The title row alone runs the full width.
- The thesis reads in a 1676px column; its top row (way back, code link) runs the full width.
- Photography caps at 2600px. Projects and the galleries fill the window.

First page
- Every card in the row is a designed poster, never a bare picture: the sections wear `g` Photography (the viewfinder: on screens of 821px and wider a landscape card with "Evening sky", the title in the clouds, focus box on the gull; on phones the tall "Lake paddlers" card, focus box on the paddlers, exposure under the title; frame lines, the title in the usual Bricolage weight (light looked foreign), mono line: the picture's exposure, or `"exif"` written in the tile when the file has none (no. 29 has none; its line is a made-up but plausible Nikon D7200 setting taken with his 18–140 mm lens at 70 mm; the line shows only the focal length, like the others), or else what the section holds), `c` Research (blue), `e` Projects, `a` About me with its name set large (`HOMEV` in `build.mjs`); the highlights wear their own posters.
- A tile in `site.json` → `tiles` is a path, or `{ "src", "pos", "focus", "wide": { "src", "pos", "focus" } }` (`wide` is shown and grown on wide screens; a tall picture grown to a wide window looked poor): `pos` is where the picture is cut (also used when it grows to fill the window), `focus` where the focus box of `g` sits ("47% 68%"). Change `focus` with the picture.

Projects page
- Posters lie in rows of three and two in turn, never one alone in a row (`rowsLayout()` in `build.mjs` writes each poster's place as `--l`, `--t`, `--w`, `--dp`; `site.js` reads them, as for the stories, and repeats the arrangement while it moves). Each layout keeps one size wherever it lies.
- Every piece names its poster and colour (`poster:`, `tone:`), so new work never changes old covers. Theses wear `c` (yellow master's, green bachelor's); To Meet the Ends `e`; Beyond `f`; Two Readings `b`; Price Lens `a`.

Photography page
- Two halves: photo stories as posters at the left, genres as pictures at the right.
- Lying still, the stories stand in the middle of the height the genres take, with equal room above and below (`.halves` `align-content:start`, the table `margin-block:auto`).
- Up to four stories lie still. From the fifth on, the left half is a table that moves (wheel, drag, arrow keys) and loops; the genres stay. This needs at least 960px width, 560px height and motion allowed; otherwise the page itself scrolls.
- A genre's card picture is `"cover"` in its `content/photography/*.json`.
- No hint lines such as "Scroll or drag. It does not end."

Motion
- A cover grows to fill the window, the next page opens under it, and the picture settles exactly onto that page's own picture (`data-hero`).
- Nothing may shift because of the scroll bar. Never toggle `overflow` on `body` directly: use `hush(1)` / `hush(0)` in `site.js`. The arriving page begins as wide as the page it came from (`bar` in the `enter` record, class `nobar` on `html`).
- The title written on the growing picture is set letter by letter and must stand exactly where the plain title stands on the next page: `tight()` in `site.js` gives the letters their kerning. Any title set letter by letter needs it, or it closes up and moves left when the plain one takes over ("To Meet the Ends" moved 12px).
- The growing picture ends at the page's real width (`clientWidth`, beside the scroll bar), not `innerWidth`.
- A cover that comes forward (home row, Projects, Photography stories) is never magnified with `scale()`: that shows it soft for a second and shifts its small type. `grow()` sets it at full size at once and shows it reduced, `lay()` places a grown cover, `shrink()` puts it back. Fixed least sizes on posters are multiplied by `--k` (`max(calc(8px*var(--k,1)),2.3cqw)`), so a grown poster keeps the small one's proportions exactly; write any new fixed size on a poster the same way.
- On arrival the title on the picture is not faded out and the page's faded in. Where the page's title says the same and is set alike (stories), it travels to the page title's place and size and the page's own title takes over unseen. Where they differ (the thesis), it fades.
- The ACG shapes ignore the pointer until the opening fall is over (`opening` in `site.js`).
- The small portrait (home rail, top of About me) is square, flashes through the face pictures twice and rests on the About cover photo. Every change is a cut. No fades, no endless rotation.
- A reload always starts at the top of the page. Links within About me scroll without changing the address.
- Safari: view transitions are skipped for Apple browsers (they caused jitter). Do not turn them back on.

Pointer
- On a mouse or trackpad the system pointer is hidden everywhere (`html.curon`, set by `site.js` only when the ring runs, so without the script the normal pointer stays). A 6px dot (`.cdot`, `mix-blend-mode:difference`) marks the exact point; the ring trails it and hugs controls; over covers the Open disc replaces the dot. Touch screens are untouched.

Links and contact
- Every link that leaves the site opens in a new tab; `outward()` in `build.mjs` writes that into the pages.
- Site email is `mail@adhitchandy.com`. About me ends with `about.contact`; its closing words "write to me" become the mail link (`reach()` in `build.mjs`), on a drifting ground of the four poster colours, passing through four of six faces every 5.2 s, each held 0.42 s so it can be read (each face sized to the plain word, so the line never moves). Under the pointer or keyboard focus the ground turns to its negative (`filter:invert(1)`), the word is drawn only in outline (`-webkit-text-stroke`, transparent fill) and it keeps changing every 0.65 s among the four heavier faces, since the thin ones fall apart in outline. There is no separate button. Reduced motion: still ground, no flicking. The CV PDF still shows his Gmail address until he updates the CV himself.

## Content quick reference (details in README.md)

- Photo story: folder in `content/stories/` with `story.md`; `## Chapter`, text, `@images: a.jpg, b.jpg`. `draft: true` hides it. `cover:` sets the cover.
- Project: `content/projects/<slug>.md` with `title`, `type`, `year`, `summary`, optional `cover`, `poster`, `link`, `repo`, `lead`, `facts: A: x | B: y`. A line `@screens: folder` with `name-light.png` / `name-dark.png` pairs makes the staged page used by Price Lens.
- Paper: `content/research/<slug>/paper.json` (`repo` adds the code link) plus `body.html`. Follow the paper checklist in `AGENTS.md` point by point; the master's thesis is the model. Covers are his own photographs; `"coverFit": "contain"` (keeps a chart whole) is only for a chart he asks to use as a cover. Other cover keys: `coverAlt`, `coverPosition` (CSS object-position; the arriving picture follows it) and `coverCredit` (author, authorUrl, source, sourceUrl) for a picture that is not his. Everything in a paper's `fig/` is published as it is, so keep the cover and drafts in the paper folder itself, not in `fig/`. `data.json` is not used by the build. Simple bar charts can be written in the body as HTML (`figure.survey-chart` with `ul.survey-bars`, styled in `site.css`); tables take `class="num"` and `class="r"` on number columns. The 2021 EV bachelor’s thesis preserves its 2026 revision date separately; its source counts are in `data.json`.
- About me, Research text, home sentence, links, facts: `content/site.json`.
- Writing voice for his texts: loose, first person, a little dry; not academic.

## Code conventions

- Comments are whole sentences that say why, written in plain prose. Match them.
- `site.css`: one rule per line, compact. `site.js`: one function wrapping everything, with helpers `$`, `$$`, `reduce`, `fine`, `hush`, and the paces `T_OPEN`, `T_CLOSE`.
- New CSS goes beside the rules it belongs with, not at the end of the file.

## How Adhit likes to work

- When he says "tell me first", explain the cause and the plan and wait. Do not build.
- He asks why something happens; give the cause in plain words, then the fix.
- When asked for an opinion, give one recommendation and the reason.
- If a request can be read two ways, say which reading you took, or ask one short question when a wrong guess would be wasted work.
- Test content (dummy stories and the like) must be clearly marked and removed before he publishes; remind him while it exists.
- Send a screenshot of the real build when the change is visual.

## Open items

- Both repositories are made locally; Adhit has to create `adhitchandy` and `two-readings` (private, empty) on github.com and run `push.sh` once. Photo backup advised: Time Machine on an external drive plus Backblaze Personal Backup; not yet confirmed as set up.
- The CV PDF shows the old email address.
- About me says he plays for "one of its teams" at ETV Hamburg; the exact team is not named.
- Recent changes are tested in Chromium only. Safari and the dark theme have not been re-checked since the title, column and transition fixes.

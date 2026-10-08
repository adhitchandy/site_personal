# adhitchandy.com

Everything on the site comes from the `content/` folder. `build.mjs` turns it into the finished site in `dist/`.

An AI agent working on the site reads `AGENTS.md` first.

## First time

    npm install

## Every time you change something

    npm run deploy

That rebuilds the site and publishes it. To look at it first without publishing: `npm run build`, then `npm run preview`.

## Adding things

**Photographs.** Open `content/photography/landscapes.json` (or `street.json`, `portraits.json`) and add a line to `photos`:

    { "src": "Exports/2025/some-folder/_DSC1234.jpg", "title": "Optional title" }

`src` is the path inside your Photography folder. A folder path adds every image in that folder. To start a new kind of photography, copy one of the files, rename it, and set `"style"` to `wide` (one large frame at a time), `sheet` (contact-sheet grid) or `tall` (upright frames in a row).

**A photo story.** Make a folder in `content/stories/` with a `story.md` in it. Start a chapter with `## Chapter name`, write the text, and add `@images: path/to/folder` (or a list of files separated by commas) where the pictures go.

**A project.** Add a `.md` file to `content/projects/`. The top block sets `title`, `type` (any of `photography`, `research`, `code`, `writing`, separated by commas), `year`, `summary`, and optionally `link` and `cover`. Projects with the type `research` also appear on the Research page. See `_example-thesis.md`.

**A blog post.** Add a `.md` file to `content/writing/`. See `_example-post.md`. The Writing section appears in the menu once one post is published.

**Your details.** Name, introduction, links and the home-page pictures are in `content/site.json`. The corner portraits are the files in `content/faces/`.

A file with `draft: true` in its top block is left out of the site.

## Research papers (full text on the site)

Each folder in `content/research/` is one paper with its own reading page at `/research/<folder-name>/`:

- `paper.json`: title, kind, date, summary, facts, abstract, keywords, the "at a glance" numbers and the cover picture.
- `body.html`: the full text (chapters, numbered figures, tables, equations, references).
- `fig/`: the figures used in the text and the overview, and nothing else, because everything in it is published. The cover and any drafts stay beside it.

Photo covers can include `coverAlt`, `coverPosition` (for example `"center 70%"`) and `coverCredit` (`author`, `authorUrl`, `source`, `sourceUrl`), which adds linked attribution beneath the cover.

For a chart used as the cover, set `"coverFit": "contain"` in `paper.json` to keep its labels visible on the reading page. The bachelor’s thesis is in `content/research/electric-vehicle-awareness-kerala-2021/`; its `data.json` retains the supplied tables and chart data.

The paper also appears on the Research and Projects pages. Add `"draft": true` to `paper.json` to hide it.

## Highlights on the first page

The two pinned pieces beside the section panels are named in `content/site.json` under `home.highlights`,
by the file or folder name of a project, story or paper, for example `["two-readings", "ncap-thesis"]`.
Change the names and rebuild to pin something else. Only the first two are shown.

## The section cards on the first page

The pictures of the section cards are `tiles` in `content/site.json`. A tile is a path, or for Photography `{ "src": "…", "pos": "50% 100%", "focus": "47% 68%", "wide": { "src": "…", "pos": "50% 50%", "focus": "35.6% 54.6%" } }`: `pos` is the part of the picture shown, `focus` where the little focus box sits on its card. `src` is the phone picture (tall), `wide` the one for wider screens (landscape). If you change a picture, move its `focus` to what the eye should go to.

## The picture that stands for each kind of photograph

On the Photography page every set is shown by one picture. Name it in the set's file in `content/photography/`
with `"cover": "<the same path as in the photos list>"`. Without it, the first picture of the set is used.

Each kind of photograph has its own page, and that page names the other kinds at the right of its title, so a reader can go from Landscapes straight to Portraits. A new kind appears there by itself.

## The overview before a paper

A paper can open with a short overview: the question, one figure, the finding and its limits. It comes from the `overview` entry in that paper's `paper.json`:

- `question`: `lead` (the question, set large) and `text` (two or three sentences of background)
- `figure`: `src` (a file in the paper's `fig/` folder), `caption`, and optionally `ref` (the id of the figure in the text) with `refLabel`
- `finding`: `lead` (one sentence) and `points`, each a pair of a number and a sentence
- `limits`: `lead` and `points`, each a sentence

Leave `overview` out and the page starts with the abstract as before. The Research page shows each paper by its question, its cover and its first three `glance` numbers.

## The first page

The row holds the sections followed by the work named in `site.json` under `home.highlights` (at most two). On a phone the highlights come first, then the sections, then the personal details.

## A project's own page

A project without a `link` gets a page of its own. Its name stays at the left while the text is read. The first paragraph is set large as a way in, the cover follows it (a chart or drawing saved as a PNG is shown whole, a photograph is cropped to 3:2), then the rest of the text. `repo:` in the top block adds a "View the code" link.

## A piece of software shown at work

A project can show its screens beside a large sentence that tells how it is used (Price Lens does). In the project's file, below the top block, write:

    @screens: projects/price-lens
    Every study starts in your list of [researches](#1). You [plan](#2) it, ...

    - **Researches.** One line about the first screen.
    - **Plan.** One line about the second.

- `@screens:` names the folder of screenshots, under `content/`.
- The sentence under it is set large. A word written `[like this](#3)` is underlined and calls the third screen.
- The list gives each screen, in order, its name (in bold) and the line shown under it.
- Everything else in the file is the text further down the page.

Name each screenshot with a number for its place, and give it twice, once for each theme of the site: `03-collect-light.png` and `03-collect-dark.png`. A screenshot given only once is used for both themes.

Two lines in the top block fill in the rest: `lead:` is the short line beside the title, and `facts:` is the row of small facts under it, written `Shops: Amazon, eBay | Runs: On your own computer`. The `cover:` still makes the poster on the Projects page.

## Posters

Every project is shown as a small poster on the Projects page. A project pinned to the first page wears the same poster there, a photo story wears it on the Photography page, and it appears once more at the end of the page before it, as the piece to read next. Without a name, the layout and colour follow the project's place in the list. Every piece names its layout with `poster: a` (or `b`, `c`, `d`, `e`, `f`) in the top block of the project's file, or `"poster": "c"` in a paper's `paper.json`, and its colour with `tone: blue` (or `red`, `yellow`, `green`; only layout `c` shows it). Name both for anything new, or adding it would change the covers of the work after it. `f` is a book jacket: the picture at the left, a red spine, the title on the flap. On the Projects page the posters lie in rows of three and two, never one alone.

## The Photography page

One window divided down the middle, with nothing drawn between the halves: the photo stories at the left as posters, the kinds of photograph at the right as pictures. Every folder in `content/stories/` is a story; a project of the type `photography` that links to another site (Two Readings) joins them as a photo project. The sentence beside the heading is `photography.intro` in `site.json`.

Up to four stories are all seen at once. From the fifth on they keep a good size instead of shrinking, and the left half becomes a table that moves: scroll, drag or use the arrow keys and the covers pass by, without end, while the kinds of photograph at the right stay where they are. This needs a window wide enough for the two halves and tall enough to hold them; on a narrower or lower window, with motion turned off, or without the script, the covers are simply laid out down the page and it is the page that scrolls.

## The "Currently" line

`currently` in `site.json` is one sentence. Words in square brackets followed by an address in round brackets become a link, for example `[Universität Hamburg](https://www.uni-hamburg.de/en.html)`.

## What comes after a page

A story, a project page and a paper each end with the next piece of work, in the order of the Projects page (the last leads back to the first). Nothing to maintain.

## Typefaces

Bricolage Grotesque and IBM Plex Mono are kept in `theme/fonts/` and served by the site itself, so no other company's server is asked for them. Both are under the SIL Open Font License; its text is in the same folder.

## What browsers may keep

The build writes `dist/_headers`, which lets browsers keep pictures, fonts, the style sheet and the script instead of asking for them again on every page. A picture's address changes when its file changes, so a replaced picture is always fetched anew. If the picture sizes or quality in `build.mjs` are ever changed, put a word in `RECIPE` there (it is explained beside it), so every picture gets a new address.

## The About page

The page is made from `about` in `content/site.json`:

- `text`: the sentence set very large. Words written `[like this](#camera)` are underlined and jump to the piece whose `id` is `camera`.
- `hint`: the small line under it.
- `sections`: the pieces, each an `id`, a `title` and its `text` (a list of paragraphs). They are numbered in the order they stand in and listed under Contents. The `id` is a short word that only the links in `text` use, so a title can be reworded freely without breaking them. (Left out, it is the title in small letters with dashes for spaces.)
- `quote`: the last word (`lead`, `text`, `by`, `sign`).
- `contact`: the sentence beside the CV. If it ends with "write to me", those words become the email link, set on a moving coloured ground.
- `facts`: what stands beside the small portrait. Anything that is a link or an email address goes to the list at the right instead.

The small portrait is the same set of pictures as in the corner of the first page (`content/faces/`).

Opened from its cover on the first page, About does not let the portrait grow to fill the window as the other covers do with their pictures: the cover grows into a plain dark card that carries the title. (`plain: true` beside the About cover in `build.mjs` does this.)

Inside a paragraph a few marks do things:

- `((an aside))` is set in the typewriter face, in brackets, and types itself when the reader reaches it. `{{an aside}}` does the same without brackets.
- `~~crossed off~~` is struck through. Several in one paragraph are crossed off one after another.
- `{a choice}` marks one of several choices in a sentence: an underline passes over them and comes to rest on `{=this one}`.
- `[words](https://example.org "a note")` is a link with a note that shows while the pointer is on it. On a phone the first tap shows the note and the second opens the link.

In place of a paragraph there may be a row of figures, which count up when they are reached:

    { "figures": [["92.67 km²", "Total area"], ["43,273", "Population"]], "note": "Where they come from." }

## Reloading a page

A reload starts at the top of the page, on every page, and drops any `#part` from the end of the address. The links inside the About page do not put one there in the first place. Going back with the browser's Back button still returns to the place you left.

## The page for an address that does not exist

`dist/404.html` is built with the rest and lists the sections. Nothing to maintain.

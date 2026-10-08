# Instructions for AI agents working on adhitchandy.com

This file is for any AI agent (ChatGPT, Codex, Claude or another) asked to change this site. Read it in full before you change anything, then read `SKILL.md` (how the site is built and tested, and the design rules already settled) and `README.md` (how content is written).

The master's thesis in `content/research/ncap-thesis/` is the reference for every research paper. When you are unsure how something should be marked up or how it should look, open its `paper.json` and `body.html` and do what it does.

## Ground rules

- Never publish. Do not run `npx wrangler deploy` or `npm run deploy`. Adhit publishes himself.
- Do not edit `dist/` by hand. It is written by the build; change `content/`, `theme/` or `build.mjs` and build again.
- Do not delete Adhit's files. If something is unused, move it out of the way (out of `fig/`, for example) and tell him.
- Change what you were asked to change. When you notice other problems, list them in your report instead of quietly rewriting things.
- Published text never mentions how it was made: no "the revised Word thesis", "generated", "exported from", source file names, or notes to yourself. The reader sees a finished page.
- Every claim in your report must be checked: build the site, open the pages in a browser, and look.

## Adding or changing a research paper

A paper is a folder `content/research/<slug>/` holding `paper.json`, `body.html` and `fig/`. Go through every point.

### paper.json

1. **title** in Title Case, like every other title on the site. Lowercase only articles (a, an, the), conjunctions (and, but, or, nor, for, so, yet) and prepositions (of, in, on, at, to, by, for, from, with, among, into, within, between and so on), unless they come first or last. Capitalise both halves of a hyphenated word: "A Stronger Follow-Up Survey". Example: "Electric Vehicle Awareness and Perceived Adoption Barriers in Kerala".
2. **short**: the title for posters and for the picture that opens the page. Title Case, at most 40 characters.
3. **summary**: at most three sentences, and the first must make sense on its own. It is shown when a cover is opened on the Projects page and typed under the title while the page opens, where only the whole sentences that fit are typed.
4. **cover**: one of Adhit's own photographs, chosen with him. The path is relative to `content/` (for example `stories/to-meet-the-ends/img/03.jpg`) or to the Photography folder. No stock photos, no charts. `coverAlt` describes the picture. Add `coverPosition` (for example `"center 65%"`) when the wide 21:9 crop cuts the subject; check the crop on the page. Use `coverCredit` only for a picture that is not his. The cover file never goes inside `fig/`.
5. **glance**: three or four pairs `[number, label]`. Labels are plain words of at most 70 characters, for example `["92.50%", "reported knowing that electric vehicles were available"]`. The first three are shown on the Research page. Do not repeat `overview.finding.points` word for word; the page shows both.
6. **poster** and **tone**: every piece of work names its poster layout and its colour, so that adding new work never changes the covers already there. Theses wear `"poster": "c"` (the coloured jacket with the photograph in a circle), each in its own colour: the master's thesis `"tone": "yellow"`, the bachelor's thesis `"tone": "green"`. See "Covers and the Projects page" below.
7. **overview.figure**: `src` is a file in `fig/`. `ref` is the id of the same figure in `body.html` and `refLabel` names it correctly ("Figure 4.1 in the text"). Check that the id exists. The overview figure is the same chart as that figure and looks like it.
8. **kind**, **year** (and **date** if it needs more than the year), **types** `["research"]`, **facts** as `[label, value]` pairs.

### body.html

8. **Structure**, as in the master's thesis:
   - chapter: `<section class="ch" id="..."><h2><span class="no c">4</span>  Descriptive Results</h2> ... </section>`
   - section: `<h3 id="..."><span class="no">4.1</span>  Composition of the Sample</h3>` (h3 sections are listed in the contents rail)
   - appendix: `<h2><span class="no">Appendix A</span>  Calculation Rules and Source Traceability</h2>`
   - references: `<section class="ch refs" id="references">` with `<li id="ref-1">` and so on
   - chapter and section headings in Title Case (rule 1). Every id is used once on the page.
9. **Equations are never plain text.** No `sum from t = 1 to T`, `E_t`, `^t` or `/` fractions in a paragraph. Write MathML, as in the master's thesis:
   `<div class="eqrow" id="eq-tco"><math display="block" xmlns="http://www.w3.org/1998/Math/MathML">...</math></div>`
   Single variables in running text are `<i>P</i>` or `<i>E</i><sub><i>t</i></sub>`.
10. **Citations link to the reference list**: `(<a class="cite" href="#ref-5">IEA, 2021</a>)` or `<a class="cite" href="#ref-4">Hidrue et al. (2011)</a>`. Every `href="#..."` must point at an id that exists.
11. **Tables**:
    `<figure class="tbl" id="table-..."><figcaption><span class="lab">Table 4.1</span> Composition of the sample</figcaption><div class="tw" tabindex="0" role="region" aria-label="Table 4.1 Composition of the sample"><table class="num"> ... </table></div><p class="fnote">Source: ...</p></figure>`
    Every column that holds numbers gets `class="r"` on its header and on each of its cells, so the numbers line up on the right.
12. **Figures as pictures**:
    `<figure id="figure-..."><div class="plot"><button class="zoom" type="button" aria-label="Enlarge figure 4.1"><img src="fig/....webp" alt="what the figure shows" loading="lazy"></button></div><figcaption><span class="lab">Figure 4.1</span> Caption.</figcaption></figure>`
    The picture itself:
    - is drawn in the site's own typefaces: Bricolage Grotesque for text and numbers, IBM Plex Mono for small uppercase labels (both in `theme/fonts/`). Never Arial, Helvetica, Calibri or a plotting library's default font.
    - has a white background (it sits on a white plate in the light and the dark theme) and uses the site's colours: ink `#11110f`, grey `#6a665e`, hairline `#d8d4ca`, accent red `#e0492c`, blue `#2b4bd6`.
    - is at least 1600 px wide, saved as WebP (lossless for charts) or PNG.
    - shows the same chart in the same style wherever it appears (in the overview and in the text).
13. **Simple bar charts** can be HTML instead of a picture: `<figure class="survey-chart">` with `ul.survey-bars`, as in the bachelor's thesis. Bars for categories go largest first, unless their order means something (a scale, years, a questionnaire's sequence that the text discusses).
14. **One note per thing.** A chart does not repeat its table's note; the source line appears once.
15. **`fig/` holds only files that `body.html` or `paper.json` use.** Everything in it is copied to the public site as it is. No originals, drafts, covers or multi-megabyte files.
16. **Numbers agree.** Every percentage in the text, tables and charts is recomputed from its count and its denominator. Say which denominator a percentage uses when it could be read two ways (share of respondents or share of answers).

## Covers and the Projects page

Every piece of work (project, photo story, paper) is shown as a small poster on the Projects page, and the same poster appears on the first page, on the Photography page and in the "Next" block at the end of pages.

- **Name the poster and the colour of every new piece**: `poster: a` to `f` and `tone: blue`, `red`, `yellow` or `green` in a project's top block, `"poster"` and `"tone"` in a paper's `paper.json`. Left out, they come from the piece's place in the list, and the next piece added would change them. Never change the poster or tone of existing work unless Adhit asks.
- The layouts: `a` a light card with the picture framed (Price Lens), `b` a white card with the title split around a strip of picture (Two Readings), `c` a coloured jacket with the picture in a circle (the theses), `d` a picture with the title over it, `e` a black card with an italic title and a picture (To Meet the Ends), `f` a book jacket (Beyond), `g` a viewfinder (the Photography card on the first page). Only `c` uses the colour. Pick the layout that fits the kind of work, and the one its siblings wear.
- The Projects page lays the posters in rows of three and two in turn and never leaves one alone in a row (`rowsLayout` in `build.mjs`); do not go back to fixed places. After adding work, scroll the Projects page at 1728 px and check that every poster has company and that none is cut off or covering another.
- Covers are Adhit's own photographs. Look through his folders and offer him a few before using anything else.

## Other content

- Projects, stories and photographs: see `README.md`. Covers are Adhit's own photographs.
- Text Adhit writes in his own voice (About me, Research introduction, project texts): loose, first person, a little dry. Academic texts keep their own register.

## Code

- Read the part of `build.mjs`, `theme/site.css` or `theme/site.js` you are about to change, and change it with small exact edits. Do not reformat files.
- New CSS goes beside the rules it belongs with, one rule per line. Use the colour variables (`var(--accent)`, `var(--fg)`, `var(--dim)`, `var(--line)`) instead of colour codes.
- Comments are whole sentences that say why.
- The motion rules in `SKILL.md` (scroll bar, covers that grow, titles that settle) are settled. Do not work around them.

## Before you finish

1. Build with the command in `SKILL.md` and read its last line.
2. Open the changed pages in a browser at 1440 px and 390 px wide, in the light and the dark theme. For a paper, look at the title, the overview, every chart, every table and every equation, and open it from its card on the Research page to see the cover grow into place.
3. Search the built page for leftovers: `TODO`, `lorem`, `sum from`, subscripts typed as `_t`, `Word`, `ChatGPT`, `AI`, source file names, `undefined`, `NaN`.
4. Report what changed, what you tested, and what you did not test (usually Safari).

## Mistakes already made once (October 2026)

A first version of the bachelor's thesis page had these, all now fixed. Do not repeat them.

- The overview chart was drawn in Arial, unlike every other figure, and linked to Table 4.3 instead of Figure 4.1.
- The ownership-cost formula was written as plain text with underscores and the word "sum".
- Numbers in tables were aligned to the left.
- Citations in the text did not link to the references.
- Two charts repeated their table's note word for word, and a bar chart of categories was not sorted.
- An appendix said its pages came from "the revised Word thesis".
- The at-a-glance numbers were the same four sentences as the overview's findings, so the page said them twice.
- A 1.4 MB stock photo and an unused draft cover sat in `fig/` and were published with the site.
- The title and headings were in sentence case while the rest of the site uses Title Case.
- The cover was a stock photo of a car rather than one of Adhit's photographs.
- Adding the bachelor's thesis moved To Meet the Ends one place down the list, and its poster changed from the black card to another layout, because neither had a named poster. On the Projects page it was then left alone in a row of its own.

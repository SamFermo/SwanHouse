# Rules for Claude: editing the Swan House Farm website

This repo is the public website for Swan House Farm, served by GitHub Pages at
https://samfermo.github.io/SwanHouse/ . Anything committed to `main` is live for every
visitor within a minute or two. Read this whole file before changing anything.

Written 2026-10-14 for Kelly (and her Claude), who may change how the site LOOKS:
layout, spacing, fonts, colors, sizes, section order, how things sit on a phone. Sam
West owns the site. When in doubt, stop and ask Kelly to check with Sam.

## The one thing to understand first

The words on this page are NOT controlled by `index.html` alone. Approved family
members change the text from the live site itself (an edit mode reached by tapping the
copyright line in the footer five times). Their published text is stored online and is
laid over the page every time it loads, replacing what the HTML says.

So:

- **Do not change wording by editing the HTML.** If the text you change has been
  published from the edit screen, the site keeps showing the published version and your
  change looks like it failed. If Kelly wants different words, she changes them on the
  live site in edit mode (instructions are in Sam's handoff doc). Your job is the look.
- **Every element with a `data-copy="..."` attribute is an editable text block.** You
  may restyle it, move it, change its tag or classes, or wrap it in new containers. You
  must keep the `data-copy` attribute, keep its value EXACTLY the same, and keep it on
  the element that directly holds the text. Renaming a key orphans whatever has been
  published under the old name.
- Inside a `data-copy` element, only plain text plus `b`, `i`, `em`, `strong`, `br` and
  `a` survive. Do not put other markup (spans with classes, icons, nested divs) inside
  one; it will be stripped when someone edits it. Put decoration outside the element.
- Deleting an element that has `data-copy` is allowed if Kelly wants that text gone,
  but say so in the commit message. Adding a NEW text element is fine: give it a new,
  unique, lowercase dotted key (e.g. `data-copy="story.p4"`) so it becomes editable too.
  Check the key is not already used anywhere in the file.

## What you can change freely

- Everything inside the `<style>` block at the top of `index.html` (colors live in the
  `:root` variables at the start of it). The `2026-09-19 hero rework` block near the end
  of the style is the newest layer and wins over earlier rules.
- Layout markup: sections, containers, grids, order of sections, classes.
- Fixed images (`images/`), such as the top-of-page photo, logos and section photos.
  Optimize first: about 1920px wide for full-width photos, 800px for small ones, JPG
  around 80% quality.

## What you must leave working

These are parts of the page that scripts depend on. You may move or restyle them, but
keep the element, its id or attribute, and its role:

- **Ids used by scripts:** `navbar`, `navLinks`, `navToggle`, `scheduleTitle`, `scheduleMonths`, `scheduleLegend`, `scheduleNote`, `seasonBanner`, `dinnerCta`, `ctaCaution`, `farmstandStatus`, `signupForm`, `signupEmail`, `signupBtn`, `signupMsg`. Do not rename or remove any of these.
- **`id="siteEditEntry"`** on the copyright line in the footer. It is the hidden way into
  edit mode. Keep it as a short, tappable piece of text.
- **Gallery slots (`data-pool-slot="std|wide|tall"`).** The gallery shows a rotating mix
  from a shared photo folder, and each slot must contain one `<img>`. You may change the
  grid around them; keep the attribute and its value (it tells the rotation whether the
  slot wants a landscape, portrait or standard photo).
- **FAQ structure (`.faq-item`, `.faq-question`, `.faq-answer`).** The page's accordion
  and edit mode both look for these classes.
- **The `<script>` blocks at the bottom of the page.** Do not edit them. They load the
  published text, the gallery rotation, the mailing-list form and edit mode. Two of them
  contain functions marked `KEEP BYTE-IDENTICAL` with a copy elsewhere; a test checks
  that, so even a whitespace change breaks it.
- **`edit.js`** in the repo root is generated from Sam's own files and is overwritten on
  his next push. Never edit it here; if something about edit mode needs changing, tell Sam.
- **The farm dinner schedule card** (`scheduleTitle`, `scheduleMonths` and the other
  schedule ids above). The dates, sold-out marks and the on/off-season switch are set from
  the live site's edit screen (Dinner Dates button) and drawn in by a script. Style the card
  freely; do not edit the `SEASON` list or `OFF_SEASON` in the script, they are only a fallback.
- **The farm stand line (`id="farmstandStatus"`, class `farmstand-status`).** Hours and
  closures are set from the edit screen (Farm Stand button). Style it, keep it.
- **Past menus** (the four seasonal menu cards) are deliberately not editable text. Restyle
  them as you like.
- **`picard-briefs/`** is not part of the website; another of Sam's tools publishes it.
  Do not touch it.
- **`picnic-faq.pdf`** is linked from the page and is the only copy
  of those booking terms. Keep the file and its links.
- **The small folders** (`blog-1/`, `contact/`, `gallery/`, `members/` and the `copy-of-...` folders) are redirects from the old Wix addresses. Leave them.
- **Never add a `CNAME` file.** That is a step for the day the real domain moves over;
  adding it early takes the site down.
- `CLAUDE.md` (this file) and `_config.yml` keep these instructions out of the public
  site. Leave both.

## How to work

1. Make the change on a copy first and look at it before committing. Open `index.html`
   in a browser, or serve the folder with `python3 -m http.server 8000` and open
   http://localhost:8000/ . A local copy cannot reach the live text and photos (that is
   expected: it shows the baked-in fallback text and photos), so judge layout, not words.
2. Check it at phone width (about 390px wide) as well as desktop. Most visitors are on
   phones. No sideways scrolling, nothing overlapping, buttons big enough to tap.
3. Commit to `main` with a plain message saying what changed and why
   ("Bigger section headings on phones, per Kelly"). One commit per change.
4. After a minute or two, open the live site (add `?v=` and any number to the address to
   skip the cache) and confirm it looks right, on a phone too. Confirm the dotted
   outlines still appear in edit mode if Kelly can check that.
5. If something went wrong, revert that commit (`git revert`) rather than patching on top
   of it in a hurry, and tell Kelly what happened.

Sam also pushes to this repo from his own setup. His tool checks for changes made here
first and pulls them in, so your work will not be overwritten. You do not need to do
anything special for that, but do not rewrite history (no force-push, no rebasing `main`).

## Not your job here

Words (edit mode on the live site), gallery photos (the shared Google Drive folder),
dinner dates and sold-out status, farm stand hours (edit screen buttons) and anything about who can edit. Those all live outside this repo.

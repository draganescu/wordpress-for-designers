# Demo site: Morrow Coffee Roasters

A seeded WordPress site for demos and videos of WordPress for Designers. It is not part of the plugin and is not in the plugin's package (`tools/package.sh` copies a fixed list of files).

Morrow is a fictional coffee roaster: six coffees, a subscription, a journal. The site is built to show what the plugin is for, so it has dynamic data (a coffee post type with custom fields), synced patterns used on several pages, three style variations that change everything, and six boards.

## Run it

The demo has its own WordPress on port 8900, apart from the development site on 8888 and its tests.

```bash
npm run build
```

```bash
cd demo && npx wp-env start
```

```bash
cd demo && npx wp-env run cli wp wfd-demo seed --yes
```

```bash
cd demo && npx wp-env run cli wp rewrite structure '/%postname%/' --hard
```

- Site: http://localhost:8900, user `admin`, password `password`.
- Boards: http://localhost:8900/wp-admin/admin.php?page=wfd-boards
- **The seed deletes all content of the site it runs on** (pages, posts, coffees, patterns, boards, images, menus, and customised templates and styles) and creates it again. Run it again to reset the demo between takes.
- Stop it with `cd demo && npx wp-env stop`.

## What is in it

| Folder | Holds |
|---|---|
| `theme/morrow/` | The block theme: `theme.json`, templates, the header and footer parts, three style variations in `styles/`, four fonts copied from Twenty Twenty-Five |
| `plugin/wfd-demo/` | The `coffee` post type with its fields, and the `wp wfd-demo seed` command |
| `plugin/wfd-demo/content/` | Everything the seed creates: `manifest.php` (pages, posts, coffees, patterns, menu), `boards.php` (the boards and their notes), and one block markup file per item |
| `plugin/wfd-demo/media/` | 18 photographs and 11 generated images |
| `tools/art.mjs` | Draws the generated images with Chromium |
| `tools/normalize.mjs` | Rewrites every markup file the way the block editor saves it |
| `tools/screenshots.mjs` | Takes the screenshots of the repository's README into `docs/screenshots/` |

### The site

- **Pages:** Home, Subscribe, Our story, Wholesale, Brew guides, Visit, Journal (the posts page), and a draft, "First Frost, winter campaign".
- **Coffees:** six entries of the `coffee` post type, each with an origin, process, tasting notes, roast and price. The `single-coffee` and `archive-coffee` templates show those fields through block bindings.
- **Journal:** five articles.
- **Patterns:** three synced ("Subscribe call to action", "Grower quote", "Newsletter sign-up"), used on several pages each, and four not synced.
- **Style variations:** "Night shift" (dark), "Paper" (serif, editorial), "Citrus" (yellow and cobalt, upper-case headings). Content uses the theme's colour and size presets throughout, so a variation changes every artboard.

### The boards

| Board | Shows | Made for |
|---|---|---|
| Site map | Six pages at desktop width, with notes | The infinite canvas; a whole site at a glance |
| Homepage, every screen | Home at three widths; header and footer at two | One page across devices; template parts |
| Coffee pages, template and live data | The two coffee templates beside browsers on real coffees | Browsers as artboards; a template change reaching every page |
| Journal | The journal and article templates beside browsers | The same, for articles |
| Design system | Seven patterns at desktop and phone width, and the packaging | Global styles; variations |
| First Frost, winter campaign | A draft landing page, a mood board of images, notes | A board per project; images and notes on the canvas |

## Scenes to film

One scene per idea. The caption is the on-screen text.

| # | Board | What happens | Caption |
|---|---|---|---|
| 1 | Site map | Open fitted to all, zoom slowly into Home, pan across to Subscribe | Your whole site on one canvas. Every artboard is the real page. |
| 2 | Site map, then the Boards list | Zoom out, go back to the list, open First Frost | One board for the site. One for each thing you are working on. |
| 3 | Homepage, every screen | Edit the hero heading on Desktop; Tablet and Mobile follow | One page, three widths, edited once. |
| 4 | Design system | Click empty board, change Ember in Colors; switch to Night shift, Paper, Citrus | Change a colour and see everywhere it is used. |
| 5 | Design system | Open Typography, change the heading font; watch use counts | Styles that show you what they touch. |
| 6 | Coffee pages | Edit `single-coffee`: move the price above the title; the three browsers update before saving | Design the template. Check it against real data. |
| 7 | Site map | Edit the synced "Subscribe call to action" on Home; Our story changes too | Change a pattern once. Every page that uses it follows. |
| 8 | Site map | Copy the pricing tiers on Subscribe, paste into Wholesale | Copy from one page, paste into another, without leaving the canvas. |
| 9 | Any | Open Review changes, save | Nothing reaches the site until you say so. |

Reset with the seed command between takes.

## Changing the demo

- **Text and layout:** edit the markup file under `plugin/wfd-demo/content/`, then run `node demo/tools/normalize.mjs` from the repository root with the demo site running, and seed again. `node demo/tools/normalize.mjs --check` changes nothing and fails if a file would be rewritten.
- **In markup files** the site's address is written `https://morrow.test/`, an image is `https://morrow.test/media/{file name}`, and a synced pattern is `"ref":900001` for the first pattern of the manifest, `900002` for the second, and so on. The seed replaces all three.
- **Boards:** `plugin/wfd-demo/content/boards.php`. Positions are board units; a Desktop artboard is 1440 wide.
- **Generated images:** `node demo/tools/art.mjs` from the repository root.
- **README screenshots:** seed the demo, then `node demo/tools/screenshots.mjs` from the repository root. It needs the built plugin (`npm run build`) and takes about four minutes.

## Not done

- **WordPress Playground.** `blueprint.json` at the repository root still starts an empty site. Loading this demo in Playground needs the theme, the demo plugin and the media published where a blueprint can fetch them.
- **Brew guides and Visit** use the least convincing photographs.

## Image credits

The photographs are from the [WordPress Photo Directory](https://wordpress.org/photos/) and are CC0. `plugin/wfd-demo/media/credits.json` lists the page of each one, and the seed writes it into each image's caption. The other images are drawn by `tools/art.mjs`. The fonts are Manrope, Platypi, Ysabeau Office and Fira Code, under the SIL Open Font License, copied from Twenty Twenty-Five.

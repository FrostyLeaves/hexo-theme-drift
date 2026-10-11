# Drift guide

**English** · [简体中文](guide.zh-CN.md) · [Back to the screenshots](../README.md)

[Installation](#installation) · [Configuration](#configuration) · [Diagrams](#diagrams) · [WebP](#webp) · [Development](#development)

<a id="installation"></a>
## Installation

Drift needs Hexo ≥ 7, `hexo-renderer-ejs`, and a Markdown renderer such as `hexo-renderer-marked`. Use a Node.js version supported by your installed Hexo and optional Sharp dependency. The bundled example uses Hexo 8, which requires Node.js ≥ 20.19.

### From source

Run in your existing Hexo site:

```sh
git clone https://github.com/FrostyLeaves/hexo-theme-drift.git themes/drift
npm install hexo-renderer-ejs
```

For WebP conversion, also run `npm install sharp` in the site. Keep using the site's existing package manager; use `pnpm add` for a pnpm site.

To track the theme as a submodule, replace the clone command with:

```sh
git submodule add https://github.com/FrostyLeaves/hexo-theme-drift.git themes/drift
```

When checking out that blog elsewhere, use `git clone --recurse-submodules` or run `git submodule update --init --recursive` after cloning. Install the site's Node dependencies separately.

### From npm, after the first release

The package is not published yet. Once available, npm will be the recommended installation method:

```sh
npm install hexo-theme-drift hexo-renderer-ejs
```

The theme then lives in `node_modules/hexo-theme-drift/`. Use one installation method: move aside a source checkout at `themes/drift` before switching to npm.

### Enable the theme

In your site's `_config.yml`:

```yaml
theme: drift
post_asset_folder: true
highlight:
  auto_detect: false
```

Create `source/categories/index.md` and `source/tags/index.md` with the following front matter, respectively:

```yaml
---
title: Categories
type: categories
---
```

```yaml
---
title: Tags
type: tags
---
```

Keep the usual Hexo archive, category, index, and tag generators installed. The example's [package.json](../example/package.json) shows the full set. Then build and preview:

```sh
npx hexo clean
npx hexo generate
npx hexo server
```

For SVG authoring, follow the [SVG file contract](#svg-contract) in this guide. Remove duplicate site-level copies of the theme plugins, such as `scripts/theme-svg.js`, to avoid registering them twice.

<a id="configuration"></a>
## Configuration

Create `_config.drift.yml` at the **site root** and override only the keys you need. Do not edit the installed theme. All defaults are in [_config.yml](../_config.yml).

```yaml
hero:
  title: My notebook
  subtitle: Notes on code, graphics, and everything between
background:
  style: sky
  styles: [sky, ocean]
  mode: night
  speed: 1
palette:
  home: blue
  post: auto
post:
  toc: true
```

The site's `_config.yml` also accepts overrides under `theme_config:`. For `theme_svg`, `diagrams`, and `webp`, a top-level block in the site configuration takes precedence over the theme defaults.

| Key | Purpose |
| --- | --- |
| `nav` | Navigation labels and paths; labels come from `languages/*.yml`. |
| `hero.enabled / title / subtitle / typing / stats / height` | Home-page opening, title, typing effect, counters, and height. |
| `index.intro / excerpt_length` | Intro when the hero is disabled; card excerpt length. |
| `post.toc / toc_max_depth / show_updated / reading_speed / license_links` | Contents, metadata, reading-time estimates, and license links. |
| `palettes` | Colors and accent for each palette. |
| `palette.home / post / pool / archive / category / tag / page / error` | Palette per page type. `post: auto` selects from `pool` using the first category. |
| `background.enable / style / styles / mode / speed / fps / pixel_filter` | Sky/ocean, initial day/night mode, animation speed, frame cap, and pixel resolution. |
| `juice.tilt / wobble / foil / text` | Card tilt, idle motion, sheen, and animated lettering. |
| `utterances` | GitHub-backed comments. |
| `footer.start_year / links` | Copyright starting year and extra footer links. |
| `favicon` | ICO, PNG, and Apple touch icons. |
| `theme_svg / diagrams / webp` | Bundled build plugins. |

### Appearance and motion

- `sky` and `ocean` each have day and night scenes. Header controls change the scene, mode, and palette; choices persist in the browser. Day/night is not selected from the system color scheme.
- The default palettes are `blue`, `green`, `gold`, and `red`. Add a palette under `palettes`, define its label there or in `languages/`, and include its name in `palette.pool` for automatic post colors.
- A single entry in `background.styles` hides the scene switch. Set `background.enable: false` for a static gradient, also used when WebGL is unavailable.
- `juice.text` accepts `hero`, `titles` (default), or `all`. Set motion options to `false` to disable them. The theme respects reduced motion and pauses the background while the tab is hidden.
- Day-mode colors live under `:root[data-mode="day"]` in `source/css/main.css`. Preserve the three `--color-*` diagram inputs when customizing tokens.

### Article front matter

```yaml
---
title: A rendering notebook
description: A short summary for the article card
categories:
  - Graphics
tags:
  - GPU
palette: gold
toc: true
comments: false
license: CC BY 4.0
---
```

Card summaries use `description`, then content before `<!-- more -->`, then the start of the article. Set `toc: false` or `comments: false` per article. Scene and day/night settings do not support front-matter overrides. Wide tables and code blocks scroll within the article.

### Comments

Install [Utterances](https://utteranc.es/) on the repository used for comments:

```yaml
utterances:
  enabled: true
  repo: your-name/your-comments-repo
  issue_term: title
  label: utterances
```

Comments follow Drift's day/night mode. Built-in site search is not currently provided.

<a id="diagrams"></a>
## Diagrams

The plugins load from the theme's `scripts/`; no separate Hexo diagram plugin is needed. See the [showcase article](../example/source/_posts/theme-showcase.md) for complete examples.

### Theme-aware SVG

With `post_asset_folder: true`, place an SVG in the article's asset directory and embed it with:

```jinja
{% theme_svg 01-pipeline.svg A draw call from CPU recording to GPU execution %}
```

The plugin inlines SVGs, prefixes their IDs, and maps page colors to diagram tokens. This lets one SVG follow both the current palette and day/night mode through CSS, without client-side SVG rewriting or separate image variants. Use the rules below for hand-written diagrams and generated SVGs alike.

<a id="svg-contract"></a>
### SVG file contract

#### Structure and accessibility

- Use an `<svg>` root with `xmlns` set to `http://www.w3.org/2000/svg`, a `viewBox="0 0 W H"`, `class="theme-diagram"`, `data-theme-svg="1"`, `role="img"`, and `aria-labelledby` pointing to the title and, if present, description. Intrinsic `width`/`height` are optional; the theme controls the displayed size.
- Put a non-empty `<title id="…-title">` immediately after the root. A following `<desc id="…-desc">` is recommended. Reference only IDs that exist in `aria-labelledby`.
- Put the canonical `<style>` block after the title/description. Copy the block from the complete example below without changing its formulas. `TOKEN_STYLE` in [lib/theme-svg-contract.js](../lib/theme-svg-contract.js) is the authoritative copy.
- For authored files, prefix every ID with the filename stem: `01-example-title`, `01-example-arrow`, and so on. The plugin adds another prefix when inlining, including when the same SVG appears more than once. Kroki caches receive generated prefixes automatically.
- Use `<text>` for lettering and inherit the font from the token block. Do not set `font-family` on individual elements or convert text into a bitmap.

#### Color rules

These rules apply to `fill`, `stroke`, `stop-color`, `flood-color`, `lighting-color`, and `color`, whether in SVG attributes, inline styles, or stylesheet declarations.

| Use | Rule |
| --- | --- |
| Theme colors | Use `var(--d-*)` tokens. |
| Lighter fills or weaker lines | Derive them from tokens, for example `color-mix(in srgb, var(--d-teal) 9%, var(--d-bg))`. |
| No paint or inherited paint | `none`, `currentColor`, `context-fill`, and `context-stroke` are allowed. |
| Local paint servers | Use `url(#id)` for a gradient or pattern in the same SVG; its colors must follow these rules too. |
| Literal colors | Hex, RGB/HSL, and color names belong only in custom-property definitions inside the canonical token block, or in a `var(--token, fallback)` fallback. Do not add literal colors to shapes or new palette formulas. |

Do not assume a white or dark canvas. Use `--d-ink` or `--d-muted` for readable text, and category colors for fills and lines. A standalone SVG uses the token block's fallback colors; embedded SVGs inherit the page or panel colors. Arrowhead markers can use `fill="context-stroke"` to follow their line color.

#### Content that must not appear

- `<script>`, `<foreignObject>`, `<image>`, or `on*` event attributes.
- External references, including remote `href`, external `url(...)`, and CSS `@import`. Keep paint servers and other references within the SVG.
- Rasterized lettering or shadows. Put screenshots and photos in separate raster assets.
- Diagram SVGs embedded through Markdown images, `<img src="…svg">`, or `{% asset_img …svg %}`. Use `{% theme_svg %}` so the diagram can inherit colors; `asset_img` remains appropriate for raster images.

#### Tokens

The SVG reads `--diagram-*` inputs supplied by the theme/plugin; do not redefine them in the file. Shapes use the derived `--d-*` tokens.

| Input | Source or purpose |
| --- | --- |
| `--diagram-background` | `--color-background`: the page or local panel background. |
| `--diagram-text` | `--color-text`: primary text and outlines. |
| `--diagram-accent` | `--color-accent-1`: the active palette accent. |
| `--diagram-teal`, `--diagram-blue`, `--diagram-purple`, `--diagram-orange` | Optional `--color-diagram-*` category colors; otherwise the canonical formulas derive them. |
| `--diagram-font` | Optional font stack inherited from the theme/container; defaults to a system sans-serif stack. |

| Derived token | Purpose |
| --- | --- |
| `--d-bg / --d-ink / --d-accent` | Background, primary ink, and accent. |
| `--d-muted` | Secondary text and guides: 68% ink mixed with the background. |
| `--d-border` | Borders: 19% ink. |
| `--d-surface` | Subtle panel fill: 3% ink. |
| `--d-shadow` | Shadow: 35% black mixed with the background. |
| `--d-teal / --d-blue / --d-purple / --d-orange` | Category fills and lines. |

Drift provides all seven color inputs and overrides the background on article diagram panels. The plugin transitions fills and strokes when colors change, while respecting reduced motion. If adapting the plugin to another theme, map differently named variables through `theme_svg.css_variables` (`background`, `text`, `accent`, `teal`, `blue`, `purple`, `orange`). Set colors on the theme or container rather than editing individual diagrams.

#### Complete starter SVG

Save this as `01-example.svg` in the article's asset directory. Its `<style>` block is the canonical token block, including standalone fallback colors.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 280"
     class="theme-diagram" data-theme-svg="1" role="img"
     aria-labelledby="01-example-title 01-example-desc">
<title id="01-example-title">Theme-aware SVG</title>
<desc id="01-example-desc">A panel and its text inherit the current theme colors.</desc>
<style>
.theme-diagram {
  --d-bg: var(--diagram-background, #ffffff);
  --d-ink: var(--diagram-text, #383838);
  --d-accent: var(--diagram-accent, #2bbc8a);
  --d-muted: color-mix(in srgb, var(--d-ink) 68%, var(--d-bg));
  --d-border: color-mix(in srgb, var(--d-ink) 19%, var(--d-bg));
  --d-surface: color-mix(in srgb, var(--d-ink) 3%, var(--d-bg));
  --d-shadow: color-mix(in srgb, #000000 35%, var(--d-bg));
  --d-teal: var(--diagram-teal, color-mix(in srgb, var(--d-accent) 76%, var(--d-ink)));
  --d-blue: var(--diagram-blue, color-mix(in srgb, var(--d-accent) 28%, #6c91bc));
  --d-purple: var(--diagram-purple, color-mix(in srgb, var(--d-accent) 15%, #a18ab9));
  --d-orange: var(--diagram-orange, color-mix(in srgb, var(--d-accent) 10%, #d3a462));
  font-family: var(--diagram-font, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
}
.theme-diagram text { font-family: inherit; }
</style>
<rect width="1080" height="280" fill="var(--d-bg)"/>
<rect x="36" y="36" width="1008" height="208" rx="8"
      fill="var(--d-surface)" stroke="var(--d-border)" stroke-width="1.3"/>
<text x="68" y="112" font-size="30" fill="var(--d-ink)">Theme-aware SVG</text>
<text x="68" y="162" font-size="20" fill="var(--d-muted)">One diagram, every palette.</text>
</svg>
```

Embed it with `{% theme_svg 01-example.svg A diagram that follows the theme %}`. A larger [pipeline example](../example/source/_posts/theme-showcase/01-pipeline.svg) includes a timeline and arrows.

For more complex diagrams, start with a 1080-unit-wide canvas, 36-unit margins, text at least 17 units high, 30-unit titles, 8-unit corner radii, and 1.3-unit outlines. Prefer tokens over literal colors in generation scripts as well; for example, `INK = 'var(--d-ink)'`. Do not rasterize text to preserve its appearance.

#### Standalone colors and validation

Keep `theme_svg.strict: true` in committed configuration. Validation runs during the build and reports detected violations; use the full authoring rules above when reviewing a diagram. `strict: false` is only a troubleshooting aid. Live diagrams follow the page palette; standalone/downloaded SVGs use `theme_svg.colors`:

```yaml
theme_svg:
  strict: true
  colors:
    background: '#222426'
    text: '#e6e4e0'
    accent: '#f3b958'
    teal: '#4bc292'
    blue: '#009dff'
    purple: '#8867a5'
    orange: '#f3b958'
```

Run the validator from the **site root**, using the path for your installation:

```sh
# Source installation
node themes/drift/tools/check-theme-svg.js

# npm installation
node node_modules/hexo-theme-drift/tools/check-theme-svg.js
```

Default targets are `source/_posts` and `source/_diagrams`; explicit files or directories are also accepted. A nonzero exit code means validation failed. Files outside the diagram cache without `data-theme-svg="1"` are reported as skipped, so confirm the checked count includes every diagram you intended to validate. `--update-tokens` replaces token blocks with the canonical version before validating.

<a id="svg-contract-maintenance"></a>
#### Maintaining the contract

When changing token formulas or validation rules, update both language guides, `TOKEN_STYLE` and `validate` in `lib/theme-svg-contract.js`, and the token templates in any generation scripts in the same change. Refresh existing diagram token blocks with `--update-tokens`, remove affected `source/_diagrams/` caches, run `hexo clean`, and rebuild to regenerate and validate them. For the bundled example, those paths are under `example/`. Commit the regenerated caches together with the rule change.

### ditaa

Text after the fence language becomes the caption:

````markdown
```ditaa Free list
+--------+     +--------+
| 8B     |---->| 16B    |
| cE99   |     | c6B8   |
+--------+     +--------+
```
````

The first build requests a render from Kroki, normalizes and validates its SVG, and stores it in `source/_diagrams/ditaa/`. Commit this cache so later builds do not need the rendering service. A network failure leaves the fence as code and logs a warning.

```yaml
diagrams:
  enable: true
  server: https://kroki.io
  languages: [ditaa]
  cache_dir: source/_diagrams
  timeout: 30000
```

Changing a fence creates a new cache file. To regenerate an unchanged diagram, delete its cache file and run `hexo clean` before rebuilding. Other Kroki languages can be added to `languages` and use the same normalization rules.

<a id="webp"></a>
## WebP

Sharp is optional. For source installations, run `npm install sharp` in the site; npm installations include it as an optional dependency. If it cannot load, the plugin logs the error and keeps the original images.

```yaml
webp:
  enable: true
  quality: 82
  max_width: 1600
  min_size: 30720
  extensions: [jpg, jpeg, png]
  exclude: []
```

Eligible JPEG/PNG files become WebP during generation; matching `asset_img`, `asset_link`, and Open Graph references are updated. Source files stay intact. Small images and favicons are skipped. `exclude` accepts regular expressions matched against output paths.

<a id="development"></a>
## Development

```sh
git clone https://github.com/FrostyLeaves/hexo-theme-drift.git
cd hexo-theme-drift/example
npm install
npm run server
```

The example contains demonstration content only. Its `prebuild` and `preserver` hooks run `link-theme.js`, which links `themes/drift` to the repository root: a relative symlink on macOS/Linux, a junction on Windows. Repeated calls keep a correct link; a former copied directory is preserved as `drift.backup-<timestamp>` before replacement. `npm run link:theme` runs it explicitly; `npm run sync` is an alias.

Edit the root `source/`, `layout/`, `languages/`, or `_config.yml` and refresh the browser. Restart after editing plugins in `scripts/` or `lib/`. The example's `ignore` rule excludes the linked theme's nested `example/` to prevent recursive watching. `themes/`, `public/`, and `node_modules/` stay out of Git.

Run from `example/`:

```sh
npm run clean
npm run build
npm run check:svg
```

Run `npm pack --dry-run` at the repository root to inspect package contents. Before a release, install the generated `.tgz` in a clean Hexo site and verify its pages and plugins as well as the linked demo.

### Source map

| Path | Purpose |
| --- | --- |
| `layout/` | EJS templates and partials. |
| `source/css/` | Layout, palettes, day/night tokens, and fonts. |
| `source/js/theme.js` | Controls, card effects, reading interactions, and comments. |
| `source/js/background.js` | WebGL sky/ocean scenes. |
| `scripts/` | Hexo helpers, filters, and build plugins. |
| `lib/theme-svg-contract.js` | Canonical SVG tokens and validation. |
| `example/` | Local demo and build fixtures. |
| `docs/images/` | Browser screenshots shared by both READMEs. |

For a new background scene, update `SCENES` in `source/js/background.js`, scene registration in `scripts/helpers.js`, the header icon, and translations. For fonts, edit `source/css/fonts.css` and `--font-pixel`; integer multiples of the pixel font's native size stay sharp.

```sh
python tools/make-pixel-font.py --src /path/to/zh_hans.ttf
python tools/make-favicon.py --star '#009dff'
```

### Troubleshooting and upgrades

- A `sharp` warning may mean the dependency is absent or failed to load. Read the error and verify its runtime/platform compatibility.
- After deleting diagram caches, run `hexo clean` so old rendered content is not reused.
- `hexo server -s` serves a static snapshot; restart after theme or plugin changes.
- Upgrading from the earlier `doubleye` name requires `theme: drift` and renaming the site's override file to `_config.drift.yml`. Existing browser choices migrate when no new Drift choice is saved.
- Version 2.0 removed `default_mode`, `panel`, `diagram_panel`, and `hero.image`. Use `background.mode` for the initial day/night mode.

## Credits and license

Theme code is [MIT](../LICENSE). [Fusion Pixel](../source/fonts/FusionPixel-LICENSES.txt) and [Maple Mono](../source/fonts/OFL.txt) subsets retain SIL OFL 1.1 licenses. The visual direction is inspired by Balatro; no game assets are included. The theme uses EJS, plain CSS, and browser JavaScript, without jQuery or an icon font.

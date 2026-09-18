# CLAUDE.md

This file provides guidance for working on the frontend of this repository.

## Project overview

This is a no-build, static web app (`index.html`, `styles.css`, `script.js`). There is no bundler,
framework, or package manager — just plain HTML/CSS/JS opened directly in the browser. State is
persisted to `localStorage`. Keep changes consistent with this simplicity: avoid introducing build
tooling, frameworks, or external dependencies unless explicitly requested.

## Frontend aesthetics

DISTILLED_AESTHETICS_PROMPT = """
Design a clean, modern, data-dense scoreboard UI with a soft blue/neutral palette.

Color palette (defined as CSS custom properties in `:root`):
- Background: light cool gray (`--bg: #f5f7fb`)
- Surfaces (cards, tables): white (`--surface: #ffffff`)
- Primary actions: blue (`--primary: #2f5bea`, hover `#264bc2`)
- Secondary actions: slate gray (`--secondary: #586174`, hover `#454d5d`)
- Destructive actions: red (`--danger: #bf1f34`, hover `#9f1729`)
- Text: near-black (`--text: #21262f`); muted/secondary text: gray (`--muted: #626b7a`)
- Borders/dividers: light blue-gray (`--line: #dce2ee`)
- Alternating table rows: very light blue (`--row-alt: #f9fbff`)

Typography:
- System font stack led by Inter, falling back to system-ui and standard sans-serif fonts.
- Headings are unadorned (no extra weight/letter-spacing tricks); body copy uses muted gray for
  secondary text like descriptions and help text.

Layout:
- Centered single-column app shell, `max-width: 1100px`, with modest padding.
- Controls area uses flexbox with wrapping, generous gaps (`0.5rem`–`1rem`), and
  space-between alignment so it degrades gracefully on narrow screens.
- Data lives in a scrollable table with a sticky header (`position: sticky; top: 0`) inside a
  bordered, rounded `table-wrapper` card.

Components:
- Buttons: solid fill, no border, rounded corners (`0.45rem`), bold text, subtle darker hover
  state. Use color to communicate intent — blue for primary/add actions, gray for
  secondary/neutral actions, red for destructive actions (remove/reset/clear).
- Inputs: white background, light border, rounded corners matching buttons, comfortable padding.
- Table rows: zebra-striping via `--row-alt`; section/subtotal rows get a light blue highlight
  and bold text; the grand-total row gets the strongest highlight and largest/boldest text to
  draw the eye to the final score.
- Small utility classes handle accessibility (`.visually-hidden`) and empty states (muted,
  italic centered text).

Responsiveness:
- A single breakpoint (`max-width: 700px`) switches control rows from inline/auto-width to
  stretched, full-width stacked buttons and inputs so touch targets remain large on mobile.

Overall feel: understated "productivity tool" aesthetic — flat colors, soft rounded corners,
clear visual hierarchy through weight and background shading rather than shadows or gradients,
and functional/dense-but-readable tabular data presentation.
"""

## Guidelines for frontend changes

- Reuse the existing CSS custom properties (`--primary`, `--danger`, `--secondary`, `--muted`,
  `--line`, etc.) instead of hardcoding new colors.
- Match existing spacing scale (multiples of `0.05rem`–`0.5rem`) and border-radius (`0.45rem`
  for buttons/inputs, `0.5rem` for containers).
- Keep destructive actions styled with `--danger` and confirm before destructive operations
  (see `Reset Scores` and `Start New Game` behavior in `script.js`).
- Preserve accessibility affordances already in place: `aria-label`, `aria-describedby`,
  `scope="col"`, and the `.visually-hidden` caption pattern.
- Keep the app framework-free and dependency-free unless explicitly asked to introduce one.

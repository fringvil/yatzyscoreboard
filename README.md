# Yatzy Scoreboard

A simple, single-page Yatzy scoreboard built with plain HTML, CSS, and JavaScript.

## Features

- Add and remove players
- Scorecard with standard Yatzy categories
- Editable score inputs per category and player
- Automatic live calculation of:
  - Upper sum
  - Bonus (50 points when upper sum is at least 63)
  - Upper total
  - Lower total
  - Grand total
- Reset scores with confirmation
- Start a new game (clears players and scores)
- Local storage persistence so refresh does not lose the current game
- Responsive layout with sticky table header

## Run locally

No build step is required.

1. Clone or download this repository.
2. Open `index.html` in a web browser from the project root.

You can also host the files with GitHub Pages.

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that automatically publishes the site to GitHub Pages on every push to `main`.

To enable it:

1. Push (or merge) a commit to the `main` branch, or manually trigger the workflow from the **Actions** tab (**Deploy to GitHub Pages** > **Run workflow**).
2. The workflow will enable GitHub Pages for the repository automatically on its first run if needed.
3. Once the workflow completes, the site will be available at the URL shown on the **Settings** > **Pages** page (typically `https://<owner>.github.io/<repo>/`).

No build step is required since this is a static site; the workflow simply uploads the repository root as the Pages artifact.

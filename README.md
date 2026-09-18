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
- **Optional pre-game betting**: tie a household task (or a custom task) to a Yatzy
  category, with normal/double/triple stakes. Bets resolve automatically as scores
  are entered — a successful score wins the bet, a zero score loses it and logs the
  task in the Task Log.
- **Task Log**: a persistent log of tasks owed from lost bets, with buttons to mark
  them completed or forgiven. Hidden entirely when betting is off.
- **Optional digital dice**: a 5-die roller with hold/release per die, a 3-roll-per-turn
  counter, and a one-click button to apply the current roll's computed score directly
  into the active player's scorecard cell for any category.
- A pre-game setup lobby to add players and toggle betting/digital dice before
  locking in and starting the game (settings can be reopened with "Edit Setup").

## Run locally

No build step is required.

1. Clone or download this repository.
2. Open `index.html` in a web browser from the project root.

You can also host the files with GitHub Pages.

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that automatically publishes the site to GitHub Pages on every push to `main`.

To enable it:

1. In the GitHub repository, go to **Settings** > **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push (or merge) a commit to the `main` branch, or manually trigger the workflow from the **Actions** tab (**Deploy to GitHub Pages** > **Run workflow**).
4. Once the workflow completes, the site will be available at the URL shown on the **Settings** > **Pages** page (typically `https://<owner>.github.io/<repo>/`).

No build step is required since this is a static site; the workflow simply uploads the repository root as the Pages artifact.

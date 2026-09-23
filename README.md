# TARO Mini App Static Deployment

This folder is self-contained for static hosting.

Runtime files:

- `index.html`
- `app.js`
- `app-logic.js`
- `styles.css`
- `assets/meta/cards_index.json`
- `assets/cards/*.jpg`

## Local Test

From the project root:

```bash
cd /path/to/TARO
python3 -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000/miniapp/index.html?recipe_id=card_of_the_day&role=morning_card
```

## GitHub Pages

Simple manual deployment:

1. Create or use a public GitHub repository.
2. Copy the contents of this `miniapp/` folder to the repository root.
3. Commit and push to `main`.
4. In GitHub, open Settings -> Pages.
5. Choose "Deploy from a branch".
6. Select `main` and `/root`.
7. Wait for the GitHub Pages URL.
8. Test the published page.

If the repository is named `taro-miniapp`, the bot can use:

```text
TARO_MINIAPP_URL=https://USERNAME.github.io/taro-miniapp/
```

If `index.html` is placed in a subfolder instead, include that path in the URL.

Do not publish environment files, bot tokens, Gemini keys, logs or local database files.

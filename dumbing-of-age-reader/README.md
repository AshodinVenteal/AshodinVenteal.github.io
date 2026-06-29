# Dumbing of Age Infinite Reader

Static GitHub Pages reader for Dumbing of Age.

## Build the Archive

```powershell
node build-archive.mjs
```

The script reads the public comic RSS feed and writes `data/comics.json`.

## Run Locally

```powershell
python -m http.server 8123
```

Open `http://localhost:8123/`.

## Hosted Behavior

The reader uses the generated archive for dates, titles, images, hover text, and comment counts. Opening a comic lazy-loads the official Dumbing of Age comments section for that strip in an iframe.

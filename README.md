# Depth Layer

An interactive descent. You move down through a wall, one layer at a time. The wall
watches how you move — your pace, where you linger, whether you look back, how deep
you go — and at the bottom it reads you back to yourself.

> "You went below zero. The wall was not enough for you."

No accounts, no tracking servers, no install. Open it and descend.

## Run locally

It's a static site. Any static server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Structure

- `index.html` — the experience
- `engine/` — audio, input, behavioral tracking, reading generation
- `experiences/default.json` — the default descent

Readings are generated locally by a template engine; no network calls are required.

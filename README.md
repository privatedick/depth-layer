# Depth Layer

**▶ Live: https://privatedick.github.io/depth-layer/**

An interactive descent. You move down through a wall, one layer at a time. The wall
watches how you move — your pace, where you linger, whether you look back, how deep
you go — and at the bottom it reads you back to yourself.

> "You went below zero. The wall was not enough for you."

No accounts, no servers, no install. Open it and descend.

## Controls

The wall responds to whichever you use first — pick one and it commits to it:

- **Drag** (mouse or touch) — pull yourself down
- **Scroll** — wheel to descend
- **Tilt** (mobile) — device orientation, after you grant motion access

## Run locally

It's a static site. Any static server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Structure

- `index.html` — the experience
- `engine/` — audio synthesis, input, behavioral tracking, reading generation
- `experiences/default.json` — the default descent (JSON-driven; add your own)

## Privacy

Readings are generated **locally** by a template engine — no network calls, nothing
leaves your device. An optional Anthropic-LLM reading path exists in the code but is
**off by default**; it only activates if an endpoint/key is explicitly configured, in
which case anonymous behavioral signals (pace, depth, lingering) would be sent to that
endpoint. The live site above runs fully local.

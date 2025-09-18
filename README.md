# Spicetify Queue Manager

Do you hate it when Spotify randomly decides your queue is gone — or just want to manage queues more easily? Spicetify Queue Saver snapshots your current queue (including local files), lets you restore it later, and export snapshots to playlists.

## What it does
- Save your current queue as named snapshots
- Automatically create snapshots on a schedule or when the queue changes
- Restore a snapshot to replace your current queue
- Export any snapshot to a playlist
- Manage all snapshots in a simple queue manager UI
- Works with local files (not only the Web API)

## Why
Spotify can sometimes clear or reshuffle your queue unexpectedly. This extension preserves your listening state by periodically recording `Spicetify.Queue` and providing quick restore/export actions.

## Status
Early development. Core features are being built and refined.

## Development
Requires Spicetify and pnpm.

```bash
pnpm install
pnpm watch   # or: pnpm build
```

This project is built with Spicetify Creator and outputs to `dist/`.

## Notes
- Local files are supported by reading from `Spicetify.Queue`, so snapshots include tracks beyond the Web API scope.
- If something looks off, open DevTools and inspect `Spicetify.Queue` to help debug.

## License
MIT
<div align="center">

<h1>Queue Manager</h1>

Do you hate it when Spotify randomly decides your queue is gone — or just want to manage queues more easily? Spicetify Queue Manager snapshots your current queue (including local files), lets you restore it later, and export snapshots to playlists.

| | |
|---|---|
| <img height="750" alt="image" src="https://github.com/user-attachments/assets/f0802551-2acd-4bcd-8f8d-2bb33ef3e95a" /> | <img width="488" height="499" alt="image" src="https://github.com/user-attachments/assets/114a00cc-4571-41fc-9f62-3d8b139318d3" /> |
| Main interface | Settings |

</div>

## Status
🚧 Beta. Core features are implemented and undergoing polish.

For changes, see [CHANGELOG.md](https://github.com/D3SOX/spicetify-queue-manager/blob/master/CHANGELOG.md)

## Installation
- Open the [Spicetify Marketplace](https://github.com/spicetify/marketplace/wiki/Installation).
- Search for "Queue Manager" (You might have to click on "Load more" first)
- Install & reload

## What it does
- Save your current queue as named snapshots
- Automatically create snapshots on a schedule or when the queue changes
- Restore a snapshot to replace your current queue
- Export any snapshot to a playlist
- Manage all snapshots in a simple queue manager UI
- Works with local files (not only the Web API)

## Why
Spotify can sometimes clear or reshuffle your queue unexpectedly. This extension preserves your listening state by periodically recording `Spicetify.Queue` and providing quick restore/export actions.

## Development
Requires Spicetify CLI and pnpm.

```bash
pnpm install
pnpm watch   # or: pnpm build
spicetify apply -n
```

This project is built with [Spicetify Creator](https://spicetify.app/docs/development/spicetify-creator)

## Notes
- If something looks off, open DevTools and inspect `Spicetify.Queue` to help debug.

## License
[GNU General Public License v3.0](./LICENSE)

<div align="center">

<img width="250" alt="image" src="https://github.com/user-attachments/assets/9c9c1031-c7a3-4bfb-a498-8f80f7fc7999" />


<h1>Spicetify Queue Manager</h1>


This extension probably serves a kinda niche purpose but if you are like me and always queue a bunch of songs, swap them around, want to play a different genre or mood but still retain the same queue for later, this is for you.

It also helps when Spotify forgets your queue or reshuffles it unexpectedly.

With this extension you can manage queues more easily. It snapshots your current queue, lets you restore it later, and export snapshots to playlists.

This can be done by:

- Automatically capturing snapshots on a schedule or when the queue changes.
- Manually creating snapshots
- Creating synced snapshots that automatically stay in sync with your queue, allowing you to switch between different ones and have your queue instantly replaced with the one from the snapshot (including playback position).

The extension adds an icon to the topbar right side of the player. Clicking it opens a modal with all the snapshots and allows you to manage settings for customizing the behavior of the extension. (see below)
There is also a hotkey of `Ctrl+Alt+Q` to open it.

| | |
|---|---|
| <img height="750" alt="image" src="https://github.com/user-attachments/assets/f0802551-2acd-4bcd-8f8d-2bb33ef3e95a" /> | <img width="488" height="499" alt="image" src="https://github.com/user-attachments/assets/114a00cc-4571-41fc-9f62-3d8b139318d3" /> |
| Main interface | Settings |


</div>

## Status

🚧 Late Beta. Core features are implemented and undergoing polish. Beta testing would be appreciated.

For changes, see [CHANGELOG.md](https://github.com/D3SOX/spicetify-queue-manager/blob/master/CHANGELOG.md)

## Installation

- Open the [Spicetify Marketplace](https://github.com/spicetify/marketplace/wiki/Installation).
- Search for "Queue Manager" (You might have to click on "Load more" first)
- Install & reload

## Development

Requires [Spicetify CLI](https://spicetify.app) and [Bun](https://bun.sh).

```bash
bun install
bun run build   # or: bun watch
spicetify extensions queue-manager.js
spicetify apply -n
```

This project is built with [Spicetify Creator](https://spicetify.app/docs/development/spicetify-creator)

## Notes

- If something looks off, open DevTools and inspect the console log any errors and send the contents of `Spicetify.Queue` to help debug.

## License

[GNU General Public License v3.0](./LICENSE)

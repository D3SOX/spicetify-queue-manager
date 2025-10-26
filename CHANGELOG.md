# Changelog

This documents the user-facing changes for each version

## 0.6.3

- Enable prompting for manual snapshot before replacing queue by default
- Reduce max automatic snapshots by default to 15
- Add a description to the queue max size setting

## 0.6.2

- Reduce queue nearly full warning toast duration to 15 seconds

## 0.6.1

- Fix interaction when settings are collapsed

## 0.6

- Queue capacity watcher now only sends notifications when the queue size has actually increased
- Appending songs to queue now filters out songs that are already in the queue
- Add a button to clear all automatic snapshots
- Small UI improvements (collapsible settings, tooltips)
- Add support for multiple languages. Supports English, German, Spanish and French and can be changed in settings

## 0.5.1

- Fix manual snapshot getting saved with custom name when not changing it from the default

## 0.5

- Import settings and snapshots
- Append snapshots to queue
- Update UI icons and layout

## 0.4.4

- Correct duplicate detection for auto snapshots

## 0.4.3

- Fix playback of first track while replacing queue when it's a local file

## 0.4.2

- Make buttons have unique tones in snapshot before replacing queue prompt

## 0.4.1

- Show a progress bar on toasts

## 0.4

- Fix notifications by using custom toasts
- Option to cancel replacing the queue

## 0.3.1

- Inline name editing
- Prettier custom dialogs for confirmation and prompt

## 0.3

- Add prompt for manual snapshot before queue replacement and deletions
- Small UI improvements

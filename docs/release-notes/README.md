# Release notes page

Published artifact: https://claude.ai/code/artifact/f4c8f327-7303-4fb4-a9a1-91e42ad1d93d — also served at https://bebe.fyi/notes/ (built from this folder on every deploy).

Keep this page updated whenever the app changes in a way a user would notice.

1. Add a release entry to `index.html` (chronological, newest at the bottom; bump the "releases" count in the header facts).
2. `node seed-demo.mjs` if the demo household needs fresh "today" data (entries are anchored to now).
3. `npm i --no-save playwright-core && node shoot.mjs` to re-capture current screens into `shots/`.
4. Republish `index.html` to the artifact URL above with the `shots/*.png` files attached.

Demo household id: `demo-release-notes-Xk29Qp7Lm3RtVw` (made-up data, not the family's log).

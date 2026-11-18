# Backups

Two layers, both free on the Spark plan.

## Settings history (in the app)
Every time settings are saved, the version being replaced is kept in
`households/<id>/settings_history/<epoch ms>` as `{ saved_at, by, previous, changed }`.
To undo a bad change, copy `previous` from the right record back over `settings/main`.

## Nightly backup on a Mac
`scripts/backup.mjs` downloads a whole household (settings, settings history, entries, weights,
appointments) into a dated JSON file in the same shape as the app's "Backup everything (JSON)".

```bash
node scripts/backup.mjs "https://bebe.fyi/h/<household id>" "$HOME/Documents/bebe backups" 90
```

To run it every night at 3 AM, save this as `~/Library/LaunchAgents/fyi.bebe.backup.plist`
(full paths; `which node` for the first one), then
`launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/fyi.bebe.backup.plist`.
If the Mac is asleep at 3 AM, macOS runs it when it wakes.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>fyi.bebe.backup</string>
  <key>ProgramArguments</key><array>
    <string>/path/to/node</string><string>/path/to/bebe/scripts/backup.mjs</string>
    <string>https://bebe.fyi/h/YOUR-HOUSEHOLD-ID</string><string>/Users/you/Documents/bebe backups</string><string>90</string>
  </array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/Users/you/Documents/bebe backups/backup.log</string>
  <key>StandardErrorPath</key><string>/Users/you/Documents/bebe backups/backup.log</string>
</dict></plist>
```

Stop it with `launchctl bootout gui/$(id -u)/fyi.bebe.backup` and delete the plist.
The household link is the key to the data: keep it in the plist, never in the repo.

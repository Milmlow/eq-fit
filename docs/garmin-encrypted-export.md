# Private Garmin running export (manual first version)

The GitHub Garmin connection check has passed. The next step deliberately
**does not** publish activity data to the EQ Fit website or GitHub repository.

## One-time setup

1. In repo **Settings > Secrets and variables > Actions > Secrets**, keep the
   existing `GARMIN_PERSONAL_API_KEY` as a **secret**.
2. Add a second, **different** secret called `EQFIT_EXPORT_PASSPHRASE`. Use a
   strong passphrase of **16+ characters** you can remember or safely store
   in your password manager. This is NOT your Garmin API key.
3. You will need the passphrase on your own computer to decrypt the file.
   GitHub does not offer a way to read back a saved secret.

## Export

1. Once this feature is merged, open **Actions > Export Garmin runs (encrypted)**.
2. Choose **Run workflow**, `main`, and **7, 30, 90 or 365 days**.
3. Wait for a green tick; open the run and download
   `garmin-runs-encrypted` under **Artifacts**.
4. Extract the ZIP to your computer. The contained `garmin-runs.eqfit`
   is encrypted, not an importable CSV. In a public repository, anyone
   who can access artifacts may also be able to download the encrypted file.
   The contents are protected by the separate passphrase, not by GitHub visibility.
   Retention is one day.

## Decrypt and import (on your computer)

Install Python 3.12+ and `py -3 -m pip install cryptography`.

From a local checkout of EQ Fit, run:

```powershell
py -3 scripts/decrypt_garmin_export.py "C:\path\garmin-runs.eqfit" --output "C:\path\garmin-runs.csv"
```

Enter the **EQ Fit export passphrase**, not the Garmin key. Open the EQ Fit
app in your usual browser > More > Import and select `garmin-runs.csv`.
Review the preview before saving. This uses existing local-first CSV
import; the browser never sees your Garmin secret.

**Important:** The existing importer's duplicate detection is based on CSV
row contents, not Garmin activity IDs across formats. If you have already
imported a Garmin Connect Activities.csv export covering the same dates,
do **not** import overlapping runs until a cross-source activity-ID
reconciliation feature has been implemented and tested. Use a later,
non-overlapping date range or a separate test browser profile for now.
The new export includes a `Garmin Activity ID` column for future stable dedupe.

## Safety and limitations

- Garmin activities are fetched only when you manually run the workflow.
- GitHub workflows do not run inside your browser, and the app does not have
  access to the Actions secret.
- Running summaries include running, trail/track/ultra and treadmill/indoor
  categories. Other sports are ignored in this initial export.
- Pace is derived from Garmin average speed when present. No missing values
  are filled with guesses.
- This is **not** automatic sync, nor a fully end-to-end tested release.
- Exporting 365 days may require multiple API pages; Garmin availability
  and rate limits are not under EQ Fit's control.
- Keep the decrypted CSV and GitHub encrypted download private. Delete
  decrypted copies when no longer needed.
- Do not upload a Garmin CSV to an issue, a PR, an artifact or a public Pages
  folder. The only workflow artifact is the encrypted file.

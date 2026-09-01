# Scripts

## smoke_call.py

A manual, live end-to-end smoke test for the Hunar Voice integration.

**This is NOT a pytest test and is never run in CI.** It dials a REAL
phone number using a REAL `HUNAR_API_KEY`. Only run it yourself, by hand,
when you want to confirm the Hunar integration works end-to-end.

It will:

1. Create a minimal "Smoke Test Screen" agent via the Hunar API.
2. Place a single outbound call to the number you pass with `--to`.
3. Poll the call status every few seconds until it reaches a terminal
   state (`COMPLETED`, `NOT_CONNECTED`, `FAILED`, or `CANCELLED`), or
   until a timeout is hit.
4. Print the final call JSON (status + extracted result).

### Prerequisites

- A real `HUNAR_API_KEY` set in `backend/.env` (the script reads
  configuration the same way the app does, via `app.config.get_settings()`).
- A phone you can actually answer, since this will really ring it.

### Run it

```bash
cd backend
python scripts/smoke_call.py --to +918837518407
```

Optional flags: `--lang`, `--persona`, `--name`, `--company`,
`--poll-interval`, `--timeout`, `--from-number`. Run with `--help` for
the full list.

### Expected outcomes

- **Success**: the script prints status transitions ending in
  `status=COMPLETED`, followed by the final call JSON including the
  extracted `result`.
- **Minutes exhausted (402)**: the script prints a clear message that
  the Hunar account is out of minutes and exits `0` — this still
  confirms the API key and request path are correct.
- **Any other error**: the script prints the HTTP status and response
  body and exits non-zero.

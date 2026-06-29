# Store listings

Versioned App Store + Google Play assets for **uoplan.party**, kept alongside the
marketing video so copy and screenshots stay in sync with each release.

```
store-listings/
  ios/
    descriptions.md                 # App Store Connect copy (name, subtitle, keywords, description, review notes)
    screenshots/
      iphone-6.9/   01..05 *.png    # 1320 × 2868  (iPhone 6.9")
      ipad-13/      01..05 *.png    # 2064 × 2752  (iPad Pro 13")
  android/
    descriptions.md                 # Google Play copy (short + full description)
    icon-512.png                    # 512 × 512 hi-res icon
    feature-graphic.png             # 1024 × 500 feature graphic
    screenshots/
      phone/        01..05 *.png
      tablet-7/     01..05 *.png
      tablet-10/    01..05 *.png
    release/
      *.aab                         # signed bundle — GITIGNORED (large release artifact)
```

## The five screens

Every bucket uses the same five screens, in order:

| #   | File                  | Screen                          |
| --- | --------------------- | ------------------------------- |
| 1   | `01-weekly-schedule`  | Generated weekly timetable      |
| 2   | `02-course-explorer`  | Course / professor explorer     |
| 3   | `03-grade-trends`     | Grade trends & distributions    |
| 4   | `04-course-detail`    | Course detail (evals, grades)   |
| 5   | `05-personalize-plan` | Personalize / requirements step |

## Store size requirements

- **App Store** — iPhone 6.9": 1320 × 2868 (portrait). iPad 13": 2064 × 2752.
- **Google Play** — phone & tablet screenshots (min 320 px, max 3840 px, ≤ 8 each);
  icon 512 × 512 (32-bit PNG); feature graphic 1024 × 500.

## Regenerating screenshots

Screenshots (and the ad's app-flow videos) are produced by the automated capture
harness in [`../scripts/capture`](../scripts/capture). It seeds each platform to a
deterministic populated state via the `?s=` URL encoding, then captures every device
bucket. See that folder's notes for the per-platform commands and the (documented but
not-yet-wired) CI path.

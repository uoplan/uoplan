# Feedback survey

The website displays a one-time invitation to give feedback through a bilingual Google Form. The survey covers university, faculty or field, study level, program year, usage frequency, use cases, strengths, frustrations, other planning tools, and written suggestions or bug reports.

## How it works

`FeedbackSurveyModal` mounts in the web root layout, so it works across routes and both schools. It checks localStorage after mounting to avoid displaying the modal in prerendered HTML. Closing with the close button, Escape, backdrop, or dismissal button saves the decision. Opening the survey also dismisses and saves before following the link in a new tab.

The decision persists across reloads and future visits in the same browser. Clearing site storage or using another browser makes the invitation appear again. If browser storage is blocked, dismissal still works for the current mounted session, but cannot persist across reloads.

The survey also appears as a blue option in the rotating home-page top banner. Visitors can return to the form after dismissing the modal. It follows the existing banner rotation, pause, reduced-motion, analytics, and session dismissal behavior; its link opens in a new tab.

## How to change it

Edit `apps/web/src/components/shared/FeedbackSurveyModal.tsx` for the prompt and `apps/web/src/lib/feedbackSurvey.ts` for the shared respondent URL. The banner option lives in `homeBanners.tsx`; its dynamic translation IDs are registered in `scripts/i18n/dynamic-keys.ts`. Change the corresponding `feedbackSurvey.*` messages in both Lingui catalogs for copy. Keep the storage key stable unless intentionally inviting everyone to a new survey. Browser tests cover dismissal, remounting, the survey link, and unavailable storage.

The invitation includes a decorative inline SVG combining a calendar and speech bubble at the bottom right of the copy. It is hidden from assistive technology. `FeedbackSurveyModal.module.css` controls the layout, blue accents, and smaller illustration below 400px; theme variables keep it compatible with light and dark themes.

Edit the form at https://docs.google.com/forms/d/1dddNdoJiMlpWX5r3NPgnt-DiTv18VBDcUhwAtUyo6qQ/edit. Respondents use https://docs.google.com/forms/d/e/1FAIpQLSc-7tD_e1OEyM602hbog1e8OJmkBVZFm4UIwM9MZfOUon_NPg/viewform.

## Configuration

`FEEDBACK_SURVEY_URL` in `apps/web/src/lib/feedbackSurvey.ts` is the public respondent link shared by the modal and banner. `STORAGE_KEY` is `uoplan:feedback-survey:v1`, shared across schools on the same origin. There are no environment variables or cookies. All form questions are optional; email collection, required sign-in, and public response summaries are disabled.

## Dependencies

The prompt uses React, Mantine's accessible modal, Lingui translations, and browser localStorage. Google Forms hosts and collects survey responses; the website does not receive the answers. The modal applies to the website only.

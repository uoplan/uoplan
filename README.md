## uoplan.party

[![Latest term in data](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fuoplan%2Fuoplan%2Fmain%2Fapps%2Fscraper%2Fdata%2Fuottawa%2Fterms.json&query=%24.terms%5B-1%3A%5D.name&label=data&color=2ea44f)](apps/scraper/data/uottawa/terms.json)

`uoplan.party` is a fast, no-nonsense course planner for uOttawa that turns degree requirements into a real weekly timetable.

- **Plan by requirement**: pick your program, mark the courses you've completed, then choose courses by requirement instead of by guesswork.
- **Instant timetables**: generate multiple conflict-free weekly schedules, fine-tune them with extra options, and swap courses right from the calendar.
- **Prerequisite-aware**: the planner uses course prerequisites to focus on what you're eligible for and warns you when a course you want looks like it's missing prerequisites.
- **Explore courses & professors**: search any course or professor and view real historical grade distributions, student course-evaluation feedback, and professor ratings.
- **Grade trends**: browse how grades have shifted over time across the whole university.
- **Professor network**: explore a map of how professors are connected through the courses they share.
- **Bring in your courses**: import what you've already taken from your transcript, or pull in an existing schedule.
- **Share & export**: share your plan with a single link that shows a preview, add your schedule to your calendar app, or enrol straight from your terminal.
- **Bilingual**: available in English and French.

AI was used to create this project.

### Analytics

uoPlan uses anonymous, cookieless PostHog analytics to understand feature usage. Events are hosted in PostHog's EU region and ingested through the first-party reverse proxy at `https://t.uoplan.party`; no session replay is used.

For web builds, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_POSTHOG_UI_HOST`, and `VITE_POSTHOG_DEBUG` are optional because defaults are committed in `@uoplan/analytics`. The key is publishable and safe in the client bundle. Capture is production-gated by default; set `VITE_POSTHOG_DEBUG=1` to test locally.

Native builds use optional `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`, and `EXPO_PUBLIC_POSTHOG_DEBUG` variables with the same production/debug gating.

The Cloudflare Worker does not need the key at runtime: the web key is baked into the Vite client bundle. Set `VITE_POSTHOG_KEY` in the Cloudflare Workers Build environment only if you prefer build-time injection over the committed default. One-time maintainer setup: create the PostHog EU project, enable the managed reverse proxy, and point `t.uoplan.party` DNS at it.

### Acknowledgements

- [uo.zone / uo.grades.zone](https://github.com/alexander-azizi-martin/uo.zone) — inspiration for the explore page.
- [uschedule.me](https://github.com/uScheduleMe/uSchedule) — inspiration for the schedule planner.

### Grade data

Historical grade data in this repository (for example `apps/scraper/data/uottawa/grades.json` and data derived from it) was obtained through an access to information request under Ontario's _Freedom of Information and Protection of Privacy Act_.

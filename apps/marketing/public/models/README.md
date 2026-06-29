# 3D model — manual download required

The launch video renders a real **iPhone 17 Pro** GLB. It is **git-ignored** (a ~24 MB
binary), so you must download it once before rendering.

## Get it

Download **"iPhone 17 Pro" by Ranguel** from Sketchfab and save it in this folder as
`iphone.glb`:

- Model: <https://sketchfab.com/3d-models/iphone-17-pro-4541aa8a28324b33a2baaf81d263aaec>
- License: **CC BY 4.0** — <https://creativecommons.org/licenses/by/4.0/>

Steps:

1. Open the link → **Download 3D Model** → choose **glTF Binary (`.glb`)**.
2. Save / rename it to exactly `apps/marketing/public/models/iphone.glb`.

The composition loads it via `staticFile("models/iphone.glb")` (`src/Launch.tsx`). No
geometry is modified — it is re-lit and posed at render time. Attribution appears
on-screen in the outro and is recorded in `../../CREDITS.md`.

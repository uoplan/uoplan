# 3D models — manual download required

The launch video renders four real device GLBs (iPhone, iPad, Pixel, MacBook). They are
**git-ignored** (large binaries), so download them once before rendering. Save each with
the exact filename below into this folder.

| Device  | File          | Source                                                                                   | License   |
| ------- | ------------- | ---------------------------------------------------------------------------------------- | --------- |
| iPhone  | `iphone.glb`  | iPhone 17 Pro by Ranguel — <https://sketchfab.com/3d-models/iphone-17-pro-4541aa8a28324b33a2baaf81d263aaec> | CC BY 4.0 |
| iPad    | `ipad.glb`    | Apple iPad Pro by DatSketch — <https://sketchfab.com/3d-models/apple-ipad-pro-e5ffb3c80b2d4d6690249f8ee2bdafbe> | CC BY 4.0 |
| Pixel   | `pixel.glb`   | Pixel 10 — official Google model (de-Draco'd via `npx @gltf-transform/cli dedup`)        | —         |
| MacBook | `macbook.glb` | MacBook Pro 16" Silver by sugcx — <https://sketchfab.com/3d-models/macbook-pro-16-silver-3a53a9dba68f45a48f4fd216fb43ca02> | CC BY 4.0 |

Steps for each Sketchfab model: open the link → **Download 3D Model** → **glTF Binary
(`.glb`)** → save/rename to `apps/marketing/public/models/<file>`. CC BY 4.0:
<https://creativecommons.org/licenses/by/4.0/>.

The composition loads each via `staticFile("models/*.glb")` and `DeviceModel.tsx` finds the
screen mesh, swaps in the captured app video, and hides glass/glare. No geometry is
modified — devices are re-lit and posed at render time. Attribution appears on-screen in
the outro and is recorded in `../../CREDITS.md`.

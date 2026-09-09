# Security

Culk is a local-first photo culling PWA. Photos and culling state stay on
the user's device. There is no hosted processing service and no telemetry.
This file is a short privacy stub, not a disclosure program for a remote
product.

## Local-only claims

- Image bytes, EXIF, ratings, flags, and IndexedDB records are not uploaded.
- Face detection, focus scoring, and grouping run in the browser (ONNX
  Runtime Web / Web Workers / Canvas). Models ship with the app.
- Folder access uses the File System Access API and requires an explicit
  user gesture. Production must be served over HTTPS (`localhost` is a
  secure context for development).
- No usage analytics, crash telemetry, or third-party scoring APIs.

## Reporting

This is an offline local app. If the app sends photo data off-device or
opens unexpected outbound traffic, open a GitHub issue against this
repository.

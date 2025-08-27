# CLAUDE.md — AI Photo Culling Web App (Personal, Local-First, Docker-Ready)

Use this as your spec. Build a local-first PWA for RAW/JPEG culling with grouping, face/eye/focus detection, auto-picks, and XMP export. Add Docker support without compromising secure-context needs.

## Objective
- Import folders of RAW/JPEG.
- Show filmstrip, loupe, compare, survey.
- Auto-group near-duplicates, pick best.
- Score blur, focus, detect face and eye state.
- Write .XMP sidecars for Lightroom/Capture One.
- Local processing only. No cloud.

## Docker Integration
### Files added
- `Dockerfile`
- `Dockerfile.dev`
- `docker-compose.yml`
- `.dockerignore`
- `env.example`

### Docker workflow section
Docker Workflow
Targets

dev: hot-reload via Docker Compose on port 3000.

prod: multi-stage lean image, built with pnpm, includes healthcheck.

Commands

Dev up: docker compose up --build

Dev down: docker compose down

Prod build: docker build -t ai-cull:prod .

Prod run: docker run -p 3000:3000 --env-file ./.env ai-cull:prod

Secure Context Note
The app uses the File System Access API and service workers. These require a secure context. Browsers treat http://localhost as secure for local dev. In production, serve over HTTPS to support folder import and PWA offline.

Acceptance Criteria (Docker)

Dev container serves app at http://localhost:3000 with folder import working.

Production image passes healthcheck within 30s.

PWA installs and works offline locally; in prod behind HTTPS.



## Tech Stack
- Next.js 14, React, TypeScript, Tailwind, PWA.
- File System Access API for folder IO.
- Dexie (IndexedDB) for data storage.
- LibRaw-WASM via Web Workers for preview + EXIF.
- ONNX Runtime Web for face/eye detection.
- pHash + Hamming + SSIM for grouping.
- XMP writer for ratings/labels.
- JSON/CSV export.

## Repo Structure
/app
/components
/lib/{raw,ml,quality,similarity,grouping,xmp,store,fs}
/workers
/models
/public
/scripts
/tests



## Data Model & Scoring
```ts
ImageRec { …fields for preview, phash, focus, eyes, score, rating, flag… }  
GroupRec { id, memberIds, autoPickId? }  
ProjectMeta { thresholds, weights, cameraStats… }
Focus via Laplacian variance.

Eyes via face detection + eye-state classifier.

Group by pHash (Hamming ≤ threshold), refine with SSIM.

Auto-pick by weighted formula (sharpness, eyes open, face size, exposure).

UI Flows
Import: folder → decode previews + EXIF → store.

Cull: filmstrip, loupe, compare, survey; face badges; hotkeys.

Filters: blurry, closed eyes, picks, rejects, metadata filters.

Export: write XMP sidecars + session JSON/CSV.

Acceptance Tests
2000 images import quickly via embedded previews.

Auto-grouping + auto-pick works; user override works.

Face badges show focus and eye state.

Filters detect blur/closed eyes correctly.

Lightroom reads ratings from XMP.

PWA works offline on localhost; production served over HTTPS.

Milestones
Import & basic UI

Similarity, grouping, auto-pick, export

Face/eye/focus detection, issue filters

PWA and Docker support with settings

(Setup commands same as before.)

Non-Goals
No cloud sync. No editing beyond metadata.

Stretch Ideas
CLIP embeddings, preference learning, Tauri desktop wrapper.

Deliverables
Next.js PWA with import/cull/review/export.

LibRaw-WASM, ONNX face/eye, grouping, XMP writer.

Tests + README stub.



---

## `README.md`

```md
# AI Photo Culling (Personal)

Local-first PWA for culling RAW/JPEG files with AI support. Auto-grouping, face/eye/focus flags, auto-picks, XMP export.

## Prerequisites
- Docker & Docker Compose
- Node 20+

## Setup

### Development
```bash
cp env.example .env
docker compose up --build
# Open http://localhost:3000
Production Build

docker build -t ai-cull:prod .
docker run -p 3000:3000 --env-file .env ai-cull:prod
# Ensure HTTPS to enable File System Access API & PWA capabilities
Features
Folder import with in-browser previews (LibRaw WASM)

Duplicate detection and grouping (pHash + SSIM)

Face and eye detection with focus scoring (ONNX WebGPU)

Export ratings/flags via XMP sidecars

Works offline (PWA)

Docker Notes
Multi-stage Dockerfile uses pnpm and BuildKit cache techniques.

.dockerignore trims image size.

Healthcheck included in production image.

Local-First Security
Uses the File System Access API and service workers. Browsers accept http://localhost as secure. Production deployment must run on HTTPS to enable folder access and offline PWA behavior.


---

Tight, complete, and production-ready.



/docker-compose.yml
/Dockerfile
/Dockerfile.dev
/.dockerignore
/env.example
/README.md
/CLAUDE.md
/next.config.js
/package.json
/pnpm-lock.yaml
/.gitignore
/public/
  /models/
  /icons/
  manifest.webmanifest
/src or / (depending on preference)
  /app/
    /(import)/
    /(cull)/
    /(review)/
    /(export)/
  /components/
  /lib/
    /raw/
    /ml/
    /quality/
    /similarity/
    /grouping/
    /xmp/
    /store/
    /fs/
  /workers/
  /models/       # ONNX files, with models.json
  /scripts/
  /tests/
/tsconfig.json
/vitest.config.ts
/tailwind.config.js
/postcss.config.js

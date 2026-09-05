# Potensi Creative HRIS Constitution

> HRIS untuk Potensi Creative: absensi, jadwal live streamer, payroll, lembur/izin, LMS — untuk staff, streamer/OTS, dan admin operasional. Semua fitur acuan ada di `ref-deploy/` (HTML legacy); proyek ini adalah migrasi ke Next.js + Supabase (Prisma Postgres) dengan optimasi dan fitur tambahan seperti LMS.

Ralph version: `3f15f0f` (fstandhartinger/ralph-wiggum HEAD, 2026-09-06)

---

## Context Detection

**Ralph Loop Mode** (started by ralph-loop*.sh / ralph-loop*.ps1):
- Pick highest priority incomplete spec from `specs/`
- Implement, test, commit (no push without asking)
- Output `<promise>DONE</promise>` only when 100% complete
- Output `<promise>ALL_DONE</promise>` when no work remains

**Interactive Mode** (normal conversation):
- Be helpful, guide decisions, create specs

---

## Core Principles

- Paritas ref-deploy — samakan perilaku dan tampilan dengan `ref-deploy/` kecuali diminta menambah fitur (mis. LMS)
- Verifikasi dulu — `npx tsc --noEmit`, `eslint` file terkait, dan `npm test` harus hijau sebelum klaim selesai
- Fakta di atas asumsi — baca file dan bukti lokal dulu, jangan menebak

---

## Technical Stack

Detected from codebase: Next.js 16 (App Router) + React 19 + Tailwind CSS 4, Prisma ORM 7 (Postgres via Supabase pooler), NextAuth v5, Vitest + Playwright. Windows PowerShell environment — use `.ps1` loop scripts.

---

## Autonomy

YOLO Mode: DISABLED — ask before significant commands (migrations, deploys, bulk changes)
Git Autonomy: DISABLED — commit only when explicitly requested; never push without asking

---

## Specs

Specs live in `specs/` as markdown files. Pick the highest priority incomplete spec (lower number = higher priority). A spec is incomplete if it lacks `## Status: COMPLETE`.

Spec template: https://raw.githubusercontent.com/github/spec-kit/refs/heads/main/templates/spec-template.md

When all specs are complete, re-verify a random one before signaling done.

---

## NR_OF_TRIES

Track attempts per spec via `<!-- NR_OF_TRIES: N -->` at the bottom of the spec file. Increment each attempt. At 10+, the spec is too hard — split it into smaller specs.

---

## History

Append a 1-line summary to `history.md` after each spec completion. For details, create `history/YYYY-MM-DD--spec-name.md` with lessons learned, decisions made, and issues encountered. Check history before starting work on any spec.

---

## Completion Signal

All acceptance criteria verified, tests pass, changes committed → output `<promise>DONE</promise>`. Never output this until truly complete.

---

## Telegram Notifications

Send progress via Telegram using env vars `TG_BOT_TOKEN` and `TG_CHAT_ID` (never put tokens in files; set them in the environment before running the loop).

After completing a spec:
  curl -s -X POST "https://api.telegram.org/bot$TG_BOT_TOKEN/sendMessage" \
    -d chat_id="$TG_CHAT_ID" -d parse_mode=Markdown \
    -d text="✅ *Completed:* {spec name}%0A{one-line summary}"

Also notify on: 3+ consecutive failures, stuck specs (NR_OF_TRIES >= 10).

---

## Completion Logs

After each spec, create `completion_log/YYYY-MM-DD--HH-MM-SS--spec-name.md` with a brief summary.

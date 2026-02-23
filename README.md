# CloudSync Reader (PDF/EPUB) — Product Blueprint

This repository contains a practical blueprint for building an ebook reader that supports:

- Reading **PDF**, **EPUB** (and extensible to other formats)
- Connecting to **MEGA cloud storage**
- Syncing reading position, highlights, and notes
- Sharing a library with other users
- Sign-in via MEGA account and/or share-code based access

## Suggested Tech Stack

- **Frontend (Web + Mobile):** Flutter (single codebase) or React Native + React Web
- **Reader engines:**
  - EPUB: `epub.js` / native equivalent
  - PDF: `pdf.js` / native equivalent
- **Backend API:** Node.js (NestJS/Express) or Go
- **Database:** PostgreSQL
- **Cache / realtime:** Redis + WebSocket
- **Storage for generated metadata:** S3-compatible bucket

## Core Product Modules

1. **Auth Module**
   - MEGA OAuth/login integration
   - Optional local account + link MEGA account
   - Share-code invite flow
2. **Library Module**
   - Import books from MEGA folders
   - Parse metadata (title, author, cover)
   - Organize tags/collections
3. **Reader Module**
   - Progress tracking per book/device
   - Highlights, bookmarks, notes
   - Offline cache with background sync
4. **Sync Engine**
   - Conflict resolution for progress and annotations
   - Versioned events and device timestamps
5. **Sharing Module**
   - Shared library (owner/editor/viewer)
   - Invite links + codes
   - Audit trail for shared changes

## MVP Scope (Phase 1)

- Login with MEGA
- Import and list PDF/EPUB from selected MEGA folder
- Read books in app
- Sync progress (last position + percent)
- Share library with one invite code model

See detailed architecture in [`docs/architecture.md`](docs/architecture.md) and data/sync model in [`docs/sync-model.md`](docs/sync-model.md).


## Build-ready Artifacts

- Database schema: [`docs/database-schema.sql`](docs/database-schema.sql)
- OpenAPI contract: [`docs/api-spec.yaml`](docs/api-spec.yaml)
- Delivery timeline: [`docs/implementation-plan.md`](docs/implementation-plan.md)



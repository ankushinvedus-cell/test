# Architecture

## 1. High-Level Components

```text
Client Apps (Web/Mobile)
    |
API Gateway
    |
+-------------------------------+
| Auth Service                  |
| Library Service               |
| Reader Progress Service       |
| Sharing Service               |
| Sync Orchestrator             |
+-------------------------------+
    |
PostgreSQL + Redis + Object Store
    |
MEGA API connector (import + file fetch)
```

## 2. Main Flows

### A. MEGA Login and Account Linking

1. User clicks "Login with MEGA".
2. App receives access token from MEGA.
3. Backend validates token and creates/links user record.
4. Backend issues app JWT for internal APIs.

### B. Import Books from MEGA

1. User selects MEGA folder.
2. Backend connector fetches file list and filters supported formats.
3. System creates `book` records with source URI + checksum.
4. Metadata worker extracts title/author/cover and updates records.

### C. Read + Sync Progress

1. Client opens book and periodically posts checkpoints.
2. Sync service stores checkpoints as events (`progress_updated`).
3. Last-write-wins at checkpoint level, but monotonic rules prevent accidental backward overwrite unless explicit rewind.
4. On app open, latest state is composed from events and returned to client.

### D. Shared Library

1. Owner creates a library and invite code.
2. Guest redeems code and joins with role.
3. Any member updates become visible per permission model.
4. Conflict handling per field + event timestamp/device-id.

## 3. Security and Privacy

- Encrypt tokens/secrets at rest.
- Use short-lived app JWT + refresh tokens.
- Store only required MEGA scope.
- Add row-level access checks for every library/book endpoint.
- Add immutable audit logs for sharing actions.

## 4. Scalability Notes

- Keep book files in MEGA; cache derivatives only when necessary.
- Use Redis for hot progress reads and websocket fanout.
- Partition events table by month if volume grows.
- Use background jobs for metadata extraction and large imports.

## 5. Suggested API Surface (MVP)

- `POST /auth/mega/callback`
- `POST /libraries`
- `POST /libraries/:id/invites`
- `POST /libraries/join`
- `POST /imports/mega`
- `GET /books`
- `GET /books/:bookId/open`
- `POST /books/:bookId/progress`
- `GET /books/:bookId/progress`
- `POST /books/:bookId/annotations`
- `GET /books/:bookId/annotations`

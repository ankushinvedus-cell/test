# Sync Model

## 1. Entities

- `users`
- `identities` (provider = mega)
- `libraries`
- `library_members`
- `books`
- `book_sources` (provider, remote_path, checksum)
- `reading_states` (materialized latest)
- `sync_events` (append-only history)
- `annotations` (highlight/note/bookmark)

## 2. Progress Payload

```json
{
  "bookId": "uuid",
  "deviceId": "string",
  "position": {
    "type": "epub-cfi | pdf-page",
    "value": "epubcfi(...) or page=12&x=0.1&y=0.3"
  },
  "percent": 42.3,
  "updatedAt": "2026-01-01T10:00:00Z",
  "clientSeq": 139
}
```

## 3. Conflict Rules

1. Prefer highest `clientSeq` from same `deviceId`.
2. Across devices, prefer latest `updatedAt`.
3. If timestamps are too close (<5 seconds), prefer higher percent **unless** explicit `rewind=true`.
4. Never delete old events; rebuild materialized view if needed.

## 4. Sharing Model

Roles:

- `owner`: full control, can remove members
- `editor`: can add books, edit metadata, write annotations
- `viewer`: read-only + personal progress/annotations

Invite code:

- Code maps to `library_id`, role, expiry, max redemptions.
- Redemption requires authenticated account (MEGA-linked or local).

## 5. Offline Behavior

- Queue progress/annotation events locally.
- Sync on reconnect in order of local enqueue time.
- Server returns accepted event IDs and merged reading state.

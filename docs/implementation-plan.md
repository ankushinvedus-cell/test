# Implementation Plan (8 Weeks)

## Week 1: Foundation
- Create backend service skeleton (auth, library, reader, sharing modules).
- Provision PostgreSQL and Redis.
- Define CI pipeline: lint + tests + migration checks.

## Week 2: Authentication
- Implement MEGA sign-in callback and identity linking.
- Implement app JWT issue + refresh token flow.
- Add auth middleware and role guard primitives.

## Week 3: Library + Import
- Build library CRUD and membership APIs.
- Build invite code create/redeem APIs.
- Implement MEGA import worker for PDF/EPUB discovery.

## Week 4: Reader Progress Sync
- Implement progress POST/GET with conflict rules.
- Persist append-only sync events.
- Add integration tests for multi-device race conditions.

## Week 5: Annotations + Offline Queue Contract
- Implement annotation CRUD endpoints.
- Define client event queue contract and retry strategy.
- Add reconciliation endpoint for batched offline events.

## Week 6: Frontend Reader MVP
- Build library/book list views.
- Integrate PDF/EPUB reader surface.
- Persist local progress and push checkpoints.

## Week 7: Sharing UX + Hardening
- Invite flow in UI and member management views.
- Add audit logs and permission edge-case tests.
- Add observability dashboards (errors, sync lag, import latency).

## Week 8: Beta Readiness
- Performance test with 10k books and 100 concurrent readers.
- Security review (token storage, endpoint access checks).
- Pilot rollout with feedback loop.

## Exit Criteria for MVP
- User can sign in with MEGA and import books from chosen folder.
- User can open PDF/EPUB and progress syncs across two devices within 5 seconds.
- User can invite another account via code and share a library.

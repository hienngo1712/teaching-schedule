# Bulk Edit & Delete Sessions Plan (IMPLEMENTED)

## Objective
Implement the ability to edit and delete recurring sessions in bulk directly from the `SessionDetailDialog` and `SessionFormDialog`. The system will identify related sessions using pattern matching (same Subject, Start/End Time, and Day of Week). The UI will integrate this as an option (checkbox) within the existing Edit and Delete flows.

## Status: ✅ COMPLETED
This feature has been fully implemented in Phase 8.
- Backend services: `bulkDeleteFutureSessions`, `bulkUpdateFutureSessions`, `addStudentsToRecurringSessions`.
- TRPC Routes: `session.deleteFuture`, `session.updateFuture`, `session.addRecurringStudents`.
- UI: Checkboxes added to `SessionDetailDialog` (Delete) and `SessionFormDialog` (Edit).
- Additional feature: "Add Recurring Students" added to `SessionDetailDialog` -> Add Students dialog.

## Key Files & Context
- `src/components/sessions/SessionDetailDialog.tsx`: Needs updates to the Delete alert dialog to include a "Delete future recurring sessions" checkbox and handle the bulk delete API call.
- `src/components/sessions/SessionFormDialog.tsx`: Needs a new checkbox in the form to "Apply to future recurring sessions" and handle passing this flag to the update mutation.
- `src/server/services/session.service.ts`: Needs two new functions: `bulkDeleteFutureSessions` and `bulkUpdateFutureSessions`.
- `src/server/trpc/routers/session.ts`: Needs new routes `deleteFuture` and `updateFuture` (or modifications to existing routes) to expose the new service functions.
- `src/lib/schemas/session.ts`: Define schemas for the new endpoints or add a flag to existing ones.

## Implementation Steps

### 1. Update API Schemas (`src/lib/schemas/session.ts`)
- Create `sessionBulkDeleteFutureSchema` requiring `id` (the reference session).
- Create `sessionBulkUpdateFutureSchema` requiring `id` (the reference session) and `data` (the fields to update).

### 2. Implement Backend Services (`src/server/services/session.service.ts`)
- **`deleteFutureSessions(db, userId, referenceSessionId)`**:
  - Fetch the reference session.
  - Calculate the Day of Week.
  - Delete all sessions where:
    - `userId` matches.
    - `subjectId` matches.
    - `startTime` and `endTime` match.
    - `sessionDate >= referenceSession.sessionDate`.
    - `EXTRACT(DOW FROM sessionDate)` matches the reference session's day of week (using raw SQL or filtering in JS after DB query, Prisma requires specific handling for DOW, JS filtering might be safer if not huge, but raw SQL is better for DB-level deletion). Let's use `db.$executeRaw` for the deletion to ensure atomicity and DOW matching.
- **`updateFutureSessions(db, userId, referenceSessionId, data)`**:
  - Fetch the reference session.
  - Find all matching future sessions (same criteria as delete).
  - Update them in a transaction. Ensure `checkOverlap` is handled correctly if times change (this is complex for bulk, might need to skip overlapping ones or fail the whole batch). *Alternative: Allow updating title/notes/subject easily, but changing time requires careful overlap checking. Let's start with updating all matched sessions. If time changes, we must check overlap for EVERY target date.*

### 3. Expose via TRPC (`src/server/trpc/routers/session.ts`)
- Add `deleteFuture` mutation calling `deleteFutureSessions`.
- Add `updateFuture` mutation calling `updateFutureSessions`.

### 4. Update UI Components
- **`SessionDetailDialog.tsx`**:
  - Add a checkbox to the `AlertDialog` for deletion: "Xóa cả các ca dạy định kỳ trong tương lai (cùng thứ, giờ, môn học)".
  - Update `handleDelete` to call `deleteFuture` if checked, else standard `delete`.
- **`SessionFormDialog.tsx`**:
  - Add an accordion or simple checkbox section at the bottom for "Chỉnh sửa lịch định kỳ".
  - Checkbox: "Áp dụng thay đổi cho các ca dạy định kỳ trong tương lai".
  - If checked, `onSubmit` calls `updateFuture` instead of `update`.

## Verification & Testing
- Create a recurring session.
- Open one session in the middle of the series.
- Delete it and check the box -> verify current and future are gone, past are kept.
- Edit one session, change notes and time, check the box -> verify current and future are updated, past are kept. Verify overlap validation works if editing time causes a conflict.
- **Run `pnpm test` and `pnpm build` to ensure no flow errors are introduced.**

# Anonymous Login Feature Spec

## Goal

Add one-click anonymous login so a visitor can start using InterviewAI without filling the registration form. The backend creates a normal user account, signs the existing JWT session cookie, and redirects the user into the authenticated app.

## Scope

This feature includes:

- A new public `POST /api/auth/anonymous` route handler.
- Anonymous account generation using `userxxxxx` usernames and mock email addresses.
- Automatic JWT cookie creation using the existing auth mechanism.
- A login page entry point for anonymous login.
- A password settings flow that lets any logged-in user set a new password without entering the old password.
- Tests for anonymous account creation, session cookies, collision retry behavior, password reset behavior, and proxy public route coverage.

This feature does not include:

- A new `User` database column such as `isAnonymous`.
- Different authorization rules for anonymous users.
- Automatic cleanup of unused anonymous accounts.
- Email verification.
- Migration from anonymous to formal user through a dedicated conversion workflow. Users convert the account manually by updating username, email, and password in settings.

## Current System Context

Authentication currently uses:

- `src/entities/User.ts` for `username`, `email`, `passwordHash`, and `createdAt`.
- `src/lib/auth.ts` for bcrypt password hashing and JWT signing/verification.
- `src/app/api/auth/register/route.ts` and `src/app/api/auth/login/route.ts` for user creation/login plus `token` cookie creation.
- `src/proxy.ts` for optimistic authentication checks and `x-user-id` propagation.
- `src/app/settings/page.tsx` and `src/app/api/auth/password/route.ts` for profile and password changes.

Next.js 16 route handlers should stay under the `app` directory in `route.ts` files. Proxy should remain a lightweight request gate and must not create users or perform database work.

## Recommended Design

### Backend Anonymous Login API

Create `src/app/api/auth/anonymous/route.ts` with `POST`.

The handler will:

1. Initialize the TypeORM data source with `getDataSource()`.
2. Generate a candidate username in the form `userxxxxx`, where `xxxxx` is a random numeric suffix.
3. Generate a mock email from the username, such as `user48291@anonymous.local`.
4. Generate a random server-side password string and hash it with `hashPassword()`.
5. Create a normal `User` record.
6. Retry with a new candidate if the username or email already exists.
7. Sign a JWT with `signToken(user.id)`.
8. Return `{ token, user: { id, username, email } }` and set the same `token` cookie options used by login/register.

The API must not return the generated password.

The retry loop will use a fixed upper bound, such as 8 attempts. If all candidates collide or persistence repeatedly fails with uniqueness conflicts, return:

```json
{ "error": "创建匿名账号失败，请重试" }
```

with HTTP 500.

Unexpected database or hashing errors should be logged server-side and return:

```json
{ "error": "服务器错误，请稍后重试" }
```

with HTTP 500.

### Public Route

Update `src/proxy.ts`:

- Add `/api/auth/anonymous` to `publicPaths`.

This is required because unauthenticated users must be able to create the anonymous session.

### Frontend Login Page

Update `src/app/login/page.tsx`:

- Add an anonymous login button near the existing login submit button.
- Use a separate loading state such as `anonymousLoading`.
- Disable normal login while anonymous login is pending.
- Disable anonymous login while normal login is pending.
- On click, call `POST /api/auth/anonymous`.
- On success, route to `/dashboard`.
- On failure, show the backend error in the existing error region.

The page should keep the existing username/password login behavior unchanged.

### Password Settings Flow

Update `src/app/api/auth/password/route.ts`:

- Change the schema from `{ currentPassword, newPassword }` to `{ newPassword }`.
- Keep the existing logged-in user check through `getUserId(request)`.
- Keep the existing password strength validation.
- Load the current `User` by `userId`.
- If the user does not exist, return 404 or a generic authenticated-user error.
- Hash and save the new password.
- Return `{ success: true }`.

Update `src/app/settings/page.tsx`:

- Remove current password state, input, visibility toggle, and request payload field.
- Change copy from "修改密码" to "设置新密码" where appropriate.
- Keep the new password field, strength meter, loading state, success state, and error display.
- Submit `{ newPassword }` to `PATCH /api/auth/password`.

This enables an anonymous account to become a normal account without the user knowing the generated password. The user can change username/email in the existing profile form and set a known password in the password form.

## Security And Product Tradeoffs

- Anonymous accounts are normal accounts. The system cannot distinguish them later because no new field will be added.
- A user with a valid logged-in session can set a new password without knowing the old password. This is an accepted product tradeoff for the anonymous login flow.
- The password route must still require a valid session and must only update the current `x-user-id` user.
- Generated anonymous passwords must never be returned to the browser or logged.
- Mock email addresses should use a non-deliverable local/reserved domain, such as `anonymous.local`, to avoid accidental real email delivery.
- API errors must not reveal whether a specific generated username or email already exists.

## Testing Plan

Add focused Vitest coverage before implementation.

### Anonymous Login API

Tests should verify:

- `POST /api/auth/anonymous` creates a user with a `userxxxxx` username.
- The generated email uses the mock anonymous domain.
- The stored password is hashed, not saved as a plain generated value.
- The response includes `user.id`, `user.username`, and `user.email`.
- The response sets a `token` cookie with `httpOnly`, `sameSite: "lax"`, `path: "/"`, and the same max age as login/register.
- Username/email collision triggers a retry and eventually succeeds.
- Exhausting retry attempts returns 500 with a generic anonymous creation error.
- Unexpected errors return 500 with a generic server error.

### Password API

Tests should verify:

- Unauthenticated requests return 401.
- Weak `newPassword` values return 400.
- Authenticated requests with a valid `newPassword` update only the current user password hash.
- The handler no longer requires or checks `currentPassword`.

### Proxy

Tests should verify:

- `/api/auth/anonymous` is treated as public.
- Other protected API routes remain protected without a token.

### UI

Tests should verify:

- The login page calls `/api/auth/anonymous` when the anonymous login button is clicked.
- The login page routes to `/dashboard` after anonymous login succeeds.
- The settings password form sends only `{ newPassword }`.
- The settings password form still blocks weak passwords client-side.

## Acceptance Criteria

- A visitor on `/login` can click one button and reach `/dashboard` as a newly created user.
- The created account has a `userxxxxx` username and mock anonymous email.
- The account can own resumes, interviews, messages, and evaluations through existing relationships.
- The user can later update username/email and set a known password from settings.
- Existing login/register/logout behavior remains unchanged.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass after implementation.


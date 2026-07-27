# Feature Spec: Email / Notifications Infrastructure

Parent: [../SCOPE.md](../SCOPE.md), scope item 10 ("Notifications"). Also fulfills email trigger points already committed to by [01-accounts-and-ranges.md](01-accounts-and-ranges.md) (invite, resend-invite, password reset) but left unbuilt there on purpose.

Status: DRAFT — pending your sign-off before any implementation starts.

"Done" for this feature means: this spec is agreed, automated tests below pass, and a human has walked through the manual verification checklist against the running app.

Stack: Next.js (TypeScript) + a transactional email API provider (recommendation below), deployed per `../SCOPE.md`'s Hetzner VPS / Docker Compose plan.

---

## GOAL

Give every other feature one reliable, reusable way to send an email — invite links, password resets, membership decisions now; booking/event confirmations, cancellations, and reminders later — without any calling code talking to an email provider's SDK directly, and without a failed send ever blocking or reversing the action that triggered it.

---

## ⚠️ Decision: this necessarily involves a third party — addressed directly, not glossed over

Following the same honesty standard as the Hetzner hosting decision: **sending real email means some data leaves infrastructure you control, there's no way around that.**

**Why this is a smaller concession than the database question, not a repeat of it:** whichever relay sends the email, the *recipient's own inbox provider* (Gmail, Outlook, Yahoo, whatever the member happens to use) receives and stores the full content regardless — that's true whether you self-host the outbound relay or use a transactional API. The marginal exposure from using a reputable transactional provider *in between* is small compared to what already happens at the recipient's end, which you have zero control over either way.

**Self-hosting an SMTP server (e.g. Postfix on the same VPS) was considered and rejected:** a freshly-provisioned VPS IP has no sending reputation. Without an established reputation, proper SPF/DKIM/DMARC, and (realistically) a warmed-up IP, a large fraction of these emails — including password resets and invite links, the ones that matter most — will silently land in spam or get outright rejected by Gmail/Outlook. That's a worse privacy/reliability trade than using a reputable provider: the emails not arriving at all defeats the entire feature.

**Confirmed: [Resend](https://resend.com).** This is a swappable implementation detail — the whole codebase only ever calls one internal `sendEmail()` function (see Behaviour), so switching providers later touches one module, not every feature that sends email.

**Cost, checked directly rather than assumed (as of mid-2026):**
- **Resend free tier: $0/month** — 3,000 emails/month, capped at 100/day, no credit card required, no time limit on the free tier itself. For this club's v1 scope (invites, resets, membership-decision emails), this is comfortably free indefinitely.
- **Watch item once the Booking spec ships:** confirmation + 24h reminder + 2h reminder = up to 3 emails per booking. On a genuinely busy day (many bookings across 6 ranges), the **100/day** cap is the one that could realistically be hit before the 3,000/month cap — worth revisiting once real booking volume exists, not a v1 concern.
- **If it's ever outgrown:** Resend Pro is $20/month for 50,000 emails/month (no daily cap at that tier) — a trivial cost even then. For reference, the alternatives considered: Postmark charges $1.25 per 1,000 emails with no meaningful free tier at this scale; AWS SES is the cheapest at $0.10 per 1,000 emails but requires materially more setup (manual sandbox-mode removal, your own deliverability monitoring) that isn't worth the operational overhead for a first project at this volume.

**Deployment prerequisite, not a code concern:** the club needs to add SPF/DKIM DNS records for their domain (`harbourhouse.ie`) pointing at Resend, so emails are sent as "from the club" with proper authentication rather than an unrelated default domain — this materially affects deliverability and is worth doing before real launch. **Confirmed:** you know who holds the DNS access and they're able to help with this step.

**Deployment prerequisite, not a code concern:** the club needs to add SPF/DKIM DNS records for their domain (e.g. `harbourhouse.ie`) pointing at the chosen provider, so emails are sent as "from the club" with proper authentication rather than an unrelated default domain — this materially affects deliverability and is worth doing before real launch.

---

## SCOPE

In scope:

1. A single internal `sendEmail({ to, template, data })` function — the only code path allowed to call the email provider's API. Every feature that needs to send email calls this, never the provider SDK directly.
2. Templates for the trigger points already committed by [01-accounts-and-ranges.md](01-accounts-and-ranges.md): `invite`, `password-reset`.
3. **New, flagged addition — not previously decided anywhere:** `member-approved`, `member-rejected`, `member-deactivated` templates, sent on those respective admin actions. Currently a `PENDING` member has no way to find out they've been approved except blindly trying to log in — this closes that gap. Flagging clearly since it's new scope, not silently bundled in.
4. Delivery logging: every send attempt (success or failure) recorded, visible to admin — nothing is silently dropped.
5. One automatic retry on transient/network-level failure; no queue/worker system in v1 (see Out of Scope).
6. Failure isolation: a failed send never blocks, delays, or reverses the action that triggered it (registration, invite, approval, etc. all still succeed even if the resulting email fails to send).

Out of scope for this spec specifically: the actual booking/event/reminder templates themselves (confirmation, cancellation, 24h/2h reminders) and the guest-booking magic-link email — those belong to the Booking, Courses & Competitions, and Guest Booking specs respectively, which will all reuse the `sendEmail()` mechanism defined here rather than rebuilding it.

---

## DATA MODEL (Prisma schema, illustrative)

```prisma
enum EmailStatus {
  SENT
  FAILED
}

model EmailLog {
  id                String      @id @default(cuid())
  toEmail           String
  template          String      // "invite" | "password-reset" | "member-approved" | "member-rejected" | "member-deactivated" | (future templates)
  status            EmailStatus
  providerMessageId String?     // the provider's own send ID, for cross-referencing with their dashboard/support
  error             String?     // failure reason, only set when status = FAILED
  userId            String?     // nullable — not every future email is tied to a User (e.g. guest booking emails have no User)
  createdAt         DateTime    @default(now())
}
```

No changes to the `User` or `AccountToken` models from [01-accounts-and-ranges.md](01-accounts-and-ranges.md) — this spec is purely additive.

---

## BEHAVIOUR

### `sendEmail()` — the one function everything else calls
- Signature: `sendEmail({ to: string, template: TemplateName, data: object }): Promise<{ success: boolean }>`.
- Renders the named template (simple HTML-string functions — no heavy templating engine needed at this volume/complexity) with `data`, producing both an HTML body and a plain-text fallback (many spam filters and email clients weight the presence of a text alternative — this isn't optional polish).
- Calls the provider's send API.
- **Always writes an `EmailLog` row**, regardless of outcome — `SENT` with `providerMessageId`, or `FAILED` with `error`.
- On a transient/network-level failure (timeout, 5xx from the provider), retries **exactly once**, immediately, before giving up and logging `FAILED`.
- Returns `{ success: boolean }` to the caller — **callers must not treat `success: false` as a reason to fail their own action.** This is a hard rule carried over from the Accounts spec's existing acceptance criterion ("a failed outbound email never blocks or reverses a successful booking/cancellation") — it applies identically here to registration, invite, and membership-decision actions.

### Templates (v1)
- `invite` — data: `{ name, inviteUrl }`. Used by `POST /api/admin/members/invite` and `resend-invite` (see [01-accounts-and-ranges.md](01-accounts-and-ranges.md)).
- `password-reset` — data: `{ name, resetUrl }`. Used by `POST /api/auth/forgot-password`.
- `member-approved` — data: `{ name, loginUrl }`. New: sent when admin approves a `PENDING` member. Includes a link to the login page.
- `member-rejected` — data: `{ name, loginUrl }`. New: sent when admin rejects a `PENDING` member. Contains only the same generic message the member would see if they tried to log in — no `rejectedReason` content, since that field is for the club's internal record-keeping, not the applicant (per [01-accounts-and-ranges.md](01-accounts-and-ranges.md)'s existing decision). Still includes the login link per the account-state convention below, even though attempting to log in will just show the rejection message again.
- `member-deactivated` — data: `{ name, loginUrl }`. New: sent when admin deactivates a previously-`APPROVED` member. Includes the login link for the same consistency reason — if reactivated later, or if the deactivation is disputed/reversed, the member already has the link at hand.
- **Convention: every account-state email (approved/rejected/deactivated) includes a login link**, even for the two states where logging in won't currently succeed — consistent presentation across all three rather than only linking when it's immediately useful.
- Each template includes minimal club branding (name, not a full design system) and, where applicable, the relevant action link.

### Sender identity
- All emails sent from an address at a domain the club controls (e.g. `noreply@harbourhouse.ie`), not the provider's shared/default domain — requires the SPF/DKIM DNS setup noted above as a deployment prerequisite.

### Admin visibility
- Admin can view the `EmailLog`, filterable by recipient email / template / status — the concrete answer to "did the invite email I just sent actually go out."
- No automated retry beyond the single immediate one in `sendEmail()` — for the two flows that already have a natural "try again" action (`resend-invite`, `forgot-password` can just be called again), a persistent failure is recoverable by the normal user/admin flow, not a special retry button. No new admin action is added specifically for retrying `member-approved`/`member-rejected`/`member-deactivated` emails in v1 — a failure there just means the member finds out by trying to log in instead, same as before this feature existed.

---

## EDGE CASES

| # | Scenario | Expected behaviour |
|---|---|---|
| 1 | Provider API is down or times out | `sendEmail()` retries once; if still failing, logs `FAILED` with the error. The triggering action (invite, approval, etc.) has already succeeded regardless — it never rolls back because of this. |
| 2 | The same email is triggered twice in quick succession (e.g. an admin double-clicks "resend invite") | Not deduplicated at the email layer — `sendEmail()` will happily send twice if called twice. Whatever prevents a genuine duplicate action (e.g. `resend-invite`'s own token-invalidation logic) is what prevents duplicate *intent*; `EmailLog` will simply show two rows if the caller allowed two calls through. |
| 3 | `to` is a malformed address (shouldn't happen given upstream email validation on `User.email`, but defense in depth) | Provider rejects it; logged as `FAILED` with the provider's rejection reason; does not throw an unhandled exception into the calling action. |
| 4 | The provider account hits its sending-quota/rate limit | Affected sends logged as `FAILED`; this is an operational/deployment concern (monitor `EmailLog` for a cluster of failures, upgrade the plan) rather than something the app auto-remediates. |
| 5 | SPF/DKIM aren't configured for the sending domain | Not a code-level failure — emails may send successfully per the provider but land in recipients' spam folders. Not detectable from inside this system; mitigated entirely by the deployment prerequisite above. |
| 6 | A member is rejected, and the rejection email is sent | Contains only the generic "not approved, contact the club" message — never the admin's internal `rejectedReason` free-text, which could contain notes not meant for the applicant (see `PATCH`/reject behavior in [01-accounts-and-ranges.md](01-accounts-and-ranges.md)). |
| 7 | Admin deactivates a member who is currently mid-session | The deactivation itself (session deletion, status change) already happens synchronously per [01-accounts-and-ranges.md](01-accounts-and-ranges.md) — the `member-deactivated` email is a notification of something that has already taken effect, not a step that gates it. |

---

## ACCEPTANCE CRITERIA

1. Every call to `sendEmail()` results in exactly one `EmailLog` row reflecting the actual outcome (`SENT` with a `providerMessageId`, or `FAILED` with an `error`).
2. A simulated provider failure (mocked in tests) does not throw an exception that propagates into and fails the calling action — verified by triggering an invite with a forced email failure and confirming the `User`/`AccountToken` rows were still created successfully.
3. `member-approved`, `member-rejected`, and `member-deactivated` emails are sent on their respective admin actions (new trigger points, not previously specified anywhere), and all three include a working login link.
4. A `member-rejected` email never contains the admin's `rejectedReason` text.
5. A transient failure triggers exactly one automatic retry before being logged as `FAILED` — verified with a mock provider configured to fail once then succeed, and separately with one configured to always fail.
6. Admin can filter `EmailLog` by recipient, template, and status and get an accurate result.
7. Two rapid duplicate calls to `sendEmail()` for the same logical action produce two independent `EmailLog` rows — the system doesn't silently swallow the second one, making it visible if upstream code has an idempotency bug.

---

## TEST PLAN

- **Unit:** each template's render function (HTML + plain-text output, given known input data), `sendEmail()`'s retry logic against a mocked provider client (success, single-failure-then-success, always-fails).
- **Integration:** the full invite → email-sent → `EmailLog` row chain; approve/reject/deactivate → corresponding template sent; a forced provider failure during invite creation confirming the `User`/`AccountToken` rows persist regardless.
- **Manual verification checklist (human sign-off, required before this is "done"):**
  1. Trigger each of the five v1 templates (invite, password-reset, member-approved, member-rejected, member-deactivated) against a real inbox; confirm each arrives, renders sensibly in at least one real email client, and isn't caught by spam filtering (check the spam folder specifically).
  2. Temporarily misconfigure the provider API key (simulate an outage) and confirm: the triggering action (e.g. registration → invite) still succeeds, the email is logged as `FAILED` in the admin view, and no error is shown to the end user beyond what's already expected.
  3. Confirm SPF/DKIM are actually configured for the sending domain before treating this as launch-ready (a code-complete feature with unauthenticated sending domain is not actually done, per the Edge Case #5 caveat).

---

## OUT OF SCOPE (for this spec)

- A queue/worker system (e.g. BullMQ + Redis) for retries beyond the single immediate one built into `sendEmail()` — flagged as a candidate future improvement if delivery reliability turns out to be a real problem in practice, not built preemptively.
- Booking/event confirmation, cancellation, and 24h/2h reminder templates — belong to the Booking and Courses & Competitions specs, which reuse `sendEmail()`.
- Guest booking's magic-link confirmation email — belongs to the Guest Booking spec, same reuse.
- SMS notifications — out of scope per `../SCOPE.md`, email only.
- Admin-editable email templates (a WYSIWYG template editor) — templates are code in v1, not admin-configurable content.
- A dedicated "resend" admin action for `member-approved`/`member-rejected`/`member-deactivated` specifically — see Behaviour: Admin visibility.

---

## Decisions (previously open questions, now resolved)

1. ~~Provider choice~~ — **Decided:** Resend. Free tier ($0/mo, 3,000/month, 100/day cap) comfortably covers v1; see cost breakdown above. Revisit the 100/day cap specifically once Booking ships and real volume exists.
2. ~~Member-approved/rejected/deactivated emails~~ — **Decided:** wanted, all three. Each includes a login link, even the two states where logging in won't currently succeed (rejected, deactivated) — consistent presentation across all three rather than conditionally omitting it.
3. ~~DNS access for SPF/DKIM~~ — **Decided:** known and available. Coordinate with that person before real launch, not a blocker to writing code now.

No open questions remain blocking implementation of this spec.

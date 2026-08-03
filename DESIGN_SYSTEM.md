# Design System

The visual design for this app was designed in a [Claude Design](https://claude.ai/design) project — **"Shooting Club Booking - Design System"** (`803e024e-7e5a-4601-8474-31456de6980a`) — and ported into this codebase. **The codebase is the source of truth going forward.** The Claude Design project stays as the reference/spec; only go back to it if you want to redesign a specific component, in which case re-port just that component.

## Where things live

- `app/src/styles/design-system/tokens/*.css` — colour, typography, spacing, elevation and motion tokens, as CSS custom properties. Mirrors the design system project's `tokens/` folder 1:1 (so a re-sync is a straightforward diff), **except** `tokens/fonts.css`'s Google Fonts CDN `@import` — see below.
- `app/src/app/layout.tsx` — loads fonts via `next/font/google` (`Source_Sans_3`, `IBM_Plex_Mono`) and the Phosphor icon CSS via a direct package import, both self-hosted/bundled rather than CDN `@import`s. **Why:** Tailwind v4's Turbopack bundler re-emits its own generated rules ahead of any `@import` that appears later in a CSS file's *source*, regardless of where you place it — so a remote CDN `@import` for fonts/icons can never be made to "come first" from inside a CSS file. Real package imports (next/font, or `@phosphor-icons/web` here) sidestep this because they become their own bundled chunks instead of literal `@import` statements.
- `app/src/app/globals.css` — imports the tokens, overrides `--font-sans`/`--font-mono` to front the next/font-generated variables ahead of the design system's own (CDN-oriented) font stack, and maps Tailwind's own theme keys onto the design system's semantic tokens.
- `app/src/components/ui/<family>/*.tsx` — the ported component library: `core` (Icon, Tooltip), `buttons` (Button, IconButton, **ButtonLink**), `status` (StatusBadge, CoverageBadge, CapacityChip), `forms` (FormField, TextField, PasswordField, SelectField, DayPicker), `booking` (SlotCard, RangePicker, BookingListItem, EventCard), `scheduling` (CoverageGrid), `data` (DataTable), `feedback` (InlineAlert, BlackoutBanner, Toast, EmptyState, ErrorState, ListSkeleton).
  - `ButtonLink` is **not** from the source design system — `Button` is deliberately a plain `<button>` only (see its own file comment), so this was added locally for the frequent "button-shaped control that navigates instead of submitting" case (e.g. "Back to sign in"). It re-exports `Button`'s own `BUTTON_VARIANTS`/`BUTTON_SIZES`/`BUTTON_HOVER` style maps so the two never drift apart.
- `app/src/components/layout/AuthShell.tsx` — shared shell for every sign-in-adjacent screen (logo, title, intro, centered card). Mirrors `ui_kits/member/AuthScreens.jsx`'s `AuthShell`.
- `app/src/app/admin/layout.tsx` + `app/src/app/admin/AdminNav.tsx` — shared shell for every `/admin/*` route (sidebar nav, signed-in-as block, sign out). Mirrors `ui_kits/admin/AdminApp.jsx`, minus the role switch and bookings/coverage nav items (those arrive with specs 03/04). `AdminNav` is a small client component using `usePathname()` for active-link highlighting; the layout itself is a server component that also does the admin-role redirect gate.
- `app/public/logo.png` — the club roundel, pulled from the design system project's `assets/logo.png`. Used exactly as supplied — never redrawn, recoloured or cropped.

Components use plain CSS custom properties (`var(--brand-500)`, `var(--sp-6)`, ...) via inline `style` objects — not Tailwind utility classes or CSS-in-JS. Tailwind is still available for layout (`flex`, `grid`, etc.); the design system owns colour/type/spacing.

## Pages already retrofitted

Every page that existed before the design system was ported has since been rebuilt on it — this isn't just tokens/components sitting unused in `components/ui/`:

- `login`, `register`, `register/pending`, `forgot-password`, `reset-password`, `accept-invite` — all on `AuthShell`, matching `ui_kits/member/AuthScreens.jsx`'s Login/Register/Pending screens where one exists.
- `dashboard` — the `ProfileScreen` pattern from `ui_kits/member/MemberApp.jsx` (avatar initials, key/value card, admin quick-links). The rest of that tab bar (Book / My bookings / Events) needs the booking backend from specs 02–06 and isn't built yet.
- `admin/members` — `MembersTable.tsx`, matching `ui_kits/admin/MembersScreen.jsx`: client-side search/sort/filter over a `DataTable`, row actions as real `<form action={serverAction}>` elements (not the mockup's local-state demo actions). The mockup's header "Invite a member directly" button is a modal in the full product; this codebase has no modal pattern yet, so it stays an inline form section instead — a deliberate, noted adaptation, not a miss.
- `admin/ranges` — `RangesTable.tsx`, same `DataTable` pattern as members. No `ui_kits` mockup exists for this screen (only Members/Bookings/Coverage were in the brief), so it was built consistent with the token/component language rather than against a specific reference.

If you're building a new admin list screen, `MembersTable.tsx`/`RangesTable.tsx` are the reference pattern: a client component wrapping `DataTable` for local sort/search state, with row actions as plain `<form>`s pointing at existing Server Actions (Server Actions passed as props into a Client Component work fine in Next.js — no need to convert them to client-side fetch calls).

## The three non-negotiable rules

Carried over verbatim from the design system's own readme, because they're safety-adjacent:

1. **Red is reserved for danger** — no RSO coverage, blackout, destructive actions, rejection. Never a brand or decorative colour.
2. **Nothing safety-relevant is signalled by colour alone.** Status is always colour + icon + word; uncovered coverage additionally gets a diagonal stripe so it survives greyscale and colour-vision deficiency.
3. **A disabled control always states its reason**, in club voice ("Please note: bookings made within 4 hours of the slot cannot be cancelled."), via `disabledReason` — visible on hover, focus *and* tap, since there's no hover on a phone.

## Using it in new work

Every spec's UI work (specs 02–06 onward) builds on these components — no new inline styles, no ad hoc colours/spacing. If a screen needs something the library doesn't have yet, port the missing piece from the Claude Design project rather than improvising a one-off.

- Import from `@/components/ui/<family>/<Component>` (e.g. `import { Button } from "@/components/ui/buttons/Button"`).
- Reach for a token (`var(--sp-6)`, `var(--text-muted)`, ...) before reaching for a raw value.
- Club vocabulary and voice rules (formal, full sentences, no exclamation marks) live in the design system's `readme.md` "CONTENT FUNDAMENTALS" section — worth a skim before writing UI copy.

## Known caveats (flagged by the design system itself)

- **Phosphor Icons is a substitution** — the codebase had no icon set of its own before this. Installed as the `@phosphor-icons/web` npm package and imported directly in `layout.tsx`; swap it if the club has a preference.
- **Fonts** (Source Sans 3, IBM Plex Mono) are self-hosted at build time via `next/font/google` — no third-party font requests at runtime, unlike the design system's own CDN-oriented `tokens/fonts.css`.
- **No range photography** — discipline tiles are icon + label only. `RangePicker` can take an image variant if the club supplies photos.
- Dark mode is fully tokened (`[data-theme="dark"]` on `<html>` re-points every semantic alias) but there's no theme toggle wired up yet — that's a follow-up UI feature, not part of this port.

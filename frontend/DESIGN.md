# SkyGuardian design system

A warm, editorial look inspired by premium travel magazines: calm sand backgrounds, large tight
headlines with one italic serif accent, small monospace labels, hairline rules and a single coral accent.
It must stay **friendly and usable first**: readable sizes, clear labels, obvious buttons, AA contrast.

## Tokens (tailwind.config.ts)

| Token | Use |
|---|---|
| `bg-sand-200` | Page background (default on `body`) |
| `bg-sand-100` | Cards (`.surface`) |
| `bg-sand-50` | Inputs, raised cards (`.surface-raised`) |
| `bg-sand-400` | Deep sand feature section |
| `bg-mist` / `bg-mist-soft` | Dusty-blue section (timelines) |
| `bg-cabin*` | Dark warm hero (cabin wall gradient: `bg-gradient-to-br from-cabin-light via-cabin to-cabin-dark`) |
| `text-ink` / `text-ink-soft` / `text-ink-muted` | Primary / secondary / labels |
| `text-ink-faint` | Decoration only, never text |
| `text-coral` | Large display accents (≥ 24px), dots, icons |
| `text-coral-deep` / `bg-coral-deep` | Small accent text, accent buttons |
| `status-*` + `status-*-bg` | safe, caution, high, danger, unknown pills and panels |

Contrast rules: small text only `ink`, `ink-soft`, `ink-muted` on `sand-50..200`. On `sand-400` and `mist`
use `ink` or `ink-soft`. Bright `coral` never for small text. White text on `cabin` and `coral-deep` is fine.

## Type

- **Display**: `.display` (Inter Tight, semibold, tracking −0.045em, leading 0.95). Hero 6xl–8xl, page titles 4xl–6xl.
- **Accent**: `.accent` (Instrument Serif italic). One accent phrase per headline, usually `text-coral`
  (light backgrounds) or `text-coral-peach` (dark backgrounds).
- **Label**: `.eyebrow` (JetBrains Mono, 11px, uppercase, tracking 0.16em) for section labels like `01 / How it works`.
- **Body**: Inter Tight, `text-base`/`text-lg`, `text-ink-soft`, `leading-relaxed`. Never smaller than `text-sm` for content.

## Layout

- Container: `mx-auto max-w-7xl px-5 sm:px-8`. Sections: `py-20 sm:py-28`.
- Big rounded panels: `rounded-4xl` (hero, feature sections), cards `rounded-3xl`, inputs `rounded-xl`, buttons `rounded-full`.
- Hairlines (`border-ink/10`, `.rule`) instead of heavy borders and shadows. No glows, no neon, no glassmorphism.
- Mobile first: everything must work at 390px wide with no horizontal scroll. Tap targets ≥ 44px.

## Components (`src/components/ui`)

- `SiteHeader` — `variant="overlay"` over a dark hero, `variant="solid"` (sticky) elsewhere; `section="marketing" | "app"`.
  Render it **once per page**. The `(dashboard)` layout already renders it — pages inside that group must not.
- `SiteFooter`, `PageHeader` (eyebrow + title + accent + description + actions).
- `Button` (`primary` ink, `accent` coral-deep, `secondary`, `outline`, `ghost`, `danger`), `Card`, `Badge` (+ `statusLabel()`), `Input` (accessible label/error).
- `WindowIllustration` (hero art, decorative), `Barcode` (boarding-pass decoration).

## Motifs

- **Boarding pass**: big IATA codes (`display text-6xl+`), dashed route line with a plane icon, a field row
  separated by hairlines, and a perforated stub (`bg-coral-deep`, white text, `Barcode`) holding the main action.
- **Timeline**: left column times/step numbers in large light display type, a vertical hairline with coral dots, step rows to the right.
- **Labels**: `NN / SECTION NAME` eyebrows and small mono captions in corners.

## Voice

Plain, calm and honest. Say what the system knows and how sure it is. Mark demo or sample data clearly.
Never present the risk score as a probability. Point people to their airline for final decisions.

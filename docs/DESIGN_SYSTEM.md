# Design system — Yekola Business

This document defines the visual foundations for FOREVER CASHFLOW. The design system is intentionally separate from business rules, Firestore models, stores, and service logic.

## Brand palette

| Token | Value | Intended use |
|---|---|---|
| `--fcf-brand-gold` | `#F9A825` | Brand highlight, progress, subtle emphasis |
| `--fcf-brand-orange` | `#FF6A1A` | Secondary brand accent |
| `--fcf-brand-terracotta` | `#C1440E` | Strong primary actions and emphasis |
| `--fcf-brand-gradient` | Gold → terracotta | Selective brand moments only |

Do not use the brand gradient as a default card or page background.

## Typography

- **Montserrat**: headings and display labels.
- **Poppins**: body copy, forms, and business data.
- Keep numeric values easy to scan and avoid decorative typography in dense data areas.

## Semantic tokens

Use semantic tokens rather than introducing one-off colors:

- Surfaces: `--fcf-background`, `--fcf-surface`, `--fcf-surface-muted`
- Text: `--fcf-foreground`, `--fcf-muted`
- Controls: `--fcf-primary`, `--fcf-primary-foreground`, `--fcf-focus`
- Structure: `--fcf-border`
- Status: `--fcf-success`, `--fcf-warning`, `--fcf-danger`, `--fcf-info`

The `.dark` class on the document root remains the theme switch. It is currently applied by the existing application layout and must not be replaced by a second theme controller.

## Shape and elevation

Use the radius and shadow tokens declared in `src/index.css`. Prefer compact surfaces and subtle elevation. Reserve larger radii for major panels and overlays.

## Accessibility

- Keep visible keyboard focus.
- Never communicate status by color alone; include a label or icon with accessible text.
- Keep touch targets comfortable on mobile.
- Respect reduced-motion preferences in animated components.

## Arc UI integration

The Arc registry namespace is configured in the root `components.json`. Arc components are installed as local source files; they are not a runtime component package. Install only the components needed by a real screen, inspect their dependencies first, and preserve the local source for future maintenance.

Current integration state:
- [x] Design tokens and brand typography added to `src/index.css`.
- [x] shadcn/Arc registry configuration added without changing the existing `@` alias.
- [ ] Install Arc foundation and selected free primitives.
- [ ] Build the internal component showcase and validate light/dark themes.
- [ ] Verify responsive behavior and keyboard interactions.

## Implementation rules

1. Do not change business calculations, Firestore schemas, or service contracts for visual consistency.
2. Do not replace complex business components with generic primitives without a parity review.
3. Prefer semantic tokens in new components; migrate existing hard-coded styles progressively by lot.
4. Keep print styles independent from screen themes.

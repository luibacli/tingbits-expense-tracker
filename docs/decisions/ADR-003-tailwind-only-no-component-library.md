# ADR-003: Tailwind CSS only, no component library

## Status
Accepted

## Context
The owner's CLAUDE.md template listed PrimeVue. For this project the owner asked to keep Tailwind and not use PrimeVue. The app already had a small in-house component set built on native elements.

## Decision
Tailwind CSS 4 is the only styling tool. Standard controls are native elements (`<dialog>`, `<select>`, `<input type="date">`) with shared classes in `main.css` and a few in-house components. No PrimeVue or other component library, and no CSS-in-JS.

## Alternatives Considered
- **PrimeVue (styled or unstyled):** large dependency and its own theming system next to Tailwind.
- **Headless UI libraries:** not needed for the few controls this app uses.

## Consequences
- Smaller bundle and one styling system.
- Accessibility is our job. The rules in CLAUDE.md §6 (roles, labels, focus, 44 px targets, states) are mandatory and checked by Playwright.

## Date
2026-11-09

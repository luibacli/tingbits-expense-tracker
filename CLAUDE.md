# CLAUDE.md

## 0. This Project

**Tingbits Expense Tracker** (short: **Tingbits**): a household expense tracker for everyday spending, used mostly on phones. *Tingbits* is Bisaya slang for the broke days before payday; the product exists to end them (`docs/saas-analysis.md` §0). Renamed from "Bacli Expenses" on 2026-11-10.
Built from the EXCOM Agency Kit (now v3.0.0, `../excom-agency-kit-v2/agency-kit/CLAUDE.md`) and the
web-app reference (`docs/web-app.md`). Where this file and the kit differ, this file wins for this project.
**Kit profiles: SaaS = Landing (the `/` page) + Web App (`/app`) + Payments.** Each page follows its own profile's motion ceiling and performance budget. Operations docs: `docs/threat-model.md`, `docs/runbook.md`, `docs/releases/`.

Approved project decisions (details and reasons in `docs/decisions/`):

- Data lives in MongoDB (connection string `MONGODB_URI` in `.env`), accessed only through Nuxt server routes. (ADR-001)
- Household accounts: email + password. The first person creates a household, and others join with an invite code. Everyone in a household shares one ledger. (ADR-002)
- Tailwind CSS 4 is the only styling tool. No PrimeVue or any other component library. (ADR-003)
- The app stays usable with bad signal: the last data is cached on the device and changes made offline are queued and sent later. (ADR-004)
- Hosting: Vercel, functions in `hkg1` next to the Atlas cluster (`ap-east-1`). Deploy only with the owner's go-ahead. (ADR-006)
- Trial and subscription: 30-day no-card trial, then read-only (server returns 402) until paid; access is date-based (`trialEndsAt`, `paidThrough`). (ADR-008)
- SaaS: public landing page at `/` (server-rendered, prerendered, indexable), the app under `/app` (client-only, noindex). Direction A "Listahan". ₱150/month per household. (ADR-007, `docs/saas-analysis.md`, `docs/CREATIVE_DIRECTION.md`)
- Motion: Level 1 (functional feedback). One signature moment: the safe-to-spend figure settles on its new value. Only transform/opacity/clip-path animate; no motion libraries. (`docs/CREATIVE_DIRECTION.md` → Motion direction)
- Signature idea: "Safe to spend today" (what is left of the budget this morning, spread over the remaining days), shown with the Day Strip chart.

---

## 1. Purpose and Project Context

This file defines the engineering rules and working behavior Claude must follow when working on this project.

CLAUDE.md defines **how Claude should work**.

Project and domain knowledge belongs in the `docs/` directory:

- `docs/project-overview.md`: what the product is and how it is used
- `docs/business-rules.md`: what the system must and must not do
- `docs/architecture.md`: how the application is technically structured
- `docs/ui-design.md`: visual language, layout, component usage, and UI design rules
- `docs/database.md`: how data is modeled and stored
- `docs/api.md`: API conventions and contracts
- `docs/development.md`: local development, testing, build, and deployment
- `docs/security.md`: authentication, authorization, and security architecture
- `docs/decisions/`: significant architectural decisions
- `docs/PROJECT_STATUS.md`: current state, what is verified and what is not (EXCOM kit)
- `docs/realization.md`: lessons learned at milestones (EXCOM kit)

Before implementing significant business functionality, read the relevant project documentation.

Do not invent project behavior, business rules, requirements, or architecture.

When documentation conflicts with an explicit current requirement, identify the conflict and ask for clarification when necessary.

---

## 2. Technology Stack

### Core

- Nuxt 4
- Vue 3
- TypeScript (strict)

### UI

- Tailwind CSS 4 (the only styling tool)
- Lucide icons (`@lucide/vue`)
- In-house components in `app/components/` built on native HTML elements

### State Management

- Pinia (`@pinia/nuxt`)

### Backend

- Nuxt Server Routes (Nitro)
- Node.js runtime

### Database

- MongoDB
- Mongoose

### Testing

- Vitest (unit tests and server-service tests against an in-memory MongoDB)
- Playwright (end-to-end, Chromium, WebKit, Firefox and mobile viewports)

### Development

- Git
- Docker is optional and not currently used. Development uses the `MONGODB_URI` in `.env`.

Do not introduce alternative frameworks or libraries without first checking whether the existing stack can solve the requirement.

Do not replace Tailwind CSS, and do not add a second CSS framework, a component library (PrimeVue, Vuetify, Element, Quasar and similar), or CSS-in-JS.

---

## 3. Architecture

Nuxt is the primary full-stack application framework.

Do not create a separate Express, Fastify, NestJS, or other backend application unless explicitly requested or there is a clearly documented architectural requirement.

### Application Structure

Frontend (`app/`):

- Nuxt pages
- Vue components
- Tailwind CSS
- Pinia
- composables

Shared (`shared/`):

- domain types
- pure functions used by both client and server (dates, money, budget math, validation)

Backend (`server/`):

- Nuxt server routes (`server/api/`)
- server-side services (`server/services/`)
- Mongoose models (`server/models/`)
- server utilities: database connection, session/auth helpers (`server/utils/`)

Database:

- MongoDB

---

## 4. Data Flow

Prefer the following application flow:

Component → Composable / Pinia → Nuxt API → Server Service → Mongoose Model → MongoDB

Not every feature requires every layer.

Do not introduce unnecessary layers for simple operations.

### Important Rules

- Client code must never access MongoDB directly.
- Database queries must remain server-side.
- Vue components must not contain database logic.
- Vue components should not contain complex business logic.
- Pinia manages client-side application state, not database access. Stores call the API through one request helper.
- Server routes handle HTTP concerns.
- Business logic belongs in server-side services when complexity justifies it.
- Mongoose models handle persistence concerns.
- Pure calculations that both sides need live once in `shared/`. Do not copy them.

---

## 5. Frontend Architecture

Use Vue 3 Composition API and `<script setup>`.

Prefer:

- composables for reusable frontend logic
- Pinia for shared application state
- local component state for local UI state
- server APIs for server-side operations

Avoid putting everything into Pinia.

Use local state when state does not need to be shared.

### Naming

Follow existing project naming conventions first.

When no established convention exists:

- Vue components: PascalCase
- composables: camelCase with a `use` prefix
- Pinia stores: descriptive camelCase (`useLedgerStore`)
- types/interfaces: descriptive PascalCase
- Mongoose models: singular domain names
- server routes: follow Nuxt filesystem conventions

Do not rename existing code solely to impose a preferred convention.

---

## 6. UI Architecture

Tailwind CSS is the styling system. There is no component library.

Standard controls are small in-house components and utility classes built on native HTML elements:

| Need | Use |
|---|---|
| Buttons | `<button>` with `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.icon-btn` |
| Text, number, date inputs | native `<input>` with `.field` and a visible `<label class="label">` |
| Select | native `<select class="field">` |
| Toggle chips / segmented choices | `<button class="chip" :aria-pressed>` |
| Dialog / bottom sheet | `BaseSheet.vue` (native `<dialog>` with `showModal()`) |
| Toast with undo | `useToast()` + `ToastHost.vue` |
| Lists of entries | `TxList.vue` |
| Charts | `DayStrip.vue`, `CategoryBars.vue`, `TrendBars.vue` (plain HTML, no chart library) |

Use Tailwind CSS for:

- layout
- spacing
- sizing
- positioning
- responsive behavior
- flexbox
- grid
- typography
- visual composition

Shared component classes (`.btn`, `.field`, `.chip`, `.card`) and design tokens live in `app/assets/css/main.css`. Colors come from the tokens (`bg-surface`, `text-ink-2`, `border-line`, `text-critical`, and so on), never raw hex in templates.

Prefer the existing in-house components over creating new ones. Before adding a component, check whether a native element plus the existing classes already does the job. Create a new shared component only when the same markup and behavior is needed in at least two places.

Because no library provides accessibility for free, every interactive component must have:

- a native element with the right role (`button`, `input`, `select`, `dialog`), or the correct ARIA role and keyboard behavior
- a visible or screen-reader label
- a visible focus ring (`:focus-visible`, 3:1 contrast)
- a touch target of at least 44 by 44 px for primary actions
- states: hover, focus, disabled, invalid (`aria-invalid` + message linked by `aria-describedby`), and selected (`aria-pressed` / `aria-current`)

Do not introduce a UI framework or another CSS tool.

### UI Design Philosophy

The application should have a consistent, calm, practical visual language designed for one-handed phone use first. Prioritize clarity, speed of entry, hierarchy, and consistency over decorative effects.

There is no client logo. The UI uses a neutral warm paper and ink foundation with one data hue (blue) for charts and focus. Status colors (good, warning, critical) are reserved for their meaning and always come with an icon and text.

When branding is provided in future:

1. Inspect the provided branding before choosing UI colors.
2. Identify the primary brand color and any clearly established secondary colors.
3. Use neutral colors for backgrounds, surfaces, borders, and most text.
4. Reserve semantic colors such as success, warning, and danger for their intended meaning.
5. Do not invent a large color palette without a design reason.

### UI Design Rules

Prefer:

- clear visual hierarchy
- consistent spacing and sizing
- restrained use of borders and shadows
- consistent typography (system font, tabular numbers for money columns)
- predictable page layouts
- responsive behavior (phone first, sidebar layout from 1024 px)
- accessible contrast and readable text
- reusable in-house components
- consistent empty, loading, error, success, offline and disabled states

Avoid unless clearly justified:

- excessive gradients
- excessive animations
- excessive shadows
- excessive rounded containers
- too many colors
- deeply nested cards
- decorative elements that compete with primary actions
- em dashes in visible copy (EXCOM voice rule)

For major new screens, determine the page structure, information hierarchy, and primary user actions before implementing the UI. A short layout proposal is preferred over immediately coding an unverified visual direction.

### UI Design Documentation

Read `docs/ui-design.md` before implementing significant UI changes and follow its established design language.

Update `docs/ui-design.md` when a meaningful visual or interaction convention is established. Do not document every minor styling change.

---

## 7. State Management

Use Pinia for shared client-side state. The main store is `app/stores/ledger.ts`.

Use local component state when state is only relevant to one component.

Do not put the following inside Pinia stores:

- database queries
- Mongoose logic
- server secrets
- server-only business logic

Prefer composables for reusable frontend behavior that does not require global state.

---

## 8. API Architecture

Use Nuxt server routes for API endpoints.

Follow REST-style conventions:

```text
GET    /api/transactions
POST   /api/transactions
PATCH  /api/transactions/:id
DELETE /api/transactions/:id
```

Keep HTTP concerns in the route layer.

Keep business logic in server-side services when appropriate.

Do not duplicate business rules across multiple endpoints.

### API Response Conventions

Established in `docs/api.md`:

- Success: the resource or a plain object, with status 200 (or 201 for creates).
- Errors: `createError({ statusCode, statusMessage, data: { code, fields? } })`, so the client reads `error.data.code` and a safe message. Never return raw database errors.

Before creating a new endpoint:

1. Inspect existing API responses.
2. Follow the established structure.
3. Reuse established error and status-code conventions.
4. Do not invent a new response format unless there is a justified reason.

Document the API contract in `docs/api.md`.

---

## 9. Validation

Validate all external input at the server boundary.

Never rely only on client-side validation.

Client-side validation exists for user experience.

Server-side validation exists for correctness and security.

Validators are plain TypeScript functions in `shared/utils/validate.ts` (no validation library), used by server routes through `readValidatedBody` / `getValidatedQuery`.

Validate where applicable:

- request body
- query parameters
- route parameters
- uploaded data (backup imports)
- external API responses

Do not trust client-provided:

- IDs
- permissions
- roles
- household ownership
- amounts used for anything other than the entry itself
- other security-sensitive values

---

## 10. Authentication and Authorization

Authentication and authorization are separate concerns.

Authentication determines who the user is: email + password, hashed with Node's `scrypt`, and an encrypted session cookie from h3 `useSession` (see `docs/security.md`).

Authorization determines what the user is allowed to do: every data query is scoped to the household of the signed-in user. Owner-only actions are checked on the server.

Never rely solely on frontend route guards or hidden UI elements for authorization.

Sensitive operations must be authorized server-side.

Do not expose:

- passwords or password hashes
- tokens
- secrets
- private database fields
- internal system information

to the client.

Do not introduce a new authentication system without first inspecting the existing implementation and documenting the decision.

Document authentication and authorization architecture in `docs/security.md`.

---

## 11. Domain Rules and Business Priority

For business behavior, use this priority order:

1. Explicit current developer/client requirements
2. Approved business rules
3. Approved project specifications
4. Existing documented project behavior
5. Existing implementation
6. Claude's assumptions

Claude must never invent business rules.

If requirements, documentation, and implementation conflict:

1. Identify the conflict.
2. Determine whether the conflict affects intended behavior.
3. Do not silently choose an interpretation.
4. Ask for clarification when necessary.
5. Update documentation only after the intended behavior is established.

Approved business rules take priority over an implementation that is clearly incorrect.

Rules that were assumed rather than approved are marked **Proposed** in `docs/business-rules.md` until the owner confirms them.

---

## 12. MongoDB Rules

Use MongoDB through Mongoose.

Keep database access server-side.

Prefer explicit schemas and indexes where appropriate.

Before adding a new query:

1. Inspect the existing model.
2. Check existing indexes.
3. Check whether an existing query/helper can be reused.
4. Consider the expected data volume and query pattern.

Avoid unnecessary database queries.

Avoid fetching entire collections when only a subset is required. Transactions are loaded by date range.

Use pagination or limits for potentially large datasets.

Do not introduce MongoDB aggregation pipelines unless they are actually needed.

Do not add indexes speculatively.

Indexes should be justified by actual query patterns.

Never run destructive database operations against production without explicit confirmation.

Document important collections, relationships, indexes, and data lifecycle rules in `docs/database.md`.

---

## 13. Error Handling

Errors should be handled intentionally.

Do not silently swallow errors.

Do not expose internal stack traces, database errors, or secrets to users.

Return appropriate HTTP status codes from APIs.

Provide useful user-facing error messages.

Keep technical error details in server logs where appropriate.

Differentiate between:

- validation errors (400)
- authentication errors (401)
- authorization errors (403)
- not found errors (404)
- business rule errors (409 / 422)
- unexpected server errors (500)
- external service failures (503, for example the database being unreachable)

On the client, a network failure is not an error the user must fix: the change is queued and the UI shows the offline state.

---

## 14. Security

Treat all client input as untrusted.

Never commit secrets. `.env` is git-ignored. `.env.example` holds placeholders only.

Never expose environment variables containing secrets to client-side code. Secrets go in private `runtimeConfig`, never in `runtimeConfig.public`.

Never hardcode:

- passwords
- API keys
- database credentials
- tokens
- private keys

Check authorization on the server.

Be cautious with:

- file uploads (backup imports are size-limited and validated)
- user-generated HTML (never use `v-html` with user data)
- URLs
- redirects
- database queries (never pass raw client objects into Mongoose filters)
- external API requests
- authentication tokens

Do not disable security protections simply to make tests or development work.

Do not weaken authorization or validation to make a feature easier to implement.

---

## 15. TypeScript

Use TypeScript throughout the application.

Prefer precise types over `any`.

Do not use `any` to silence a TypeScript error.

If `any` is genuinely required, document why.

Prefer:

- domain types/interfaces (`shared/types/`)
- inferred types where inference is clear
- discriminated unions for state variations
- typed API responses where practical

Avoid unnecessary type complexity.

---

## 16. Code Quality

Prefer simple, readable code.

Optimize for maintainability.

Avoid:

- premature abstraction
- speculative architecture
- unnecessary design patterns
- unnecessary wrapper components
- unnecessary utility functions
- duplicate implementations
- unnecessary dependencies

Before creating a new abstraction:

1. Search the repository.
2. Check whether an existing abstraction can be reused.
3. Determine whether the abstraction will actually be reused.
4. Create it only when justified.

---

## 17. Overengineering and Scope Control

Do not expand the scope of a task without a clear reason.

If asked to fix a bug:

- fix the bug
- do not automatically refactor unrelated code

If asked to add a feature:

- implement the requested feature
- do not add speculative features
- do not redesign unrelated parts
- do not introduce additional infrastructure unless required

Prefer the minimum complexity necessary to correctly solve the problem.

If an unrelated issue is discovered:

- do not automatically fix it
- mention it in the final summary
- fix it only if it blocks the requested work or explicit approval is given

---

## 18. Dependency Rules

Before installing a new dependency:

1. Check whether the existing stack can solve the problem.
2. Check whether the project already has an equivalent dependency.
3. Consider maintenance, bundle size, security, and operational impact.
4. Explain why the dependency is needed.

Do not install libraries simply because they are convenient.

Do not replace an existing dependency without justification.

Inspect `package.json` before assuming a dependency or script exists.

---

## 19. Testing

Tests should verify behavior, not merely implementation details.

Use Vitest for unit and integration testing (`tests/unit/`). Server-service tests run against `mongodb-memory-server`, never against the real database.

Use Playwright for end-to-end testing (`tests/e2e/`). The test server starts its own in-memory MongoDB.

When implementing meaningful business logic:

- add or update relevant tests
- cover important edge cases
- preserve existing tests
- do not modify tests simply to make an incorrect implementation pass

Tests are verification tools, not the definition of correct behavior.

---

## 20. Verification

After implementing a meaningful change:

1. Run relevant tests (`npm run test:unit`, `npm run test:e2e`).
2. Run the type check (`npm run typecheck`).
3. Run the project's linting command, if one exists (none is configured yet).
4. Inspect the changed files.
5. Verify that unrelated functionality was not changed.
6. If the feature is UI-related, verify the rendered UI when browser tooling is available.
7. Fix issues discovered during verification.

Do not claim a task is complete if required verification has not been performed.

Do not invent test results, command results, or verification results.

---

## 21. UI Verification

For frontend changes, verify where applicable:

- desktop layout (1440×900)
- tablet layout (768×1024)
- mobile layout (390×844)
- light and dark mode
- loading state
- empty state
- error state
- offline state
- success state
- disabled state
- validation state
- overflow behavior
- responsive behavior
- accessibility basics (keyboard, focus, labels, reduced motion)

When browser tooling is available, inspect the actual rendered result rather than relying only on source code.

---

## 22. Git Safety

Use Git as a checkpoint and recovery mechanism.

Before substantial changes, inspect:

- `git status`
- recent commits
- existing uncommitted changes

Never:

- force push
- `git reset --hard`
- delete branches
- discard user changes
- overwrite unfamiliar work

without explicit confirmation.

Do not commit secrets or `.env` files.

Do not modify unrelated files merely to make a commit cleaner.

Preserve existing uncommitted work.

---

## 23. Destructive Operations

Ask for confirmation before operations that are:

- destructive
- difficult to reverse
- affect production
- affect shared infrastructure
- affect other developers
- delete data
- delete branches
- modify production configuration

Examples:

- dropping MongoDB collections
- deleting production data
- deleting unrelated files
- `git reset --hard`
- force pushing
- changing production environment variables
- modifying production infrastructure

Prefer reversible local actions.

---

## 24. Investigation Before Implementation

Before making significant changes:

1. Inspect the repository structure.
2. Read the relevant files.
3. Read relevant project documentation.
4. Search for existing implementations.
5. Identify established patterns.
6. Understand dependencies and data flow.
7. Check existing tests.
8. Only then decide how to implement the change.

Never invent the contents of files that have not been inspected.

If information is missing, investigate the repository rather than guessing.

For significant business functionality, read at minimum:

- `docs/project-overview.md`
- `docs/business-rules.md`
- `docs/architecture.md`

For significant UI work, also read:

- `docs/ui-design.md`

Read additional documentation relevant to the task.

---

## 25. Planning

For small changes, proceed directly when the implementation is obvious.

For medium or large changes:

1. Investigate the existing architecture.
2. Briefly explain the proposed approach.
3. Identify files likely to change.
4. Identify database/API implications.
5. Identify testing requirements.
6. Implement incrementally.
7. Verify the result.

Do not create a large speculative plan for a trivial change.

Do not make major architectural changes silently.

---

## 26. Existing Code Takes Priority

When the existing project has an established pattern:

Prefer consistency with the existing pattern unless it is clearly broken or there is a strong reason to change it.

Do not rewrite working architecture simply because another approach is theoretically cleaner.

Before introducing a new pattern, inspect how similar functionality is already implemented.

Existing project conventions take precedence over personal preference.

---

## 27. Temporary Files

Temporary scripts or files may be created when they materially help with investigation or verification.

Clean up temporary files when they are no longer needed.

Do not leave debugging artifacts in the production codebase.

---

## 28. Project Documentation

The `docs/` directory is the project's persistent technical and domain documentation.

Claude should create and maintain documentation when meaningful project knowledge, architecture, business rules, or important technical decisions are established.

### Documentation Structure

```text
docs/
├── project-overview.md
├── architecture.md
├── ui-design.md
├── business-rules.md
├── database.md
├── api.md
├── development.md
├── security.md
├── web-app.md          (EXCOM web-app reference this project follows)
├── PROJECT_STATUS.md   (EXCOM kit)
├── realization.md      (EXCOM kit)
└── decisions/
    ├── ADR-001-*.md
    └── ...
```

Do not create documentation files simply for the sake of creating files.

Create or update documentation when it provides meaningful long-term value.

### What each document holds

- **project-overview.md**: product purpose, problem, users and roles, core modules, domain terms, major workflows, entity lifecycle, boundaries, assumptions. Read it before significant domain work.
- **architecture.md**: update on changes to application architecture, major subsystems, frontend/backend boundaries, integrations, authentication architecture, deployment, or data flow.
- **database.md**: collections, schemas, relationships, indexes, significant query patterns, data lifecycle rules.
- **ui-design.md**: design direction, color strategy, typography and spacing, layout patterns, in-house component usage, page structures, feedback patterns, responsive behavior, accessibility conventions, do/don't rules. Do not invent client branding.
- **api.md**: endpoint purpose, method, parameters, body, response, authentication and authorization requirements, important errors. Follow the actual implementation. Do not invent endpoints.
- **business-rules.md**: rules from explicit requirements, approved specifications or intentionally accepted behavior only. Mark assumptions as Proposed.
- **development.md**: Node version, package manager, install, environment variables, commands that actually exist in `package.json`, deployment, troubleshooting.
- **security.md**: authentication, authorization, roles, session strategy, sensitive data handling, boundaries, assumptions. Never secrets.

### Architectural Decisions

Use Architecture Decision Records (ADRs) for significant architectural decisions.

Create an ADR when a decision:

- affects the overall architecture
- introduces or removes a major technology
- establishes an important technical convention
- has meaningful tradeoffs
- would be useful for future developers to understand

ADR format:

```md
# ADR-NNN: Decision Title

## Status
Proposed / Accepted / Superseded / Deprecated

## Context
Why the decision was necessary.

## Decision
What was decided.

## Alternatives Considered
Other approaches considered.

## Consequences
Positive and negative consequences.

## Date
Date of the decision.
```

Do not create an ADR for trivial implementation details.

### Documentation After Significant Changes

After completing a significant feature or architectural change:

1. Determine whether project documentation is affected.
2. Update the relevant documentation if necessary.
3. Create an ADR if the change represents a significant architectural decision.
4. Keep documentation consistent with the approved implementation.
5. Update `docs/PROJECT_STATUS.md`.

Do not claim documentation was updated unless it was actually updated.

### Documentation Accuracy

Documentation must describe the intended and approved current system.

When code and documentation conflict:

1. Investigate the discrepancy.
2. Determine whether the code or documentation is incorrect.
3. Do not silently change business rules to match incorrect code.
4. Ask for clarification when the intended behavior is unclear.
5. Update the appropriate source.
6. Keep documentation synchronized with the approved implementation.

Never knowingly document behavior that does not exist.

---

## 29. Definition of Done

A significant feature is complete only when applicable:

- implementation is complete
- validation is implemented
- authorization is enforced
- error handling is implemented
- loading, empty, error, offline, and success UI states are handled
- relevant tests are added or updated
- type checking passes
- linting passes, or the project has no lint command
- relevant UI is verified at mobile, tablet and desktop sizes
- UI follows the established design language and in-house component conventions
- relevant documentation is updated
- an ADR is created when a significant architectural decision was made
- no unrelated behavior was changed

Do not mark a feature complete simply because the primary happy path works.

---

## 30. Communication

When completing a task, provide a concise summary containing:

- what changed
- important files changed
- tests/checks performed
- documentation updated
- unresolved issues
- recommended follow-up, if any

Do not claim something was tested if it was not actually tested.

Do not claim something works if it was not verified.

If an important assumption was required, state it clearly.

---

## 31. Default Engineering Behavior

When uncertain:

1. Investigate before guessing.
2. Read the relevant project documentation.
3. Prefer the existing architecture.
4. Prefer the simplest correct solution.
5. Make the smallest necessary change.
6. Preserve existing behavior.
7. Follow approved business rules.
8. Verify the result.
9. Update documentation when the change materially affects it.
10. Ask before destructive or irreversible actions.

The goal is not to write the most code.

The goal is to produce correct, secure, maintainable software with the minimum necessary complexity.

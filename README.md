# TODOP — Personal Task Planner

**🌐 Live App: [todop7.netlify.app](https://todop7.netlify.app/)**

A sleek, mobile-first, local-first progressive web application (PWA) designed for focused task tracking with live countdowns, project organization, instant archive search, and complete offline capability.

---

## Features

- **Live Countdown Timers**: Automatically calculates and updates real-time countdowns (`X D YH ZM`, `X H YM`, `X M`, or `OVERDUE`) grouped into **OVERDUE**, **TODAY**, and **UPCOMING** sections.
- **Project Management**: Group logs under dedicated projects. Supports intuitive drag-and-drop reordering, keyboard-accessible Move Up / Move Down controls, and safe unassignment of logs when a project is deleted.
- **Instant Archive Search**: Real-time case-insensitive search across both active and completed log archives, sorted by nearest deadline (active) and latest modification (completed).
- **Appearance & Typography**:
  - **Theme System**: Default modern Light theme (`#F4F5F7` surface, white cards, `#AEACFF` lavender accent with WCAG AAA accessible `#0D0E15` text) and dark mode with persistent state.
  - **Global Font Scaling**: Responsive root `rem` scaling with **Small**, **Medium**, and **Large** settings.
  - **Typography**: 100% offline bundled [Plus Jakarta Sans](https://fontsource.org/fonts/plus-jakarta-sans) with zero external CDN dependencies.
- **Local-First & Offline PWA**:
  - Service Worker v2 caching application shell and bundled assets for seamless offline operation.
  - Web App Manifest configured for standalone mobile installation.
  - Zero cloud, authentication, or network dependencies — all data is saved locally on the user's device.
- **Atomic Backup & Restore**:
  - Export full application state to a structured JSON file.
  - Comprehensive pre-import validation and confirmation dialog before data replacement, with automatic rollback if persistence fails.
- **Accessibility & Mobile Ergonomics**:
  - Full keyboard support (`Escape` key dismisses sheets, modals, and overflow menus cleanly).
  - Minimum 44×44px touch targets on interactive controls for mobile comfort.
  - High-contrast visual states for overdue items, active tabs, and focus rings.

---
 
## Tech Stack

- **Core Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Tooling**: [Vite](https://vite.dev/)
- **Styling**: Vanilla CSS Design Tokens & CSS Variables (no heavy utility frameworks)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Typography**: `@fontsource/plus-jakarta-sans` (locally bundled)
- **Linting**: [Oxlint](https://oxc.rs/)
- **Testing**: Native TypeScript test suite executed via `tsx`

---

## Project Structure

```text
TODOP/
├── public/
│   ├── _redirects         # Netlify SPA rewrite rule
│   ├── favicon.svg        # Scalable application icon
│   ├── manifest.json      # PWA Web App Manifest
│   └── sw.js              # Offline-first Service Worker
├── src/
│   ├── components/
│   │   ├── common/        # Shared components (FAB, buttons)
│   │   ├── layout/        # TopBar, BottomNav, Navigation shell
│   │   ├── logs/          # UpcomingPage, LogCard, LogFormSheet, EmptyState
│   │   ├── projects/      # ProjectsPage, ProjectDetailPage, ProjectFormSheet, DeleteProjectDialog
│   │   ├── search/        # SearchPage
│   │   └── settings/      # SettingsPage (Appearance, Font Scaling, Backup/Restore)
│   ├── context/           # React storage context & reactive external store
│   ├── hooks/             # Custom hooks (useStorage, useRealtimeTicker)
│   ├── services/storage/  # LocalStorageRepository with atomic validation & rollback
│   ├── styles/            # variables.css (theme tokens) & index.css (global styles)
│   ├── types/             # Domain TypeScript definitions & schemas
│   ├── utils/             # Time formatting, countdown calculations, routing, backup validation
│   ├── App.tsx            # Main application layout & view router
│   └── main.tsx           # Entry point & PWA service worker registration
├── tests/
│   └── unit-and-logic.test.ts # 92 automated regression and logic tests
├── netlify.toml           # Netlify build and routing configuration
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or later
- **npm**: v9.0.0 or later

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/DhruboImtiaz/TODOP.git
cd TODOP
npm install
```

### Development Server

Start the local development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Running Tests

Execute the automated unit and logic test suite:

```bash
npm test
```

### Code Quality & Linting

Run Oxlint across the codebase:

```bash
npm run lint
```

### Production Build

Compile TypeScript and build the production distribution bundle:

```bash
npm run build
```

The optimized static assets will be output to the `dist/` directory.

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

Visit `http://localhost:4173` in your browser.

---

## Deployment

TODOP is live at **[todop7.netlify.app](https://todop7.netlify.app/)**, deployed via [Netlify](https://www.netlify.com/) with automatic continuous deployment from the `main` branch.

### Netlify Configuration

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- SPA routing is handled automatically via `netlify.toml` and `public/_redirects`, ensuring deep links (e.g., `/projects`, `/search`, `/settings`) resolve correctly on page refresh.
- The production build is fully static — no server-side runtime required.

---

## License

This project is licensed under the MIT License.

# Branch1 Desktop App

Tauri 2 desktop shell for the existing Branch1 application.

The shell intentionally reuses the existing production web application instead of rebuilding the dashboard. This preserves the current UI, business calculations, manager access, reports, accordions, and shared backend/database.

Production URL: https://branch1-mu.vercel.app/

## Build
Install Rust + Tauri prerequisites, then run:
- npm install
- npm run dev
- npm run build

The desktop shell is a thin client. Existing Branch1 remains the source of truth.

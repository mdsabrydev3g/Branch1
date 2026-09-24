# Branch1 Mobile App

Capacitor mobile shell for the existing Branch1 application.

The shell intentionally reuses the existing production web application. This preserves the current UI, calculations, manager access, reports, accordions, and shared backend/database.

Production URL: https://branch1-mu.vercel.app/

## Build
Install Node.js and Capacitor prerequisites, then run:
- npm install
- npm run add:android
- npm run add:ios
- npm run sync
- npm run open:android
- npm run open:ios

This first phase is deliberately non-destructive. The app remains connected to the existing shared backend/database.

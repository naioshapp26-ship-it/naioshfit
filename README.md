# Naioshfit — Deployment

This repository is set up to publish the client site to GitHub Pages.

Automatic deploy (recommended)
- A GitHub Actions workflow builds the site and deploys the `docs` folder on push to `main`.

Manual / alternative deploy (optional)
- You can also publish from your machine using the `deploy` script which uses `gh-pages`:

```bash
npm ci
npm run deploy
```

Notes
- `vite.config.ts` now sets `base: '/naioshfit/'` and outputs the build to the `docs` folder.
- After pushing to `main`, check the Actions tab for the deployment status and Pages settings in the repository settings.

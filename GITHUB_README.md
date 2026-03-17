# CultPodcasts Research Companion: Developer Guide

This file contains developer-facing documentation for building, testing, and deploying the CultPodcasts Devvit application.

For public, user-focused project messaging, see `README.md`.

## Tech Stack

- [Devvit](https://developers.reddit.com/) for Reddit app runtime and deployment.
- [TypeScript](https://www.typescriptlang.org/) across client, server, and shared code.
- Reddit-hosted web components in `public/` and `src/client/`.

## Local Development

Prerequisites:

- Node.js `22.x`
- A Reddit account connected to Reddit Developers
- Devvit CLI authentication

Install and run:

```bash
npm install
npm run login
npm run dev
```

Useful commands:

- `npm run dev` starts the live Devvit development environment.
- `npm run build` builds client and server bundles.
- `npm run deploy` uploads a new app version.
- `npm run launch` publishes the latest version for review/use.
- `npm run type-check` runs type-checking, linting, and formatting checks.

## Repository Layout

- `src/client/` client-side app logic.
- `src/server/` server entry points and runtime logic.
- `src/shared/` shared API contracts and types.
- `public/` static assets for splash and game surfaces.
- `tools/` build and TypeScript configuration helpers.

## CI/CD Workflows

This repository includes deployment workflows for test and production subreddit installs.

### Test Subreddit Deploy

Workflow: `.github/workflows/deploy-test-subreddit.yml`

- Triggered on pushes to `main` (app/workflow changes) or manually.
- Uploads latest Devvit version and installs to a test subreddit.

Required setup:

1. Create repository secret `DEVVIT_AUTH_TOKEN`.
2. From a machine where `devvit login` succeeded, copy `~/.devvit/token` into that secret.
3. Set `DEVVIT_TEST_SUBREDDIT` as a repository variable, or pass `subreddit` when running manually.

### Production Subreddit Deploy

Workflow: `.github/workflows/deploy-production-subreddit.yml`

- Manual trigger only.
- Publishes (`npm run launch`) and installs latest version after processing.

Required setup:

1. Reuse `DEVVIT_AUTH_TOKEN`.
2. Provide production subreddit via one of:
	- repository variable `DEVVIT_PROD_SUBREDDIT`
	- repository secret `DEVVIT_PROD_SUBREDDIT`
	- manual workflow input `subreddit`

## Contribution Workflow

1. Create a branch from `main`.
2. Run `npm run type-check` and `npm run build` before opening a PR.
3. Open a pull request with clear release notes and testing notes.

## Episode Create API (Machine-to-Machine)

This app exposes an authenticated endpoint for external systems to create Episode custom posts:

- `POST /api/episode/create`

Authentication uses Auth0 M2M bearer tokens validated against Auth0 JWKS.

Required environment variables:

- `AUTH0_ISSUER_BASE_URL` (example: `https://your-tenant.us.auth0.com`)
- `AUTH0_AUDIENCE` (the API audience configured in Auth0)

Optional:

- `AUTH0_REQUIRED_SCOPE` (default: `episode:create`)

Request body:

```json
{
	"podcastName": "Sounds Like a Cult",
	"title": "Episode 43: High-Control Narratives",
	"description": "A discussion of influence and manipulation patterns.",
	"releaseDateTime": "2026-03-17T16:30:00Z",
	"duration": "1h 12m",
	"serviceLinks": {
		"youtube": "https://www.youtube.com/watch?v=abc123",
		"spotify": "https://open.spotify.com/episode/xyz123",
		"apple_podcasts": "https://podcasts.apple.com/us/podcast/example/id123456?i=100000000"
	},
	"subredditName": "cp_search_dev"
}
```

Response body:

```json
{
	"type": "episode_created",
	"postType": "episode",
	"postId": "t3_abc123",
	"postUrl": "https://reddit.com/r/..."
}
```

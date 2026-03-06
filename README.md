## Devvit Hello World Starter

A starter to build web applications on Reddit's developer platform

- [Devvit](https://developers.reddit.com/): A way to build and deploy immersive games on Reddit
- [TypeScript](https://www.typescriptlang.org/): For type safety

## Getting Started

> Make sure you have Node 22 downloaded on your machine before running!

1. Run `npm create devvit@latest --template=hello-world`
2. Go through the installation wizard. You will need to create a Reddit account and connect it to Reddit developers
3. Copy the command on the success page into your terminal

## Commands

- `npm run dev`: Starts a development server where you can develop your application live on Reddit.
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads a new version of your app
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run type-check`: Type checks, lints, and prettifies your app

## GitHub Action: Deploy To Test Subreddit

This repo includes `.github/workflows/deploy-test-subreddit.yml`.

What it does:

- Runs on pushes to `main` (for app and workflow file changes)
- Supports manual runs via `workflow_dispatch`
- Uploads the latest Devvit app version
- Installs that latest version into your test subreddit

### One-Time Setup

1. Create a GitHub repository secret named `DEVVIT_AUTH_TOKEN`.
2. On a machine where `devvit login` already worked, read your local token file:
	- Path: `~/.devvit/token`
	- Copy the full file contents into the `DEVVIT_AUTH_TOKEN` secret.
3. Set the test subreddit:
	- Option A: set repository variable `DEVVIT_TEST_SUBREDDIT` (for push-triggered deploys).
	- Option B: provide the `subreddit` input when manually running the workflow.

### Run It

- Automatic: push to `main`.
- Manual: Actions -> `Deploy To Test Subreddit` -> `Run workflow`.

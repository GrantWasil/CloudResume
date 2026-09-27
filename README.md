# grantwasil.com

Grant Wasil’s personal website: a short introduction, selected software and systems work, and contact links.

## Local development

```sh
bun install
bun run dev
```

## Quality checks

```sh
bun run check
bun run build
bun run verify:build
```

The production build is generated in `dist/` as a static site.
Only the homepage, a not-found page, three legacy article redirects, and their required public assets are deployable. Design comparisons and private career notes are not part of this repository's build. The verifier enforces that artifact boundary.

## Deployment boundary

The live domain is delivered by Amazon S3 through CloudFront with DNS hosted in Route 53. A gated GitHub Actions workflow can publish verified builds using short-lived AWS OIDC credentials. The AWS resources and credentials are not stored in this repository.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the one-time AWS and GitHub setup, release safeguards, and first-production-deployment checklist.

## Public-content boundary

Current work at Gary Community Ventures is intentionally described at a high level. Do not add employer, partner, project, or outcome details without confirming that they are public-safe.

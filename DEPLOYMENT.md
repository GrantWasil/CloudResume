# Production deployment

The production site is a static Astro build delivered by the existing Amazon S3, CloudFront, and Route 53 resources. GitHub Actions builds and verifies the site before it can publish anything.

## Release flow

1. A pull request targeting `main` runs the Astro checks and produces a build artifact.
2. A merge to `main` repeats those checks.
3. If the AWS repository variables are absent, the workflow reports that deployment is not configured and stops safely.
4. If the variables exist, the protected `production` environment must approve the deployment.
5. GitHub authenticates to AWS with a short-lived OIDC credential, syncs `dist/` to S3, invalidates CloudFront, and smoke-tests every public route.

No permanent AWS access key is stored in GitHub.

## One-time AWS setup

First, identify the existing site resources:

- AWS region
- S3 bucket name
- CloudFront distribution ID

In the IAM console, check whether the AWS account already has an OpenID Connect provider for `https://token.actions.githubusercontent.com` with audience `sts.amazonaws.com`.

- If it does not exist, create a CloudFormation stack from `infra/github-actions-oidc-provider.yml`.
- If it already exists, do not deploy that template again. An AWS account can have only one provider for the same URL.

Next, create a CloudFormation stack from `infra/deployment-role.yml`, supplying the existing S3 bucket and CloudFront distribution. The role trusts only the `production` GitHub environment in `GrantWasil/CloudResume` and can modify only that bucket and distribution.

Record the `DeploymentRoleArn` stack output.

## One-time GitHub setup

Under **Settings → Secrets and variables → Actions → Variables**, create these repository variables:

| Variable | Value |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | The `DeploymentRoleArn` CloudFormation output |
| `AWS_REGION` | Region containing the S3 bucket |
| `S3_BUCKET` | Existing production bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` | Existing production distribution ID |

Under **Settings → Environments**, create an environment named `production` and configure:

- at least one required reviewer for the first release;
- a deployment branch rule allowing only `main`;
- the environment URL `https://grantwasil.com`.

The environment name and branch restriction are security controls. The AWS role trusts the named environment, while GitHub controls which branch is allowed to use it.

## First release

1. Merge the reviewed pull request into `main`.
2. Open the **Build and deploy production** workflow run.
3. Review and approve the `production` deployment.
4. Confirm that the smoke-test job passes.
5. Check the homepage, each article route, the contact links, and the generated sitemap in a browser.

## Cache behavior

Files under `/_astro/` have content-hashed names and receive a one-year immutable cache policy. HTML, images, `robots.txt`, and sitemap files are uploaded with immediate revalidation so content changes appear after the CloudFront invalidation.

## Domain follow-up

The apex domain is the production URL. `www.grantwasil.com` currently has no DNS record. Add a redirect later if both forms of the domain should work.

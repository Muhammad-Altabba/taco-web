# Contribution Guide

Download, install, build, and test with:

```bash
git clone https://github.com/nucypher/taco-web
cd taco-web
pnpm install
```

## Development

Execute common tasks with:

```bash
pnpm build
pnpm test
pnpm lint
pnpm fix
```

## Documentation

Build and publish documentation with:

```bash
pnpm typedoc
pnpm typedoc:publish
```

## Publishing

1. Update version and create tags

For each package in the following order: `shared`, `taco-auth`, `taco`, do the
following:

- Update the `version` value in corresponding `package.json`
- Commit the change using the following commit message:

```
chore(release): release @nucypher/<package>:<new_version>
```

- Tag the commit

```bash
git tag <package>@<version>
```

2. Push the commits, and the tags

```
git push orgin <branch> && git push origin shared@<new_version> && git push origin taco-auth@<new_version> && git push taco@<new_version>
```

- NOTE: each `<new_version>` may be a different value

3. Publish `@nucypher-experimental/shared`, `@nucypher-experimental/taco-auth`
   and `@nucypher-experimental/taco` packages to npm.

Perform a dry run to observe the eventual outcome without actually publishing

```bash
pnpm publish -r --filter '!@nucypher-experimental/pre' --dry-run
```

If the outcome looks good then re-run the command without the `--dry-run`
parameter

```bash
pnpm publish -r --filter '!@nucypher-experimental/pre'
```

View resulting published versions:

- [@nucypher-experimental/shared](https://www.npmjs.com/package/@nucypher-experimental/shared?activeTab=versions)
- [@nucypher-experimental/taco-auth](https://www.npmjs.com/package/@nucypher-experimental/taco-auth?activeTab=versions)
- [@nucypher-experimental/taco](https://www.npmjs.com/package/@nucypher-experimental/taco?activeTab=versions)

4. Tag latest release of `@nucypher-experimental/taco` for various domains where
   appropriate:

```bash
npm dist-tag add @nucypher-experimental/taco@<new_version> devnet
npm dist-tag add @nucypher-experimental/taco@<new_version> testnet
npm dist-tag add @nucypher-experimental/taco@<new_version> mainnet
```

where `<new_version>` is the latest version that was published.

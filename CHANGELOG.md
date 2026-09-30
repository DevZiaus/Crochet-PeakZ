# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Bumped the required Node.js runtime from 22 to 24.20.0 and updated the API package to ESNext modules (`"type": "module"`, `module: ESNext`, `moduleResolution: Bundler`) for faster, native TypeScript execution via `tsx`
- Added a strict ESLint flat config across the monorepo (strict type checked rules, no-default-exports, naming conventions) with workspace specific overrides for the Next.js frontend and Express.js backend
- Added Prettier with consistent formatting (2 space indent, double quotes, semicolons, trailing commas) and a `.prettierignore` covering build outputs and lock files

### Added

- Added Husky pre-commit hooks and lint-staged to run ESLint and Prettier on staged files before every commit
- Bumped `engines.node` requirement to `>=24.20.0` to match the pinned Node.js version

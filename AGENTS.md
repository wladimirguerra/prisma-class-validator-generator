# AGENTS.md

## Project at a glance
- This repo is a **Prisma generator** that emits TypeScript `class-validator` DTO/model classes from a Prisma schema.
- Runtime entry point: `src/index.ts` → `generatorHandler(...)` → `src/prisma-generator.ts`.
- Generation is built with **ts-morph** and writes source files into the configured output directory.

## Core generation flow
- `src/prisma-generator.ts` orchestrates everything: reads Prisma DMMF, creates output folders, generates enums/models/inputs/outputs, then saves the `ts-morph` project.
- `src/generate-class.ts` handles model classes; with `separateRelationFields = "true"` it emits `ModelBase`, `ModelRelations`, and combined `Model` files.
- `src/generate-schema-object.ts` generates Prisma input/output schema object classes under `inputs/` and `outputs/`.
- `src/generate-enum.ts` and `src/generate-helpers.ts` create enum files and the shared `getEnumValues()` helper.

## Important conventions
- Generated import specifiers intentionally use `.js` extensions even in `.ts` output (for example `./UserBase.model.js`, `../enums/index.js`).
- Output is organized as `models/`, `enums/`, `helpers/`, `inputs/`, and `outputs/`; barrel files are generated with sorted exports.
- Optional Prisma fields become `type | null` and are decorated with `@IsOptional()`; required fields use `@IsDefined()`.
- Prisma `Bytes` maps to `Uint8Array`, `Json` to `Prisma.JsonValue`, and `Decimal` uses `typeof Prisma.Decimal` plus `class-transformer` conversions.
- Enum fields use `@IsIn(getEnumValues(EnumType))` and import `getEnumValues` from `../helpers/index.js`.
- Relation fields import related models from `./index.js` to avoid circular imports; self-relations in `Relations` files import the combined model class instead.

## Configuration to know
- Generator options come from Prisma schema config: `output`, `swagger`, and `separateRelationFields`.
- `swagger = "true"` adds `@nestjs/swagger` `@ApiProperty` decorators alongside class-validator decorators.
- A Prisma Client generator must be present in the same schema; both `provider = "prisma-client"` and `provider = "prisma-client-js"` are supported.

## Developer workflow
- Build TypeScript before testing generation logic: `npm run build`.
- Run full generator tests with `npm run test:ci` or watch mode with `npm test`.
- Validate types with `npm run test:type-check`; format with `npm run format:check`.
- For local generator runs, use schemas in `tests/schemas/` with `npx prisma generate --schema=tests/schemas/basic.prisma`.

## Testing patterns
- Tests use Vitest and `tests/utils/prisma-test-helpers.ts`.
- `ensureGeneratorBuilt()` caches `npm run build` so multiple tests reuse the same build.
- Generator tests assert against files in `tests/generated/` and check both file existence and exact emitted content.
- When changing generation behavior, update the relevant schema fixture in `tests/schemas/` and the matching test file together.

## Practical editing tips
- Prefer fixing source under `src/`; `lib/` is generated build output.
- Preserve the existing `ts-morph` pattern: create files with `overwrite: true`, add imports first, then add the class or enum.
- Keep changes focused on the generator pipeline and matching tests rather than broad refactors.

## Contributing
- Contributions are welcome! Please open an issue or submit a pull request.
- Follow the code style and conventions used in the project.
- The commit message format follows `semantic-release` package conventions. Its guidelines for this project are in `.releaserc.json` file.
- Ensure tests pass before submitting a PR.
- Keep PRs focused on a single feature or bug fix.

## License
- This project is licensed under the MIT License.

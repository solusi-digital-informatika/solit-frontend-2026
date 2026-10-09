# Shared contract schemas

`src/index.ts` exports the version, enums, DTO schemas, response-envelope
factories, and inferred TypeScript types for integration contract v1.0.0.

Sync this file with the backend repository before integration. Schema names use
the type name followed by `Schema`; response factories take a payload schema.
Zod is supplied by the root package. Objects strip unknown response fields.
Canonical enum values remain strict so fixtures cannot drift silently.

The frontend contract audit compares exported names and DTO field names with
sections 4–5 of `INTEGRATION_CONTRACT.md`.

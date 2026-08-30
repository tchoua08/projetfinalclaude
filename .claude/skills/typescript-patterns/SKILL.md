---
description: Reviews TypeScript for sound types, safe narrowing, API design, and maintainable language patterns
---

# TypeScript Patterns

Use this skill for `.ts` and `.tsx` files. Report only issues evidenced by the reviewed code.

## Type safety

- Prefer `unknown` plus narrowing to `any`; flag unsafe casts that hide runtime uncertainty.
- Model variants with discriminated unions and require exhaustive handling.
- Avoid non-null assertions unless an invariant is locally proven.
- Keep public interfaces explicit and use inferred types for obvious local values.
- Validate untrusted runtime data before treating it as a TypeScript type.

## API and async design

- Preserve rejected-promise context and use typed domain errors where callers need recovery.
- Do not leave floating promises or mix callbacks with promise control flow.
- Prefer readonly inputs/outputs when mutation is not part of the contract.
- Avoid broad optional fields when separate states or unions communicate invariants better.

## Maintainability

- Use type predicates for reusable narrowing.
- Keep generics constrained and meaningful; avoid generic abstraction for a single concrete case.
- Treat compiler suppressions as high risk unless documented and narrowly scoped.

## Output

For every issue provide its location, severity, impact, and a concrete safer alternative.

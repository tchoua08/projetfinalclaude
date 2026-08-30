---
description: Reviews Python code for correctness, idioms, typing, resource safety, and maintainability
---

# Python Code Review

Use for `.py` files.

- Prefer context managers for files, locks, transactions, and other resources.
- Detect mutable default arguments, overly broad exceptions, swallowed errors, and unsafe dynamic execution.
- Check iterator exhaustion, truthiness ambiguity, timezone-naive dates, and shared mutable state.
- Encourage useful type hints at public boundaries without obscuring simple code.
- Prefer comprehensions only when readable; use explicit loops for complex control flow.
- Verify subprocess arguments, filesystem paths, deserialization, and network inputs are handled safely.

Return localized, severity-ranked findings with concrete fixes.

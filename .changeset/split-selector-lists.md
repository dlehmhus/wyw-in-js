---
'@wyw-in-js/turbopack-loader': patch
---

Emit every member of a selector list as its own `:global()` rule. lightningcss resolves `:global(a), :global(b)` into `:is(a, b)`, which is not equivalent to the list: pseudo-elements are invalid inside `:is()` (every `&::before, &::after { ... }` rule was silently dropped by browsers) and `:is()` takes the specificity of its most specific member, which changed the cascade for lists with unequal members.

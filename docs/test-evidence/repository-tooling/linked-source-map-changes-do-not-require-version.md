### Case REPO-SKILL-HASH-001: Linked source map changes do not require a version

Entry:
- `scripts/lib/skill-package-hash.test.ts > does not require a version for linked source map edits, additions, or deletions`
- `bun test --test-name-pattern="^does not require a version for linked source map edits, additions, or deletions$" ./scripts/lib/skill-package-hash.test.ts`

Contract:
- `scripts/` 内由相邻包内 `.mjs` 的最后一个非空行中完整 `//# sourceMappingURL=<basename>` 指令链接的生成 `.mjs.map` 调试元数据，单独编辑、新增或删除时不承载 skill 版本；其他位置、普通字符串或跨行模板伪引用的 map 继续承载版本。

Proves:
- 真实指令链接的 `scripts/` source map 编辑、基线无 map 的新增与删除都不会产生 metadata.version 提升诊断。
- 包根 linked source map 的变化仍会产生 metadata.version 提升诊断。
- `scripts/` 内仅作为普通字符串出现的伪引用，其 source map 变化仍会产生 metadata.version 提升诊断。
- `scripts/` 内多行模板字符串中的精确文本，其 source map 变化仍会产生 metadata.version 提升诊断。

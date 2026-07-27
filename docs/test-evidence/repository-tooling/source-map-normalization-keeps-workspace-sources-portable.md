### Case GENERATED-FILE-SOURCE-MAP-001: Source map 路径保持可移植
Entry:
- `scripts/lib/generated-file.test.ts > source map normalization keeps workspace sources portable`
- `bun test --test-name-pattern="^source map normalization keeps workspace sources portable$" ./scripts/lib/generated-file.test.ts`
Contract:
- 生成 source map 中的 workspace 源路径必须规范化为可移植相对路径。
Proves:
- 绝对路径和平台分隔符不会泄漏到规范化 source map。

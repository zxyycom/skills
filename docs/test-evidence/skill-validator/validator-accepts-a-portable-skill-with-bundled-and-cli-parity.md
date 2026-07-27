### Case SKILL-VALIDATOR-PORTABLE-001: 可移植 skill 通过源码与 CLI 校验
Entry:
- `tools/skill-validator/tests/run.ts > validator accepts a portable skill with bundled and CLI parity`
- `bun test --test-name-pattern="^validator accepts a portable skill with bundled and CLI parity$" ./tools/skill-validator/tests/run.ts`
Contract:
- 结构和链接合法的可移植 skill 必须通过源码、bundled API 与 CLI。
Proves:
- 三个入口均成功且报告相同 Markdown 文件数量。

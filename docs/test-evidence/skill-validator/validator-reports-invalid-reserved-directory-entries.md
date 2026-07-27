### Case SKILL-VALIDATOR-DIRECTORY-001: 保留目录必须具有目录形态
Entry:
- `tools/skill-validator/tests/run.ts > validator reports invalid reserved directory entries`
- `bun test --test-name-pattern="^validator reports invalid reserved directory entries$" ./tools/skill-validator/tests/run.ts`
Contract:
- `scripts/` 等保留支持目录不能被普通文件占用。
Proves:
- Validator 为错误的 `scripts/` 形态产生明确诊断。

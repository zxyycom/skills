### Case SKILL-VALIDATOR-DIAGNOSTICS-001: 无效 frontmatter metadata 可诊断
Entry:
- `tools/skill-validator/tests/run.ts > validator reports invalid frontmatter metadata`
- `bun test --test-name-pattern="^validator reports invalid frontmatter metadata$" ./tools/skill-validator/tests/run.ts`
Contract:
- Validator 必须独立报告非法名称、目录名称不匹配和空 description。
Proves:
- 三类 frontmatter metadata 错误都产生可定位诊断。

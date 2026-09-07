### Case SKILL-VALIDATOR-ENTRY-STATES-001: 缺失的 skill 入口可诊断

Tests:
- `test:2919c765562ddde121e8f6f3c8a325e36b154205ba34dd0c7a46e21ddee98828`

Tags:
- `skill-validator`

Contract:
- Skill 目录缺少 `SKILL.md` 时必须返回明确的入口缺失诊断。

Proves:
- 缺失入口不会被误判为有效 skill。

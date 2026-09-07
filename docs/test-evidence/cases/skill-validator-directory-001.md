### Case SKILL-VALIDATOR-DIRECTORY-001: 保留目录必须具有目录形态

Tests:
- `test:29946c298403dd3137496c362949a57ee4e74cb53221db6f783abd8546374fc0`

Tags:
- `skill-validator`

Contract:
- `scripts/` 等保留支持目录不能被普通文件占用。

Proves:
- Validator 为错误的 `scripts/` 形态产生明确诊断。

### Case INVESTIGATION-RENAME-LEGACY-PATH-001: 候选同路径更新 legacy 身份

Tests:
- `test:57ab1cf9db8328e4923e957ecde429e9a6bef4a5b75e93e423ca2113285d42c7`

Tags:
- `investigation-report`

Contract:
- 旧候选同名迁移到日期 ID 时，即使 locator 不变也须更新声明身份。

Proves:
- 真实候选 old 重命名为 261106-old 后提交，原 locator 内容声明新 ID。

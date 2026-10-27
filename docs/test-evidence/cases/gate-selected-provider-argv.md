### Case GATE-SELECTED-PROVIDER-ARGV-001: Definition 把必要 skill 传给生成命令

Tests:
- `test:e450547ff8c8a13f5f5cbba51922a94e3960d12289f5f326e8d33a21b1b7024d`

Tags:
- `repository-tooling`

Contract:
- selected 生成 provider 命令显式重复 --skill 传入必要域；changed/full 与明确全量生成保持全量命令。

Proves:
- 从实际 Definition 检查 mcpshell、mcpshell+test-evidence、共同 reader 三种 provider argv 的精确 skill 集合；generated-artifacts、changed 与 full 均无 --skill。

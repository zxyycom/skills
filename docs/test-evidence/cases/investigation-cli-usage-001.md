### Case INVESTIGATION-CLI-USAGE-001: CLI uses invalid-option exit status for malformed list input

Tests:
- `test:8b1a4fbe28a527977ed9434324b27c6729303749622064387114dc6338bb1f4a`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口对非法报告级 list 选项返回稳定用法错误。

Proves:
- 非正整数 `--limit` 返回退出码 2、stdout 为空且 stderr 给出该选项的诊断。

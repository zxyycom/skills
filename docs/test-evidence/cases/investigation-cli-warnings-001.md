### Case INVESTIGATION-CLI-WARNINGS-001: CLI show requires one Investigation ID

Tests:
- `test:21ad3cdbb4ceb281821e0df3b9516f00ab13b7cca0ac4e0cf724a98910e16b1f`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `show` 只接受一个明确 Investigation ID。

Proves:
- 省略 ID 返回退出码 2、stdout 为空且 stderr 给出用法诊断。

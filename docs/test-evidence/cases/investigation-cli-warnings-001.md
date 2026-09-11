### Case INVESTIGATION-CLI-WARNINGS-001: CLI show requires one Investigation ID

Tests:
- `test:85dca3710ebfbbbccbf8e20c93b7ce2aa474ce198adcf6947540c29103b0b1f4`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `show` 只接受一个明确 Investigation ID。

Proves:
- 省略 ID 返回退出码 2、stdout 为空且 stderr 给出用法诊断。

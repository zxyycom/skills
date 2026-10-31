### Case INVESTIGATION-CLI-WARNINGS-001: CLI show requires one Investigation ID

Tests:
- `test:499d65aed3abe151be5962079d91fa50f1cb728dfb38b30a569e70a794a2d9d6`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `show` 只接受一个明确 Investigation ID。

Proves:
- 省略 ID 返回退出码 2、stdout 为空且 stderr 给出用法诊断。

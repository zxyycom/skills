### Case INVESTIGATION-CANDIDATE-CLI-001: candidate CLI separates creation success from readiness

Tests:
- `test:eba7a2d3e1becb4a6d609d61695e10e7b61a2f496b96d9ed9ba3a2709102e604`

Tags:
- `investigation-report`

Contract:
- `new` 成功创建候选后以退出码 0 报告正文 readiness，而保留候选文件名或成员安全错误仍阻断正式集合检查。

Proves:
- CLI 创建空正文 candidate 返回成功、在 stderr 指向编辑和 `publish --preflight`，并可由 `show-candidate` 读取。
- 不规范保留候选文件仍作为根目录安全错误阻断默认检查。

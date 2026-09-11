### Case INDEX-RUNTIME-STAGING-REPOSITORY-001: 暂存前报告可执行的仓库发现失败

Tests:
- `test:c8af51abc8307f8c083950b73956a0bef7a175ccd1a88abc976957515c28d87a`

Tags:
- `index-runtime`

Contract:
- 按 ID 暂存依赖可用的版本管理仓库；仓库发现失败必须与 revision 文件读取失败分开诊断并给出下一步，但只读失败不得虚构 pending mutation。

Proves:
- 非仓库根目录返回 `revision-read-failed` 和 `state-index.repository-unavailable`，并保留 `not-repository` 的共享诊断事实。
- 诊断要求选择由仓库承载的根目录后重试，结果不包含 pending scope/outcome。

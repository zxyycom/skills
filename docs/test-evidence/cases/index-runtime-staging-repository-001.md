### Case INDEX-RUNTIME-STAGING-REPOSITORY-001: 暂存前报告可执行的仓库发现失败

Tests:
- `test:eaf661fc7cb5ef0960c742320059c120814055a834f9b02742c32cab11f13709`

Tags:
- `index-runtime`

Contract:
- 按 ID 暂存依赖可用的版本管理仓库；仓库发现失败必须与 revision 文件读取失败分开诊断并给出下一步，但只读失败不得虚构 pending mutation。

Proves:
- 非仓库根目录返回 `revision-read-failed` 和 `state-index.repository-unavailable`，并保留 `not-repository` 的共享诊断事实。
- 诊断要求选择由仓库承载的根目录后重试，结果不包含 pending scope/outcome。

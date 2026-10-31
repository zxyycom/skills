### Case INDEX-RUNTIME-STAGING-TOOL-UNAVAILABLE-001: 暂存前报告不可用的版本控制工具

Tests:
- `test:4a2ad3dc33a62c3f70f3ac0766e7d495e15568fd6191041ee91bc4ca3df25f88`

Tags:
- `index-runtime`

Contract:
- 暂存前的仓库打开属于只读边界；工具不可用必须与仓库不存在和 pending 写入失败分开报告，且不得虚构 mutation。

Proves:
- 注入 `tool-unavailable` 的仓库打开错误返回 `revision-read-failed` 和 `state-index.repository-tool-unavailable`，并保留共享 operation、target 和 detail。
- 失败不调用 pending 替换，也不返回 pending scope/outcome。

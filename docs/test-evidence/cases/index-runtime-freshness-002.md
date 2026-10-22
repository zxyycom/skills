### Case INDEX-RUNTIME-FRESHNESS-002: 保持绑定快照稳定并由 runtime 刷新旧索引

Tests:
- `test:c47f156c7019e5b5c4e379dc562129a95429a753580ada37acdca064e3487055`

Tags:
- `index-runtime`

Contract:
- 已打开 reader 保持原快照，runtime 直接操作必须检测源修订变化并在同步后读取新状态。

Proves:
- 源变化后 runtime 返回 `state-index.index-stale`；同步后的新 reader 读取 archived，既有 reader 仍读取 active。

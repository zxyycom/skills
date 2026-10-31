### Case MCPSHELL-BRIDGE-FILE-004: workspace put reports a failed no-replace link without calling it an existing destination

Tests:
- `test:e7970b591fcdd36a9e0e3a55721be18eb5906045edb6fff0fa848cc84e31b4f7`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- no-replace 的同目录 hard-link commit 失败时，只有已存在 destination 才能归类为 `destination_exists`；其他 link 失败必须保留 target failure，不能误报冲突。

Proves:
- 隔离 SSH fixture 令 `ln` 在 destination 缺失时失败；result 为 `target_exit` 且含稳定 link-failure diagnostic，目标文件仍不存在。

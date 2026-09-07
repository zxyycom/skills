### Case MCPSHELL-BRIDGE-FILE-004: workspace put reports a failed no-replace link without calling it an existing destination

Tests:
- `test:7264c70cba0baf4a221dcb205b733b9c7665771490956917575bd7db8ccd30a5`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- no-replace 的同目录 hard-link commit 失败时，只有已存在 destination 才能归类为 `destination_exists`；其他 link 失败必须保留 target failure，不能误报冲突。

Proves:
- 隔离 SSH fixture 令 `ln` 在 destination 缺失时失败；result 为 `target_exit` 且含稳定 link-failure diagnostic，目标文件仍不存在。

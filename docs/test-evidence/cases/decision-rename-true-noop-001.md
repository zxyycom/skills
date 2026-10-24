### Case DECISION-RENAME-TRUE-NOOP-001: 同身份同路径改名是真零写

Tests:
- `test:325852b3cbb0e199fe08c5565a38ca811284c93e3b31d6da6cef87e3af8bcf4a`
- `test:6853127a1705285e49950e79ef665c834a02188ef4a3c5fa8cd205cf3d452e61`
- `test:70fa7e564871aaec2446ed7c82bb0d3aa47b05b789d5c83d54b091e9b486304a`
- `test:ba2b3dc12cd9fe416216a6c3596625b69fcc4e0b12ed13bf9aca32ccdd65c668`

Tags:
- `decision-records`

Contract:
- 同 ID 同路径 rename 仍须核对所选正式来源的发布 revision；允许跨日同名，独立 fresh 保持同一局部选择边界。不规范正文、索引或 mode，也不要求历史改名确认。

Proves:
- Git 已记录的来源包含非规范合法正文且无关正文失效时，SDK rename 仍返回 changed=false，原始来源、inode、mode 与 index 全部保持。
- 所选正式正文未同步编辑时，预检与正式 no-op 均明确 sync-index 失败，来源 bytes、inode、mode 和索引保持。
- 另一日期候选同名不阻断完整 ID no-op，双方来源与索引均保持。
- name 路径被正式项占用、所选候选位于 canonical 路径时，fresh 不扩大候选范围；未选候选健康或 header 损坏均零读取，no-op 成功且字节保持。

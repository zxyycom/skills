### Case DECISION-RENAME-TRUE-NOOP-001: 同身份同路径改名是真零写

Tests:
- `test:49af9f2199d340d1436e3daf1d3da89a7cc1d3ba2ef6bf36573d7e9f5c03eeb8`
- `test:b2067d92df5fc218c344e7e956c99ed6fe8a25e20a0fd7840797055c2adb2b01`
- `test:e40bde4a4ee54d2f10347fdb89acd06c14ee3cef0bf892991593e36bf428612e`
- `test:f630de6246698a217dc89094ac4c9d4740a3fba5787dfbf3690f72151b055329`

Tags:
- `decision-records`

Contract:
- 同 ID 同路径 rename 仍须核对所选正式来源的发布 revision；允许跨日同名，独立 fresh 保持同一局部选择边界。不规范正文、索引或 mode，也不要求历史改名确认。

Proves:
- Git 已记录的来源包含非规范合法正文且无关正文失效时，SDK rename 仍返回 changed=false，原始来源、inode、mode 与 index 全部保持。
- 所选正式正文未同步编辑时，预检与正式 no-op 均明确 sync-index 失败，来源 bytes、inode、mode 和索引保持。
- 另一日期候选同名不阻断完整 ID no-op，双方来源与索引均保持。
- name 路径被正式项占用、所选候选位于 canonical 路径时，fresh 不扩大候选范围；未选候选健康或 header 损坏均零读取，no-op 成功且字节保持。

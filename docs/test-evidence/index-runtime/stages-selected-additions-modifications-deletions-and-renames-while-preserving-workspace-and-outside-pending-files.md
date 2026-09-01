### Case INDEX-RUNTIME-STAGING-SELECTION-001: 选择性暂存条目变化与逐条 Revision

Entry:
- `tools/index-runtime/tests/staging.test.ts > stages selected additions modifications deletions and renames while preserving workspace and outside pending files`
- `bun test --test-name-pattern="^stages selected additions modifications deletions and renames while preserving workspace and outside pending files$" ./tools/index-runtime/tests/run.ts`

Contract:
- 按 ID 暂存必须以 revision 索引为基线，只把选中条目的工作区 state 与逐条来源 revision 成对写入目标索引。

Proves:
- 真实 Git 仓库中同时选择新增、修改、删除和重命名身份后，pending 索引只保留目标条目，并为每项配对采用对应来源指纹。
- 反转相同选择集合不改变确定性目标文本，runtime 方法只接收 selected IDs。
- 工作区索引、领域文件和目标外 pending 内容保持不变。

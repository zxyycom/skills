### Case DECISION-STAGE-OVERLAY-001: Stage 应用显式增加修改删除与重命名

Entry:
- `tools/decision-records/tests/stage.test.ts > stage applies selected additions modifications deletions and explicit renames`
- `bun test --test-name-pattern="^stage applies selected additions modifications deletions and explicit renames$" ./tools/decision-records/tests/stage.test.ts`

Contract:
- 所选路径在 revision 与 filesystem 中的存在状态分别表达增加、修改和删除；重命名由旧路径删除与新路径增加共同显式表达。

Proves:
- pending 精确应用所选增加、修改和删除，并移除显式选择的旧名称路径。
- 重建索引只包含最终目标路径集合，且 `sourceRevision` 与同一 pending 来源一致。

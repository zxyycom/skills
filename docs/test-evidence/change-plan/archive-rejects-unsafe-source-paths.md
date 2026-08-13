### Case CHANGE-PLAN-ARCHIVE-SOURCE-001: 归档拒绝不安全源路径
Entry:
- `tools/change-plan/tests/archive.test.ts > archive rejects unsafe source paths`
- `bun test --test-name-pattern="^archive rejects unsafe source paths$" ./tools/change-plan/tests/run.ts`
Contract:
- 归档源必须是当前活动 Change 的真实目录，并在移动前保持与初次检查相同的文件系统身份。
Proves:
- 符号链接、已归档目录、普通文件和不可检查路径分别返回源路径诊断且不进入内容检查。
- 初次检查后被另一目录替换的源路径返回 `changed before archive`，原目录与替换目录均保持存在。

### Case VERSION-CONTROL-STATES-001: 分离读取 pending 索引内容与 workspace 状态
Entry:
- `tools/shared/tests/version-control.test.ts > reads pending index content separately from workspace state`
- `bun test --test-name-pattern="^reads pending index content separately from workspace state$" ./tools/shared/tests/version-control.test.ts`
Contract:
- pending 内容取自 Git 索引，workspace 文件与变化列表反映工作树、排除忽略项并支持字面路径范围。
Proves:
- staged 文本和二进制保持索引内容与稳定顺序，未跟踪文件只出现在 workspace 视图。
- 多个字面文件范围只返回范围内的已跟踪或未忽略工作区文件。
- 越过仓库根的工作区文件范围在执行 Git 查询前以 `invalid-path` 拒绝。

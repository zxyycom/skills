### Case CHANGE-PLAN-SHOW-SYMLINK-001: Show 不读取符号链接外部内容
Entry:
- `tools/change-plan/tests/catalog.test.ts > show does not read symbolic-link directories or artifacts`
- `bun test --test-name-pattern="^show does not read symbolic-link directories or artifacts$" ./tools/change-plan/tests/run.ts`
Contract:
- `show` 只能读取真实 Change 目录中的普通 artifact；目录或 artifact 为符号链接时返回空内容，不跟随链接读取 Change 外部数据。
Proves:
- 源码函数与 JSON CLI 对 active 或 archived 链接目录均返回全空 artifacts，对 active 链接 `proposal.md` 返回 `null`，且所有输出都不包含外部 marker。
- Archived 链接目录返回 `check: null` 与查询错误，不进入 checker 或外部目标。

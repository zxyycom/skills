### Case TASK-GRAPH-LOCK-ABA-001: stale claimed generation 的双回收者不得隔离后来发布的新 owner

Entry:
- `tools/task-graph/tests/store.test.ts > stale recovery never isolates a fresh owner published after observation`
- `bun test --test-name-pattern="^stale recovery never isolates a fresh owner published after observation$" ./tools/task-graph/tests/run.ts`

Contract:
- 两个回收者观察同一 stale `owner-O.claimed-by-Rold` 时，必须各自发布唯一 reclaimer，并以精确 owner-generation rename 决定唯一胜者；胜者隔离前后复验 claimed owner 与自己的 reclaimer，失败者重新读取 canonical generation，不能沿用旧 directory 观察隔离新鲜 owner。

Proves:
- B/C 同时接管 stale claimant Rold 时只有精确 rename 胜者进入 isolation seam；胜者隔离旧 generation 并发布 fresh owner N 后，失败者及在 directory `lstat` 后暂停的旧观察者都会重读 N、超时而不偷锁，最终只有胜者提交一次 mutation。

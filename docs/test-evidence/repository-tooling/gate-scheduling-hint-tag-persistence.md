### Case GATE-SCHEDULING-TAG-PERSISTENCE-002: completed 时长提示按 active tag 集合保存并用于后续 Definition

Entry:
- `scripts/vibe-check.test.ts > completed duration hints are isolated by active tag set and only alter later admission order`
- `bun test --test-name-pattern="^completed duration hints are isolated by active tag set and only alter later admission order$" ./scripts/vibe-check.test.ts`

Contract:
- base 与 release tag 独立保存当前 active Check 的有限非负时长；关键路径排序只要求 active executable Check 具有完整提示，未激活 Check 保留在完整 Definition 中但不影响 admission。未知 Check、损坏或不完整的 active 提示不改变 Gate 结算，并回退声明顺序。

Proves:
- release 写入不会覆盖 base 提示；base 的完整 active hint 会实际改变 active admission 顺序，release-only catalog Check 仍保留且顺序不变；损坏 base 文件会被忽略。

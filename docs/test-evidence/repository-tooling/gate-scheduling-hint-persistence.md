### Case GATE-SCHEDULING-PROFILE-PERSISTENCE-002: completed 时长提示按 profile 保存并用于后续 Definition

Entry:
- `scripts/vibe-check.test.ts > completed duration hints are profile-local and only alter later admission order`
- `bun test --test-name-pattern="^completed duration hints are profile-local and only alter later admission order$" ./scripts/vibe-check.test.ts`

Contract:
- default 与 full 独立保存已完成 Check 的有限非负时长；未知 Check、损坏或不完整提示不改变 Gate 结算，并回退声明顺序。

Proves:
- full 写入不会覆盖 default 提示，损坏 default 文件会被忽略。

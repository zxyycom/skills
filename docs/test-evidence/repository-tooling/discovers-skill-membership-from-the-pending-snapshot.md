### Case SKILL-PACKAGE-HASH-006: 从同一 pending 快照发现 skill 成员与内容
Entry:
- `scripts/lib/skill-package-hash.test.ts > discovers skill membership from the same pending snapshot as its files`
- `bun test --test-name-pattern="^discovers skill membership from the same pending snapshot as its files$" ./scripts/lib/skill-package-hash.test.ts`
Contract:
- Skill hash 与打包必须从同一版本管理 pending 快照恢复成员集合和包内文件，不能由工作区目录另行决定成员。
Proves:
- 已进入 pending、随后从工作区删除的完整 skill 仍被发现，并保留其暂存版本与文件内容。
- 只存在于工作区而未进入 pending 的 skill 不进入快照、hash 版本集合或版本基线判断。

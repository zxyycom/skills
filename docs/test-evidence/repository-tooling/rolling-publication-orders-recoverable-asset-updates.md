### Case SKILL-RELEASE-PUBLISH-001: 滚动发布按可恢复顺序同步资产
Entry:
- `scripts/publish-skills.test.ts > rolling publication replaces packages before manifest and removes stale assets`
- `bun test --test-name-pattern="^rolling publication replaces packages before manifest and removes stale assets$" ./scripts/publish-skills.test.ts`
Contract:
- `skills-latest` 更新先移动并推送滚动 tag，再覆盖 skill zip，最后覆盖 manifest；当前资产可用后才删除旧资产并更新 Release 元数据。
Proves:
- 命令序列先执行 Git tag 与 push，再依次上传全部 zip 和 manifest。
- 不属于当前制品的资产在上传完成后删除，Release 元数据最后更新。
- CLI 成功时返回退出状态零并报告已更新的滚动 tag。

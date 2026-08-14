### Case SKILL-RELEASE-PUBLISH-005: 滚动发布可从缺失状态创建
Entry:
- `scripts/publish-skills.test.ts > rolling publication creates a verified latest release when absent`
- `bun test --test-name-pattern="^rolling publication creates a verified latest release when absent$" ./scripts/publish-skills.test.ts`
Contract:
- `skills-latest` Release 不存在时，发布入口先确认远端缺失，再推送当前提交对应的 tag，并从完整资产集创建 GitHub Latest。
Proves:
- 缺失分支只读检查后依次更新本地 tag、推送远端 tag 和创建 Release。
- 创建 Release 时要求 tag 已存在、标记 GitHub Latest，并把 manifest 放在资产列表末尾。

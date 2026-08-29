### Case PROJECT-MARKDOWN-SCOPE-001: 主 Markdown 收集排除形成时字节

Entry:
- `scripts/check.test.ts > main Markdown collection excludes archived changes and investigation resources`
- `bun test --test-name-pattern="^main Markdown collection excludes archived changes and investigation resources$" ./scripts/check.test.ts`

Contract:
- 主仓库链接校验只收集 active 与当前维护 Markdown，不把归档 Change 或 Investigation Report 的形成时资源纳入持续链接义务。

Proves:
- active Change、调查根目录中的非资源 Markdown 与根 README 被收集。
- archived Change 和 `_resources` 下的 Markdown 被排除。

# Test Evidence

### Case TEST-EVIDENCE-CONFIG-PATH-001: 不可检查的 catalog 路径被拒绝
Entry:
- `tools/test-evidence/tests/config-path.test.ts > rejects a catalog path that cannot be inspected`
- `bun test --test-name-pattern="^rejects a catalog path that cannot be inspected$" ./tools/test-evidence/tests/run.ts`
Contract:
- Test evidence 配置必须拒绝无法安全检查的 uninspectable catalog 路径。
Proves:
- 该路径返回 blocking `config.path-inspection-failed` 诊断且不写入索引。

### Case TEST-EVIDENCE-QUERY-REPOSITORY-001: 仓库 case 可按契约与证明检索
Entry:
- `tools/test-evidence/tests/repository-catalog.test.ts > queries the repository catalog by contract and proof terms`
- `bun test --test-name-pattern="^queries the repository catalog by contract and proof terms$" ./tools/test-evidence/tests/run.ts`
Contract:
- Test evidence 查询必须把当前仓库目录投影为可检索 case metadata。
Proves:
- 跨 Contract 与 Proves 的多词查询只返回匹配 case ID。

### Case TEST-EVIDENCE-SHOW-REPOSITORY-001: 仓库 case 可展开权威 Markdown
Entry:
- `tools/test-evidence/tests/repository-catalog.test.ts > shows the authoritative Markdown for a repository case`
- `bun test --test-name-pattern="^shows the authoritative Markdown for a repository case$" ./tools/test-evidence/tests/run.ts`
Contract:
- Show 必须把已登记 case ID 解析回权威 Markdown 块。
Proves:
- 已知 case 返回自身内容且不混入相邻 case。

### Case TEST-EVIDENCE-PATH-IDENTITY-001: Catalog 路径身份拒绝别名与硬链接
Entry:
- `tools/test-evidence/tests/run.ts > catalog paths reject aliases, hard links, and platform-equivalent identities`
- `bun test --test-name-pattern="^catalog paths reject aliases, hard links, and platform-equivalent identities$" ./tools/test-evidence/tests/run.ts`
Contract:
- 配置、catalog 与索引路径必须按平台和文件身份保持互异。
Proves:
- 词法别名、大小写等价路径和同 inode 硬链接都产生路径冲突。

### Case TEST-EVIDENCE-MISSING-INDEX-001: 缺失索引时从 catalog 回退
Entry:
- `tools/test-evidence/tests/run.ts > missing indexes fall back to the catalog for validation and queries`
- `bun test --test-name-pattern="^missing indexes fall back to the catalog for validation and queries$" ./tools/test-evidence/tests/run.ts`
Contract:
- 索引缺失时，校验和查询必须读取权威 catalog 并返回非阻断诊断。
Proves:
- 两个 case 仍可查询，`state-index.index-missing` 不阻断读取。

### Case TEST-EVIDENCE-INDEX-SYNC-001: 索引同步写入有效可检索快照
Entry:
- `tools/test-evidence/tests/run.ts > index synchronization writes a valid searchable snapshot`
- `bun test --test-name-pattern="^index synchronization writes a valid searchable snapshot$" ./tools/test-evidence/tests/run.ts`
Contract:
- 写入同步必须从 catalog 生成当前有效的派生索引。
Proves:
- 同步返回 written，随后目录和索引校验无诊断。

### Case TEST-EVIDENCE-DAMAGED-INDEX-001: 损坏索引可回退并重建
Entry:
- `tools/test-evidence/tests/run.ts > damaged indexes fall back to the catalog and can be rebuilt`
- `bun test --test-name-pattern="^damaged indexes fall back to the catalog and can be rebuilt$" ./tools/test-evidence/tests/run.ts`
Contract:
- JSON 损坏但可恢复的索引不得阻断 catalog 查询，并应允许重建。
Proves:
- 查询返回当前 case 与非阻断诊断，写入同步恢复有效索引。

### Case TEST-EVIDENCE-QUERY-SHOW-001: 多主题 Catalog 支持精确列出、搜索与展示
Entry:
- `tools/test-evidence/tests/run.ts > catalog queries list, search, and show exact cases`
- `bun test --test-name-pattern="^catalog queries list, search, and show exact cases$" ./tools/test-evidence/tests/run.ts`
Contract:
- List、search 和 show 必须跨主题文件使用同一 catalog case 身份与正文。
Proves:
- ID 顺序、源文件定位、契约词搜索、证明词搜索及 Markdown 展开均返回精确结果。

### Case TEST-EVIDENCE-LEGACY-FIELD-001: Catalog 拒绝旧 Verification 字段
Entry:
- `tools/test-evidence/tests/run.ts > catalog validation rejects legacy verification fields`
- `bun test --test-name-pattern="^catalog validation rejects legacy verification fields$" ./tools/test-evidence/tests/run.ts`
Contract:
- 测试专用 catalog 不接受已经移除的 `Verification` 分类字段。
Proves:
- `test` 与 `check` 两种旧字段值都产生结构诊断。

### Case TEST-EVIDENCE-ENTRY-LIST-001: Catalog 要求非空且唯一的 Entry
Entry:
- `tools/test-evidence/tests/run.ts > catalog validation requires one non-empty unique entry list`
- `bun test --test-name-pattern="^catalog validation requires one non-empty unique entry list$" ./tools/test-evidence/tests/run.ts`
Contract:
- 每个 case 必须且只能声明一个非空 Entry 列表，列表项不得重复。
Proves:
- 缺失 Entry 和重复 locator 都被目录校验拒绝。

### Case TEST-EVIDENCE-CROSS-TOPIC-ID-001: Case ID 在全部主题中唯一
Entry:
- `tools/test-evidence/tests/run.ts > catalog validation rejects duplicate case IDs across topics`
- `bun test --test-name-pattern="^catalog validation rejects duplicate case IDs across topics$" ./tools/test-evidence/tests/run.ts`
Contract:
- Case ID 是统一目录身份，不能在不同主题文件中重复。
Proves:
- 两个主题声明相同 ID 时返回包含双方源路径的 `catalog.case-id-duplicate` 诊断。

### Case TEST-EVIDENCE-TOPIC-MEMBERSHIP-001: 主题集合与文件都必须非空
Entry:
- `tools/test-evidence/tests/run.ts > catalog validation rejects empty topic sets and topic files`
- `bun test --test-name-pattern="^catalog validation rejects empty topic sets and topic files$" ./tools/test-evidence/tests/run.ts`
Contract:
- Catalog 目录必须包含主题 Markdown，且每个主题文件至少承接一个 case。
Proves:
- 空主题集合返回 `catalog.empty`，无 case 的主题文件返回可定位的 `catalog.topic-empty`。

### Case TEST-EVIDENCE-STALE-INDEX-001: 过期索引回退到当前 catalog
Entry:
- `tools/test-evidence/tests/run.ts > stale indexes fall back to current catalog content`
- `bun test --test-name-pattern="^stale indexes fall back to current catalog content$" ./tools/test-evidence/tests/run.ts`
Contract:
- 派生索引落后于 catalog 时，查询与展示必须使用当前正文。
Proves:
- Case 仍可读取，同时返回非阻断 `state-index.index-stale` 诊断。

### Case TEST-EVIDENCE-UNREADABLE-INDEX-001: 不可读索引阻断 list 与 show
Entry:
- `tools/test-evidence/tests/run.ts > unreadable indexes remain blocking for list and show operations`
- `bun test --test-name-pattern="^unreadable indexes remain blocking for list and show operations$" ./tools/test-evidence/tests/run.ts`
Contract:
- 无法安全读取且不可回退的索引错误必须阻断 list 与 show。
Proves:
- 两种操作都不返回 case，并报告 blocking `state-index.index-read-failed`。

### Case TEST-EVIDENCE-DISTRIBUTED-CLI-001: 分发模块与 CLI 保持查询契约
Entry:
- `tools/test-evidence/tests/run.ts > distributed module and CLI preserve catalog query contracts`
- `bun test --test-name-pattern="^distributed module and CLI preserve catalog query contracts$" ./tools/test-evidence/tests/run.ts`
Contract:
- 分发模块和 CLI 必须与维护源码共享 catalog 查询及失败语义。
Proves:
- 正常 list 返回全部 case，不可读索引在 list 与 show 中都以失败退出。

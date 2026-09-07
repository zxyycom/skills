# 测试证据 Case 账本契约

本引用定义 `test-evidence-review` 的 Case、实体快照、派生索引、查询、引用检查和迁移边界。触发、最小原生测试入口判断、证明价值审查与维护流程由 [SKILL.md](../SKILL.md) 承接。

## 目录与 Case

测试证据根固定为 `docs/test-evidence/`，根目录只允许：

1. `cases/`：直属普通 Markdown 文件，每个文件恰好一个 Case；空目录合法。
2. `test-evidence-index.json`：从完整 Case 集合重建的派生索引。

根或 `cases/` 缺失表示未初始化，不自动创建 Case。拒绝符号链接、硬链接身份冲突、嵌套目录、非 Markdown 成员和不支持的根成员。调用方只能用 `--root` 或 `workspaceRoot` 选择工作区，不能配置 Case 根、索引路径或 Case ID 规则。

每个文件名为 kebab-case `<semantic-slug>.md`，但 Case ID 只由首行决定：

```markdown
### Case AUTH-ROLE-ACCESS-001: 未授权修改被拒绝

Tests:
- `test:example-a`

Tags:
- `access-control`

Contract:
- 已存在资源只允许具备修改权限的用户写入。

Proves:
- 未授权请求返回权限错误。
```

精确规则：

- ID 匹配 `^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-[0-9]{3}$`，全集合唯一；标题非空且无首尾空白。
- 字段顺序固定为 `Tests:`、可选 `Tags:`、`Contract:`、`Proves:`；每个至多一次，拒绝未知字段、额外 Case 与字段外正文。支持 LF/CRLF 和字段间空行。
- Tests 至少一个反引号包裹的非空不透明 token，禁止空白、反引号和控制字符；唯一且词法排序。核心不解释 runner 前缀。
- Tags 缺失表示无标签；存在时至少一个反引号包裹、唯一且词法排序的 kebab-case token。tags 只筛选，不决定目录、身份、topic 或行为 owner。
- Contract、Proves 各至少一个非空单行列表项，保持人工顺序。Tests 共同支持 Case 的 Proves；不保存证明点映射或反向关系表。

重命名或移动意图连续的测试可保留 Case ID；拆合测试不自动拆合 Case。任何 Tests 正文变化都要求重审 Contract 与 Proves。

## 实体快照与引用检查

核心不发现项目测试。项目显式提供严格 JSON：

```json
{
  "schemaVersion": 2,
  "source": {
    "projectId": "example-project",
    "scopeId": "registered-tests",
    "revision": "opaque-source-snapshot-id"
  },
  "completeness": "complete",
  "entities": [
    {
      "id": "test:example-a",
      "name": "拒绝未授权修改",
      "locators": ["tests/access.test.ts > 拒绝未授权修改"]
    }
  ]
}
```

- source 三字段均为 trim 后非空单行文本；`revision` 是项目拥有的不透明输入标识，不等于 Git 或时间戳。
- completeness 只能是 `complete` 或 `partial`。partial 是合法交换状态，但引用门禁必定阻断；采集失败以生产者失败表示，不以空实体伪装成功。
- entities 按 ID 词法排序且 ID 唯一；每项的 ID 是 Tests 可用的不透明 token，name 非空单行，locators 非空、唯一、排序的单行文本。定位信息只供阅读。
- API/CLI 同时接收独立的 `expectedSource`。它必须来自本次项目输入，不能从快照复制后自证；任一 source 字段不匹配、快照无效或 partial 时先返回阻断，不输出实体缺失结论。
- 默认检查完整 Case 集合；可选 `caseIds` 必须非空、唯一且都存在。结构、source 和 complete 均有效后才逐项检查 Tests 引用。未引用的快照实体在核心中合法；项目若需要完整覆盖，在核心调用之后实施自己的门禁。
- 成功只说明相对于输入快照的引用有效，不说明当前源码相同、测试已经执行通过或 Proves 充分。

引用结果使用 schemaVersion 6：`status` 仅在 `state: valid` 时为 `ok`；state 为 `valid`、`case-invalid`、`snapshot-invalid`、`snapshot-incomplete`、`source-mismatch` 或 `references-invalid`。诊断只使用 `case`、`snapshot`、`reference`、`index`、`query` 分类。

## 索引与查询

索引使用通用 `schemaVersion: 4`、`namespace: test-evidence`、`definitionVersion: 6`，metadata 为严格空对象。`entries[Case ID]` 只保存：

```json
{ "title": "…", "sourcePath": "cases/example.md", "tags": ["…"], "testIds": ["test:…"] }
```

source revision 的 metadata 来自空对象；每个 entry 来自 `sourcePath` 和 LF 规范化的完整 Case 字节。索引不保存 Contract、Proves、搜索文本、实体详情或快照身份。

| 操作 | 输入与结果边界 |
| --- | --- |
| `list` / `tags` | 只读持久索引，返回 `source: index`、`currentness: unchecked`；不读 Case 或快照。索引无效、缺失或版本不符时阻断并提示同步。 |
| `show` | 索引定位一个 Case，读取并核对该 Case 身份与来源指纹；漂移阻断。 |
| `search` | 先核对当前 Case revision，再只搜索筛选后的权威正文；读取期间变化或资源上限阻断。 |
| `check` | 验证完整 Case 根、目录安全、索引结构和当前性；不读实体快照。 |
| `sync-index` | 从完整合法 Case 重建索引，只写索引；selected sync 保留完整验证和受限接纳。 |
| `stage-index` | 只暂存所选 Case 的索引条目；definitionVersion 首次切换必须整体暂存索引。 |

list 的 `--id`、重复 `--tag` 的 AND 和单个 `--test` 都是精确过滤；未知 tag/test 返回合法空集。结果按 Case ID 升序，limit 默认 20、范围 1–1000，offset 为非负安全整数。search 支持 NFKC、忽略大小写的 `all`、`any`、`phrase`，并受 10,000 候选、2 MiB/文件、20 MiB/请求边界约束；无法形成完整集合时不报告成功 total。

## CLI 与 API

唯一分发 CLI 和公开 API：

| CLI | API |
| --- | --- |
| `check` | `validateTestEvidence({ workspaceRoot })` |
| `check-refs --snapshot <file> --expect-project <id> --expect-scope <id> --expect-revision <value> [--case <id> ...]` | `validateTestEvidenceReferences({ workspaceRoot, snapshot, expectedSource, caseIds? })` |
| `list [--id <id>] [--tag <tag> ...] [--test <id>] [--limit <n>] [--offset <n>]` | `queryTestEvidence(...)` |
| `tags` | `listTestEvidenceTags({ workspaceRoot })` |
| `show <case-id>` | `showTestEvidenceCase(...)` |
| `search <text> [--match all\|any\|phrase] [--tag <tag> ...] [--test <id>]` | `searchTestEvidence(...)` |
| `sync-index [--select <case-id> ...] [--write]` | `syncTestEvidenceIndex(...)` |
| `stage-index <case-id...>` | `stageTestEvidenceIndex(...)` |

全部 CLI 接受 `--root` 和 `--json`。参数形状错误退出 2，领域、文件、查询、引用或同步失败退出 1，成功退出 0。JSON 模式下可预期领域结果写 stdout，usage 与启动失败不伪装为领域成功。

## 迁移

旧 topic/`Entry:` 目录不是运行时输入。仅受支持的旧布局和本仓库实际预演/写入步骤见[旧 Topic 账本升级](upgrade-from-legacy-topic-catalog.md)。显式 `migrate:test-evidence` 默认预演，必须同时接收 snapshot 和独立 expected source；每个保留旧 Case 映射为 `cases/<小写-case-id>.md`，保留 ID、标题、Contract、Proves，并把旧 topic 作为初始 tag。

每个旧 Entry 必须通过快照 locator 精确匹配唯一真实实体；零、多或无法解释的匹配阻断，不能哈希旧字符串伪造实体。预演校验旧源 fingerprint、expected source、目标冲突并列出新增/删除路径；旧索引只作复核。只有明确追加 `--write` 才写入，写入前重验并保存已知源的原始字节与权限备份；新 Case 和索引发布后才移除已验证旧源。失败仅恢复仍可确认属于本事务的字节，保留并报告并发现场；不递归删除未知路径。

# 实体快照与集成接口

本文件供快照生产者和 CLI/API 集成者使用；Case 作者先读[账本契约](catalog-contract.md)，证据责任由 [SKILL.md](../SKILL.md) 承接。

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

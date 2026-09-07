# Test Evidence Review

`test-evidence-review` 用于把保留的最小原生测试入口与可复核的测试证据 Case 一起维护。它不替代产品测试、构建校验或覆盖率工具；它保存测试为什么值得保留、共同证明什么以及如何定位已登记证据。

## 何时使用

在新增、修改、删除或审查测试实现时使用，也可用于查询、修复或整理 Case。只运行既有测试、只修改被测对象、lint 或构建检查不触发本 skill。

Case 的粒度来自 runner 能稳定独立选择并单独报告的最小命名测试节点。suite、测试文件、package script、CI job 是容器；fixture、helper、mock、断言和测试步骤不是独立 Case。先盘点本次保留入口及其证据责任；测试拆分或合并时，按测试意图决定 Case 是否保留、拆分、合并或删除，不能按容器或实体 ID 机械处理。

## Case 账本

账本固定在项目的 `docs/test-evidence/`：

```text
docs/test-evidence/
├── cases/
│   └── <semantic-slug>.md
└── test-evidence-index.json
```

每个 Markdown 保存一个 Case，标题中的稳定 Case ID 不由文件名推导。Case 使用 `Tests:` 记录一个或多个项目实体 ID，可选 `Tags:` 仅用于筛选，`Contract:` 概括应保持的规则，`Proves:` 写可观察结果。一个 Case 可以共同引用多个实体，实体也可被多个 Case 引用；不维护 topic、证明点映射、Case 图或反向人工关系表。

索引是可删除重建的查询快照：`list` 与 `tags` 只读取它，因此结果的 currentness 为 unchecked；`show` 核对一个权威 Case，`search` 读取当前 Case 正文。修改 Case 后应同步索引，而不是手工编辑 JSON。

## 项目快照与检查

通用核心不扫描或执行项目测试。项目可显式产生 schema v2 实体快照，并把独立的 `expectedSource` 一并传给引用检查。只有 snapshot 完整、source 完全匹配且 Tests 引用存在时，引用检查才有效；结果不等同于测试通过、源码新鲜或 Proves 充分。

核心允许未被任何 Case 引用的快照实体。项目若要求全部发现实体都有 Case，应在调用核心之后实施自己的项目覆盖门禁。

## 常用操作

从 skill 的分发目录或项目维护入口执行：

```text
node scripts/test-evidence-catalog.mjs check --root <project>
node scripts/test-evidence-catalog.mjs list --tag <tag> --root <project>
node scripts/test-evidence-catalog.mjs tags --root <project>
node scripts/test-evidence-catalog.mjs show <case-id> --root <project>
node scripts/test-evidence-catalog.mjs search <text> --root <project>
node scripts/test-evidence-catalog.mjs sync-index --write --root <project>
node scripts/test-evidence-catalog.mjs stage-index <case-id...> --root <project>
```

`stage-index` 只暂存所选 Case 的派生索引条目，不会暂存 Case Markdown、测试或产品代码；跨 index definition 的首次迁移必须整体暂存索引。

旧 topic/`Entry:` 目录须使用显式迁移入口，先以真实项目快照预演全部映射。零、多或无法解释的旧 Entry 必须阻断；正常运行时不兼容读取旧格式。受支持旧布局、预演、`--write` 和失败恢复边界见[旧 Topic 账本升级](../../skills/test-evidence-review/references/upgrade-from-legacy-topic-catalog.md)。

完整字段、JSON 协议、CLI/API、资源边界与迁移恢复要求见 [Case 账本契约](../../skills/test-evidence-review/references/catalog-contract.md)。

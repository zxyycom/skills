---
name: test-evidence-review
description: >-
  在新增、修改、删除或审查测试实现，或查询、整理其测试证据 Case 时使用。
  先以测试框架能稳定独立选择并单独报告结果的最小原生测试入口界定 Case，
  审查其 Contract 与 Proves，再维护可检索的 Case-only 账本。
  工程校验、仅运行既有测试或只修改被测对象不使用。
metadata:
  version: "25"
---

# Test Evidence Review

## 使用判断

本 skill 处理测试实现及其测试证据账本。新增、修改、删除或审查测试实现，以及查询、整理或修复已登记 Case 时使用；lint、构建、只运行既有测试或只改被测对象时不使用。

触发后，先盘点本次范围内的**保留最小原生测试入口**；每个入口都必须有明确的 Case 证据责任。最小入口是 runner 能稳定独立选择、单独报告结果、且不含可分别归因的更小原生测试节点的命名节点。测试文件、suite、脚本、CI job 是容器；fixture、helper、mock、断言和步骤是内部环节，不单独登记。参数化测试按 runner 实际报告粒度判断。

Case 以测试意图而非一对一实体关系组织：一个 Case 可以在 `Tests:` 中列出多个实体以共同支持同一 Contract 与 Proves，同一实体也可被多个 Case 引用。测试重命名、移动、拆分或合并时，先判断意图是否连续，再保留、拆分、合并或删除 Case；不从实体 ID、容器或引用检查自动推导这些决定。该模型不建立证明点映射、Case 关系图或反向人工表。

## 读取路径与 owner

1. 本文件承接触发、粒度、证据审查、维护流程和完成标准。
2. 写入、结构修复、查询或引用检查时完整读取 [Case 账本契约](references/catalog-contract.md)。它是字段、固定目录、索引、JSON 快照、CLI/API 和迁移边界的 owner。
3. 审查或修改测试时读取项目测试约定、目标测试、当前 diff 和被测行为 owner。`Contract:` 只压缩理解当前测试所需的稳定背景，不取代行为 owner。
4. 工作区仍有旧 topic/`Entry:` 目录时，读取契约中的迁移边界与[旧 Topic 账本升级](references/upgrade-from-legacy-topic-catalog.md)；旧布局只由显式迁移入口处理，不由正常查询兼容读取。其他历史布局不在当前入口或迁移器的支持范围内，先人工恢复为受支持的旧布局或另行建立迁移方案。

核心工具只读写固定 Case 根和派生索引；它不扫描测试源码、执行测试、运行采集命令、调用网络或自动登记 Case。项目可以产生实体快照并实行“所有发现实体都有 Case”等项目覆盖策略，但这不是通用 skill 或核心引用检查的责任。

## 证据审查

确定最小入口后，逐项判断：

1. **Contract**：测试关联的产品规则、接口行为、schema、安全边界或错误语义清楚且仍应维护。
2. **Proves**：失败能指向可判断的外部观察，而非只复述实现或 mock。
3. **可观察性与可靠性**：断言、输入、fixture、时序、随机性和环境能给出稳定信号。
4. **独立性与价值**：预期不由被测实现生成，新增价值足以承担维护成本。

多个断言可共同服务一个测试意图；已经构成可独立命名、可独立失败意图的观察点应先拆成不同原生入口和 Case。测试重命名、移动、拆分或合并时，依据意图连续性重审 Case ID、Contract 和 Proves；不以实体 ID 或引用检查自动替代语义判断。

## 维护流程

### 查询或审查

1. 确认只读范围、目标测试或 Case，读取必要的行为和测试 owner。
2. 先用 `list`、`tags` 或 `search` 缩小范围，再以 `show <case-id>` 读取权威正文。
3. 区分最小入口、聚合容器与内部环节，按证据审查得出结论；只读任务不改测试、Case 或索引。
4. `list` 与 `tags` 只表示最近同步的索引快照；`show` 核对目标 Case 身份，`search` 读取当前权威正文。索引无效或陈旧时按诊断先同步，不把旧索引冒充当前事实。

### 修改测试或账本

1. 列出本次新增、保留、修改或删除的最小原生测试入口及预期 Contract。
2. 搜索已有 Case，按意图连续性决定保留、拆分、合并或删除 Case；新增或删除入口本身不自动决定 Case 的增删。列出最终每个保留入口由哪个 Case 承接，再继续写入。
3. 按账本契约写入 `Tests:`、可选 `Tags:`、`Contract:` 和 `Proves:`。Tests 只使用项目快照中真实存在的实体 ID；tags 只做筛选，不能表达 topic、目录、身份或行为 owner。
4. 运行 `sync-index --write`；需要隔离索引 pending 时，先完整验证目录，再用 `stage-index <case-id...>`。它不暂存 Case Markdown、测试或产品代码。
5. 项目提供 snapshot/check 时，调用方独立提供 `expectedSource`，再执行引用检查。完整快照且来源一致时，核心只证明所选 Case 的实体引用有效；partial、来源不符或缺失实体阻断。它不证明测试执行通过，也不要求快照中未引用实体失败。
6. 运行目标测试、Case `check` 和项目要求的覆盖检查；报告测试失败、被测对象失败、Case 结构失败和快照/引用失败的区别。

## Case 与查询模型

固定根为 `docs/test-evidence/`：`cases/<semantic-slug>.md` 是权威单 Case Markdown，`test-evidence-index.json` 是可删除重建的派生索引。根或 `cases/` 不存在时表示未初始化；目录只允许这两类成员。Case ID 来自标题，不由文件名推导；文件移动不改变身份。

`Tests:` 至少一个不透明实体 ID；`Tags:` 缺失表示无标签；`Contract:` 与 `Proves:` 各至少一个人工可读的单行观察。Case 的 Tests 集合共同支持其 Proves，不要求每个实体单独证明全部条目。精确 Markdown、目录安全、索引 revision、分页、搜索资源上限、JSON snapshot 和稳定 CLI/API 以 [Case 账本契约](references/catalog-contract.md) 为准。

常用维护命令：

```text
node scripts/test-evidence-catalog.mjs check --root <workspace-root>
node scripts/test-evidence-catalog.mjs list --tag <tag> --root <workspace-root>
node scripts/test-evidence-catalog.mjs tags --root <workspace-root>
node scripts/test-evidence-catalog.mjs show <case-id> --root <workspace-root>
node scripts/test-evidence-catalog.mjs search <text> --root <workspace-root>
node scripts/test-evidence-catalog.mjs sync-index --write --root <workspace-root>
node scripts/test-evidence-catalog.mjs stage-index <case-id...> --root <workspace-root>
```

## 完成标准

### 只读任务

- 已说明最小原生入口、所属容器、Contract、Proves、证据判断和需要的动作。
- 未越过只读授权；索引快照、实体快照和实际测试结果的边界清楚。

### 修改任务

- 已盘点本次范围内每个保留最小原生测试入口，并说明其 Case 证据责任；测试拆合后的 Case 保留、拆分、合并或删除与意图一致。
- Case 不登记容器或内部环节；Tests 是真实实体，Contract 与 Proves 可独立理解。
- Case-only 目录和派生索引已同步；目标测试、Case 检查及适用的项目快照/覆盖检查已运行，或未验证边界已说明。
- 选择性暂存时，Case IDs 和 pending 范围已核对，未把其他 Case、测试或项目文件误称为已暂存。

交付说明实际改动、测试和目录验证、未运行环境及残余风险。

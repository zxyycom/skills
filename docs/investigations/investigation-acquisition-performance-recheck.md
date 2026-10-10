---
title: "调查读取职责收敛后的性能复查"
id: "261010-investigation-acquisition-performance-recheck"
formedAt: "2026-10-10T07:11:53Z"
question: "发布快照、局部验证、候选与 domain 暂存按职责取源后，重复正文读取与 Git 进程是否减少且关键写入保护仍成立？"
tags:
  - "performance"
  - "root-cause-analysis"
  - "skill-tooling"
relations:
  - type: "复查"
    target: "261009-skill-cli-repeated-process-and-source-access"
    summary: "同样本复查 Investigation，Decision保持原边界"
---

## 形成时背景

前序调查在 `3b5f1475` 确认候选正文立方级重复读取、局部资源检查逐条发现以及 domain 暂存逐 owner/文件启动 Git。本轮在 `3e6e8cd7` 基线上复现，再按用户授权收敛 Investigation 的职责和读取范围。新实现尚未提交；旧报告的条件、数字和观测保持原样。

## 调查目的

复查重复获取共同事实的机制是否消除，区分快照查询、局部证明、全集合法性及写前复核；验证减少访问未取消来源与 pending 的正确性边界。Decision 暂存平方扫描不属于本轮修复。

## 调查范围与依据

- 2026-10-10，Node 26.8.2、Bun 1.4.2、Git 2.53.0、Python 3.14.7；before 为主仓库基线生成 CLI，after 为其上尚未提交的实现。首次实现与最终优化的实际生成 CLI 指纹分别保存在随附观测中；两个 after 阶段均真实重放同样本。
- 复用前序的[隔离计数脚本](./_resources/261009-skill-cli-repeated-process-and-source-access/measure-process-access.py)，运行 `--count 1 --count 20`。样本无关系、metadata 合法，带资源样本每条一个普通文本资源；formal 已同步并提交，pending 起初等于 HEAD。Git 初始化、提交及暂存只在自动清理的隔离目录，未改主仓库 pending。
- Git Trace2 按 start/session 计进程；Node 局部观察器计 `fs/promises.readFile` 并保留原返回值。formal 样本依次运行局部 check、全量 check、fileMode=true 与 false 的 domain stage；读取次数含集合内索引，不全等于正文次数。
- 主仓库 48 条报告的 list 与 metadata search 补充观测，before 各读正式 Markdown 96 次/48 个文件，after 各 0 次；before 未留逐调用日志。after 可用[只读快照计数脚本](./_resources/261010-investigation-acquisition-performance-recheck/measure-snapshot-query-access.py)复现。最终优化阶段在 49 条已发布报告上重放同样查询，两者仍各读正式 Markdown 0 次；这证明当次访问边界，不依赖报告总数固定。
- 根因调用链与职责实现位于 `tools/investigation-report/src/`；共享表示批次位于 `tools/shared/src/version-control/git-workspace-file.ts`。独立可选择的测试入口和证明义务见 `docs/test-evidence/cases/investigation-acquisition-*.md` 与 `version-control-workspace-batch*.md`，测试通过不证明所有并发现场。

## 调查结果与边界

### 同条件计数

每项选择全部 N 条样本；下表为 before → after。

| 对象 | N=1 | N=20 |
| --- | ---: | ---: |
| 候选正文 readFile，带资源与无资源相同 | 6 → 1 | 5250 → 20 |
| 带资源 candidates Git | 4 → 2 | 80 → 2 |
| 无资源 candidates Git | 2 → 0 | 40 → 0 |
| 带资源局部 check Git | 2 → 2 | 40 → 2 |
| 局部 check 集合内 readFile | 3 → 2 | 60 → 21 |
| 无关系全量 check Git | 9 → 2 | 9 → 2 |
| 全量 check 集合内 readFile | 7 → 3 | 121 → 41 |
| domain stage Git，fileMode=true | 24 → 24 | 214 → 24 |
| domain stage Git，fileMode=false | 28 → 26 | 294 → 26 |
| domain stage 配置读取 | 4 → 2 | 80 → 2 |
| domain stage 集合内 readFile | 8 → 7 | 122 → 102 |

[首次 before/after 观测](./_resources/261010-investigation-acquisition-performance-recheck/observations.json)保留每条原始摘要、命令分布与单次耗时。[最终优化观测](./_resources/261010-investigation-acquisition-performance-recheck/final-optimization-observations.json)保留优化阶段各次真实观测；`rechecks` 中最后一项对应最终 CLI 的指纹与结果。全部命令、Git 与文件访问计数与首次 after 相同，上表适用于两次实测。Decision domain stage 的集合内读取仍为 4/441，Git 仍为 15/15；archive 也未优化。单次时间噪声不能推导稳定时延或承诺固定加速比，未测 after N=100。

### 根因闭合与实际动作

- list、trace、metadata search 的职责是严格查询最后发布索引。删除越界 freshness 调用及查询前同步义务后，入口不再读全集，metadata 来源固定 unchecked；这不是证明当前集合新鲜。
- 已索引 show/局部 check 直接定位目标，读取时检查普通文件与目标身份。移动或新增正式 ID 必要时做一次身份发现；无关候选或报告错误不冒充局部证明对象。
- 候选列表共用一次身份、源字节、解析和资源准备，正式 owner 按直接资源需要读取。样本候选正文从立方增长变成每条一次；正式/候选资源可见性仍由各自引用验证。
- domain stage 全集门禁校验关系与资源，准备和写前复核各批量列所选 owner 成员并读文件表示。core.fileMode 每阶段一次，false 的 pending 表示每阶段一次；仍独立复核 ID、来源指纹、成员、字节、执行位，以及外层 HEAD/pending 锁与漂移。
- 无前序关系不探测 Git，HEAD 无报告不把空路径变成全仓库读取。全量检查保留结束来源复核，因此其读取并非强行降为一次全集。

当前测试明确覆盖 source-free 查询、普通目标与 symlink 拒绝、移动/新身份、正式 owner 资源共享、批次两阶段成员和来源漂移、非法资源所有权、执行位 true/false、空路径、pending symlink 与冲突。正确性复核另确认合法 legacy ID `constructor` 会与对象继承成员混淆；定位与 owner 发现改用索引自有成员判断，三个独立回归在修复前均失败、修复后均通过，分别覆盖未索引身份发现、正式 owner 共享和 HEAD-only 删除暂存（见 `docs/test-evidence/cases/investigation-legacy-identity-membership.md`）。候选读取准备的访问故障另由独立回归覆盖：candidates 与 show-candidate 返回只读 access-denied 诊断、读取恢复动作及不变的候选正文，不附创建事务或 mutation 结果（见 `docs/test-evidence/cases/investigation-candidate-read-failure.md`）。这些测试支持选定契约，不证明任意资源拓扑、平台或并发时序。

本轮实现与分发产物仅写入工作区，未暂存、提交或推送。

## 随附资源

- [复用前序隔离样本脚本](./_resources/261009-skill-cli-repeated-process-and-source-access/measure-process-access.py)
- [最终优化阶段重测摘要](./_resources/261010-investigation-acquisition-performance-recheck/final-optimization-observations.json)
- [只读快照查询计数脚本](./_resources/261010-investigation-acquisition-performance-recheck/measure-snapshot-query-access.py)
- [before/after 完整计数摘要](./_resources/261010-investigation-acquisition-performance-recheck/observations.json)

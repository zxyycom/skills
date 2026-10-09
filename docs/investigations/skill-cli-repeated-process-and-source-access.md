---
title: "其他 Skill CLI 的重复进程与集合读取"
id: "261009-skill-cli-repeated-process-and-source-access"
formedAt: "2026-10-09T03:33:16Z"
question: "Change 之外的 Skill CLI 是否重复访问同一 Git 上下文或集合来源，哪些路径已形成可复现的扩展问题？"
tags:
  - "git-integration"
  - "performance"
  - "root-cause-analysis"
  - "skill-tooling"
relations: []
---

## 形成时背景

Change Plan 已在单次集合查询内共享仓库、HEAD 与基线历史。用户继续询问其他 skill 是否也存在频繁进程访问。本报告调查仓库快照 `3b5f14751da1e7007ac27a551f7fd787b225f165` 的其他本地 CLI。

## 调查目的

通过调用链与规模对照，定位重复进程和集合读取，区分可共享的查询事实与必要的写前复核，并判断减少 Git 次数是否足以改善总耗时。

## 调查范围与依据

- **源码范围**：盘点 `skills/` 下 24 个 skill 的脚本分发入口，重点分析 Investigation Report、Decision Records 和共享版本控制层。使用 CodeGraph 恢复调用关系，再补读源码与行为契约。
- **计数方法**：通过仓库短命令调用生成 CLI；按 Git Trace2 的 session ID 统计 `start` 事件。Node 局部计数器观察 `fs/promises` 调用并保留原返回结果。Git 次数涵盖整个领域命令，不含 Bun/Node 启动。
- **运行环境**：2026-10-09，Node 26.8.2、Bun 1.4.2、Git 2.53.0、Python 3.14.7。
- **样本条件**：普通 Git 仓库、有效 metadata、空直接关系；带资源时每条报告有一个普通文本资源。正式索引已同步并提交到样本 HEAD，暂存前来源未改、pending 与 HEAD 相同。样本提交禁用自身 hooks，操作限于自动清理的隔离目录。

### Git 进程规模对照

每次操作选择样本中的全部 N 条记录。

| 隔离样本命令 | N=1 | N=20 | N=100 |
| --- | ---: | ---: | ---: |
| Investigation `check --id ...`，每条带资源 | 2 | 40 | 200 |
| Investigation `candidates`，每条带资源 | 4 | 80 | 400 |
| Investigation `candidates`，无资源 | 2 | 40 | 200 |
| Investigation `stage ... --scope domain`，未改来源、`core.fileMode=true` | 24 | 214 | 1014 |
| Investigation 默认全量 `check`，带资源、无关系 | 9 | 9 | 9 |
| Decision `stage ... --scope domain`，未改来源 | 15 | 15 | 15 |
| Decision 批量 `archive` | 7 | 7 | 7 |

100 条候选的交叠 trace 按 `sid` 与 `def_repo.worktree` 分离复核，只保留进程次数；摘要中的对应耗时为空。Decision 暂存已独立复跑确认。

### 文件读取对照

| 读取对象 | 已测规模与次数 | 样本调用链推导 |
| --- | --- | --- |
| Investigation 候选正文，带资源与无资源相同 | N=1：6；N=10：825；N=20：5250；N=40：36900 | `(N³ + 6N² + 5N) / 2` |
| Decision domain 暂存的集合内 `readFile` | N=1：4；N=20：441；N=100：10201 | `(N+1)²` |

以上实测与公式一致；候选 N=100 的正文读取未计数。带计数器的单次候选耗时在 N=1/20/40 时，带资源为 150/1742/7623 ms，无资源为 137/2026/6892 ms。无资源使 Git 次数减半，但正文读取不变，耗时也未同比例降低。这些观测说明仍有其他成本，不能用于预测稳定时延或优化收益。

### 其他入口的覆盖情况

- **实测 0 次 Git**：主仓库的 Decision `list/search/check`、Investigation `list/search`、Test Evidence `list/search/check`、`validate-skill skills/decision-records`；有效独立样本的 Novel Cards `check/find/show/history`。这些入口仍有文件读取、解析或索引核对成本。
- **实测固定路由成本**：Task Graph `task list` 默认经一次 `git worktree list` 选择中央项目，再启动一个领域 Node CLI；显式 root 时为 0 次 Git，路由不逐 task 重复。
- **仅静态核对**：共享 updater 使用进程内文件与网络 API；MCPShell 为显式远端请求启动 SSH。本轮未运行更新或远端请求。OpenSpec、ast-grep 等外部 CLI 内部行为，以及项目 Gate、发布、hooks 均未纳入计数。

## 调查结果与边界

同类型问题集中在 Investigation Report 的候选、局部检查和 domain 暂存；Decision 暂存另有重复文件扫描。共同机制是集合入口反复调用单项入口，未传递本次已取得的集合事实。普通列表的实测不支持“其他 skill 普遍逐条启动 Git”；问题已在无子仓库的普通样本中复现。

### 候选列表：立方级正文读取

[候选列表](../../tools/investigation-report/src/candidate-access.ts)逐条读取候选；[资源准备](../../tools/investigation-report/src/candidate-document.ts)每条重建完整 authoring references，并执行直接资源与全资源验证。[引用构建](../../tools/investigation-report/src/candidate-resource-references.ts)逐候选调用[身份定位](../../tools/investigation-report/src/candidate-path.ts)，后者又逐文件读取 frontmatter 查找 ID，形成表中的立方级读取链。每条带资源候选还两次发现仓库、两次读取同一全资源清单。

建议优先在一次集合操作内共享 ID 到路径、已解析候选、authoring references 和资源成员；只减少 Git 次数仍会留下正文扫描瓶颈。

### 局部检查：重复资源根发现

[局部检查](../../tools/investigation-report/src/validation-check-flow.ts)为每个报告独立准备[资源根](../../tools/investigation-report/src/resource-root.ts)，带资源的 N 条报告因此启动 2N 次 Git。建议共享资源成员发现，逐报告验证直接链接，并保持局部检查范围。

### Investigation 暂存：逐 owner、逐文件查询

[写入准备](../../tools/investigation-report/src/staging-domain-writes.ts)逐 owner 列举 workspace/HEAD 资源，逐文件读取有效表示，并在写前重做来源核对。[工作区文件表示](../../tools/shared/src/version-control/git-workspace-file.ts)每次读取都查询 `core.fileMode`：20 条样本的 214 次 Git 中有 80 次配置查询；`core.fileMode=false` 还增加逐文件 pending 表示查询，总计 294 次。

建议在准备和写前复核两个阶段分别批量获取资源、配置与 pending 表示，保留阶段间重新读取。

### Decision 暂存：平方级来源扫描

[所选来源验证](../../tools/decision-records/src/decision-stage-sources.ts)为每个选择项重新扫描全部 Decision 文件，核对身份与重复来源，形成表中的平方级读取。Git 次数保持 15，HEAD blob 已通过 `cat-file --batch` 读取。建议在每个验证阶段合并批次成员与重复身份检查。

### 历史读取：固定重复与空路径范围

[共享历史读取](../../tools/shared/src/version-control/git-revision.ts)重复解析 revision、列举 tree，增加固定成本。Investigation [前序历史提示](../../tools/investigation-report/src/validation-history.ts)在没有关系时仍读 HEAD；HEAD 没有报告时，空 `sourcePaths` 被 API 解释为全仓库范围。“一个无关系工作区报告、HEAD 只有无关 notes 文件”的对照确实执行了无 pathspec 的 `ls-tree` 和 `cat-file --batch`。

建议先明确无目标、空路径集合的处理，再复用已解析 revision；API 的空范围与空结果应分别表达。

### 实施与验证边界

上述建议尚未实施。后续优化需保持检查范围、资源可见性、文件表示和失败语义，并验证结果等价；写前必须重新核对来源字节与身份，准备快照不能代替漂移验证。

已列计数实验均退出 0。随附脚本以 `--count 1 --count 20` 重跑 16 项操作，Git 和候选正文读取次数与上表一致；它是隔离样本复现资源，不是性能门禁或正式回归测试。复现使用当前工作区生成 CLI，历史版本与数字见观测摘要。

结论限于已列入口和样本；未覆盖 Windows、网络、远端、全部 mutation 组合及新增/改动 blob 的写入成本。调用链、文件定位、资源可见性或版本层 API 变化后需重新计数。

## 随附资源

- [计数复现：隔离样本、Git Trace2 与正文读取观察](./_resources/261009-skill-cli-repeated-process-and-source-access/measure-process-access.py)
- [观测摘要：版本、命令、进程与文件读取次数](./_resources/261009-skill-cli-repeated-process-and-source-access/observations.json)

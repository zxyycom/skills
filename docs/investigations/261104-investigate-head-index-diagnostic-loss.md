---
title: "调查历史索引损坏的诊断丢失与工作区修复边界"
id: "261104-investigate-head-index-diagnostic-loss"
formedAt: "2026-11-04T07:47:38Z"
question: "HEAD 调查索引损坏时为何只报通用错误，工作区索引恢复后为何仍有历史 warning，应如何定位和恢复？"
tags:
  - "git-integration"
  - "investigation-report"
  - "root-cause-analysis"
relations: []
---

## 形成时背景

用户转述外部 Windows 项目的排查：提交 `487af6ad` 错置调查索引中的 `},`，HEAD 无法解析；工作区已修正但尚未提交，历史检查仍报告通用的 `historical investigation index is invalid`。

本仓库的调查起点为 `06dcb04e`。当时 HEAD 和工作区索引均可解析，各有 83 个正式条目；对象库中不存在外部反馈的提交。问题因此分为外部索引数据损坏与本仓库可复现的诊断缺口，分别取证。

## 调查目的

确认具体解析错误在哪一层丢失，解释工作区修复与 HEAD 历史恢复的区别，并确定保留诊断信息和正确恢复指引的实现边界。

## 调查范围与依据

### 代码路径

| 责任位置 | 观察 |
| --- | --- |
| `tools/index-runtime/src/snapshot/snapshot-parser.ts` | JSON 异常已返回 `state-index.json-invalid` 及具体 message；其他校验保留自己的 code。 |
| `tools/investigation-report/src/records/validation/validation-history.ts` | 原实现读取固定 HEAD，却在索引失败时丢弃 diagnostics，只抛通用 Error；外层统一提示恢复版本控制访问。 |
| `tools/investigation-report/src/diagnostics.ts` 与 CLI 输出 | 已有共同诊断类型、适配器和 renderer，历史 warning 原先走独立的文本拼接路径。 |

### 隔离 Git 对照

`history-prefix-contract.test.ts` 从合法报告和索引建立私有 Git 仓库，分别提交截断 JSON 与 definitionVersion=999 的索引，再仅恢复工作区索引。

| 状态 | 观察 |
| --- | --- |
| 健康 HEAD | 无历史 warning。 |
| HEAD 索引异常，工作区索引已恢复 | 返回唯一 `history-check-unavailable`；保留所读 revision、path、原因 code 和 detail。JSON 损坏指向验证后提交修复，definition 不兼容指向兼容性与迁移核对。 |
| 健康索引纳入后续新提交 | 同一前序检查恢复无 warning，已有提交保留。 |

原实现无法通过历史定位断言。初步补丁虽补回了文本，但把全部信息拼入一个限长的 Error.message，长定位或多条原因仍可能丢失细节。后续以共同诊断类型保存 source 与 causes，并在公开字符串结果边界统一渲染；纯测试验证适配器保真、定位与详情的独立预算及敏感内容净化。既有损坏 HEAD 场景同时验证系统失败指引。

### 回归证据

`bun run test:investigation-report-check` 实际执行 397 项通过；Node 原生运行共同诊断和历史索引的四个新增节点全部通过；`bun run check:investigation-report-check` 通过生成一致性检查。

测试审查保留字段传递、安全输出、两种历史异常和系统失败指引五个新增／调整节点：它们分别保护诊断保真、敏感信息与历史恢复判断。纯规则采用函数级测试，HEAD 与工作区的区别使用隔离真实 Git；断言围绕稳定诊断字段和恢复语义，解析器的英文措辞可变化。

## 调查结果与边界

**确认的工具缺陷位于历史诊断适配层。** 解析器已经提供具体错误；领域适配丢失信息，又把不同原因导向同一恢复动作。修复复用共同类型、构造入口与 renderer，已知历史失败以 Result 传递，系统异常沿现有适配返回；恢复指引区分数据损坏、工具／索引兼容性和系统失败。

**工作区正确而历史 warning 仍在，符合固定 HEAD 契约。** 对照证明，恢复工作区或暂存区不会改变 HEAD；验证后的数据修复进入新提交，才建立新的可信历史基线。历史判断不可用仍表现为 warning，前序未记录判定和来源选择保持原语义。

本仓库的源码、分发副本、恢复文档和测试账本同步维护，skill 版本由 95 提升为 96。公开 warnings 字符串接口保持兼容；共同诊断约束调查工具已接入的入口，其他 skill 的错误模型仍由各自 owner 维护。

外部反馈的括号位置、引入提交及父提交对照未取得原始项目证据，本轮隔离复现不证明该 Windows 项目已恢复。验收覆盖本地源码与生成副本，已安装 skill 和远端发布状态另行验证。

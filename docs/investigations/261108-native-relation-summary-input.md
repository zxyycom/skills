---
title: "原生记录关系摘要的选择与规范化缺口"
id: "261108-native-relation-summary-input"
formedAt: "2026-11-08T17:13:40Z"
question: "关系摘要为何误拒同一目标的不同选择形式及合法边界文本？"
tags:
  - "record-cli"
  - "relation-summary"
relations: []
---

## 形成时背景

2026-11-08 推进原生记录 CLI 时发现，关系与摘要选择器即使指向同一记录，也可能因写法不同被拒绝；候选创建的摘要规范化也与领域规则不一致。摘要属于关系的说明，不应改变关系身份；[调查报告关系契约](../../skills/investigation-report/references/investigation-report-contract.md#认识演进关系)要求 trim 后空值省略，非空值单行且最多 40 个 Unicode 码点。

## 调查目的

解释原生 CLI 参数绑定与摘要文本处理的缺口，记录其修复和验证；不推断已发布版本或其他后端存在同样问题。

## 调查范围与依据

实施者报告：在临时调查集合先创建 ID 为 `261106-target` 的候选，再运行原生 investigation-report 的 `new`，传入 `--relation '补充=target' --relation-summary '261106-target=first=second'`，修复前退出码为 1，诊断为 `relation summary has no matching target`。完整参数和形成时间可由回归节点 `tools/record-cli/tests/authoring/ir_cli_contract.rs::investigation_cli_new_summary_resolves_target_and_preserves_equals` 复核；该节点现在也验证摘要中的第二个等号保留。此处是实施者转述的实测，本报告作者未重跑旧二进制。

本报告作者检查了基线提交 `a88af9bc` 的 `tools/record-cli/src/cli/arguments/mutation/relations.rs`：`finish` 在目标解析前用原始 `edge.target` 从摘要表移除对应值，剩余摘要即报错；因此同一身份的 name 与完整 ID 无法匹配。该静态源码解释支持上述观察，但不能单凭它证明当次旧二进制的构建来源。基线 `tools/record-cli/src/mutations/authoring/render.rs::convert_relation` 直接复制摘要，未在创建时统一做 trim 和长度检查；领域校验及 frontmatter 的处理入口不同，因而可导致创建与读取阶段的不一致。40 个非 BMP 字符加边缘空白的旧行为在这里属于源码分析，未作基线运行证明。

## 调查结果与边界

修复将关系和摘要的 selector 在同一快照中分别解析并核对完整 ID，而不是仅比较原始字符串；日期错误、歧义或不同 ID 仍不能绑定。摘要先 trim，空值省略，非空按 Unicode 码点限长并拒绝内部换行。修复位于 `tools/record-cli/src/cli/arguments/mutation/relations.rs`、`tools/record-cli/src/mutations/authoring/render.rs` 及各领域关系准备入口；来源 frontmatter 的规范化也有覆盖。

实施者报告运行 `cargo +1.98.1 test --manifest-path tools/record-cli/Cargo.toml --locked --test authoring ir_cli_contract::`，4/4 通过；测试涵盖别名、不同日期、等号和 trim 边界。`tools/record-cli/tests/authoring/create.rs::decision_cli_new_summary_trims_before_single_line_and_length_validation` 定向 1/1 通过，覆盖空白省略、40 个 emoji 加边缘空白接受、内部换行及 41 个 emoji 拒绝；调查来源 frontmatter 新节点 `investigation_source_summary_trims_before_projection_and_validation` 也报告 1/1 通过。实施者另报告完整 Rust `cargo test --locked` 通过；这些不是本报告作者亲自执行的结果，也不证明线上或已分发版本生效。测试具体条件以源码为准，未来改变 selector 或文本契约时需重新核查。

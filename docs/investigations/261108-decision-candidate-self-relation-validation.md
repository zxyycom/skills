---
title: "候选决策自环未在读取时拒绝"
id: "261108-decision-candidate-self-relation-validation"
formedAt: "2026-11-08T16:45:00Z"
question: "决策候选自环为何被计为就绪？"
tags:
  - "decision-records"
  - "record-cli"
relations: []
---

## 形成时背景

2026-11-08 检查本机原生 decision-records 时，正文就绪的决策候选将自身声明为修订目标，仍被读取并计入就绪数量。现行[决策关系规则](../../skills/decision-records/references/decision-record-rules.md)要求候选起草阶段检查自环；目标尚未建立可以保留，但自环不是这种情况。

## 调查目的

确认上述结果、候选读取和就绪统计之间的原因及其边界，并保留修复后的定向验证；不判断发布路径是否允许自环。

## 调查范围与依据

发现者在临时工作区 `<T>` 写入 `docs/decisions/260101-one.md`，完整输入如下：

```md
---
title: Example title
id: 260101-one
status: candidate
alignment: null
createdAt: null
purpose: Purpose
background: Background
decision: Decision
tags:
  - tag
relations:
  - type: 修订
    target: 260101-one
---

## 目的
Purpose

## 背景
Background

## 决策
- 采用: Choice
```

修复前从仓库根分别运行以下本机程序，三次退出码均为 0：

```sh
tools/record-cli/target/debug/decision-records check --root <T> --json
tools/record-cli/target/debug/decision-records candidates --root <T> --json
tools/record-cli/target/debug/decision-records show-candidate 260101-one --root <T> --json
```

`check` 的 `ok` 为 true、`candidateCount` 为 1，`summary.activationCandidateCount` 与 `bodyReadyCandidateCount` 均为 1；`candidates` 包含此项，`scaffoldValid` 和 `bodyReady` 均为 true；`show-candidate` 返回此项。后两者提示无正式索引，但无自环警告。发现者未重编译：二进制修改时间为 16:38:39 UTC，旧解析和查询源码文件修改时间为 2026-11-07 09:41:47 UTC；这不能证明该二进制由所检查的源码构建。

另对照提交 `a88af9bc` 的 `tools/record-cli/src/domains/decision/frontmatter.rs`，`decode_frontmatter` 分别解析自身 ID 和 relations，但没有比较 target 与自身 ID。查询侧 `tools/record-cli/src/queries/decision/candidates.rs` 的 `validate_dependencies` 将候选 map 中目标作为普通候选依赖；`tools/record-cli/src/mutations/check/decision/sources.rs` 的 summary 将正文就绪候选数量用于 activation 统计。这些源码检查提供机制依据，不替代对旧二进制构建来源的证明。

## 调查结果与边界

观察与源码支持的解释是：候选共同的 frontmatter 读取缺少自环校验，因而自身可被依赖查找接受，正文就绪又进入统计；这违反候选起草契约，影响所观察的校验、发现与就绪信息。该结论不证明 `publish` 会放行，也不证明其他关系缺陷或所有版本均受影响。

实施者在工作树的 `tools/record-cli/src/domains/decision/frontmatter.rs` 解析关系后拒绝 `target == id`，并新增 `tools/record-cli/tests/queries/candidates.rs` 的 `candidates::decision_candidate_self_relation_is_not_readable_or_ready`。实施者报告执行以下命令，定向测试 1/1 通过：

```sh
cargo +1.98.1 test --manifest-path tools/record-cli/Cargo.toml --locked --test queries decision_candidate_self_relation_is_not_readable_or_ready -- --nocapture
```

测试断言 `parse_candidate` 拒绝该输入，`check` 与 `show-candidate` 返回非零且 JSON `ok` 为 false；无选择器 `candidates` 仍成功退出，返回空 records 并在 stderr 警告 `cannot target itself`，符合非法候选跳过协议。稳定测试义务见 [Case 账本](../test-evidence/cases/decision-candidate-relation-self-001.md)，其身份为 `test:e220a04ecd94aa66e4c31e6f7aba7845dc7ee281233b8c7ea1ddf793fa23496c`。这是实施者报告的定向测试结果，不等于完整门禁、发布路径或已分发环境已验证；若需确认那些范围，应分别执行对应验证。

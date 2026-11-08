---
title: "决策演进的最终事件选择闭合缺口"
id: "261108-decision-evolve-final-selection-closure"
formedAt: "2026-11-08T17:48:13Z"
question: "为何最终关系图合法仍不足以证明演进选择闭合？"
tags:
  - "decision-records"
  - "record-cli"
relations: []
---

## 形成时背景

2026-11-08 原生记录 CLI 切换期间，决策 `evolve` 被发现可能接受不完整的事件选择。领域规则要求拆分选择同一前序的全部直接拆分后继、重划选择一个连通事件的全部后继；普通演进只选一个后继，见 [后继集合与语义闭合](../../skills/decision-records/references/decision-record-rules.md#后继集合与语义闭合)。最终图合法与调用者选齐事件成员是不同条件。

## 调查目的

确认基线缺口的触发方式、实现责任及当前修复的有限证据，不将工作区补丁视为已发布或线上事故。

## 调查范围与依据

测试作者报告在修复前运行 `cargo test --locked --test decision_authoring evolution_cases::split_extension -- --include-ignored` 和同入口的 `evolution_cases::evolution_rejects_multiple`：各自的拒绝预检断言失败，因为预检意外成功。本报告作者未运行旧二进制。复现 fixture 在 `tools/record-cli/tests/decision_authoring/evolution_cases.rs`：先建立 `old` 的完整拆分 `first`、`second`，再选新候选 `third` 与 `first`、漏选 `second`；另一例选择两个无关系候选。这些组合的最终图可以合法，但不满足一次演进的选择契约。

本报告作者检查基线 `a88af9bc` 的 `tools/record-cli/src/mutations/authoring/decision/writes.rs`：构造最终索引后只验证关系图，没有对显式选择和完整事件后继集合做比较；这解释了观察，但不单凭源码认定当次旧二进制的构建身份。当前未提交补丁在同文件构造最终图后增加事件选择检查；`tools/record-cli/src/transaction.rs` 中预检和实际事务共用准备路径，准备失败后事务在应用写入计划前返回。

## 调查结果与边界

修复以最终图为准：拆分按同一前序的全部直接拆分后继比较选集，重划按区分前序和后继角色的二部图连通分量比较；多选普通后继被拒绝。只按最终事件闭合，不额外要求选齐已退出最终事件的旧事件成员；后来以先前后继为前序的重划是另一事件。规范与实现责任分别属于决策领域规则和原生决策写入准备，不改变 selector 或 metadata 格式。

本报告作者运行 `cargo +1.98.1 test --manifest-path tools/record-cli/Cargo.toml --locked --test decision_authoring evolution_cases:: -- --nocapture`，当时 7/7 通过。测试直接观察漏选拆分、漏选重划及无关系多选的预检拒绝与所检查文件不变，并实际提交完整拆分和稀疏重划；漏选场景的正式执行零写入是根据共用准备路径作出的源码推断，而非本次单独运行正式失败调用的观察。其他实现者另报告修复前复现和更宽测试通过，不代替本次独立结果。

结论限于所检查源码及本机定向测试；未复跑旧构建、未做全门禁或跨平台验证，也未验证任何已分发或线上版本。补丁后续改变事件语义、写入准备路径或领域契约时应重新复核。

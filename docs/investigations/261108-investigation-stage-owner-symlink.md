---
title: "调查暂存遗漏资源目录符号链接边界"
id: "261108-investigation-stage-owner-symlink"
formedAt: "2026-11-08T17:13:40Z"
question: "为何所选资源目录符号链接可能未阻断 Git 暂存？"
tags:
  - "git-stage"
  - "investigation-report"
  - "record-cli"
relations: []
---

## 形成时背景

2026-11-08 检查原生 investigation-report 的 Git stage 时，所选报告没有直接资源引用，但其资源根被替换为符号链接，暂存仍可成功。stage 的领域范围包含所选 owner 的完整资源树，不能把 Git 路径发现没有返回成员解释成目录边界安全。

## 调查目的

确认漏检机制和失败时的待暂存区保护，限定检查在所选 owner 的范围；不把本地 Unix Git 的证据外推为 Windows 符号链接实测。

## 调查范围与依据

实施者报告在基线测试真实 Git 的临时仓库：已提交的 `240229-alpha` 报告和索引被更新，另有一个未选文件带不同的 pending 与工作树内容；报告没有直接引用资源，`_resources` 指向外部临时目录。调用 `stage_investigations`，选择 `240229-alpha` 和 `StageScope::Domain`，预期应拒绝，但修复前 root 位置的拒绝断言失败，即调用未报错。该首次失败停止了循环，不能据此声称基线 owner 和 member 两个位置也实测放行。

本报告作者检查现有 `tools/record-cli/src/stage/investigation_scope/resource_selection.rs`：资源选择由 Git 按所选 owner pathspec 取得可见成员并结合 HEAD、pending 和直接引用。Git 枚举可能不返回资源根或 owner 目录边界的符号链接自身；无直接引用时，依靠成员发现不足以检查该边界。这个机制解释与基线 root 观察一致；对其他位置的旧行为是机制判断而非上述运行结果。

## 调查结果与边界

实施者在资源选择前显式检查资源根及所选 owner 目录类型，随后仍按既有范围处理成员；此边界检查不枚举未选或 ignored 子项。新增 `tools/record-cli/tests/git_stage/stage_investigation_sources.rs::investigation_stage_rejects_unreferenced_owner_tree_symlinks_without_changing_pending` 在真实 Unix Git 下分别构造 root、owner 和 member 三种链接，断言拒绝、完整 pending 不变，链接和外部文件保留，报告及索引工作树内容不变。实施者报告该定向节点修后 1/1 通过，另报告 `source::tests::directory_boundary_does_not_enumerate_unrelated_names` 1/1 通过，以及完整 Rust `cargo test --locked` 通过。

这些结果来自实施者报告，报告作者未亲自复跑；测试不证明真实 Windows 符号链接行为，也不证明已分发环境生效。链接若出现在未选树或 ignored 子项内，不属于这次边界检查对全集安全的证明；需要改变 stage 范围时应重新验证。

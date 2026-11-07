---
title: "Git 索引路径前缀冲突导致未选暂存被驱逐"
id: "261107-git-index-update-prefix-collisions"
formedAt: "2026-11-07T08:06:02Z"
question: "标准 Git 索引更新为何会破坏选择性暂存对未选 pending 的保留，最小防护边界是什么？"
tags:
  - "correctness"
  - "git-integration"
  - "staging"
relations: []
---

## 形成时背景

2026-11-07 对 Rust record CLI 的未提交候选实现进行 stage 审查：其简化方案使用 `hash-object` 和 `update-index` 写所选路径，同时要求保留未选 pending。基线为 `abefbf3a`，计划提交为 `4b61aa70`；被审实现是当时工作树候选，并非已发布版本。审查发现，文件与目录路径前缀冲突可使 Git 成功写入所选项的同时移除未选暂存。没有 TS 生产事故或用户事故频率资料，不能推断实际发生频率。

## 调查目的

确认损失是否需要外部并发、为何成功退出码不足以证明选择范围，并确定既保留选择性暂存功能又不重新引入并发事务机制的最小边界。

## 调查范围与依据

2026-11-07 在 Git 2.53.0 的独立临时仓库中直接运行以下命令；未操作主工作区 Git index。`oid` 是内容 `x` 的 blob，记录使用 NUL 分隔；两次更新均退出 0。输出省略相同的 mode、OID 和 stage，只列路径：

```sh
git init -q
oid=$(printf x | git hash-object -w --stdin)
printf '100644 %s\ta/b\0' "$oid" | git update-index -z --index-info
git ls-files --stage  # a/b
printf '100644 %s\ta\0' "$oid" | git update-index -z --index-info  # exit 0
git ls-files --stage  # a；a/b 已消失
printf '100644 %s\ta/b\0' "$oid" | git update-index -z --index-info  # exit 0
git ls-files --stage  # a/b；a 已消失
```

这些是同一 index 上连续的双向对照：首次写 `a` 时将既有 `a/b` 视为未选，反向将既有 `a` 视为未选。没有其他进程同时修改 index；这证明单纯调用 Git 即可触发，不证明所有仓库或具体上层命令都会产生该状态。审查范围是 Git 更新行为及 Rust 候选的 `tools/record-cli/src/git/publish.rs` 和 stage 调用，不是整个工具的事故普查。

## 调查结果与边界

Git index 不能同时包含作为文件的 `a` 与作为其后代的 `a/b`。`update-index --index-info` 在添加目标时处理此目录／文件冲突，会移除冲突项；这是 Git 更新的正常效果，与上层“未选 pending 必须保留”的功能契约冲突。成功退出只说明 Git 接受更新，不能证明未选项仍在。无需假设外部竞争；真实条件是既有 pending 与所选写入存在路径组件级祖先／后代冲突。`a` 与 `ab` 不构成这种关系。

最小防护是在对象和 index 写入前，以已读取的 pending membership 和完整目标清单检查冲突；仅当冲突项被本批明确删除时允许其退出，拒绝相互冲突的新增目标。应保留对正常选择性暂存和明确选中的文件／目录转换的支持，而不是因为冲突完全禁用该功能。此检查解决已观测快照内的冲突，不保证检查后另一个进程更改 index 的情况；放弃锁内 CAS、备份和并发恢复的简化边界不应被描述成并发安全。

候选修复在 `tools/record-cli/src/git/publish.rs` 的 `replace_selected` 中，于 `hash-object` 及 `update-index` 之前使用 `Path::starts_with` 按路径组件检查已有 membership 和目标；未添加锁、重读、CAS 或备份。2026-11-07 运行 `cargo +1.98.1 test --manifest-path ./tools/record-cli/Cargo.toml --locked --test git_stage publication_ -- --nocapture`：6 项通过、30 项过滤。新增测试实际检查两方向拒绝后 index 字节、成员和未选内容不变，同批明确删除后双向转换，以及 `a` 与 `ab/file` 共存；另测同批冲突 upsert 拒绝。独立 stage 审查亦复核这一局部修复，未发现新增阻断。上述结果证明所测私有 fixture 的行为，不证明并发安全、全量回归或已发布环境生效。

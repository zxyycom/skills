---
title: "Rust 记录工具 Windows 原生兼容性调查"
id: "261106-rust-windows-native-compatibility"
formedAt: "2026-11-06T12:56:39Z"
question: "Linux 验收通过的 Rust 候选为何在 Windows 原生执行失败，哪些产品边界与测试假设分别需要修正？"
tags:
  - "native-cli"
  - "root-cause-analysis"
  - "rust"
  - "windows"
relations: []
---

## 形成时背景

本轮调查两域 Record CLI 的纯 Rust 迁移候选在 Windows 原生 runner 的功能失败，不是性能比较或此前事务 namespace 竞态调查。候选 `be1e9c4053e292a0ea3d0959f275e4cc1295f677` 在 Ubuntu 22.04 原生通过 189 个 library、122 个 integration 测试以及 2,147 个 Case 引用与覆盖检查，真实私有安装 A、故障回退及更新 B 也通过；同一 [运行 42215386882](https://github.com/zxyycom/skills/actions/runs/42215386882) 的 Windows Server 2022、NTFS job 却报告 41 个测试节点失败，另有四个节点超过 60 秒未完成。用户授权取消该运行，harness 未汇总 panic，故取消结果不是完整失败清单。当次 Windows job 与 Ubuntu job 的记录分别见 [Windows job](https://github.com/zxyycom/skills/actions/runs/42215386882/job/127883976325) 和 [Ubuntu job](https://github.com/zxyycom/skills/actions/runs/42215386882/job/127883976040)。

本机 Linux、Ubuntu 原生、Windows 交叉编译及格式检查分别证明各自平台或构建条件，不能替代 Windows 实际执行：目录名大小写检查、路径分隔符、句柄共享和文件系统调用均可能表现不同。旧性能报告测试的是其标明的冻结版本和工作负载，不能外推到后续源码或 Windows 功能。

## 调查目的

区分产品实现缺口与不成立的测试假设，记录各版本原生复测及未闭合边界；不将多个失败预设为单一根因，也不以修改测试代替产品修复。

## 调查范围与依据

2026-11-06 读取平台验收记录、原 Windows job 日志、后续 Windows 诊断日志、受影响源码和正在修改的工作区 diff。第一轮因为 harness 未结束，只有测试名称和超时现象；`b122a537` 随后把测试双向会合改为 30 秒有界并设置 CI 15 分钟限制，`d521e997` 增加 nocapture、backtrace 和精确 smoke。它们用于暴露故障，并不本身修复产品。

后续 [运行 42220026108](https://github.com/zxyycom/skills/actions/runs/42220026108) 的提交为 `9d239ad28916421093fd9977fb9eface78245144`；只读查询显示 Ubuntu job 成功、Windows job 失败。Windows 日志先对目录移动的精确 smoke 报 `MoveDirectoryFailure`、OS error 87、effect `Unknown`；完整 library 测试随后得到 144 passed、45 failed、0 ignored。它不是全部 integration 或离线 A/B 通过的证据。详细 panic 有重复和并发交错，下述摘录仅保留有区分力的节点与结果；日志按原样保存于当次 CI，临时本地下载不作为永久附件。

- `new_lock_parent_bootstrap_reports_partial_and_preserves_foreign_entry` 返回 `directory-bootstrap-failed`，消息 `Unsafe("docs")`，状态为未写入；多个事务测试同样在 `collection`、`new-assets` 等目录准备阶段得到 `Unsafe`。
- `selected_git_evidence_ignores_other_owner_membership` 返回 `InvalidOutput("invalid relative path")`，须和 Windows 本地路径到 Git 路径的适配一起检查，不能仅按领域资源故障归因。
- `newly_created_namespace_rejects_concurrent_unjournaled_member_after_commit` 的有界等待报告 worker 在会合前退出，事务结果 `NoChange`，原因是 `Unsafe("collection")`。这为该后续版本的等待现象提供了直接解释，但不能单凭它证明原取消运行的四个节点均具有相同退出原因。
- `capture_allows_internal_directory_link_but_rejects_escape` 对 `absolute-alias/item.md` 得到 `Unsafe`；单独 smoke 的目录移动错误 87 与此均需各自定位，不能被缺失目录假设解释。

## 调查结果与边界

### 目录准备与 Git 路径

阶段性源码分析发现，Windows 精确目录名检查把枚举找不到名字直接映射为 `Unsafe`，没有区分真正不存在和大小写不精确等不安全情况；调用方需要将缺失视为可处理状态以准备目录。日志中 bootstrap 和多个事务在准备阶段失败与此一致，但不能据此将全部 45 个失败逐一归因。提交 `1511b2d6a7672cca62c613544b9ab3c8c910b3ec` 通过元数据查询区分缺失与已存在的非精确名称；后续原生运行中，先前失败的 bootstrap、嵌套父目录与 namespace 会合测试均通过，支持这些具名场景已处理，不代表所有入口已验证。

Git adapter 的原路径校验将本地 `PathBuf` 的 Windows 反斜杠与 Git 输出使用的斜杠路径混为一层；上述提交在本地路径进入 Git 协议前转换，同时保留 Git 原始路径校验及 Windows ADS、设备名约束；HEAD ref probe 按职责调整，保留两次 ref 与 symbolic 重读。结构化诊断的路径表示也有平台差异，须以公开输出契约判断，而非将全部差异视为文件系统故障。后续原生运行中，先前失败的 selected Git evidence 测试通过，不能据此推断所有 Git 输入均已覆盖。

### 父目录竞争的测试假设

测试竞态还需区分平台保护与错误：调查参与者检查到 Windows 父链证明使用的 `cap-primitives` 句柄不共享删除，强行按 POSIX 模型重命名被保护的父目录会遇到 sharing violation（OS error 32）。这属于保护机制，不能为了让测试执行替换而移除；该场景的测试因此改为验证替换被阻止并核对真实事务事实，而非声称发生了 POSIX 替换。上述提交包含相应测试修改；后续原生运行中 `missing_parent_replacement_between_prepare_and_fresh_is_rejected` 通过，具名场景验证了实际平台行为。

### 目录移动与短路径

上述提交后的本地完整 Gate 报告 70/0/0，Case 检查报告 2,148 个实体通过；这些是参与者提供的本地证据而非 Windows 结果。[运行 42223183994](https://github.com/zxyycom/skills/actions/runs/42223183994) 的 Ubuntu job 成功、Windows job 失败；Windows library 为 173 passed、17 failed。精确 smoke 的 Win32 相对父句柄目录移动仍返回 87；隔离 fixture 的 padded 和 nul 变体均返回 87，absolute 变体成功，但后者同时改变父句柄和目标表示，不能据此断定单一根因。内部绝对链接失败的诊断显示目标使用 Windows 8.3 短名、canonical 根使用长名，现有纯词法前缀比较不匹配；这是具体失败机制，但修正后仍须验证内部目标可读取和逃逸目标被拒绝。目录移动错误 87 的更深原因仍未闭合。

随后提交 `0f7517b6e7803b640785c74fab0c1e92c6a78f0c` 改用 NT 句柄相对移动，保留持有的源句柄、父目录句柄及不覆盖目标；pending 保守表示为效果未知并保留缓冲区，仅确认的 NT 碰撞视为未开始。内部绝对链接先展开 8.3 短名，再执行严格根边界和 capability root 访问。临时隔离探针及入口已从该提交删除，原 smoke 断言恢复；API 审查参与者未发现实质阻断。参与者报告该版本本地 Case 2,148 及 record-rust/repository-code 组合 16 项检查通过，但当时不能替代新版本 Windows 原生复测。

[运行 42224843644](https://github.com/zxyycom/skills/actions/runs/42224843644) 实际测试该提交：Ubuntu job 成功；Windows 目录移动 smoke 1/1、library 190/190 通过，原先的 17 个 library 失败已在这一版本通过。随后 `git_stage` 为 36 passed、1 failed，Cargo 未继续后续 integration targets；Windows Case、离线协议及安装更新 A/B 未执行。唯一失败的 `stage_index::cli_unresolved_selector_reports_target_recovery_and_unchanged_pending` 比较诊断路径时观察到 canonical 长路径与 fixture 8.3 短路径字符串不同；其输出契约和正确的路径身份断言仍在核查，不能先行归为产品错误或仅测试问题。因此整个 Windows job 仍失败，不可将 library 通过写成完整平台通过。

### 诊断路径与资源 fixture

后续提交 `5fe61474fc67af9b8f0614d6641465c53290dbc7` 的测试用规范文件身份核对该诊断路径；[运行 42225950339](https://github.com/zxyycom/skills/actions/runs/42225950339) 中 Windows smoke 1/1、library 190/190、git_stage 37/37 通过，Ubuntu job 成功。Windows 后续 queries 为 30 passed、1 failed：创建 junction fixture 的 `mklink /J` 报 `Invalid switch`，在产品资源断言前失败；混合路径参数是待核查的解释，不能将该次失败算作资源行为失败。后续 targets 与 A/B 未执行。

此后提交 `65c5c49cd7be5084d1b73637c5d1eb21ea8ccbc5` 修正夹具，确认 junction 指向预期目标再执行原有断言。[运行 42227116549](https://github.com/zxyycom/skills/actions/runs/42227116549) 的 Ubuntu job 成功、Windows queries 为 30 passed、1 failed；该次在候选读取时返回 `candidate-resource-read-failed` / `Unsafe`。进一步源码对照显示独立产品粒度差异：现行 TS 将符号链接汇入 candidate 错误并标记资源未就绪；Rust Windows 的成员识别对 `Symlink` 与 `Other` 都直接报 `Unsafe`，导致整个扫描 fatal，而已有共享层可把 `MemberKind::Symlink` 变为资源 issue；该次日志不能单独区分 junction 被底层识别为两者中的哪一种。形成时曾有不跟随链接、读取链接自身身份与属性并复用现有分支的未提交最小补丁，参与者报告交叉检查和局部门禁通过，但未经 Windows 原生验证，亦未作为交付。

### 范围收敛与未验证部分

用户随后明确将本轮迁移范围收敛为 Linux x64 glibc，放弃当前 Windows 验收；本轮不再等待 Windows 成功或 PE 交付证明。提交 `8ba448ea45681525f1237d82846c08e3e8410215` 移除了候选的 Windows 专用模块、NT 与 8.3 分支及相关直接依赖，并限定编译、manifest、宿主和候选 CI 到 Linux x64 GNU。参与者报告该候选本地 312 个原生测试、完整 Gate 70/0/0、2,148 个 Case 和真实私有 A/B 通过；这是本地证据，不冒充 Ubuntu 或 Windows 同版本的远端验收。现行 TS 工具和视频工具的 Windows 范围不由此改变。上述分次通过仅证明各自版本、环境和具体场景，不代表完整 Windows 支持、安装更新通过或所有根因解决。Windows 部分探索保留在相应 Git 提交中，不构成未来自动实施或支持承诺。

库适配复核参与者认为现有 `cap-std` 已承接目录枚举、不跟随打开和元数据等基础能力，但其 rename 不满足此处句柄相对、不覆盖的共同契约，不能直接替代；Windows 精确名称及短名转换仍需局部适配。该判断仅说明本轮选择理由，不是新增长期规则或对所有库的穷尽证明。报告只保存本轮形成时认识，当前行为以代码及实际验收为准。

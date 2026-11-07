# Proposal

本临时计划将两域 Rust 记录 CLI 候选收敛到合作型本地单用户、顺序操作所需的简单运行时。

## Why

当前候选的文件身份、跨阶段证明、恢复、锁和 Git 暂存机制产生大量实现与验证成本，却不提供对非合作进程的跨文件隔离。用户已选择降低这些保证，用可解释的普通文件操作及真实部分结果取代复杂协议。

## Outcome

Decision Records 与 Investigation Report 的 Rust 候选通过跨平台常用库和 Git 自身能力完成两域操作，保留业务事实与准确机器结果，显著缩减专门事务机制；候选仍隔离于生产 TypeScript。

## Scope

### Intended Change

重构 `tools/record-cli/` 的来源、事务、两域操作及 Git stage；删去不再需要的特殊文件和证明机制。保留一次必要领域校验、基本工作区路径范围、独占新建、单文件原子写及如实 JSON；正式调用正常准备一次，预检不传递凭据。候选 envelope 升至 version 2 并删除不再产生事实的恢复/验证字段；Linux 实际交付和 Windows 目标编译接线按各自边界验收，保持候选和私有 fixture 边界。

### Resulting Impacts

资源移动、部分失败、暂存及结果语义变化须同步候选协议、兼容清单、共同操作的候选边界和长期决策；测试从目标契约重设计，重新采集 Case 与实体证据。离线交付及 CI 构建接线须覆盖平台目标。生产 TS、发布和用户数据不随之改变。

## Success Criteria

- 两域适用命令在新边界下完成正常行为并准确报告成功、失败、已完成与未知；不伪称回滚或验收。
- Git 只合成所选记录的同 JSON 内容，保留未选暂存；使用 Git 锁与一次 index 更新，相关冲突和失败可解释。
- Linux 全部适用测试、Windows x64 MSVC bins 的 cargo check 与 manifest/.exe 接线 mock/单元验证、Linux 私有离线交付及相应门禁有证据；不宣称 Windows 原生资格。
- 长期文档与决策反映已实现的候选边界；测试设计及账本按真实证据更新，最终全量 Gate 通过。

## Affected Owners

`tools/record-cli/` 源码、测试、协议、兼容与交付；`tools/record-operations/` 共同模型中的候选边界；`docs/decisions/` 决策及索引；`docs/test-evidence/` Case 与实体快照；项目 CI、Gate 和分发接线。领域规则仍由各自 skill 拥有。

# Proposal

本临时计划收敛 Rust 记录候选的已批准普查改进，不切换生产入口。

## Why

两份 Rust 普查识别出帮助与失败路径的可见偏差、测试平台条件、重复规则及准备数据流问题；两个只读和选择性发现的行为边界也已获得产品选择。普查是静态证据，不替代实施与验证。

## Outcome

候选的帮助、失败路径和选择性行为符合明确契约，重复实现与准备数据流更易维护，且已有事务、错误与平台承诺得到验证。

## Scope

### Intended Change

实施 CLI-002/003/004、INFRA-001、AUTHOR-003、OPS-001/002/003 八项；按已批准选择实施 MODEL-001 和 AUTHOR-002；比较 AUTHOR-001 的关系枚举转换，采用维护面更小的方案或保留并说明。

### Resulting Impacts

调整候选协议、Rust 源码与必要测试；按测试设计与证据规则核对并按需维护 Case。保留两域协议、失败顺序和独立准备，验证依赖锁及跨平台编译；同步稳定 owner 时不擅自改变 TypeScript 生产语义或生成包。

## Success Criteria

- 八项调整、两项产品行为和关系转换取舍均有实现或明确比较结果，边界和失败行为可由针对性测试核对。
- 候选协议明确只读 BOM 与选择性身份发现的范围；实际实现与文档一致，正式 check/sync 不因查询宽容而放宽。
- 修改符合编码规范，不增加无必要抽象；完成测试设计和证据/Case 核对，并执行 tasks 中列明的 Linux、Windows 目标编译及项目门禁，记录真实结果和限制。
- 生产 TypeScript、发布和既有 Windows 原生 CI 承诺不因本 Change 改变。

## Affected Owners

候选 `tools/record-cli/` 的 README、protocol、Rust 实现与测试；两域 skill 及共同操作模型为行为参照；`docs/coding-style.md`、`docs/test-maintenance.md` 和测试技能承接质量及证据；项目工具链承接验证与分发边界。两份调查报告及共享 findings 是形成时证据，保持不变。

---
title: 以首次采集检查和局部依赖暂存调查报告
id: 261010-investigation-local-validation-and-phase-facts
status: active
alignment: aligned
createdAt: 2026-10-10T10:01:57Z
purpose: 让调查只读检查验证本次对象，局部暂存只获取所选来源及必要依赖，同时保留写入漂移保护。
background: 全量结束重读和暂存全集门禁承担了用户不需要的保证，固定选择仍随报告全集重复读取。
decision: 只读 check 比较首次完整投影，stage 按发布元数据预选依赖并分阶段复核可变事实，固定 revision 事实复用。
tags:
  - investigation-report
  - performance
  - responsibility-boundaries
  - validation-boundaries
relations:
  - type: 修订
    target: 261010-separate-investigation-query-and-validation-acquisition
    summary: 取消只读结束保证与暂存全集原文门禁，保留写入复核
---

## 目的

- 适用于 `investigation-report`（`skills/investigation-report/`），按结果责任取得必要证据，减少全集原文附带门禁与同阶段重复获取。
- 保持写入的身份、资源可见性、成员、字节、执行位、HEAD 与 pending 一致性保护；不把“少读取”等同于降低保护。

## 背景

- 前序方向已经采用：发布快照查询不读正文，show/局部检查按需定位；但全量只读检查仍承诺结束来源复核，stage 仍以完整原文健康为门禁。
- 用户重新确定结果责任：check 只验证首次取得的同一份对象，不要求结束时仍未变化；stage 只验证预先选中的对象及必要依赖，不因无关原文损坏阻断局部写入。
- 完整索引关系图和完整 pending 一致性仍是真实全集成本。固定 revision 的树与 blob 不变，工作区、HEAD 指针、pending 和执行位策略则可变，不能统一按“阶段缓存”处理。

## 决策

- 采用：按以下责任区分 Investigation Report 的验证与阶段事实；精确命令规则由[检查与同步](../../skills/investigation-report/references/investigation-report-contract.md#检查与同步)和[待提交快照](../../skills/investigation-report/references/investigation-report-contract.md#待提交快照)承接，共享表示依据由[版本管理中间层](../../tools/shared/version-control.md#工作区有效文件表示)承接。

1. **只读检查验证首次对象**：全量 `check` 使用首次取得的源字节、解析、身份和资源事实，验证完整集合并比较完整发布索引投影，而非只比较来源 revision。该证据不承诺结束时来源仍未改变，也不是跨文件原子快照；因此不为这个未承担的保证结束重读全集。
2. **暂存按结果责任取得来源**：所有 scope 验证工作区发布索引与固定 HEAD 基线的严格 metadata 图和资源 owner 声明；`index`／`all` 还验证最终选择性索引投影。`index` 只负责投影暂存，零正文；`all`／`domain` 按发布声明预选报告、直接资源及其正式 owner，校验完整报告投影、ID、来源指纹、可见性与 owner 的直接引用。`domain` 保留 pending 索引，由调用方负责相应索引维护。必要依赖只参与验证，不自动进入写入目标；未选且未使用的坏原文不阻断局部暂存。
3. **安全范围覆盖完整写入树**：所选 owner 树包含未引用成员，准备与写前均在采集资源字节之前验证根、owner 和全部目标路径分量，零引用或空树也保留这项责任。允许缺失表达未引用基线资源的合法删除，只检查所选树及直接依赖路径；未引用成员按安全普通文件路径处理，不扩张直接引用 ID 的字符限制。
4. **复用不可变事实，复核可变事实**：固定 revision 的 HEAD 索引与所选 owner 成员可复用；工作区索引、局部成员、来源字节、文件表示、执行位策略与完整 pending 在准备和写前分别新读。关闭 fileMode 时可以传入本阶段完整 pending 表示依据；其他 caller 仍默认取得新依据。锁内 HEAD 指针与完整 pending CAS 保留。基线-only 删除可条件扩大身份发现，拒绝同一 ID 移动或重现。
5. **附带反馈与成本各自闭合**：保留的无关 pending 路径用变化元数据报告，包括 staged 删除，不为反馈读取整个 HEAD 正文。正常已定位来源访问随所选报告、直接 owner 依赖及局部资源成员增长；完整 metadata、图、pending 与其他 CPU 仍有集合成本，不能据局部读取量宣称整个 stage 为 O(K) 或固定时延。

本次只改变上述验证责任。`sync-index`（含预演）、publish 与其他工作区 mutation 的完整来源前提和必要复核保持；其他 skill 和共享默认新鲜度保持。查询、候选与索引来源 revision 的既有契约继续由固定契约相应章节承接。

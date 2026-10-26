---
title: 按所选路径验收记录暂存内容
id: 261024-validate-record-stage-selected-payloads
status: active
alignment: aligned
createdAt: 2026-10-24T13:59:54Z
purpose: 让两域暂存只读取实际消费的内容，同时完整保留未选暂存身份和并发保护。
background: 完整 pending 的路径、模式和对象身份足以保护未选条目，逐一读取其 payload 并不服务所选结果。
decision: 两域全部 stage scope 按所需路径验收 payload，完整成员身份、删除和 CAS 保护不变。
tags:
  - decision-records
  - investigation-report
  - responsibility-boundaries
  - validation-boundaries
  - version-control
relations:
  - type: 修订
    target: 261022-scope-record-index-payload-validation
    summary: 把按消费范围验收扩展到全部记录暂存scope
---

## 目的

让 `skills/decision-records/` 与 `skills/investigation-report/` 的选择性暂存只验收实际消费的内容，同时完整保护未选任务的暂存版本、文件表示、删除及并发状态。

## 背景

- [前序判断](archive/scope-record-index-payload-validation.md)已让两域 `index` scope 仅验收索引 payload，却仍让 `all`／`domain` 验收完整 pending 内容。所选范围不同，不应让无关对象的 payload 可读性成为额外门槛。
- 未选条目的路径、mode 与 OID 保持，和所选 payload 已实际读取，是不同证据。前者承担未选状态保护，后者承担本次消费内容的验收，不能互相替代。
- [按对象刷新](261026-stage-and-refresh-explicit-record-selections.md)继续定义 P-base 和选择语义；本判断只收敛内容读取责任，不改为 HEAD 基底或完整工作区替换。

## 决策

- 采用: 两域所有 stage scope 按所需路径验收实际 payload。`index` 消费必要索引；`domain` 消费所选领域文件与 owner 资源，保持 pending 索引原样；`all` 原子组合二者。未选 payload 以完整身份保护，不要求即时可读或有效指纹，也不据此证明其内容正确。
- 所选当前完整版本刷新原 pending，未选条目及 staged 删除保持。完整 pending 路径、mode、OID 和阶段身份仍独立复核，锁内 HEAD 与 pending CAS、写后保护不因少读 payload 放宽。
- 根据固定 HEAD（H）、工作区（W）、Git pending（P）中可用发布定位和 canonical 已知路径读取必要对象，不扫描所有 blob 猜 ID。仅 pending 存在、所有可用索引均无定位的任意旧 basename 明确要求恢复可信来源或索引，保持 pending 不变；不新增持久 locator 清单。
- 身份已在 H／W 中出现，不表示已收集全部旧位置：合法可用的 P 索引仍为所有所选 ID 提供旧 sourcePath，所选 canonical pending 路径也始终采集核对。
- domain 仅对 P 索引自身的读取或解析失败容错，且以其他可信定位已足够为前提。P 索引原状态与完整成员身份保持，成功读取的原始字节进入 opaque 与独立 fresh 保护；已定位所选正文的读取、身份或路径失败仍拒绝执行。
- 先读取索引再扩展选中路径时，扩展捕获必须证明同一 repository／scope、完整成员身份及此前已读取 payload 未变，且只增加明确内容路径。扩展证明不替代写前独立捕获，也不放松普通快照相等的策略边界。
- 合成索引继续满足完整领域图与 owner 声明，缺依赖要求显式补选，不自动暂存其他对象。资源树仍验证路径安全、实际内容和表示；索引中已足够表达的依赖事实不额外索取未选正文。
- 两域通过现有 Index Runtime 记录暂存协调器复用阶段义务，领域选择、生命周期与资源语义仍归各域。通用 Index Runtime 及其他 pending 消费者的默认完整验收不变，OID 不冒充实际 payload 指纹。
- 同次调用可复用已证明等价的不可变解析和固定 HEAD 派生事实；可变来源、文件表示和 pending 仍按阶段重新验收。不引入跨调用缓存，也不从局部 payload 读取推断完整索引、图或 Git 元数据成本已经消失。

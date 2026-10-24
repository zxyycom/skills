---
title: 保留日期身份并解除同名迁移前置
id: 261024-retain-dated-identities-without-name-migration
status: active
alignment: aligned
createdAt: 2026-10-24T13:59:55Z
purpose: 让不同形成日的同名记录独立存在，并让新对象可由返回身份与位置直接找到。
background: 日期 ID 已区分跨时间同名，强制迁移旧记录和优先语义文件名反而引入无关检查与定位成本。
decision: 继续使用日期加名称的完整 ID，新建默认完整 ID 文件名，跨日期与 legacy 同名不要求迁移。
tags:
  - artifact-identity
  - decision-records
  - investigation-report
  - naming
  - record-identity
relations:
  - type: 修订
    target: 260904-adopt-date-prefixed-record-identities
    summary: 保留日期与选择语义并取消legacy同名迁移前置
---

## 目的

让 `skills/decision-records/` 与 `skills/investigation-report/` 的跨时间同名记录保持独立身份，新建后可直接使用返回的完整身份与实际位置，而不治理无关旧记录。

## 背景

- [前序判断](archive/adopt-date-prefixed-record-identities.md)已用日期前缀区分形成事件，但要求遇到 legacy 同名时先迁移历史身份。这让新建操作承担了与新对象唯一性无关的维护。
- 需要解决的是不同时间形成的同名记录，不是高频并发创建。现有日期加语义名称足以表达这一边界，同日同名可以明确失败，无需随机段或高精度时间。
- 身份与 sourcePath 仍分别维护；优先完整 ID 文件名能减少新对象的名称占用检查，但不能据此强迫旧路径统一。

## 决策

- 采用: 新对象继续使用有效 UTC 日历日期加名称组成的 `YYMMDD-<name>`。Decision 沿用候选创建日，Investigation 沿用其形成日语义；同一完整 ID 冲突零覆盖失败，跨日期或 legacy 同名不阻断创建。
- 新建默认以完整 ID 作 Markdown basename，并沿用各领域候选容器。创建返回最终 ID 与实际 sourcePath／locator，候选发布沿用已分配身份，不重新编号。
- 保留标准日期 ID 精确选择、非日期输入按 name 唯一解析的既有规则。name 歧义在选择时明确提示，不作为创建前置；后续调用优先使用创建返回的完整日期 ID。
- 旧 ID 与旧路径继续作为合法来源保留，不批量迁移。legacy ID 的字面值同时也是 name，与日期 ID 同名时可能发生 selector 歧义；此时从合法索引取得实际 sourcePath 读取原文，不能宣称同一字面选择必然无歧义。确需身份治理时另按授权执行，而非自动修改另一个对象。
- 本判断不改变既有 rename 的位置选择规则、不新增并发唯一性协议，也不建立候选索引。当前字段、读取与失败细节由两域行为 owner 承接。

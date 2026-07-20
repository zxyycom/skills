# 2026-07-19 - 将账本扩展为验证义务并统一源码角色

## 索引摘要
- 目的: 抑制低价值测试增长，同时让自动化证明、人工审查风险和测试发现豁免都能被持续追踪与审计。
- 背景: 只登记自动化证明无法承接当前架构下不适合机械测试的真实风险，自由文本源码豁免又会脱离账本；测试发现仍需要区分真实主入口、归属于主 case 的衍生源码和误报。
- 决策: 账本 case 采用 automated、review 或 exempt 验证义务；源码使用 main、derived、exempt 角色，CLI 按测试文件校验映射与发现结果。

## 目的
- 抑制重复、无效、实现耦合或维护成本不成比例的自动化测试增长。
- 让无法以合理成本自动化的稳定风险形成可执行、可巡检的人工审查义务。
- 让测试发现器的必要豁免由账本承接原因，并与具体源码位置保持双向映射。
- 保持账本按稳定验证义务组织，不退化为测试函数清单。

## 背景
- 自动化测试仍需要语义准入；仅凭测试执行、覆盖率或账本存在不能判断证明目标是否独立且有价值。
- 部分稳定风险受架构边界、真实环境或故障注入成本限制，当前强行自动化会产生脆弱 fixture、复杂 mock 或高维护成本，但完全不登记又会让 CR 忽略风险。
- 跨语言测试发现器以常见语法识别测试文件，框架 fixture、生成材料和语法样本可能被识别为测试；自由文本源码豁免无法形成集中巡检对象。
- 一个测试文件可能是真实自动化主入口，也可能包含归属于其他主 case 的框架入口。二者需要不同源码角色，但衍生源码不应为每个测试函数创建独立账本 case。

## 决策
- 采用: `test-evidence-review` 继续同时承担测试价值与验证方式的语义准入，以及账本、源码角色和未登记测试文件的机械校验。
- 采用: 每个账本 case 使用 `Status: active|planned` 和 `Verification: automated|review|exempt`。合法组合为 active automated、planned automated、active review 和 active exempt。
- 采用: active automated case 保存单个 `Code:` 和非空 `Proves:`；planned automated 只保存明确证明目标，尚不声明源码入口。
- 采用: active review case 保存 `Scope:`、`Risk:`、`Reason:` 和 `Review:`，明确风险范围、自动化成本原因和人工检查动作，不创建虚假测试函数或源码测试标记。
- 采用: active exempt case 只承接测试发现误报，保存 `Scope:` 和 `Reason:`，并由源码 `@test-evidence exempt CASE-ID` 指向账本；豁免原因不在源码自由文本中重复。
- 采用: 源码统一使用 `@test-evidence main CASE-ID`、`derived CASE-ID` 和 `exempt CASE-ID`。main 是自动化 case 的唯一主入口；derived 表示测试源码归属于已有主 case，不创建独立账本 case；exempt 只引用已登记豁免。单个文件不能让同一 case 同时承担 main 和 derived，也不能重复同一角色映射；发现豁免文件只保留一个 exempt 标记。
- 采用: CLI 继续以测试文件作为最小强制归属单元，校验 case 字段组合、Scope 路径格式、main 唯一性、角色类型、主入口路径、豁免映射、孤立标记和未登记测试文件；测试函数的重复性与证明价值继续由语义审查判断。
- 采用: 测试框架继续负责执行测试，项目测试策略继续拥有层级和覆盖要求；CLI 不代替自动化证据判断或人工 CR。

## 关系
- 修订: [分离测试价值审查与账本机械校验](260719-separate-test-value-from-ledger-validation.md)

# Design

本设计把指标记录作为责任复核入口，以可验证的 owner 批次逐步收敛当前质量债务，而不是对阈值进行机械适配。

## Context

- `docs/coding-style.md` 明确规定文件大小、函数长度、嵌套和复杂度只是审查触发信号；只有复核出真实责任、边界或局部推理问题才形成整改要求。
- 2026-09-10 的完整 base Gate 产物记录 84 条 `file-metrics` 和 305 条 `function-metrics` finding。函数 finding 中，product 282 条、automation 11 条、tests 12 条；按 owner 计，Investigation Report 123 条、Decision Records 95 条、Task Graph 44 条，其余分布于共享层和项目自动化。
- 至少 `scripts/test-evidence/snapshot.ts#commandTokens` 与 `scripts/lib/vibe-gate/command-runner.ts#quoteCommandArgument` 的密度结果明显跨过实际函数边界，说明当前审阅必须先区分分析器可测量性与真实结构问题。
- `tools/` 是可分发源码，`scripts/` 是主仓库适配；测试实现变更还受 Test Evidence Case-only 账本约束。
- 当前工作树在开始本 Change 前干净；`main` 相对 `origin/main` 超前一个既有计划收尾提交，该远端状态不属于本 Change。

## Goals / Non-Goals

目标是清零当前两类非阻断 finding，同时让拆分后的责任、数据流、失败边界和验证入口更清楚，并保持所有外部行为兼容。非目标包括新增产品功能、改变领域格式或 CLI、升级 Vibe/CodeGraph、调整阈值、增加 waiver、删除有效测试、顺手改写行为文档或清理与指标无关的代码。

## Decisions

### Intended Change

1. **冻结度量契约。** 保持 `scripts/lib/vibe-gate/checks/native.ts` 中 file/function limits、code area 与空 waiver 不变；每批用同一 Gate records 比较 finding 数。
2. **先恢复可测量性。** 对分析器边界误判采用语义等价且仍清楚的字符串/正则表达，验证真实函数范围可被识别；不以隐藏文件、改扩展名或包装转发规避扫描。
3. **按 owner 批次推进。** 依次处理项目自动化与共享基础设施、较小工具、Task Graph、Decision Records、Investigation Report。每批先读取对应行为 owner 和 CodeGraph 影响，再围绕解析、领域判断、文件事务、输出映射或测试场景等现实责任拆分。
4. **函数重构服从主导问题形态。** 数据转换使用具名纯阶段，工作流保持结构化过程，封闭分支使用表驱动或判别联合，外部边界单独解析/校验；只有具备独立结果或不变量时才抽 helper。
5. **文件重构服从 owner 层级。** 先按导出、边界或领域阶段识别子 owner，再移动实现与相邻私有类型；barrel 只在已有稳定消费面需要时存在。单纯行数超过 360 不足以切分，但本 Change 的完成目标要求对仍超限的单元给出能改善责任表达的真实拆分。
6. **测试按最小原生入口重组。** 优先把独立 `test(...)` 场景移动到对应行为文件；不把一个契约测试拆成无法独立说明的碎片。任何入口新增、删除、移动或改名都在同一批次同步 Case 与索引。
7. **小步验证，不小步改契约。** 每个 owner 批次先跑直接测试、typecheck/lint/format，再用 cold Gate records 确认数量只下降且没有新类型；最终跑完整 release cold Gate 和生成漂移检查。

### Resulting Impacts

- 拆分源码会新增内部文件并改变相对导入；调用方应继续只依赖原公开入口，构建脚本必须发现全部正式源码。
- 部分长函数会变成多个具名阶段或领域对象；阶段间类型需要显式区分已解析输入、准备结果、事务状态和输出模型，避免把复杂度转移到通用参数袋。
- 测试文件拆分会改变 Test Evidence 的实体 ID；Case 迁移必须由真实新入口生成快照后完成，不能保留失效 ID。
- cold Gate 每轮会因大范围源码变化执行受影响 Check；验证以机器 records 与原生测试结果为准，不用终端截断预览估算。
- active Change 与现有其他计划可能触及相同 owner；本 Change 只做行为兼容的内部重构，后续计划继续前需按其 Git distance 重新复核。

## Risks / Trade-offs

- 大范围纯重构也可能造成导入遗漏、生成产物漂移或细微失败语义变化；按 owner 批次和直接测试缩小回归定位面。
- 严格清零文件长度可能诱发过度拆分；所有拆分都必须先写出变化原因或边界，并在无法形成真实子 owner 时重新组织更高层责任，而不是任意截断。
- 分析器对某些 TypeScript/JavaScript 语法的识别可能继续不准确；优先使用清楚的等价表达，只有项目代码无法合理表达时才把工具缺陷作为外部阻塞报告，不修改阈值或 waiver。
- 变更量会很大；保持每批可独立验证、避免并行改同一 owner，并在上下文切换时记录精确 finding delta 与下一步。

## Open Questions

无。当前目标按清零全部现存 file/function finding 执行；如果清楚的等价源码仍无法被分析器正确测量，再以具体复现和外部工具边界单独请求用户决定。

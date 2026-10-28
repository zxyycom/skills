# Tasks

按四项优化的依赖顺序实施，稳定快照通过审查与本地验收后保存并结项。

## Readiness

- [x] 0.1 核对实际调用、规则 owner、当前基线和四项保守方案；主实现已定位三个源码 owner，独立测试审查者已给出真实消费与失败边界验收矩阵。

## Implementation

- [x] 1.1 selected 比较短路与变化项排序落地；成本回退变异和同 revision 未选漂移保护测试均能检测目标错误。
- [x] 1.2 重划闭包集合查询落地；成员成本与首命中诊断由独立原生节点验证。
- [x] 1.3 查询字段采用构造期调用内证明，单来源和动态输入回退；错误信任原始输入、动态 map 或 Proxy 的变异均被测试捕获。
- [x] 1.4 长行最终范围限量生成落地；保留重叠、Unicode、截断、JSON 键序和失败边界，独立 170,892 组差分结果与基线一致。
- [x] 1.5 四个受影响 skill 通过公开入口同步，版本提升为 DR 104、IR 92、Novel Cards 16、Test Evidence Review 49；13 个新 Case 与 5 个旧 Case 更新，新测试叶子由现有聚合及订阅覆盖，限量搜索叶子另补 Gate 路由回归。

## Verification

- [x] 2.1 独立 Terra 按完整编码规范复核最终模型、方法身份保存、职责拆分及 descriptor 的 unknown 收窄，无未解决阻断；权威 repository-code 13/13 通过。构造期证明以标准 JavaScript intrinsic 完整性为前提。
- [x] 2.2 独立 Terra Test Design 的隔离快照 6 文件 40/40 及定向变异通过；叶子拆分、Case、聚合与订阅已补审，职责拆分后的 query/限量测试 11/11 及关键变异再次通过。
- [x] 2.3 主代理按 AI-Ready Docs 审核所有变更文档，修正旧候选“完整证明”残留，核对 owner、调用内边界、Case 证明范围及 Markdown 结构；历史报告保持形成时认识。
- [x] 2.4 quick、repository-code 和变更范围门禁通过，四个 skill 生成一致；验证与未覆盖边界见下文。

## Verification Evidence

- `bun run check`：10/10、快速预算通过，invocation `20261028T073116731Z-669b535f-a69f-4444-a7a2-ab810a4d5df4`。后续职责及类型收敛由 `--scope repository-code` 的 13/13 验收，invocation `20261028T073922656Z-b06c940e-bc5b-4258-90ea-3681c4a46f7a`。
- `bun run check:changed`：66 通过、0 失败、3 个发布专用检查不适用，invocation `20261028T074006079Z-2c5def53-7be2-4f48-a0a0-496fbdd8967d`。包含生成、文件/函数指标、实际测试聚合及 1,769 个测试实体引用检查。
- 首轮 quick 的测试方法引用 lint 和首轮 changed 的函数指标问题已修复并复核；没有降低门槛或跳过失败项。方法保存保持原身份，描述符保持 unknown 至逐项收窄。
- 机制证据证明 revision 差异短路、闭包较小集合查询、局部字段验证复用及长行范围限量；数组证明也有自己的成本，不把调用计数等同总时延。整行 Unicode normalization 仍处理完整行。
- Windows 原项目与 344 份报告未在本工作区，未升级、部署或复测原 94 秒场景。后续在目标项目升级到包含本轮修改的制品，保持报告与资源样本一致，采集 Node/Git/文件系统环境以及冷、热运行的总时长和分段计数，再与原样本比较。当前 Git 保存不等同发布或目标环境生效。

# Design

本设计分离 quick 反馈与 changed 验收，并以本轮真实执行耗时兑现快速入口的可验证承诺。

## Context

- Gate 运行、输入证明、调度与 release 的事实 owner 为 `docs/tooling.md`；接入责任由 `docs/gate-check-authoring.md` 承接。
- 用户确认默认 quick、changed 完整变更验收且 all 为别名、CI base/release 真全量；quick 不替代完成验收。
- 继续使用现有 64 项完整 Definition、原生 flags、精确 receipt、learned strategy、成功依赖和资源准入。

## Goals / Non-Goals

- 目标：明确范围、成功授权和性能统计边界，保持单一原生执行和结算主线。
- 非目标：重写 Vibe runner、flags、receipt 或 learned 调度；为速度新建通用抽象；扩大本次未约定预算；改变发布输入或远端发布行为。

## Decisions

### Intended Change

- `--scope quick|changed|full` 默认 quick；稳定 `check:changed` 使用 changed，`all` 为它的别名。CI base 无论请求何种 scope 均提升 full。scope 与 release/`--full` 同传拒绝；`--full` 仍是 release 的兼容别名，`--cold` 仍仅 release。
- quick 使用[运行时 owner 的固定十项 eligible](../../docs/tooling.md#catalog-与选择)。eligible 是可执行范围，不是每轮必执行集；已有精确证明、工具 flag 和成功前置仍通过原生选择闭合，输入证明 fallback 不将 quick 升级为完整 base。
- changed 保留全部 base 的变更相关验收与 receipt 成功事务；full/CI 实际执行全部 base，release 实际执行完整 catalog。quick 不发布或清除任何 receipt，以免晚预算失败留下新授权。公共入口在采集和子进程前规范化真实 PATH，按[环境证明边界](../../docs/tooling.md#项目输入与成功证明)消除嵌套 Bun 产生的重复项；以实际入口环境一致性及 changed→quick 精确复用验证，不放宽环境指纹。
- quick 硬预算：total >= 30s、Check P90 >= 10s 或 mean >= 5s 任一失败；changed/full/CI/release 只报告，本次不新增预算。
- 计时从 `runVibeCheck` 入口、输入采集前覆盖至业务收尾；quick 初判通过时报告后末次复核，超限只补写一次失败报告。样本采用原生实际执行时长，null 排除、真实零保留，nearest-rank P90 及缺失/非法测量的失败政策按[性能报告与快速预算](../../docs/tooling.md#性能报告与快速预算)接入；这不是进程级强制超时。
- 原生 output failure 对全部 scope 阻断；项目附加性能 summary 写入失败仅 quick 阻断，其他范围 warning，保留原生质量结论与 changed 的 receipt 成功事务。

### Resulting Impacts

- `AGENTS.md` 完成验收入口变为 changed 或 CI 全量；日常可用 quick。
- 工具链和接入约定区分 scope 与 release tag、eligible 与实际执行、性能结论与原生 aggregate、quick 与 receipt 发布授权。
- CLI、选择、调度 identity、machine 报告、测试/Case/index 同步；Vibe 继续拥有执行生命周期、依赖传播与原生结算，不新增 runner 或成功事务。
- 新建自包含修订后继承接 `261021-allow-markdown-lint-receipts` 的完整原生执行、输入证明与 release 边界，改变默认执行范围并加入预算。完整方向已对照源码与验收证据核对，并标记 aligned；工具能力/订阅判断独立保留。

## Risks / Trade-offs

- quick 不覆盖领域测试、生成漂移和完整质量材料，成功不能代替 changed 或 CI 全量验收。
- 输入闭包或成功前置可能扩大实际执行；通过原生选择测试核对而不是按速度删除责任。
- 性能统计不以 receipt 或未知时长补零；机器负载导致超预算时如实失败，不自动放宽政策。
- quick 不发布 receipt，保留已有证明的同时避免性能失败与成功授权分裂；changed 的完整事务不受此简化影响。

## Open Questions

无阻断交付的开放问题；实际测量与未覆盖边界见[验收证据](verification.md)。

# Tasks

先闭合输入与政策，再实施和验证；全部验收有证据后才声明完成。

## Readiness

- [x] 0.1 核对 owner、现有 receipt 事务、Markdown selection 与输入闭包，确认 lint 例外及不变边界。

## Implementation

- [x] 1.1 将 lint 接入既有 catalog、能力与原生 condition，补齐 ignored/root/额外目录 Markdown 快照和已知归属。
- [x] 1.2 同步 catalog/selection/proof 测试、对应 Case 与派生索引，覆盖完整输入及保守执行边界；补齐实际 smoke 暴露的四个基线领域测试输入至既有能力，并验证路由。
- [x] 1.3 演进相关长期决策，并同步工具链与 Gate 接入 owner 的实际契约和数量。

## Verification

- [x] 2.1 运行项目接入测试和账本检查，证明 lint 精确 reuse、各类输入变化 execute、失败/漂移不发布，以及链接与 CI/release 不变。
- [x] 2.2 运行完整 Gate，并用实际共享工作场景 smoke 核对复用与输入变化；记录未覆盖边界。
- [x] 2.3 完成独立正确性审查和最终 AI-ready/编码优化，修复发现并复验；确保稳定 owner、实现与验收一致。

## Evidence

- 最终 `bun run test:check`：81/81 passed、0 skipped；`typecheck`、`lint`、`format:check` 和 `git diff --check` 通过。账本检查覆盖 1,347 entities；Decision Records 严格检查 389 条通过，新决策已通过公开操作标记 aligned。
- `bun run check`：完整 Definition 64 项，61 passed、3 release-only N/A、0 failed；完整输入闭合，发布 53 项 receipt。
- 实际 unchanged smoke：0 execute / 53 reuse；共享源码与两个生成副本变化：7 execute / 46 reuse；两者 fallback 为 0，lint 为 unchanged-success/N/A，links 实际 passed，均发布 53 项证明。
- 根目录 `.MD` 与 Git ignored 目录 `.MARKDOWN` 违规输入各自触发 lint inputs-changed/failed、CLI 退出 1、check-not-passed 不发布，原 receipt 字节不变。临时 fixture 均已清理，共享三文件原 hash/mode 已恢复。
- `bun run check --tag release --cold`：64/64 passed，0 N/A、0 failed；计划 execute 64 / reuse 0，publication 为 not-incremental，receipt SHA-256 前后相同。
- 独立正确性审查最终 PASS；最终 AI-ready 模拟阅读可恢复完整 source 选集、公共输入并集、事实缓存与成功证明区别、保守条件及 CI/release 边界。测试假阳性已修复为 CLI 返回后的关键观察断言；指标整改按输入/发布责任自然拆分，移位 Case 实体 ID 已同步，无新增执行框架。

## Validation Boundaries

- CI 的全执行由本地接线对抗测试证明，未运行远端 CI workflow 或实际远端发布；冷 release 是本地完整交付验证。
- Windows 未运行；权限/mode 测试保留既有 Windows/root 条件，本次 Linux 非 root 的相关权限节点实际通过。
- unchanged/shared 墙钟分别为 6.697s/16.907s，均为单样本路由 smoke，不代表稳定性能收益，也不构成秒数门槛。
- 起止快照不提供原子工作树隔离；漂移只拒绝发布。依赖仍服从 frozen-lock 安装信任边界，原生零源 N/A 不伪造 passed。

# Tasks

本 Plan 已完成 workspace bridge 的实现、分发、文档同步和可复核验证。勾选只记录已实际完成的工作。

## Readiness

- [x] 0.1 确认 MCPShell definitions 的 params、模板化 env、command 和 timeout 契约。
- [x] 0.2 用隔离 SSH fixture 验证 command stdin 保真、Git apply 多文件失败整体性和二进制 SHA-256 往返。
- [x] 0.3 固定 Node、系统 ssh、POSIX backend 工具、64 KiB 文本限额、JSON envelope 与 fixture 验证边界。

## Implementation

- [x] 1.1 新增四项 operation 的 runtime、env/config/path/result/process/remote-transfer 实现。
- [x] 1.2 实现 preview/apply/remove initializer、受管 TOML 合并、env ignore 校验与受控删除。
- [x] 1.3 新增 MCPShell YAML definitions 与构建适配，生成 self-contained `.mjs`、source maps 与 YAML 到 skill。
- [x] 1.4 新增稳定 test/sync/check scripts，并维护源码到分发映射。
- [x] 1.5 同步核心 skill、README、人类介绍和配置 Change；skill version 维持本次已覆盖内容的 `4`。
- [x] 1.6 新增最小 Bun 测试入口、test-evidence topic/cases，并同步派生索引。
- [x] 1.7 加固 fixed-root、physical parent、staging destination 与 source snapshot 的路径边界、清理和分类。
- [x] 1.8 收敛 file transfer 的原子提交与 final acknowledgement 丢失语义：可能提交时返回 `outcome_unknown`，不进行无所有权证明的回滚。
- [x] 1.9 收敛 SSH spawn、containment、TOML table 边界和 remove newline splice 的失败分类与保留行为。

## Verification

- [x] 2.1 运行 26 项 bridge target tests，覆盖初始化、shell、patch、put/get、generated CLI 与 config envelope。
- [x] 2.2 运行 source-to-skill sync/check、generated module import smoke、YAML shape 和 skill validation；确认生成物无仓库绝对路径。
- [x] 2.3 运行普通工作树 `bun run check`、test-evidence catalog check 与 Change check，并区分其与 release snapshot 的验证范围。
- [x] 2.4 在隔离临时 repository/index 构造 pending snapshot，运行 release gate/pack 并解包确认分发文件存在、真实 `.env.mcpshell` 不在包内。
- [x] 2.5 记录 fixture 已验证的协议和真实 sshd、MCPShell binary、Codex reload 的使用环境验证边界。

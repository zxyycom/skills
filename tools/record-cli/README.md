# 记录工具 Rust CLI 候选维护

本目录是 Decision Records 和 Investigation Report 的共同原生候选：一个 Cargo package 和 `decision-records`、`investigation-report` 两个可执行文件。内部 library 供两个入口组合，不承诺 Rust SDK。候选独立于生产入口；当前仓库维护命令、skill 分发、打包和 updater 继续使用现行 TypeScript 实现。不要用候选操作真实记录或安装到用户环境。

## 构建与调用

从仓库根目录使用目录内 `rust-toolchain.toml` 固定的工具链（含 rustfmt、clippy），依赖由 `Cargo.lock` 锁定：

```sh
cargo +1.98.1 build --manifest-path tools/record-cli/Cargo.toml --locked --release --bins
cargo +1.98.1 run --manifest-path tools/record-cli/Cargo.toml --locked --bin decision-records -- --help
cargo +1.98.1 run --manifest-path tools/record-cli/Cargo.toml --locked --bin investigation-report -- help list
bun run test:record-rust
bun run smoke:record-rust
bun run test:record-delivery
bun run check -- --scope record-rust
```

具体命令和选项以二进制 `help <command>` 为入口，`--root` 指向工作区，领域目录选项为工作区相对路径。验证写操作须使用独立私有 fixture 和真实 Git 状态，不以示例目录指向真实记录。`smoke:record-rust` 默认读取 `tools/record-cli/target/release` 下的两个可执行文件，并自行创建私有 Git fixture；若构建时指定了 `--target` 或其他目标目录，通过环境变量 `RECORD_CLI_BIN_DIR` 指向包含两个可执行文件的 release 目录。`test:record-rust` 运行 Cargo 全 target 测试及 ignored 节点；scope 还包含格式、clippy、离线交付和项目代码质量检查。quick 不要求 Rust 工具链。执行命令不意味着目标平台或所有行为已经验收。

## 契约与责任

[共同原生候选决策](../../docs/decisions/261106-isolate-shared-native-record-candidate.md)记录方向和理由；该决策的对齐状态以决策记录为准。领域规则和现行操作分别由 [Decision Records](../../skills/decision-records/SKILL.md)、[Investigation Report](../../skills/investigation-report/SKILL.md) 承接；[共同操作模型](../record-operations/model.md)定义共享事务责任。共享代码负责安全来源、索引、Git 和事务，领域代码各自负责解析、身份、关系与生命周期。索引 schema 真源仍为 `tools/index-runtime/src/schemas.ts` 和各领域 index definition；Rust 类型与生成的 JSON Schema 都不是取代领域规则的真源。

[候选机器协议](protocol.md)承接 JSON 通道、两域 trace 例外、逐命令结果与恢复事实，并定义[文件事务边界](protocol.md#文件与事务边界)；调用者应以实际测试范围判断验收证据。

候选采用[顺序本地运行时方向](../../docs/decisions/261107-rust-record-candidate-sequential-local-runtime.md)：预检不保存执行凭据，正式执行重新读取准备一次；已有文件用成熟库原子替换，新建以 `create_new` 防止覆盖，初始化失败可留下部分新文件。实际及未知写入如实报告，不能报作成功回滚。stage 只有在可证明历史为空时才能采用空基线：缺失 DR HEAD 索引且路径无法区分候选与正式记录时应停止并恢复可信基线，不读取未选正文推定身份。安全与竞争保证以真实平台及测试证据为限，不承诺对非合作进程的跨文件原子隔离。

## 源码导航

维护 CLI 参数时，从 [`src/cli/arguments/`](src/cli/arguments/) 下的 query 或 mutation 入口查找；身份和事务结果映射位于 [`src/cli/output/`](src/cli/output/)。同步索引的两域适配与共享规划位于 [`src/mutations/sync/`](src/mutations/sync/)；决策生命周期的规则、准备和操作位于 [`src/mutations/decision/lifecycle/`](src/mutations/decision/lifecycle/)，多个操作共用的历史处理位于 [`src/mutations/decision/history.rs`](src/mutations/decision/history.rs)。这些路径是候选内部维护入口，不是公共 Rust SDK 契约。

## 交付与验证边界

[离线交付入口](delivery/README.md)只对私有 fixture 构建、安装和恢复；[性能方法](benchmarks/README.md)定义私有数据和新进程测量；制品不提交 Git。Linux 原生验收目标是 Ubuntu 22.04 x64 glibc 2.35（`x86_64-unknown-linux-gnu`）。Windows x64 MSVC CI 独立构建两个 release 可执行文件，并在私有 Git fixture 运行 `smoke:record-rust`，覆盖启动、决策读写与缺失记录 JSON、调查资源目录重命名和保留未选暂存的 stage；它不运行 Windows 全套测试，也不证明发布或全部行为的原生资格。候选 CI、Case 和性能报告须分别以实际 revision、环境、测试节点与结果为依据。离线结果不证明正式发布、线上更新或真实用户安装；生产切换与发布另需授权。

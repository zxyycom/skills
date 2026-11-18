# Record CLI 维护

本目录维护 Decision Records、Investigation Report 和 Resource Records 的原生业务运行时：一个 Cargo package 和各领域独立可执行文件。内部 library 不是公开 Rust SDK；各 skill 独立分发，程序化消费者使用 CLI JSON，不提供领域 TypeScript SDK。

## 构建与调用

从仓库根目录使用目录内 `rust-toolchain.toml` 固定的工具链（含 rustfmt、clippy），依赖由 `Cargo.lock` 锁定：

```sh
cargo +1.98.1 build --manifest-path tools/record-cli/Cargo.toml --locked --release --bins
cargo +1.98.1 run --manifest-path tools/record-cli/Cargo.toml --locked --bin decision-records -- --help
cargo +1.98.1 run --manifest-path tools/record-cli/Cargo.toml --locked --bin investigation-report -- help list
cargo +1.98.1 run --manifest-path tools/record-cli/Cargo.toml --locked --bin resource-records -- --help
bun run test:record-rust
bun run smoke:record-rust
bun run test:record-delivery
bun run check -- --scope record-rust
```

资源领域的本地构建目标为 `resource-records`；构建后使用该二进制的 help，并按 [Resource Records](../../skills/resource-records/SKILL.md) 操作。构建成功、平台验收、发布和安装分别取证，不由源码存在推断。

具体命令和选项以二进制 `help <command>` 为入口，`--root` 指向工作区，领域目录选项为工作区相对路径。验证写操作须使用独立私有 fixture 和真实 Git 状态，不以示例目录指向真实记录。`smoke:record-rust` 默认读取 `tools/record-cli/target/release` 下的三个领域可执行文件，并自行创建私有 Git fixture；若构建时指定了 `--target` 或其他目标目录，通过环境变量 `RECORD_CLI_BIN_DIR` 指向包含三个可执行文件的 release 目录。`test:record-rust` 运行 Cargo 全 target 测试及 ignored 节点；scope 还包含格式、clippy、离线交付和项目代码质量检查。quick 不要求 Rust 工具链。执行命令不意味着目标平台或所有行为已经验收。

## 仓库运行时

`bun run prepare:record-native` 在被忽略的 `.local/record-cli/` 准备本机程序，`bun run prepare:record-native -- --check` 只读核对来源、目标与摘要。仓库短命令由仅依赖 Node 内置模块的调度器调用已准备程序并透传参数、stdio 和退出码；不会自动下载、构建或回退旧后端。安装后的 skill 直接调用各自 `bin/` 中的原生程序。

## 契约与责任

领域行为由 [Decision Records](../../skills/decision-records/SKILL.md)、[Investigation Report](../../skills/investigation-report/SKILL.md) 和 [Resource Records](../../skills/resource-records/SKILL.md) 分别承接；[共同操作模型](../record-operations/model.md)及[机器协议](protocol.md)承接决策与调查两域的操作、JSON 和恢复边界；资源领域的独立协议见其 [CLI 契约](../../skills/resource-records/references/cli-operations.md)。`tools/record-contracts/schemas/` 是记录机器 Schema 的来源，不是 SDK。合法 Unicode 文本受支持，孤立 UTF-16 代理项明确拒绝。

Investigation 的[来源配置与帮助](../../skills/investigation-report/references/source-selection.md)和 [CLI 操作契约](../../skills/investigation-report/references/cli-operations.md)分别承接配置展开及读写路由；维护来源选择时，按这两个 owner 核对行为与验证范围。

## 源码导航

参数位于 [`src/cli/arguments/`](src/cli/arguments/)，输出映射位于 [`src/cli/output/`](src/cli/output/)；同步索引及生命周期实现位于 `src/mutations/`。内部模块不构成公开 SDK。

## 交付与验证边界

正式支持 Linux x64 Ubuntu 22.04 / glibc 2.35 和 Windows x64 MSVC；平台与发布证明以实际 revision、构建、资产和测试结果为准。源码包与原生二进制分别发布并绑定身份；[源码分发](../../docs/tooling-distribution.md)与[发布操作](../../docs/tooling-delivery.md)承接交付。离线 fixture 不证明正式发布、线上更新或真实用户安装。

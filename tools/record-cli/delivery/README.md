# Record CLI 离线候选交付

本离线候选流程仅用于私有 fixture 验证；其产物不接入 skill 包、updater 或 GitHub release，也不能安装到真实用户 skill 或记录目录。候选维护与平台证据边界见 [Record CLI 维护入口](../README.md)。需要 Node.js >=24.18、仓库依赖、冻结 Rust 工具链及已缓存的锁定 Cargo 依赖。

以下占位符须替换：`<Cargo版本>` 取当前 `tools/record-cli/Cargo.toml` 的 package version，`<私有测试目录>` 使用调用者自行创建的隔离目录。

```sh
node tools/record-cli/delivery/cli.ts build record-cli-candidate-example <Cargo版本>
# 在独立临时测试目录中创建 .record-cli-fixture，内容严格为：
# record-cli private fixture（后接一个换行）
node tools/record-cli/delivery/cli.ts install dist/record-cli-candidate-example/assets <私有测试目录> <Cargo版本>
node --test tools/record-cli/delivery/delivery.test.ts
```

构建只创建 `dist/` 下新的单段名称，不覆盖既有输出；失败的目录保留供检查，手工核对后再决定清理。manifest 中 source hash 是隔离快照的文件名、长度和字节摘要，`source-files.json` 列出输入；Cargo 以 `--locked --offline` 从同一快照构建，输出 schemaVersion 2 manifest 前实际运行 `decision-records`、`investigation-report`、`resource-records` 三个原生二进制的 `--version`，要求角色及 Cargo 版本与所填版本一致；二进制不入 Git。读取历史 schemaVersion 1 manifest 时仍按其两角色契约校验，不将其解释为三角色。若出现路径依赖、build.rs、workspace 候选或父目录 / Cargo home 配置、额外 Rust/Cargo/编译器环境覆盖时则拒绝并先审查闭包。工具链和宿主系统库仍属外部环境，需记录并在冻结环境验证，不能仅凭源码 hash 声称可复现。

目标必须已存在且含上述标记，安装会列出受管覆盖/新增项并保留无关文件。标记仅是误用保护，调用者仍须保证目标是自己创建的私有 fixture。安装中使用临时备份，普通失败尝试恢复并回读；失败信息若提示恢复不完整或提交后清理失败，保留并检查所示目录，不要盲目重试。崩溃、断电及非合作并发不保证自动恢复；安全检查不能替代隔离。

命令中的版本须与所选源码的 Cargo 版本一致；本机构建、正式发布与 Windows 验收分别交付。

历史 0.1.0 → 0.1.1 私有双版本实验与其 `verify-real.ts --build` 入口只适用于历史源码 revision；当前源码不运行该硬编码历史构建。正式双平台来源、安装恢复与 release 验收由当前发布 workflow 和实际交付证据承接。

## 与正式交付的关系

上述私有 fixture 命令只验证离线候选，不构成正式发布或线上安装证明。正式 skill 源码包与平台原生程序是独立资产；发布时绑定来源、版本、目标与摘要。正式流程、持久恢复资产和线上隔离验收见[发布操作](../../../docs/tooling-delivery.md#原生记录资产与安装)。

首次安装和同版本重装通过独立安装器显式选择目标；后续更新与失败处置见 [Skill Updater](../../skill-updater/README.md#原生记录-skill)。hash 不单独证明来源；真实用户目录安装及远端发布仍须各自授权。

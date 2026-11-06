# Record CLI 离线候选交付

仅用于私有 fixture 验证；不接入现行 skill 包、updater 或 GitHub release，也不能安装到真实用户 skill 或记录目录。候选维护与平台证据边界见 [Record CLI 维护入口](../README.md)。需要 Node.js >=24.18、仓库依赖、冻结 Rust 工具链及已缓存的锁定 Cargo 依赖。

```sh
node tools/record-cli/delivery/cli.ts build record-cli-candidate-example 0.1.0
# 在独立临时测试目录中创建 .record-cli-fixture，内容严格为：
# record-cli private fixture（后接一个换行）
node tools/record-cli/delivery/cli.ts install dist/record-cli-candidate-example/assets <私有测试目录> 0.1.0
node --test tools/record-cli/delivery/delivery.test.ts
```

构建只创建 `dist/` 下新的单段名称，不覆盖既有输出；失败的目录保留供检查，手工核对后再决定清理。manifest 中 source hash 是隔离快照的文件名、长度和字节摘要，`source-files.json` 列出输入；Cargo 以 `--locked --offline` 从同一快照构建，输出 manifest 前实际运行两个原生二进制的 `--version`，要求角色及 Cargo 版本与所填版本一致；二进制不入 Git。若出现路径依赖、build.rs、workspace 候选或父目录 / Cargo home 配置、额外 Rust/Cargo/编译器环境覆盖时则拒绝并先审查闭包。工具链和宿主系统库仍属外部环境，需记录并在冻结环境验证，不能仅凭源码 hash 声称可复现。

目标必须已存在且含上述标记，安装会列出受管覆盖/新增项并保留无关文件。标记仅是误用保护，调用者仍须保证目标是自己创建的私有 fixture。安装中使用临时备份，普通失败尝试恢复并回读；失败信息若提示恢复不完整或提交后清理失败，保留并检查所示目录，不要盲目重试。崩溃、断电及非合作并发不保证自动恢复；安全检查不能替代隔离。

真实双版本制品复验（须从稳定源码运行）：

```sh
node tools/record-cli/delivery/verify-real.ts --build <新名称>
# 也可重新验证已经构建的两份制品：
node tools/record-cli/delivery/verify-real.ts dist/<新名称>-a dist/<新名称>-b
```

入口创建 `dist/<新名称>-a` 与 `dist/<新名称>-b`；A 从当前源码构建真实 0.1.0，B 从 A 的隔离快照仅将根 Cargo.toml 和 Cargo.lock 中 package 版本精确由 0.1.0 提升到 0.1.1，然后分别以锁定、离线方式构建。正式源码版本不变。源码快照、source-files.json、manifest、原生资产与工具链记录分别保存在构建目录；采集命令完整日志。失败半成品保留，不覆盖现有目录。该版本提升仅用于私有验收，不是发布。

复验回算完整源码树和资产 hash，检查 A/B 不同源码与二进制；在自己创建的临时 fixture 安装并运行 A 的两个 `--version` / `--help`，注入 B 首次替换故障并逐字节检查回退与无关 sentinel，再成功安装运行 B。成功清理 fixture，失败保留路径供检查。最终源码变化后必须重新构建并运行；当前平台结果不证明另一平台、正式发布或全部 CLI 行为。

## 后续生产接线的验证责任

任何未来接线须先获得相应授权，再由分发 owner 决定 release 资产、manifest 与现行 skill 包的关系：在受控环境为每个目标构建唯一资产，绑定来源、版本、target、长度和 SHA-256；消费方还须验证可信 release 身份，hash 本身不证明来源。现行 `pack:skills` 基于 Git pending 快照，未入 Git 的原生二进制不是该快照输入；若要纳入包，必须同时固定构建输入、资产身份及发布快照，不能隐式拾取本机产物。

现行 updater 只覆盖新包路径，不自动删除旧入口。接线前须列明可验证归属的旧受管路径、用户定制和依赖、平台回退与可恢复入口；清理及真实安装依各自授权执行。更新失败按实际提交状态恢复并独立验证旧入口，而非仅依据文件残留推断仍可运行。离线实验不证明远端发布、签名或线上更新。

# 原生记录 CLI 交付契约

本文件是本 Change 的实施规格，补充 [design](../design.md) 的制品、更新与激活决策。实施后由各稳定 owner 承接，不在这里保存长期运行规则。

## 格式与源码边界

- 两域索引 JSON Schema 的数据源移到 `tools/record-contracts/schemas/`，生成器复制该源，旧 TS 导出器在准备期消费该源。保留领域规则和通用 Index Runtime 的职责；这是两域持久格式的纯数据协议，不是 SDK。
- 当前 Schema 源位于两域 `src/index/*-index-json-schema.ts`，依赖领域定义。1.1 须逐项核对现有格式、规则及 Rust 校验；只迁移导出结果不足以证明语义一致。
- 正式支持合法 Unicode 文本。旧 TS 对 YAML/JSON 转义中孤立 UTF-16 代理项的宽松接受不延续；原生入口明确报错，禁止静默替换或丢字。正常持久格式仍须保持。
- 该纯数据源取代两域原有 TS Schema 构造源，属于跨语言格式 owner 的明确变更。实施时更新分发规范及决策；其他工具的 Valibot 结构源和通用索引定义不随之退役。

## 身份与资产

角色固定为 `decision-records`、`investigation-report`；目标固定为 `x86_64-unknown-linux-gnu`、`x86_64-pc-windows-msvc`。Linux 构建/验收基线为 Ubuntu 22.04、glibc 2.35；Windows 沿 Windows Server 2022 x64 MSVC CI，验证并公布运行库前置，不由编译 target 推定所有 Windows 版本已支持。

| 产物 | 必要内容与约束 |
| --- | --- |
| Git pending 中的 skill 包 | 源码、Schema、说明、安装更新入口/依赖、`native-runtime.json`；不含编译后的二进制 |
| `native-runtime.json` | `schemaVersion: 1`、`role`、`runtimeVersion`、`sourceHash`、两个受支持 `targets`；进入 skill hash 和版本门禁 |
| 基础 release manifest | 保留 `schemaVersion: 1` 和每个 skill 的正整数 `version`，其他 skill 继续使用现行解析器 |
| 每个原生 skill 的 `native` 扩展 | `schemaVersion: 1`、`runtimeVersion`、`sourceHash`、skill ZIP 的 `package`、按 target 映射的运行时 `targets`、引导 ZIP 的 `bootstrap`；角色由 skill key 与描述符交叉验证 |
| 每个资产引用 | `name`、`byteLength`、`sha256`；名称在选定 release 唯一，长度为正安全整数，SHA-256 为 64 位小写十六进制 |
| 运行时 ZIP | 每个角色/target 各一份，仅包含对应角色可执行文件；包外 manifest 与包内描述符、二进制 `--version` 对齐 |
| 引导 ZIP | 显式 Node 入口、依赖 manifest/锁文件和引导说明；与原生 updater 共用引擎，不带旧领域 SDK |

扩展解析器放在 `tools/skill-package/` 的独立原生协议模块，从原始 JSON 验证并保留扩展；旧基础解析器会忽略额外字段，不能将其输出当作原生完整元数据。新模块仅进入这两个 skill 和引导器的生成闭包，避免无关 skill 运行时变化。

固定资产名如下；所有 skill 的 manifest 仍是 `skill-release-manifest.json`。

- 两个 skill ZIP：`decision-records-native.zip`、`investigation-report-native.zip`。
- 四个运行时 ZIP：`<role>-<runtimeVersion>-<target>.zip`。
- 一次性引导 ZIP：`record-native-installer.zip`。

两个原生 skill 的旧名 `<skill>.zip` 不出现在原生正式 release。新原生 updater 从扩展读取新名；旧 updater 请求旧名时在下载安装包前失败。切换版本必须高于最新受支持 TS 版本，避免旧 updater 的同版本短路；其他 skill 的资产名和更新机制保持。

## 冻结构建与发布

1. 原生源码与 skill 都从同一发布准备阶段捕获的 Git pending 字节构建，不从工作树或任意本机 `target/`、`dist/` 拾取。原生输入沿现有候选快照规则，排除 crate 顶层 `target/` 和 `delivery/`，包含 Cargo 清单/锁文件、工具链、源码及其余纳入文件；按规范路径排序，对路径、长度和字节计算摘要并保留文件清单。额外编译输入先扩展清单再构建。
2. 同一源码清单用于两个受控平台的冻结构建。记录 Rust/Cargo、系统和运行库环境，执行 locked 构建并核验两个角色的 `--version`；离线构建仍需显式准备依赖。源码摘要不替代外部工具链证明。
3. 描述符摘要必须等于冻结源码摘要。同步描述符后如需重新暂存，重新捕获并授权 skill snapshot；最终 hash、ZIP、manifest 与 release 门禁消费同一准备结果，不能在后续阶段重新读取 index 拼接资产。
4. Cargo 原生版本、描述符和二进制版本一致。首个正式运行时采用新版本，不复用私有候选 0.1.0；同一原生版本的资产只允许按已验证相同字节复用。源码或资产变化需要新原生版本，skill 版本按最新发布基线单独提升，不能固定使用本次审计的版本号。
5. 打包输出使用新建的 `dist/skill-release/<run-id>/`，仅清理本轮拥有的 staging。发布器接收明确的本轮资产清单，包含其他 skill 的既有资产；不扫描根 `dist/` 的 ZIP，不清空已有 fixture、构建或证据目录。
6. rolling 发布先上传并核验新资产，再移除这两个旧名 skill ZIP，最后发布原生 manifest；失败则停止，不把部分发布报为成功。其余 skill 资产不因本次退役清单删除。snapshot release 同名内容必须不可变。首升说明、完整引导包和匹配的 manifest 与原生发布同时可用。

消费方固定仓库与本次解析的 release 身份，按 manifest 校验全部下载，拒绝角色、版本、target、长度、hash 或来源错配。rolling 期间缺失或混合资产应失败并保留本地旧状态；hash 只证明字节一致，不额外宣称签名或独立来源认证。

## 安装与更新

入口分为独立引导器和包内原生 updater；二者调用同一个原生安装引擎。既有认证和 release 查询可复用，通用 updater 对其他 skill 保持现行行为。

1. **取得引导器**：从指定仓库/release 下载引导 ZIP 和 manifest，核对引导资产 hash；在独立目录显式安装其锁定依赖，按 Node >=24.18 运行，显式传入 skill、目标目录和 release tag。普通业务命令不下载或安装运行时。正式 release 说明必须给出两平台可执行的完整引导命令和校验步骤。
2. **准备**：一次解析 release，验证 skill 身份、描述符与目标，下载相应 ZIP 并安全解包到隔离 staging。只接受普通、规范且唯一的相对路径；拒绝穿越、符号链接及 Windows 路径别名。Linux 设置并回读可执行位，Windows 验证可执行与占用处理。
3. **预检**：列出覆盖、新增和退役文件，核对用户定制、旧受管清单和依赖前置；确认后才写入。引导器使用自己的独立依赖，原地目标须能在原有依赖环境加载新 updater；不兼容时写前停止，转独立新装或先明确依赖处置。新装的依赖显式准备，更新期间暂停领域操作，原地升级不删除/替换 `node_modules`。
4. **写入与激活**：备份受管旧状态，准备新文件及 `bin/<role>[.exe]`，验证新入口版本/help、Schema 和说明的包身份，并从最终目标加载 updater/help；最后启用 `SKILL.md`。激活前普通失败恢复并回读旧文件、权限和旧入口，恢复不完整时保留备份与精确诊断。
5. **清理与完成**：激活后只清理验证通过的退役清单，记录受管文件、hash、权限和完成状态。成功必须同时满足新入口可用、说明匹配及退役完成；清理失败报告“已激活、清理待完成”，保留恢复位置，不宣称整体成功。再次执行先验证当前状态，再续清理或修复；本地 receipt 不是删除归属的唯一凭据。

原生 updater 的同版本判断包括本地二进制、受管文件和退役状态，不沿用只比较 `metadata.version` 的成功短路。`--check` 只读判断 readiness，修复或续清理仍需显式执行及原有确认策略。业务执行失败不改用 TS 重跑。普通失败恢复、激活后续清理与崩溃/断电恢复分开描述，不承诺多文件原子性或自动崩溃回滚。

### 受支持的旧安装

初始清单以审计 revision `dc874213f494ba5411330afe135c0542df5184a8` 的 DR 109、IR 98 包文件及 hash 为基线；这表示已知源码包，不表示已核验远端历史 release。若 A 阶段产生仍使用 TS 的过渡发布，先记录其确切清单才纳入支持。

退役集为“该旧包清单减去新受管集合”，写入前验证将覆盖或退役的文件。旧领域文件缺失或被修改、版本/内容无法识别时停止原地升级并展示冲突；可另选空目录新装。未知文件占据已退役领域入口/声明位置时也作为冲突，其余无关文件保留。两个 skill 各自处理，保留新 updater 仍用的共享文件，不凭扩展名或目录名递归删除。

## 仓库运行时

`prepare:record-native` 从冻结的本地源码准备两份可执行文件及来源 receipt 到被忽略的 `.local/record-cli/`。其 `--check` 核对源码、二进制与 receipt，供维护和 Gate 使用；源码变更后须重新 prepare。默认业务命令只由轻量 Node 调度器转发到已准备文件，缺失时给出 prepare 指令，不隐式构建/下载；源码新鲜度由 prepare/check 负责，不在每次业务调用遍历源码。

正式切换时，根短命令与记录健康 Gate 都改走该运行时；安装 skill 直接调用包内二进制。Node 调度器不加载业务模块，不改变业务 JSON，不提供 import SDK。

## 验证投入

便宜的协议/路径/状态测试使用固定小样本与独立预期，可重复执行；实际构建和平台安装复用同一组冻结来源的两版本制品，同一版本在两平台保持来源一致，不为每个故障重新编译。两平台各自保留真实制品安装证据，最后受影响源码变化后重验。测试实现与 Case 按 Test Design/Test Evidence Review 裁决，不按清单机械复制全矩阵。

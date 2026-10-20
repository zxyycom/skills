# Design

采用包内自有 TS 模块、独立 pnpm 安装基线和正常模块解析，兑现源码可读、可改、可运行的结果。

## Context

维护源码、分发适配和正式内容分别由 `tools/`、`scripts/build/` 与 `skills/` 承接，
职责见[源码与依赖边界](../../docs/tooling.md#源码与依赖边界)。根 manifest 与锁文件服务主仓库开发；
skill 需要可独立使用的运行依赖清单。

本设计保存目标状态；实际生效契约仍由项目与各 skill 的行为 owner 承接，
实施进度和验证证据由 [tasks.md](tasks.md) 维护。

## Goals / Non-Goals

- 目标：直接交付自有 TS，使用标准依赖安装，支持兼容宿主复用，保持单一维护源码与领域接口语义。
- 范围边界：调整单 skill 的运行和交付形态；用户安装集合、客户端配置与领域业务规则由既有 owner 承接。

## Decisions

### Intended Change

#### 代码与入口

维护源码继续位于 `tools/`。将运行所需 TS、共享模块、资源和类型复制到
`scripts/runtime/tools/<tool>/...`，保留相对目录与模块关系，导入路径适配 TS 扩展名。
仓库维护从源码 owner 同步；安装者可直接修改包内副本，生成头区分这两种使用方式。

公开入口为 `scripts/<entry>.ts`，updater 为 `scripts/update-skill.ts`，调用方与文档同步采用 TS
路径，原 MJS 路径不在兼容范围内。稳定程序化边界继续由公开导出及必要类型定义，
Schema 和声明按实际消费契约生成。第三方包按其原生 JS/native 格式运行，由 pnpm 安装。

执行使用 Node.js 原生类型擦除：采用可擦除语法、显式扩展名和 `import type`，
以独立运行的导入路径表达模块关系。

#### 依赖与安装

每份 skill 提供完整运行依赖的 `package.json`、`pnpm-lock.yaml` 与 `.gitignore`。
Manifest 声明 ESM、Node engine、固定 `packageManager` 和运行/公开类型需要的依赖；
pnpm 精确版本沿用根 manifest。依赖声明可脱离仓库解析，不含 `workspace:` 或仓库外本地路径。

锁文件由维护者显式刷新，用于复现经过验证的安装基线。运行采用 Node 正常解析，允许兼容宿主依赖；
兼容性由支持版本范围和 API/行为契约定义，不以来源、本地依赖目录或锁文件精确版本增设门禁。
Node 本身不会按 manifest 范围挑选兼容版本。

标准独立安装命令：

```bash
pnpm --dir "<skill-directory>" install \
  --ignore-workspace --prod --frozen-lockfile \
  --config.node-linker=isolated
```

该命令独立管理本次安装，store 复用与链接由 pnpm 处理。`pnpm-workspace.yaml` 仅在具体依赖
确需项目级配置时添加，例如构建脚本许可或 overrides，并验证其与固定 pnpm 的配置行为。

#### 使用、更新与恢复

已有兼容依赖即可运行；依赖不可用、实际不兼容或需要复现基线时，显式执行 frozen 安装。
普通运行、import、help 和只读检查不隐式下载、执行安装脚本或修改全局配置；
实际加载/调用失败保留诊断并提供安装指引。

Updater 同样需要兼容依赖。依赖损坏时先通过 pnpm 重装或重新获取 skill 恢复，再执行更新。
知识型 skill 的指令使用无需安装，其 TS updater 按上述运行前置使用。

文件更新沿用 [Updater 的覆盖/保留契约](../../tools/skill-updater/README.md#运行契约)：
同名更新会覆盖包内定制，其他本地文件保留。源码更新状态与依赖兼容性分别说明。

### Resulting Impacts

1. 同步工具维护包内预期文件集合、可移植配置和必要生成内容；check 只读比较，sync 仅清理已知
   过期受管文件。公开调用方、主模块判断、模块位置、资源和动态 import 随 TS 路径调整。
2. TS、manifest、锁文件与按需配置进入制品身份并承载独立版本；制品显式排除依赖目录、store、
   安装链接和缓存，包括被强制加入 pending 的安装产物。Git 忽略与制品过滤分别验证。
3. Node engine、native runtime 和 optional 能力沿用领域 owner；TS updater 自更新需核对执行中
   模块加载及文件覆盖边界。纯 TS 路径调整之外的兼容性变化在实施前回到设计确认。
4. 根命令、Gate impact/生成前置与 CI 消费新的同步结果；Bun 继续承担主仓库维护调度和必要生成。
   业务矩阵由源码测试承担，生成契约与最小分发 smoke 证明交付边界，
   按现有 owner 同步行为文档、Case/index 和 Decision。

## Risks / Trade-offs

| 取舍 | 处理方式 |
| --- | --- |
| 原生 TS 受语法、engine 和安装位置约束，且不执行类型检查。 | 验证各 engine；自有 TS 位于 skill 文件树而非依赖的 `node_modules`，类型检查由仓库承担。 |
| 宿主依赖可能不同于维护基线。 | 验证兼容行为，保留 frozen 安装作为复现与恢复路径。 |
| TS updater 与多文件更新依赖可用环境，源码与依赖分步更新。 | 安装/更新期间暂停领域操作，失败后按明确步骤恢复。 |
| 独立锁文件、源码副本和局部安装布局增加维护与存储开销。 | 接受独立交付成本，复用 pnpm 能力并以同步检查和测试预算约束开销。 |

## Open Questions

无。[Readiness](tasks.md#readiness) 核实依赖闭包、运行兼容性与验证预算。
若结果要求调整 Node engine、接口语义、native 责任或安装权限，先修订设计并确认影响。

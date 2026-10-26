---
title: 分发可就地修改的独立 TypeScript 运行时
id: 261020-distribute-editable-typescript-runtimes
status: active
alignment: aligned
createdAt: 2026-10-20T03:28:09Z
purpose: 让单个 skill 可独立安装、直接运行和修改源码，同时保留唯一维护源与可核对分发边界。
background: 单文件内联制品隐藏模块关系并要求修改后重新构建，标准 Node 类型擦除和独立包依赖可消除这条反馈障碍。
decision: 以包内 TS 模块闭包分发领域工具与 updater，独立 pnpm 锁定安装保底，允许标准 Node 解析复用宿主兼容依赖。
tags:
  - build-portability
  - build-reproducibility
  - dependency-boundary-design
  - project-tooling
  - source-artifact-separation
relations:
  - type: 修订
    target: generate-and-check-import-safe-tool-artifacts
    summary: 保留单源与安全导入，改为TS模块及独立依赖安装。
  - type: 修订
    target: derive-sdk-declarations-from-runtime-source
    summary: 保留task-graph单源声明，配套公开TS运行时
  - type: 修订
    target: derive-decision-records-declarations-from-runtime-source
    summary: 保留决策CLI值与类型单源，改为TS声明配套
---

## 目的

- 让独立 skill 的实现可直接阅读、运行和调整，业务修改无需回到维护仓库重新构建。
- 保持单 skill 的独立获取、版本、更新与安装边界，避免把宿主工程变成分发工具的受管对象。
- 保留唯一维护源、可安全导入及可重建核对的完整交付契约。

## 背景

- 前序选择用单文件 ESM 内联依赖保证独立运行，并用统一生成路径核对产物；它降低了安装前置，但隐藏模块关系，就地修改必须重新构建。
- Node 原生类型擦除可直接运行符合其限制的 TS；标准包管理器可以承接第三方依赖安装，不必另建依赖解析、链接或完整安装集合管理器。
- 锁文件适合复现独立安装，不应成为正常 Node 运行时拒绝宿主兼容依赖的理由。宿主依赖可能与锁文件精确版本不同，也可能没有 skill 本地的依赖目录。
- 领域工具与 updater 属于同一个 skill 交付单元，共享 manifest、锁文件与源码闭包，必须由一个联合受管集合生成和校验，不能各自覆盖另一方的依赖。

## 决策

- 采用: 领域工具、updater 及可达共享源码按 TS 模块结构复制到各 skill；第三方依赖不内联。公开 CLI 和程序化入口使用 TS，包内业务修改由 Node 直接加载生效，不引入消费者转译器或 Bun 前置。
- 采用: `tools/` 保持维护源码 owner，`scripts/build/` 适配器组合入口和资源，共享同步器计算联合闭包。生成头追溯维护源码和重建入口，不写时间戳或本机绝对路径；仓库生成副本不成为第二维护源，安装副本允许直接修改但更新会覆盖正式同路径文件。
- 采用: 每 skill 的独立 manifest 声明 Node engine、固定 pnpm 与实际依赖，锁文件提供 frozen 独立安装的保底路径；不默认提供 workspace 配置，只为已确认的依赖要求添加必要配置。
- 采用: 依赖由标准 Node 模块规则解析，兼容宿主依赖允许正常复用，不另设来源、目录、本地依赖目录或精确锁版本限制。启动、help、import 与检查不隐式安装；依赖失败明确引导显式安装或重装，updater 自身不可加载时先显式修复依赖，运行时或安装输入损坏后再重新获取正式 skill 恢复。
- 采用: 公开模块仅在主入口运行时执行 CLI；普通导入不执行命令、不修改退出状态、不产生文件或网络副作用。语法限制纳入类型检查，模块位置、Node API、资源、native/optional 能力与消费者类型解析仍以真实 Node 入口证明。
- 采用: 已建立的程序化接口继续保留必要声明闭包，机器契约继续从领域结构真源派生 Schema；公开面不自动扩展到复制后的内部源码目录。

### 两域公开接口与声明单源

- 采用: 对 `skills/task-graph/` 与 `skills/decision-records/`，各自 `tools/<tool-name>/src/cli.ts` 的公开导出是命令行与程序化导入的共同接口事实源。
  - Decision Records 的明确 `export type` 同样由该源决定。
  - 不另设 SDK 实现、手工类型清单、独立声明源或第二套接口版本管理。
- 采用: 两域声明由 TypeScript 从实现机械发出，只分发从 CLI 声明入口可达的必要声明闭包，并剔除 internal 成员。
  - 根声明只承接公开值及明确公开类型的签名，不把存储、锁、runtime 探测或测试注入变成公开接口。
  - 声明消费不要求安装实现内部依赖。
- 采用: `scripts/task-graph.d.mts` 与 `scripts/decision-records.d.mts` 分别配套本 skill 的公开 TS 入口，包内声明树承接其可达拆分模块。
  - 它们都是维护源码的生成产物，与运行时一起通过各域 `sync:*` 写入、`check:*` 重建核对。
  - 复制后的内部 TS 源码可读可改，不因此自动成为兼容性承诺。
- 不采用: 脱离实际公开导出而仅在声明中提供便捷工厂，或建立 SDK registry。

### 完整交付核对

- 采用: `sync:*` 与只读 `check:*` 使用相同受管集合和生成路径，CRLF 与 LF 视为相同文本，其余缺失、过期或内容变化均报告漂移。hash 与 zip 共享 pending 文件快照并排除依赖目录、store、缓存及安装残留；版本、release manifest 和单 snapshot 授权主线保持不变。
- 不采用: 单文件业务 bundle、运行时反向导入维护仓库或其他 skill、自动安装/自动修复宿主依赖，以及通用依赖来源或精确版本门禁。

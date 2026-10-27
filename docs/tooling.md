# 项目工具链

本文件说明主仓库从环境准备到 skill 制品发布的整体关系；具体执行契约由以下独立 owner 承接。下方兼容锚点仅转接，详情以各 owner 为准。

## 工具链模型

1. [环境自举](tooling-environment.md)及[稳定维护命令](tooling-commands.md)：pnpm 安装依赖，Bun 调度仓库脚本，Node.js 运行分发入口和 Gate，tsgo 承担类型检查；环境 setup 具有安装和本地配置副作用。
2. [源码生成与分发](tooling-distribution.md)：`tools/` 拥有分发源码，`scripts/` 组织仓库自动化；显式同步生成包内产物，版本管理的 pending 快照定义 hash 与 zip 的输入。
3. [Gate 执行](gate-execution.md)及[测试与测试证据维护](test-maintenance.md)：日常以 quick 基线和显式能力范围验证当前任务，changed/all 提供自动兜底，full/CI 全量检查；release 在普通检查后以同一快照授权版本并打包。[验证模型](validation-model.md)定义证明责任，[Gate 政策](gate-policy.md)定义精确运行政策。
4. [交付操作](tooling-delivery.md)：worktree hook、本地与远端验收、CI、聚合发布及恢复有各自授权和证明边界。日常本地验收不证明远端保护或发布已生效。

实现质量由[编码规范](coding-style.md)承接；单个工具的行为和内部契约由相邻源码目录与对应 skill 承接。[仓库导航](navigation.md)提供按任务的入口和内容 owner。

## 兼容入口

### 环境自举

详见[环境自举](tooling-environment.md#环境自举)。

### 仓库维护短命令

详见[仓库维护短命令](tooling-commands.md#仓库维护短命令)。

### 工具维护命令

详见[工具维护命令](tooling-commands.md#工具维护命令)。

### 权威 Vibe 门禁

详见[权威 Vibe 门禁](gate-execution.md#权威-vibe-门禁)。

### Catalog 与选择

详见[Catalog 与选择](gate-execution.md#catalog-与选择)。

### 性能报告与快速预算

详见[性能报告与快速预算](gate-policy.md#性能报告与快速预算)。

### 项目输入与成功证明

详见[项目输入与成功证明](gate-policy.md#项目输入与成功证明)。

### 调度与命令执行

详见[调度与命令执行](gate-policy.md#调度与命令执行)。

### 原生材料范围与质量政策

详见[原生材料范围与质量政策](gate-policy.md#原生材料范围与质量政策)。

### 工具 CLI 与 Git fixture 测试边界

详见[工具 CLI 与 Git fixture 测试边界](test-maintenance.md#工具-cli-与-git-fixture-测试边界)。

### 测试证据账本

详见[测试证据账本](test-maintenance.md#测试证据账本)。

### 源码与依赖边界

详见[源码与依赖边界](tooling-distribution.md#源码与依赖边界)。

### Skill 接入

详见[Skill 接入](tooling-distribution.md#skill-接入)。

### Git hook

详见[Git hook](tooling-delivery.md#git-hook)。

### CI 与发布

详见[CI 与发布](tooling-delivery.md#ci-与发布)。

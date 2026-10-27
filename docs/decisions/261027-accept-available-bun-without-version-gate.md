---
title: 以实际验收替代 Bun 版本前置限制
id: 261027-accept-available-bun-without-version-gate
status: active
alignment: aligned
createdAt: 2026-10-27T02:17:15Z
purpose: 允许可运行的 Bun 直接参与仓库验收，不因版本号不同阻断全部检查。
background: 精确 Bun 门槛把本机可用的新版本判为环境失败，尚未运行生成校验与测试就阻断了交付。
decision: Bun 只检查可运行性，复用现有安装；保留其他基础环境前置，以真实生成和测试结果验证兼容性。
tags:
  - project-tooling
  - toolchain-versioning
  - validation-boundaries
relations:
  - type: 修订
    target: 260919-require-gate-environment-check-prerequisite
    summary: 取消 Bun 版本门槛，保留基础环境 Check 与其他工具前置
---

## 目的

- 让可运行的 Bun 直接执行仓库检查，不因与某个选定版本不同而阻断全部验收。
- 保留必要基础工具的可用性诊断与真实失败边界，让兼容问题由实际生成和测试结果定位。

## 背景

- Bun 承担 package scripts 调度、源码同步适配与测试运行。版本号相同不证明生成或行为正确，版本号不同也不直接证明不兼容。
- 前序判断以统一工具链为由固定精确 Bun，并让基础环境失败阻止所有业务 Check。这样会在生成一致性与测试尚未执行时，拒绝当前可用的 Bun。
- Gate 已独立验证生成一致性和行为结果；增量输入证明也记录实际 Bun 版本，工具链变化会改变成功证明的适用输入。CI 选用哪个版本与本地是否允许运行是不同责任。

## 决策

- 采用：根 manifest 不声明 Bun 版本门槛；`check`、`gate` 与 `setup` 对 Bun 只检查命令可运行并能返回版本，不要求等于或高于某个版本。
- 采用：本地与 Git hook 直接复用 `PATH` 上可运行的 Bun。显式 `setup` 只在 Bun 不可用时通过 npm 安装 Bun，不为版本号不同替换现有安装；只读入口不安装或切换工具。
- 采用：CI 继续由 workflow 选择执行版本，该选择不成为本地或 hook 的准入规则。实际版本仍进入工具链指纹，不能跨不同输入复用旧成功证明。
- 采用：生成一致性、测试和完整 Gate 结果承担真实兼容性验收；Bun 造成的实际失败仍需处理，不将取消版本门槛解释为忽略失败或承诺所有版本兼容。
- 采用：保留 `scripts/environment.js gate` 的窄基础环境入口，继续检查 Git、满足 manifest 最低版本的 Node、可运行的 Bun、manifest 固定的 pnpm 与 SCC 4.0.0；不把 CodeGraph、项目依赖、hook 或 task-graph root 纳入此 Gate 前置。
- 采用：保留每轮执行、不可 receipt 复用的 `gate-environment` Check，以及其他 Check 对它的显式依赖。真正的基础环境失败保留探测 transcript 并阻止后续执行，不发布成功 receipt。
- 采用：完整自举 `check` / `setup` 继续拥有 CodeGraph、项目依赖、索引和仓库配置；SCC 恢复继续要求让精确版本在当前 `PATH` 活动，不由环境入口隐式安装或升级。
- 采用：增量层继续指纹化完整工具链；快照内部探测失败按当前输入证明契约保守扩大执行，不替代基础环境前置、Check selection、调度或 aggregate。

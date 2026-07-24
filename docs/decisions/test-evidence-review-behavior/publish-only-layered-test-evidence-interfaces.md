---
title: 仅发布分层测试证据接口
status: active
alignment: aligned
createdAt: 2026-07-21T03:26:09Z
purpose: 让测试入口采集可独立替换，并让账本维护只依赖稳定、严格校验的数据契约。
background: 组合兼容入口会把旧配置、旧输出和默认采集器继续带入账本工具边界，削弱两层接口的独立性。
decision: 以 Schema 为结构真源，只发布采集层和账本层两套接口，旧版升级仅由独立文档承接。
relations:
  - type: 修订
    target: test-evidence-review-behavior/260721-separate-test-entry-collection-from-ledger.md
---

## 目的
- 让账本维护模块不需要知道测试入口来自源码正则、AST、框架注册表还是外部清单。
- 为常见项目提供可直接使用的入口采集，同时允许复杂项目独立定义文件范围、排除规则和正则，或完全替换采集实现。
- 让配置、标准清单、诊断、报告和查询结果只有一个结构 owner，并让公共接口只表达当前契约。
- 让升级路径可查、可执行，但不增加当前运行时的分支、隐式迁移或兼容投影。

## 背景
- 既有单体 `test-evidence.mjs` 同时读取源码、决定语言范围、发现入口、解析账本并检查 Git Scope，发现策略变化会直接进入账本维护模块。
- 按语言近似屏蔽注释、字符串和 fixture 不能可靠等价于语法解析，还可能隐藏真实入口；复杂项目需要能够替换整个采集层。
- 把旧 v2 配置迁移、旧组合 API 和旧报告字段保留在第三套入口中，会形成长期维护的第二条行为路径，并让“两个层级的 CLI 和导入接口”只成为内部结构而不是公开边界。
- 手写 TypeScript 数据类型再反向生成或同步 Schema，会让结构 owner 分散到多个文件。

## 决策
- 采用: `test-entry-regex` 是独立采集层。它提供常见语言的全文正则基线，并允许项目通过独立配置选择候选文件、排除文件、启用内置 detector 和声明自定义正则；要求语法级精度的项目使用 AST、框架清单或其他自定义采集器。
- 采用: 所有采集器输出版本化 `TestEntryInventory`，包含入口、marker 绑定和上游 diagnostics。`test-evidence-ledger` 只在 Schema 边界接收该清单，再维护 catalog、入口角色、Git Scope、review trigger 和查询；它不导入文件发现或正则实现。
- 采用: 分发单元只发布 `test-entry-regex.mjs` 与 `test-evidence-ledger.mjs` 两套 CLI 和导入接口。调用方显式传递标准清单，不发布组合 facade，也不在运行时转换旧配置或保留旧报告字段。
- 采用: Valibot Schema 是配置、清单、诊断、报告、inspection 和 query 的源码真源；源码类型使用 `InferOutput`，构建时从同一 Schema 生成 JSON Schema，再生成分发 TypeScript 数据声明。
- 采用: diagnostic 同时包含固有 `severity` 和命令级 `blocking`。严格检查按 `blocking` 决定完成状态；恢复查询复制严格诊断并设为非阻断，不篡改问题级别。
- 采用: 旧 v2 组合配置、命令、导入和机器报告只在独立升级指南中映射到当前接口。当前契约文档和工具链说明只描述现行两层结构。

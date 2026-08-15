---
title: 将包字节身份与版本承载变化分离
status: active
alignment: aligned
createdAt: 2026-08-15T08:34:08Z
purpose: 让制品身份完整保留原始字节，同时只为使用者可感知的包变化要求独立版本提升。
background: 生成 source map 和声明格式化会改变包字节，却不总是改变运行时或声明语义。
decision: 聚合 hash 保留全部原始字节，版本门禁仅排除 linked map 与纯格式声明差异。
tags:
  - project-tooling
relations: []
---

## 目的

- 让聚合 hash、ZIP 和 release 检测继续准确标识每个可分发文件的原始字节。
- 避免仅由生成调试元数据或机械声明排版导致所有相关 skill 被迫提升独立版本。

## 背景

- Skill 包把生成的 linked `.mjs.map` 与运行时模块一同分发，source map 仍需要进入制品字节身份和发布核对。
- Oxfmt 对维护源码的格式化会传播到生成 source map，并可能让成对存在的 `.d.mts` 声明出现等价的排版差异。
- 若版本门禁按全部原始字节直接判断，维护格式化会把这些非语义产物差异错误地视为版本承载变化。

## 决策

- 采用: 聚合 hash、ZIP 和 release 检测继续覆盖 skill 包内全部文件的原始字节，不复用版本门禁的例外。
- 采用: 版本门禁把 `scripts/` 内由相邻 `.mjs` 的最后一个非空行中完整 `//# sourceMappingURL=<basename>` 指令链接的生成 `.mjs.map` 作为非版本承载调试元数据；仅该 map 的编辑、新增或删除不要求提升 metadata.version。
- 采用: 成对存在的 `.d.mts` 声明使用根目录 `.oxfmtrc.json` 的 Oxfmt 配置在基线与当前内容两侧规范化后比较；只有规范化后仍不同的声明才承载版本，声明新增或删除仍承载版本。
- 采用: 运行时模块和其他普通包内容的变化继续承载版本，必须按现有独立版本门禁提升 metadata.version。

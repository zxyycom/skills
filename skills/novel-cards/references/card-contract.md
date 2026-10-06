# 卡片与本地工具契约

本文件是 novel-cards 的卡片字段、身份、布局、引用与 CLI owner；写作判断与传播由 [SKILL.md](../SKILL.md) 承接。

## 项目布局

```text
<project>/
├── cards/current/       # 当前规划，递归普通 Markdown 卡
├── cards/reference/     # 可选；独立参考，不默认采用
├── card-index.json      # 派生索引，只通过 sync-index 更新
├── manuscripts/         # 建议的正文位置，不扫描
└── reports/             # 建议的反推报告位置，不扫描
```

`cards/` 与 `cards/current/` 必须真实存在；`current` 空集合合法，`reference` 缺失合法。卡片区只放普通、单硬链接 `.md` 文件与真实子目录，拒绝符号链接、其他成员和读取失败。卡片图不限制递归层级；文件目录深度上限 100 是扫描安全预算。

## Frontmatter 与正文

合法完整示例：

```markdown
---
id: gate-scene
title: 雨夜门禁
kind: detail
domain: plot
status: expected
completeness: expanded
labels: [章]
children: []
sources: []
refs: []
story_time: 第三日深夜
narrative_position: 第二章开场
---

## 细纲
主角因证件失效被阻；为保住同伴位置，以自己的通行额度换取入口。

## 导演视角
门外主线与值班室交叉切换，先让读者看到限额，再揭示交换代价。
```

示例可单独建立；其他卡实际创建后，才将其稳定 ID 写入 `children`、`sources` 或其他引用。

| 字段 | 精确职责 |
| --- | --- |
| `id` | 必填；`^[a-z0-9]+(?:-[a-z0-9]+)*$`，全项目唯一、无扩展名的稳定身份；文件改名或移动不改身份 |
| `title` | 必填非空字符串，显示名称可重复；身份选择使用 `id` |
| `kind` | 必填 `summary` 或 `detail` |
| `domain` | 必填 `plot`、`character`、`setting` 或 `history`；`history` 只允许 `summary` |
| `status` | 必填 `occurred`（已发生）、`expected`（作者预期尚未发生）或 `mixed`（范围混合，仅 `summary`） |
| `completeness` | 必填 `planned` 或 `expanded`，与发生状态独立；由作者声明与语义复核。仅依据 `sources` 的总结可为 `expanded`，`planned` 总结可无下级 |
| `labels` | 可选字符串数组，每项非空；卷/册/弧线/章等组织标签，无层级含义 |
| `children` | 可选实际 ID 数组，默认空；`summary` 的组成与展开顺序，`detail` 只能为空或省略 |
| `sources` | 可选实际 ID 数组，默认空；证据/依据，不是组成；交叉依据可形成环，不自动遍历 |
| `refs` | 可选实际 ID 数组，默认空；其他明确关联，不自动遍历 |
| `story_time` | 可选非空显示字符串，故事发生时间；工具不做时间算术 |
| `narrative_position` | 可选非空显示字符串，叙述位置；不表示发生状态 |
| `state_at` | 人物/设定 `detail` 必填，其他卡可选；稳定 ID 指向实际 `plot` 卡，是状态的故事位置锚点 |
| `relations` | 可选，仅 `character`；有向边数组，每项必填 `target`（实际 `character` ID）、`relation`（关系种类）、`attitude` 与 `knowledge`（后三项为非空文本） |

拒绝未知字段、无正文、错误类型和 `children`/`sources`/`refs` 内重复 ID。正文使用自由 Markdown，领域必要信息与文学因果由语义复核，工具不强制章节标题。人物/设定正文区分必要核心信息与 `state_at` 位置上的状态；预期状态使用单独详情或清楚的总结段，不覆盖当前详情。

### 组成、依据与参考边界

`children` 目标须与父卡同 `domain`；`history summary` 也可包含 `plot` 卡，以剧情节点承接具体变迁。`current` 卡的 `children` 只能纳入 `current` 卡；`sources`、`refs`、`state_at`、`relations` 可以显式引用参考对象，但引用不表示采用。参考内容成为本作组成前，先在 `current` 建立实际规划卡，再由作者决定纳入 `children`。

正文精确卡引用使用 `[说明](card:stable-id)`。CLI 验证这种括号链接中的 ID，包括字面出现的代码示例，拒绝空目标、非法 ID 与不存在的目标；其他自然语言、文件路径、wiki 链接或 URL 不是受管引用，不作“已校验”保证。因此卡正文不要把不存在的示意 ID 写成这个语法。稳定 ID 不接受路径、`.md` 后缀、标题匹配或近似猜测。

人物关系是有向边：双向关系写两条，态度/知情各自独立。工具校验关系目标和 `state_at` 剧情锚点的存在与域；双方对关系事实的理解、锚点位置上的状态是否正确，由语义复核。

## 最小本地 CLI

保持 cwd 在小说项目，使用实际安装目录：

```text
node <skill-directory>/scripts/novel-cards.mjs sync-index --write --root <project>
node <skill-directory>/scripts/novel-cards.mjs check --root <project>
node <skill-directory>/scripts/novel-cards.mjs show <id> --root <project>
node <skill-directory>/scripts/novel-cards.mjs expand <id> --root <project> --depth 2 --max-cards 100
node <skill-directory>/scripts/novel-cards.mjs show <reference-id> --root <project> --include-reference
```

仓库维护时用 `bun run novel-cards -- <arguments>`。`--root` 默认 cwd，卡片身份参数只接受 ID。四个命令均不联网，不更新卡片或稿件：

- **`sync-index --write`**：全扫实际卡，验证重复 ID、所有受管引用、`children` 域与参考边界及组成循环，从来源重建索引，只写 `card-index.json`。写入前再次核对来源 revision，非法集合不发布索引。同步不确认摘要语义有效性。
- **`check`**：全扫当前和参考，验证合法集合、索引结构、当前性及投影与真实卡的身份/位置。索引缺失、陈旧或旧版时失败，提示显式重建。
- **`show ID`**：完成与 `check` 相同的全体机械验证后，仅输出精确目标的 `card`、`area`、`sourcePath`、`markdown` 与 `explicitRefs`。`reference` 目标必须加 `--include-reference`。
- **`expand ID`**：完成同样验证后，按 `children` 顺序广度展开。默认 `--depth 1 --max-cards 100`；深度范围 0–20，卡数范围 1–1000。返回 `anchorId`、`complete`、`depth`、`maxCards`、`frontier` 和实际 `cards`。预算停止是成功的部分结果，`frontier` 记录 `fromId`、`nextIds`、`reason`，可据此继续查询。单次预算不约束模型递归深度；`complete` 只描述本次 `children` 闭包，不表示其他引用或全部背景已经阅读。

`show`/`expand` 均不自动输出 `sources`、`refs`、关系或状态锚点正文；agent 使用其语义前须显式 `show`。`--include-reference` 只允许本次读取所选参考内容，不写入当前规划或产生采纳状态。机械扫描会读取参考区字节，参考区不是内容隐私隔离或沙箱边界。

## 索引、预算、失败与并发

索引复用共享 Index Runtime：`schemaVersion: 4`、`namespace: novel-cards`、`definitionVersion: 1`。ID 键控条目只保存 `title`、`sourcePath`、`area`。`sourceRevision` 的每卡指纹包含独立路径与换行规范化完整文本；Markdown 是事实源，可显式重建索引。查询同时核对 revision、投影与实际扫描对象，拒绝篡改路径、标题与区域。

最多 10000 卡、2 MiB/文件、20 MiB/集合，超限失败而非截断成功。每次查询扫描全集合，成本随集合增长，不承诺大规模性能。读取前后核对文件身份与变化，同步前复核 revision；受信本地工作区由单写者保持命名空间稳定，不提供跨进程锁或恶意并发隔离。

除 `--help` 外 stdout 为单个 JSON；领域错误保留 `status: error` 与诊断，stderr 为可定位文字；usage 错误仅写 stderr。退出码：0 成功，1 来源/文件/索引/查询失败，2 参数错误。重复参数、路径伪装 ID、无 `--write` 的同步与超界预算均拒绝。故障按诊断修复来源或显式同步；不存在的目标和非法参考保持失败，不以相似卡或空结果代替。

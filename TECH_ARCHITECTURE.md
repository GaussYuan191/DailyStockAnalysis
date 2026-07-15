# 股票智能分析系统 - 技术架构文档

> 覆盖 A 股、港股、美股的多市场智能分析平台，集成数据抓取、技术分析、LLM 综合研判、多 Agent 协作决策、回测评估与多渠道通知推送。

| 层级 | 技术 | 用途 |
|------|------|------|
| 后端 | Python + FastAPI | 核心分析引擎、REST API、SSE 推送 |
| 前端 | React 19 + Vite 7 + TypeScript 5.9 | SPA 前端应用 |
| 桌面端 | Electron 31 | 跨平台桌面应用 |
| LLM | LiteLLM Multi-Provider | 多 provider LLM 统一调用 |
| 部署 | Docker + GitHub Actions | 多阶段构建、CI/CD 流水线 |
| Bot | 钉钉/飞书/Discord SDK | 多平台机器人接入 |

---

## 目录

1. [项目定位与核心流程](#1-项目定位与核心流程)
2. [技术栈一览](#2-技术栈一览)
3. [系统全局架构](#3-系统全局架构)
4. [核心分析流水线](#4-核心分析流水线)
5. [Agent 多智能体系统](#5-agent-多智能体系统)
6. [数据源适配层](#6-数据源适配层)
7. [API 层设计](#7-api-层设计)
8. [Web 前端架构](#8-web-前端架构)
9. [桌面端架构](#9-桌面端架构)
10. [Bot 机器人系统](#10-bot-机器人系统)
11. [部署与 CI/CD](#11-部署与-cicd)
12. [配置管理体系](#12-配置管理体系)
13. [回测引擎](#13-回测引擎)
14. [安全与认证](#14-安全与认证)

---

## 1. 项目定位与核心流程

本系统是一个覆盖 **A 股、港股、美股**（以及日股、韩股、台股）的多市场股票智能分析平台。主流程从数据抓取出发，经过技术分析、新闻情报检索，由 LLM 完成综合研判，最终生成结构化决策仪表盘报告并推送到多个通知渠道。系统同时提供回测引擎，对历史分析的前瞻准确性进行量化评估。

| 指标 | 数值 |
|------|------|
| 覆盖市场区域 | 6 |
| 数据源适配器 | 11+ |
| API 端点 | 60+ |
| 专业化 Agent | 6 |
| 通知渠道 | 12+ |

### 核心入口

系统有三个主要入口，共享同一套核心分析逻辑：

| 入口 | 说明 |
|------|------|
| `main.py` | CLI 主调度入口。支持单次分析、定时任务（`--schedule`）、大盘复盘（`--market-review`）、回测（`--backtest`）和 API 服务（`--serve`）。定时模式下通过 `run_full_analysis()` 执行完整的个股分析 + 大盘复盘 + 通知推送 + 自动回测链路。 |
| `server.py` | FastAPI 服务入口。从 `api.app` 导入 ASGI 应用并启动。提供 REST API、SSE 实时推送和前端静态文件托管。支持可选认证（`ADMIN_AUTH_ENABLED`）。 |
| `bot/handler.py` | Bot Webhook 入口。接收钉钉、飞书、Discord 等平台的消息，解析为统一 `BotMessage` 后分发到命令处理器，支持自然语言路由到 Agent 系统。 |

### 主流程概览

从用户输入股票代码到生成报告，完整的分析链路如下：

1. **配置加载与交易日过滤** - 从 `.env` 加载 `Config` 单例，按市场判断交易日，跳过非交易日
2. **数据抓取（多源 fallback）** - `DataFetcherManager` 按优先级尝试多个数据源，自动故障切换，获取实时行情、历史 K 线、筹码分布
3. **技术分析** - `StockTrendAnalyzer` 计算 MA/MACD/RSI/量价指标/支撑阻力位/K 线形态
4. **情报搜索** - `SearchService` 聚合多个搜索引擎，检索新闻、风险信号、业绩预期
5. **上下文构建** - `AnalysisContextPack` 生成数据质量概览，告知 LLM 各数据块的可用性
6. **LLM 综合分析** - 单 Agent 模式（`GeminiAnalyzer` + ReAct 工具循环）或多 Agent 模式（Technical → Intel → Risk → Skill → Decision 流水线）
7. **决策护栏与信号提取** - 阶段决策护栏过滤、决策信号结构化提取并持久化到数据库
8. **报告生成与推送** - 生成 Markdown 报告，通过 `NotificationService` 推送到企业微信/飞书/钉钉等 12+ 渠道
9. **回测评估** - `BacktestEngine` 对历史分析的前瞻表现进行量化评估，计算胜率和方向准确率

---

## 2. 技术栈一览

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 后端 | Python + FastAPI | 3.11+ · 0.104+ | 核心分析引擎、REST API、SSE 推送 |
| 后端 | SQLAlchemy | - | ORM 数据持久化（SQLite） |
| 后端 | LiteLLM | - | 多 provider LLM 统一调用（Gemini/OpenAI/Anthropic/DeepSeek 等） |
| 后端 | akshare / tushare / yfinance | - | 多数据源行情与基本面获取 |
| 前端 | React + TypeScript | 19.2 · 5.9 | SPA 前端应用 |
| 前端 | Vite | 7.2 | 构建工具与开发服务器 |
| 前端 | Zustand | 5.0 | 状态管理 |
| 前端 | Tailwind CSS | 4.1 | 原子化样式 |
| 前端 | Recharts | 3.3 | 数据可视化图表 |
| 前端 | react-markdown | 10.1 | Markdown 报告渲染 |
| 桌面端 | Electron | 31.4 | 跨平台桌面应用 |
| 桌面端 | electron-builder + electron-updater | 24.13 · 6.8 | 打包与自动更新 |
| 部署 | Docker + docker-compose | - | 多阶段构建、双服务编排 |
| CI/CD | GitHub Actions | - | CI 门禁、每日分析、Docker/桌面端发布 |
| Bot | 钉钉/飞书/Discord SDK | - | 多平台机器人接入（Webhook + Stream） |

---

## 3. 系统全局架构

系统采用分层架构，从数据源到用户界面共有六个核心层。各层之间通过明确的接口契约解耦，单一数据源或通知渠道的失败不会拖垮整体流程。

```
用户交互层                API 层                 核心编排层
┌─────────────┐     ┌──────────────┐     ┌────────────────────┐
│ Web 前端     │     │              │     │ StockAnalysisPipeline│
│ Desktop     │────▶│  FastAPI     │────▶│ AgentOrchestrator   │
│ Bot 平台    │     │  + AuthMW    │     │ AgentExecutor       │
│ CLI         │     │              │     │ MarketReview        │
└─────────────┘     └──────────────┘     └────────┬───────────┘
                                                   │
                    ┌──────────────────────────────┤
                    ▼                              ▼
              ┌───────────┐              ┌─────────────────┐
              │ Agent 层   │              │  数据适配层       │
              │ Technical │              │ DataFetcherManager│
              │ Intel     │              │ SearchService    │
              │ Risk      │              │ SocialSentiment   │
              │ Skill     │              └────────┬─────────┘
              │ Decision  │                       │
              └─────┬─────┘                       ▼
                    │          ┌──────────────────────────┐
                    └─────────▶│  数据源                    │
                               │  Tushare / Akshare        │
                               │  Efinance / Tencent       │
                               │  YFinance / Longbridge     │
                               │  Finnhub / AlphaVantage   │
                               │  TickFlow / Pytdx / Baostock│
                               └──────────────────────────┘
```

### 关键设计原则

| 原则 | 说明 |
|------|------|
| 多源 fallback | 每个数据维度（日线、实时行情、筹码）都有多个数据源候选，按优先级尝试，失败自动切换。带 CircuitBreaker 熔断器防止雪崩。 |
| 双分析架构 | 支持单 Agent 模式（`AGENT_ARCH=single`，ReAct 工具循环）和多 Agent 模式（`AGENT_ARCH=multi`，流水线编排），通过工厂模式无感切换。 |
| 并发隔离 | `ThreadPoolExecutor` 并行分析多只股票，单股失败不阻塞其他股票。共享锁防止大盘复盘并发执行。 |
| 渐进降级 | 非关键 Agent 阶段（intel/risk）失败时降级而非中止。数据源全部失败时生成空数据标记，LLM 感知数据质量后自行调整判断置信度。 |

---

## 4. 核心分析流水线

`StockAnalysisPipeline` 是整个分析流程的调度器，协调数据获取、技术分析、搜索、LLM 分析和通知推送。其核心方法 `analyze_stock()` 定义了从数据到报告的完整链路。

### 单股分析数据流

```
股票代码
    │
    ├─▶ 实时行情(量比/换手率) ──┐
    ├─▶ 筹码分布(带熔断) ──────┤
    ├─▶ 历史 K 线 ─────────────┤
    │                          ▼
    │                    趋势分析(MA/MACD/RSI)
    │                    量价分析
    │                    K 线形态
    │                    支撑阻力位
    │                          │
    ├─▶ 新闻搜索 ──────────────┤
    ├─▶ 风险排查 ──────────────┤
    ├─▶ 业绩预期 ──────────────┤
    │                          ▼
    │                    历史分析上下文
    │                    AnalysisContextPack(数据质量概览)
    │                          │
    │              ┌───────────┴───────────┐
    │              ▼                       ▼
    │        单 Agent                 多 Agent
    │        GeminiAnalyzer           Orchestrator
    │              │                       │
    │              └───────────┬───────────┘
    │                          ▼
    │                    阶段决策护栏
    │                    决策信号提取
    │                          │
    │                          ▼
    │                    报告生成 → 通知推送
```

### AnalysisResult 核心结构

LLM 分析的输出被解析为 `AnalysisResult` 数据类，包含核心指标和嵌套的决策仪表盘 JSON：

| 模块 | 字段 |
|------|------|
| 核心指标 | `sentiment_score`（0-100 情绪分数）、`trend_prediction`（趋势预测）、`decision_type`（buy/hold/sell）、`confidence_level`（置信度） |
| 决策仪表盘 | 嵌套 JSON，包含 core_conclusion（核心结论 + 仓位建议）、data_perspective（趋势/价格/量能/筹码）、intelligence（新闻/风险/催化/业绩）、battle_plan（买入/止损/止盈点位 + 行动清单）、phase_decision（盘前/盘中/收盘决策）、signal_attribution（信号归因） |
| 分析详情 | 走势分析、技术面、均线系统、量能分析、K 线形态、基本面、板块联动、情绪面 |
| 元数据 | 模型标记、数据来源、价格快照、provider trace（实际使用的 LLM provider/model） |

### GeminiAnalyzer LLM 调用

`GeminiAnalyzer` 虽以 Gemini 命名，实际通过 LiteLLM 统一接口支持所有主流 LLM provider。关键能力包括：

- **多模型 fallback**：主模型失败时自动切换到备用模型链，捕获 `_AllModelsFailedError` 链式失败
- **JSON 修复**：使用 `json_repair` 库修复 LLM 输出的非标准 JSON，四策略解析（markdown 代码块 → 原始解析 → json_repair → 大括号子串）
- **市场阶段感知**：根据交易时段（盘前/盘中/午休/收盘/盘后）构建不同的 Prompt
- **用量追踪**：HMAC 签名的 token 用量记录和持久化
- **Prompt 缓存**：为支持的 provider 提供缓存提示（provider cache hints）

### AnalysisContextPack 数据质量系统

这是一个创新设计：在调用 LLM 前，系统会生成一个数据质量概览包，以低敏感度的方式告知 LLM 各数据块的可用性和质量状态。

每个数据块（行情/日线/技术/筹码/基本面/新闻）都有状态标记：`available` / `missing` / `fallback` / `stale` / `partial`。同时计算整体质量评分（good/usable/limited/poor），让 LLM 能根据数据完整度自行调整判断置信度。

---

## 5. Agent 多智能体系统

系统支持两种分析架构，通过 `AGENT_ARCH` 配置切换。工厂函数 `build_agent_executor()` 根据配置创建对应的执行器，两者暴露相同的 `run()` / `chat()` 接口。

### 架构对比

| 维度 | 单 Agent 模式 (single) | 多 Agent 模式 (multi) |
|------|------------------------|------------------------|
| 执行方式 | 一个 Agent + ReAct 工具循环 | Technical → Intel → Risk → [Skill] → Decision 流水线 |
| LLM 调用数 | 1 次（多轮工具调用） | 2-4+N 次（按模式递增） |
| 编排模式 | `AgentExecutor` | `AgentOrchestrator`（quick/standard/full/specialist） |
| 上下文共享 | 单一上下文 | `AgentContext` 共享状态包 |
| 适用场景 | 快速分析、成本敏感 | 深度分析、多维度交叉验证 |

### 多 Agent 流水线架构

```
用户查询 + 股票代码
        │
        ▼
┌─────────────────────────────────┐
│ 上下文构建                       │
│  StockScope (股票范围守卫)        │
│  ConversationManager (会话管理)   │
│  ChatContextBuilder (滚动摘要压缩)│
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ Agent 流水线 (共享 AgentContext 状态)          │
│                                              │
│  TechnicalAgent ──▶ AgentOpinion             │
│  (行情/K线/技术指标/筹码, 7工具, max=6)        │
│                    │                         │
│                    ▼                         │
│  IntelAgent ──────▶ AgentOpinion             │
│  (新闻/情报/资金流, 4工具, max=4)              │
│                    │                         │
│                    ▼                         │
│  RiskAgent ───────▶ AgentOpinion             │
│  (减持/预警/解禁, 3工具, max=4)               │
│                    │                         │
│                    ▼                         │
│  SkillAgent(s) ──▶ SkillAggregator(加权共识)  │
│  (技能入场评估, max=4)                        │
│                    │                         │
│                    ▼                         │
│  DecisionAgent ──▶ 最终决策仪表盘             │
│  (聚合所有意见, 无工具, max=3)                 │
│           │                                  │
│     ┌─────┴──────┐                           │
│     ▼            ▼                           │
│  RiskOverride  DisagreementSummary           │
└─────────────────────────────────────────────┘
```

### 四种编排模式

| 模式 | Agent 链 | LLM 调用 | 适用场景 |
|------|----------|----------|----------|
| `quick` | Technical → Decision | ~2 | 快速出结论，成本最优 |
| `standard` | Technical → Intel → Decision | ~3 | 常规分析，兼顾速度与深度 |
| `full` | Technical → Intel → Risk → Decision | ~4 | 完整分析，包含风险排查 |
| `specialist` | Technical → Intel → Risk → [SkillAgents] → Decision | ~4+N | 专家模式，动态插入技能评估 |

> **降级策略**：intel 和 risk 阶段失败为非关键，系统降级继续而非中止。technical 和 decision 失败则中止整个管道。超时预算采用协作式设计，管道级和每 Agent 级双重 timeout clamp，预算不足时自动跳过非关键阶段。

### ReAct 工具循环引擎

`run_agent_loop()` 是所有 Agent 的共享执行引擎，核心循环逻辑：

1. 将 messages + tool 声明发送给 LLM
2. LLM 返回 `tool_calls` → 并行执行工具（`ThreadPoolExecutor`）→ 结果追加到 messages → 继续循环
3. LLM 返回文本 → 尝试解析为 dashboard JSON → 结束循环
4. 达到 `max_steps` 或超时 → 结束

### 工具系统

| 工具文件 | 工具 | 说明 |
|----------|------|------|
| `data_tools.py` | get_realtime_quote, get_daily_history, get_chip_distribution, get_analysis_context, get_stock_info, get_capital_flow, get_portfolio_snapshot | 行情/K线/筹码/历史分析/基本面/资金流/组合 |
| `analysis_tools.py` | analyze_trend, calculate_ma, get_volume_analysis, analyze_pattern | 趋势/均线/量能/形态 |
| `search_tools.py` | search_stock_news, search_comprehensive_intel | 新闻/综合情报 |
| `market_tools.py` | get_market_indices, get_sector_rankings | 市场指数/板块排名 |
| `backtest_tools.py` | get_skill_backtest_summary, get_strategy_backtest_summary, get_stock_backtest_summary | 回测数据查询 |

工具系统包含多层安全机制：**工具缓存**（基于 `tool_name + 归一化参数` 避免重复调用）、**股票范围守卫**（`_guard_tool_stock_scope()` 确保 Agent 只查询目标股票）、**敏感信息脱敏**（API key/token/cookie 正则过滤）、**ToolPolicy 安全策略**（read_only/side_effects/permissions 元数据）。

### 技能系统

技能（Skill）是可组合的交易策略单元，以 YAML 或 SKILL.md frontmatter 定义。`SkillRouter` 基于市场状态（trending_up/down/sideways/volatile）和用户显式请求动态选择适用技能，`SkillAggregator` 将多个技能意见加权聚合为共识（权重 = confidence × backtest_factor，基于历史胜率自适应）。

### 风险覆盖机制

Decision Agent 完成后，`build_risk_override_plan()` 根据 risk flags 对最终决策进行覆盖：

- 高严重度 risk flag → 否决买入信号（buy → hold）
- `signal_adjustment` → 降级信号（downgrade_one/two）
- 仅在 `agent_risk_override=True` 且存在触发条件时执行

---

## 6. 数据源适配层

`data_provider/` 模块采用策略模式，通过 `BaseFetcher` 抽象基类和 `DataFetcherManager` 策略管理器实现多数据源的统一管理和自动故障切换。

### 数据源矩阵

| 数据源 | 类名 | 市场支持 | 优先级 | 配置条件 | 关键特性 |
|--------|------|----------|--------|----------|----------|
| 东方财富 (efinance) | `EfinanceFetcher` | CN | 0 | 无（始终实例化） | 免费、10 分钟实时行情缓存 |
| 腾讯直连 | `TencentFetcher` | CN | 0 | 无 | qfq 前复权、8 秒 HTTP 超时 |
| AkShare | `AkshareFetcher` | CN, HK | 1 | 无 | 多子源(em/sina/tencent)、20 分钟缓存 |
| Tushare Pro | `TushareFetcher` | CN, HK | 0/2 | TUSHARE_TOKEN | 自实现 HTTP Client、80 次/分钟配额 |
| TickFlow | `TickFlowFetcher` | CN | 2 | TICKFLOW_API_KEY | 批量日 K 线、交易日历支持 |
| 通达信 | `PytdxFetcher` | CN | 2 | 无 | 多服务器自动切换、连接超时重连 |
| 证券宝 | `BaostockFetcher` | CN | 3 | 无 | 上下文管理器管理登录生命周期 |
| Yahoo Finance | `YfinanceFetcher` | CN, HK, US, JP, KR, TW | 4 | 无 | 国际兜底源、代码格式自动转换 |
| 长桥 OpenAPI | `LongbridgeFetcher` | HK, US | 5 | 长桥凭据 | OAuth 2.0 + Legacy 双凭证、进程内缓存 |
| Finnhub | `FinnhubFetcher` | US | 2 | FINNHUB_API_KEY | 60 次/分钟免费配额 |
| AlphaVantage | `AlphaVantageFetcher` | US | 3 | ALPHAVANTAGE_API_KEY | 25 次/天免费配额 |
| 台湾三大法人 | `TwInstitutionalFetcher` | TW | - | 无 | TWSE T86 + TPEx OpenAPI |

### 故障切换机制

`DataFetcherManager` 的核心故障切换流程：

1. **市场路由**：先判断股票所属市场（cn/hk/us/jp/kr/tw），跳过不支持该市场的数据源
2. **优先级排序**：按 `priority` 属性排序，数字越小越优先
3. **逐源尝试**：依次调用每个数据源的对应方法，成功则返回
4. **熔断保护**：`CircuitBreaker` 状态机（CLOSED → OPEN → HALF_OPEN），连续失败 N 次后冷却 M 分钟
5. **双源补充**：美股/港股实时行情首选源成功后，若关键字段缺失，继续从备选源补充

> **线程安全**：`_fetchers_lock` (RLock) 保护 fetcher 列表；`_fetcher_call_locks` (per-fetcher RLock) 序列化每个 fetcher 的方法调用；`_stock_name_cache_lock` 保护名称缓存。

### 统一类型系统

`realtime_types.py` 定义了跨数据源的统一数据结构：

- `UnifiedRealtimeQuote`：统一实时行情（价格、量价指标、估值指标 PE/PB/市值、数据质量元数据）
- `ChipDistribution`：筹码分布（获利比例、平均成本、集中度）
- `CircuitBreaker`：熔断器状态机
- `safe_float` / `safe_int`：统一类型转换，处理 None/空串/NaN

股票代码标准化通过 `normalize_stock_code()` 统一处理，支持 SH/SZ/BJ 前缀去除、HK 代码标准化（`00700.HK` → `HK00700`）、日韩台后缀保留等场景。

---

## 7. API 层设计

API 层基于 FastAPI 构建，所有路由挂载到 `/api/v1` 前缀。应用工厂 `create_app()` 负责初始化生命周期、CORS、中间件和路由注册。

### 路由组织

| 前缀 | 模块 | 核心端点 | 说明 |
|------|------|----------|------|
| `/auth` | Auth | login, logout, status, change-password, settings | 认证管理（单开关控制） |
| `/agent` | Agent | chat, chat/stream, sessions, research, models, skills | AI Agent 对话与会话管理 |
| `/analysis` | Analysis | analyze, market-review, tasks, tasks/stream | 分析触发与任务管理（SSE 推送） |
| `/history` | History | list, stocks, detail, markdown, diagnostics, flow | 历史报告查询与诊断 |
| `/stocks` | Stocks | extract-from-image, parse-import, watchlist, quote, history | 股票工具与自选股 |
| `/backtest` | Backtest | run, results, performance | 回测执行与绩效 |
| `/system` | SystemConfig | config, scheduler, generation-backends, llm/test-channel | 系统配置与调度器 |
| `/portfolio` | Portfolio | accounts, trades, cash-ledger, corporate-actions, snapshot, risk, imports | 投资组合管理 |
| `/alerts` | Alerts | rules (CRUD), enable, disable, test, triggers, notifications | 预警规则与触发记录 |
| `/decision-signals` | DecisionSignals | create, list, status-update, feedback, re-evaluate, results | 决策信号管理 |
| `/alphasift` | AlphaSift | status, strategies, hotspots, screen | 选股筛选 |
| `/intelligence` | Intelligence | sources (CRUD), templates, fetch, items | 情报源管理 |
| `/usage` | Usage | summary, dashboard | Token 用量统计 |

### 中间件

| 中间件 | 说明 |
|--------|------|
| AuthMiddleware | 当 `ADMIN_AUTH_ENABLED=true` 时保护 `/api/v1/*` 路由。豁免路径包括 `/auth/login`、`/auth/status`、`/health`。验证 Cookie 会话，无效返回 401。 |
| ErrorHandlerMiddleware | 全局异常捕获，统一错误响应格式 `{"error", "message", "detail"}`。处理 HTTPException、RequestValidationError(422)、通用 Exception(500)。 |

### 实时通信

系统提供两种实时通信方式：

- **SSE (EventSource)**：`/api/v1/analysis/tasks/stream` 推送任务状态（task_created/task_started/task_progress/task_completed/task_failed/heartbeat），前端使用共享 EventSource 单例多组件订阅
- **Fetch Streaming**：`/api/v1/agent/chat/stream` 使用 `fetch()` + `ReadableStream` 实现 Agent 流式对话，逐行解析 SSE 格式事件

---

## 8. Web 前端架构

Web 前端是一个 React 19 SPA 应用，使用 Vite 7 构建，输出到项目根目录 `static/` 由后端 FastAPI 静态托管。状态管理采用 Zustand，不依赖第三方 UI 库，自建 28 个通用组件。

### 页面与路由

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | HomePage | 主仪表盘：股票分析提交、历史报告、大盘复盘、实时任务面板 |
| `/chat` | ChatPage | Agent 流式对话、多会话管理、思考进度展示 |
| `/portfolio` | PortfolioPage | 投资组合：账户、交易、现金账本、CSV 导入、风险分析 |
| `/decision-signals` | DecisionSignalsPage | 决策信号：列表、时间线、重评估、结果跟踪 |
| `/screening` | StockScreeningPage | AlphaSift 选股筛选 |
| `/backtest` | BacktestPage | 回测触发、结果表格、性能指标卡片 |
| `/alerts` | AlertsPage | 预警规则管理、触发记录、通知记录 |
| `/usage` | TokenUsagePage | Token 用量统计仪表盘 |
| `/settings` | SettingsPage | 系统配置：分类编辑、验证、保存、版本冲突处理 |
| `/login` | LoginPage | 登录页（仅 authEnabled 时可见） |

### 状态管理

Zustand store 按功能域分离，React Context 仅用于认证和 UI 语言：

| Store | 说明 |
|-------|------|
| `stockPoolStore` | 最核心的 store，管理仪表盘全部状态：分析提交、历史报告、任务同步、报告选择。使用递增 requestSeq 防止竞态条件，pendingCompletedTaskSelectionKeys 机制确保任务完成后自动选中最新报告。 |
| `agentChatStore` | Agent 对话状态：fetch ReadableStream 流式接收、会话管理（localStorage 持久化）、进度步骤展示、完成徽章提醒。 |
| `analysisStore` | 分析结果和历史报告视图状态管理。 |

### API 客户端层

Axios 实例配置 `withCredentials: true`，401 拦截自动重定向到登录页。所有 API 模块使用 `toCamelCase()` 递归转换后端 snake_case 为前端 camelCase。特殊字段（evidence、metadata、data_quality_summary）保留原始结构不做转换。

### 国际化

支持中英文双语，通过 `UiLanguageContext` 提供 `t()` 翻译函数，基于类型安全的翻译键 `UiTextKey`。特性文本按模块组织在 `locales/featureText.ts` 中。

---

## 9. 桌面端架构

桌面端基于 Electron 31 构建，内嵌后端 Python 进程和 Web 前端。通过 PyInstaller 将后端打包为独立可执行文件，随应用一起分发。

### 后端进程管理

- **打包模式**：从 `process.resourcesPath/backend/` 查找 `stock_analysis.exe`（Windows）或 `stock_analysis`（macOS）
- **开发模式**：使用 `python main.py` 启动后端
- **端口发现**：在 8000-8100 范围查找可用端口
- **健康检查**：轮询 `/api/health`，60 秒超时，250ms 间隔
- **进程终止**：Windows 使用 `taskkill /T /F`，macOS/Linux 使用 SIGTERM → SIGKILL

### 自动更新机制

双模式更新策略，根据平台和安装方式自动选择：

| 模式 | 说明 |
|------|------|
| 模式 A: electron-updater | Windows NSIS 安装版专用。`autoDownload: true`，下载完成后用户确认安装。安装前自动备份 `.env`、数据库、AlphaSift 数据、日志到 `userData/.dsa-desktop-update-backup/`，启动时检测备份并恢复运行时文件。 |
| 模式 B: GitHub API 检查 | 非 NSIS / macOS 使用。直接请求 GitHub Releases API，语义化版本比较，发现新版本弹出对话框引导用户下载。macOS 额外处理运行时文件迁移。 |

### 安全隔离

Electron 使用 `contextIsolation: true` + `nodeIntegration: false`，通过 preload 脚本 `contextBridge.exposeInMainWorld('dsaDesktop', ...)` 暴露安全 API（版本查询、更新检查、安装更新、打开发布页、状态监听）。外部链接通过 `setWindowOpenHandler` 拦截并用系统浏览器打开。

---

## 10. Bot 机器人系统

Bot 层通过统一的消息模型和命令分发器，将多个即时通讯平台的消息路由到同一套分析逻辑。

### 平台适配

| 平台 | 接入模式 | 签名验证 | 关键特性 |
|------|----------|----------|----------|
| 钉钉 | Webhook + Stream | HMAC-SHA256 | 双模式支持，Stream 模式无需公网 IP |
| 飞书 | Stream (WebSocket) | - | lark-oapi SDK、交互卡片、消息分块 |
| Discord | Webhook | Ed25519 | 延迟 ACK (type 5) + 后台线程处理 |

### 命令系统

| 命令 | 别名 | 功能 |
|------|------|------|
| `/analyze` | a, 分析, 查 | 分析股票（精简/完整报告） |
| `/market` | 大盘, m | 大盘分析 |
| `/batch` | 批量, b | 批量分析 |
| `/ask` | 问股 | Agent 技能分析（多股+技能指定） |
| `/chat` | 聊天 | Agent 聊天对话 |
| `/research` | 研究 | 深度研究 |
| `/strategies` | 策略 | 查看可用策略/技能 |
| `/history` | 历史 | 查看历史分析记录 |
| `/status` | 状态 | 查看系统状态 |
| `/help` | h, 帮助 | 查看可用命令 |

命令分发器 `CommandDispatcher` 提供频率限制（滑动窗口，默认 10 次/60 秒/用户）和管理员权限检查。当 `AGENT_NL_ROUTING=true` 时，非命令消息通过两层自然语言路由处理：第一层正则预过滤器检测股票代码/金融关键词，第二层 LLM 意图解析返回 intent（analysis/chat/none）并路由到对应命令。

---

## 11. 部署与 CI/CD

### Docker 部署

多阶段构建：第一阶段在 `node:20-slim` 中构建前端，第二阶段在 `python:3.11-slim-bookworm` 中运行后端。Docker Compose 编排两个服务共享配置：

| 服务 | 命令 | 用途 |
|------|------|------|
| `analyzer` | `python main.py --schedule` | 定时分析任务 |
| `server` | `python main.py --serve-only --host 0.0.0.0` | FastAPI Web/API 服务 |

安全设计：以非 root 用户 `dsa` (UID 1000) 运行，`entrypoint.sh` 以 root 启动修复 bind mount 权限后用 `gosu` 降权。数据卷包括 `/app/data`（数据库）、`/app/logs`（日志）、`/app/reports`（报告）。资源限制：内存上限 1G，预留 512M。

### CI 流水线

CI 主流水线（`ci.yml`）在 PR 到 main 时触发，包含四个阻断 Job：

```
PR → main
  │
  ▼
ai-governance (检查 AI 协作资产一致性)
  │
  ├──▶ backend-gate (语法检查 + Flake8 + 离线测试)
  ├──▶ docker-build (Docker 构建 + 冒烟测试)
  └──▶ web-gate (条件触发: npm lint + build)
         │
         ▼
       CI 通过
```

### GitHub Actions 工作流

| 工作流 | 触发 | 阻断 | 说明 |
|--------|------|------|------|
| `ci.yml` | PR → main | 是 | AI 治理 + 后端门禁 + Docker 构建 + 前端门禁 |
| `00-daily-analysis.yml` | cron 周一至五 UTC 10:00 | - | 每日股票分析，支持 full/market-only/stocks-only 模式 |
| `docker-publish.yml` | tag v*.*.* | - | 多平台 Docker 构建，推送 GHCR + DockerHub |
| `desktop-release.yml` | tag v*.*.* | - | Windows NSIS + macOS DMG 构建，发布到 GitHub Release |
| `auto-tag.yml` | commit 含 #patch/#minor/#major | - | 自动版本号更新（opt-in） |
| `network-smoke.yml` | 定期 | 否 | 网络冒烟测试（pytest -m network） |
| `pr-review.yml` | PR | 否 | PR 静态检查 + AI 审查 + 自动标签 |

---

## 12. 配置管理体系

配置系统由三个层次构成，从底层到上层依次为：环境变量读取、`.env` 原子读写、Web UI 配置元数据。

### Config 单例

`src/config.py` 中的 `Config` 类是一个包含 200+ 字段的 `@dataclass`，通过 `get_instance()` 实现单例。所有配置从环境变量读取，支持默认值。关键配置分组包括数据源凭据、AI 模型、Agent 模式、通知渠道、回测参数等。

> **多模型支持**：通过 `llm_model_list`（LiteLLM Router 格式）支持多 channel、多 key 负载均衡和跨模型 fallback。`GENERATION_BACKEND` 支持 litellm / codex_cli / claude_code_cli / opencode_cli 四种后端。

### ConfigManager 原子配置管理

`src/core/config_manager.py` 负责 `.env` 文件的原子读写：

- **结构化行解析**：`ConfigLineEntry` 将 `.env` 每行分类为 assignment/comment/blank/raw
- **乐观版本控制**：`apply_updates()` 带版本号，敏感 key 自动掩码跳过
- **原子写入**：先写 `.tmp` 再 `os.replace`，失败时回退到原地重写（支持 NFS 等不支持 rename 的挂载）
- **Docker Compose 占位符转义**：`$$` 转义处理

### 配置注册表

`src/core/config_registry.py` 是 Web UI 配置页面的字段元数据单一真源，定义字段分类、数据类型、UI 控件类型、验证规则、示例和文档链接。配置分类包括：

- `base` - 基础配置
- `ai_model` - AI 模型配置
- `data_source` - 数据源配置
- `notification` - 通知配置
- `system` - 系统配置
- `agent` - Agent 配置
- `backtest` - 回测配置

---

## 13. 回测引擎

`src/core/backtest_engine.py` 中的 `BacktestEngine` 是一个纯逻辑回测引擎（与 DB 无关），仅操作纯值或 OHLC bar 对象。

### 核心能力

| 能力 | 说明 |
|------|------|
| 方向推断 | 从操作建议文本推断预期方向（up/down/not_down/flat）和仓位建议（long/cash）。支持中英文关键词匹配和否定检测。 |
| 单次评估 | `evaluate_single()` 评估历史分析的前瞻表现。计算窗口内收益率、最大值/最小值，止损/止盈命中检测，结果分类为 win/loss/neutral。 |
| 决策信号评估 | `evaluate_decision_signal()` 评估结构化 DecisionSignal，无需文本推断。 |
| 汇总统计 | `compute_summary()` 聚合为胜率、方向准确率、平均收益、止损/止盈触发率、ambiguous 率，按操作建议分桶统计。 |

### 设计模式

- `EvaluationConfig`：frozen dataclass，配置评估参数
- `DailyBarLike` / `BacktestResultLike`：Protocol 类型，鸭子类型接口
- 纯类方法，无实例状态，线程安全

---

## 14. 安全与认证

### Web 管理认证

`src/auth.py` 实现了可选的 Web 管理认证，由 `ADMIN_AUTH_ENABLED` 单开关控制：

- **密码存储**：PBKDF2 100K 迭代 + 随机 salt，文件存储（`.admin_password_hash`）
- **会话管理**：HMAC 签名 cookie（`dsa_session`），默认 24 小时有效期
- **速率限制**：5 次失败 / 5 分钟窗口
- **首次登录**：设置初始密码，支持 Web 修改和 CLI 重置

### 工具安全策略

Agent 工具系统通过 `ToolPolicy` 元数据控制工具的安全属性：

- `read_only`：标记工具是否只读
- `side_effects`：标记工具是否有副作用
- `permissions`：所需权限
- `scope_dimensions`：作用域维度

同时，`_guard_tool_stock_scope()` 确保工具只查询目标股票，`serialize_tool_result()` 对输出进行敏感信息脱敏（API key、token、cookie 等正则过滤）。

### 桌面端安全

Electron 使用 `contextIsolation: true` + `nodeIntegration: false`，不暴露 Node API。所有桌面端功能通过 preload 脚本的 `contextBridge` 桥接暴露，仅提供版本查询、更新管理和外链打开的安全 API。

> **设计原则**：新配置遵循"不配置也可运行，配置后增强能力"原则，避免叠加开关和互斥模式。单一通知渠道失败不拖垮整个分析主流程。自动 tag 默认 opt-in，只有 commit title 含 `#patch` / `#minor` / `#major` 才触发版本号更新。

---

*Generated by Trae Work · 2026-07-11*

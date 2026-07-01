/**
 * 模板预设答案数据
 *
 * 用于在用户点击模板后，直接将预设的问答对写入对话历史，
 * 替代原先通过调用 AI 为每个节点生成回答的实现方案，从而避免 AI 响应慢导致弹窗卡住的问题。
 *
 * 设计说明：
 * - key 为模板 ID（与 BUILTIN_TEMPLATES 中的 id 字段一一对应）
 * - value 为按节点在模板 nodes 数组中的索引顺序排列的答案数组
 * - 每个答案包含中英文两种语言版本（zh / en），运行时根据 i18n 当前语言选择
 *
 * 注意事项：
 * - 答案数组的长度必须与对应模板的 nodes 数组长度保持一致
 * - 答案为空字符串时视为"未填写"，调用方应跳过该节点不写入对话
 */

/**
 * 预设答案结构
 *
 * 单个节点对应的预设回答，包含中英文两个语言版本。
 * 运行时根据 i18n 当前语言选择对应字段返回。
 */
export interface PresetAnswer {
  /** 简体中文回答内容 */
  zh: string;
  /** 英文回答内容 */
  en: string;
}

/**
 * 模板答案映射表类型
 *
 * key 为模板 ID，value 为按节点索引排列的预设答案数组。
 */
export type TemplateAnswerMap = Record<string, PresetAnswer[]>;

/**
 * 内置模板预设答案表
 *
 * 覆盖全部 5 个内置模板的 ID：
 * - guide-deepmindmap（4 个节点）
 * - learn-python（5 个节点）
 * - work-product-analysis（5 个节点）
 * - learn-ml-basics（5 个节点）
 * - work-startup-checklist（5 个节点）
 *
 * 答案数组长度与对应模板的 nodes 数组长度严格一致。
 */
export const BUILTIN_TEMPLATE_ANSWERS: TemplateAnswerMap = {
  // DeepMindMap 使用指南（4 个节点）
  'guide-deepmindmap': [
    {
      zh: `DeepMindMap 是一款基于非线性对话的思维导图工具，核心功能包括：

1. 创建思维导图：点击画布空白处创建根节点，拖拽节点可调整位置，节点间自动生成关系连线
2. AI 对话：双击节点打开对话面板，输入问题后 AI 会流式回答，支持思考过程展示
3. 延伸方向按钮：AI 回答末尾会出现方向按钮，点击即可创建子节点并继续深入探索
4. 节点摘要：对话结束后自动生成摘要，便于快速回顾
5. 模板库：提供多种预设模板，一键创建结构化思维导图

建议从空画布开始，创建一个根节点，然后与 AI 对话探索你感兴趣的主题。`,
      en: `DeepMindMap is a mind mapping tool based on non-linear conversations. Core features include:

1. Create mind maps: Click blank canvas to create root node, drag to reposition, relations auto-generated
2. AI conversation: Double-click a node to open chat panel, AI responds with streaming output and thinking process
3. Extension buttons: Direction buttons at the end of AI replies create child nodes for deeper exploration
4. Node summaries: Auto-generated after conversations for quick review
5. Template library: Pre-built templates for structured mind maps in one click

Start from blank canvas, create a root node, then chat with AI to explore topics of interest.`,
    },
    {
      zh: `非线性对话是一种分支式的对话结构，与传统线性对话的关键区别：

- 线性对话：所有消息按时间顺序排列在一条线上，话题一旦切换就难以回溯
- 非线性对话：以思维导图节点为容器，每个节点承载一个独立的对话支线，主线与支线分离

优势：
1. 深入不偏离：在子节点深入探讨细节，不影响主线脉络
2. 并行探索：可同时展开多个方向的对话
3. 结构化沉淀：对话内容自动组织成知识树，便于回顾
4. 上下文隔离：每个节点有独立对话上下文，避免话题干扰

这种结构特别适合知识探索、学习笔记、项目分析等需要多角度深入的复杂场景。`,
      en: `Non-linear conversation is a branching dialogue structure. Key differences from traditional linear conversation:

- Linear: All messages in one timeline, hard to revisit after topic switches
- Non-linear: Each mind map node hosts an independent conversation thread, main line and branches separated

Advantages:
1. Depth without deviation: Explore details in child nodes without affecting main thread
2. Parallel exploration: Multiple directions simultaneously
3. Structured knowledge: Conversations auto-organized into knowledge tree
4. Context isolation: Each node has independent context, avoiding topic interference

Ideal for knowledge exploration, study notes, project analysis—any complex scenario requiring multi-angle deep dives.`,
    },
    {
      zh: `延伸方向按钮是 DeepMindMap 的核心交互特性：

工作原理：
- AI 回答末尾会自动生成方向按钮（通常显示为箭头或"+"图标）
- 点击按钮会在当前节点下创建一个子节点
- 新子节点自动继承上下文，并打开对话面板准备深入探讨

使用场景：
1. 深入概念：AI 提到某个术语时，点击延伸按钮深入该术语
2. 分支探索：对同一回答的不同方面分别展开子节点
3. 层级构建：通过连续延伸构建多层级的知识结构

管理多个延伸方向：
- 每个延伸都会成为独立的子节点，互不干扰
- 可随时切换到任意子节点继续对话
- 节点摘要会独立生成，保持各支线清晰`,
      en: `Extension buttons are a core interaction feature of DeepMindMap:

How it works:
- Direction buttons auto-appear at the end of AI replies (arrow or "+" icon)
- Clicking creates a child node under the current node
- New child inherits context and opens chat panel for deeper exploration

Use cases:
1. Deep dive on concepts: When AI mentions a term, extend to explore it
2. Branch exploration: Create separate child nodes for different aspects of one reply
3. Hierarchy building: Chain extensions to build multi-level knowledge structures

Managing multiple extensions:
- Each extension becomes an independent child node, non-interfering
- Switch to any child node anytime to continue
- Summaries generated independently, keeping branches clear`,
    },
    {
      zh: `节点摘要功能介绍：

生成方式：
- 当节点对话进行到一定阶段后，系统自动调用 AI 生成摘要
- 摘要基于该节点的完整对话内容提炼
- 也可手动触发摘要生成

摘要作用：
1. 快速回顾：无需展开对话即可了解节点核心内容
2. 知识沉淀：将对话中的关键信息固化为结构化摘要
3. 导航辅助：在画布上浏览各节点摘要，快速定位目标节点
4. 上下文传递：父节点的摘要可作为子节点对话的背景信息

利用技巧：
- 定期查看摘要，确认对话方向是否偏离预期
- 摘要会显示在节点下方，可折叠/展开
- 利用摘要做知识地图的全局浏览`,
      en: `Node summary feature overview:

Generation:
- AI auto-generates summary after conversation reaches a certain stage
- Based on the node's complete conversation content
- Can also be manually triggered

Purpose:
1. Quick review: Understand node core content without expanding conversation
2. Knowledge consolidation: Crystallizes key info into structured summary
3. Navigation aid: Browse summaries on canvas to locate target nodes
4. Context transfer: Parent summaries serve as background for child conversations

Tips:
- Check summaries periodically to confirm direction
- Displayed below node, collapsible/expandable
- Use summaries for global knowledge map browsing`,
    },
  ],

  // Python 入门学习路径（5 个节点）
  'learn-python': [
    {
      zh: `Python 初学者学习路线图：

第一阶段：基础语法（1-2 周）
- 变量、数据类型（int, float, str, bool, list, dict, tuple）
- 控制流（if/else, for, while）
- 函数定义与调用

第二阶段：函数与模块（1-2 周）
- 函数参数、返回值、作用域
- 模块导入、包管理

第三阶段：面向对象（2-3 周）
- 类与对象、继承、多态
- 魔术方法

第四阶段：标准库与实战（持续）
- os, sys, json, datetime 等
- 实践项目：爬虫、数据分析、Web 开发

推荐资源：
- 官方文档 docs.python.org
- 《Python Crash Course》
- 实战平台 LeetCode、HackerRank

建议：每天写代码，从简单脚本开始，逐步挑战复杂项目。`,
      en: `Python beginner learning roadmap:

Stage 1: Basic Syntax (1-2 weeks)
- Variables, data types (int, float, str, bool, list, dict, tuple)
- Control flow (if/else, for, while)
- Function definition and calls

Stage 2: Functions & Modules (1-2 weeks)
- Parameters, return values, scope
- Module imports, package management

Stage 3: OOP (2-3 weeks)
- Classes, objects, inheritance, polymorphism
- Magic methods

Stage 4: Stdlib & Practice (ongoing)
- os, sys, json, datetime, etc.
- Projects: crawler, data analysis, web dev

Recommended resources:
- Official docs docs.python.org
- "Python Crash Course"
- Practice platforms: LeetCode, HackerRank

Tip: Code daily, start with simple scripts, progress to complex projects.`,
    },
    {
      zh: `Python 基础语法系统讲解：

变量与数据类型：
\`\`\`python
name = "Alice"        # str
age = 25              # int
height = 1.68         # float
is_student = True     # bool
scores = [90, 85, 92] # list
info = {"name": "Bob", "age": 20}  # dict
\`\`\`

控制流：
\`\`\`python
# 条件判断
if age >= 18:
    print("成年")
elif age >= 13:
    print("青少年")
else:
    print("儿童")

# 循环
for i in range(5):
    print(i)

while count > 0:
    count -= 1
\`\`\`

函数：
\`\`\`python
def greet(name, greeting="你好"):
    return f"{greeting}, {name}!"

result = greet("Alice")
\`\`\`

建议：多动手练习，理解每种数据类型的适用场景。`,
      en: `Python basic syntax overview:

Variables & data types:
\`\`\`python
name = "Alice"        # str
age = 25              # int
height = 1.68         # float
is_student = True     # bool
scores = [90, 85, 92] # list
info = {"name": "Bob", "age": 20}  # dict
\`\`\`

Control flow:
\`\`\`python
if age >= 18:
    print("Adult")
elif age >= 13:
    print("Teen")
else:
    print("Child")

for i in range(5):
    print(i)

while count > 0:
    count -= 1
\`\`\`

Functions:
\`\`\`python
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

result = greet("Alice")
\`\`\`

Tip: Practice hands-on, understand when to use each data type.`,
    },
    {
      zh: `Python 函数与模块深入讲解：

函数定义：
\`\`\`python
# 默认参数、关键字参数、可变参数
def func(a, b=10, *args, **kwargs):
    return a + b

# 匿名函数
square = lambda x: x ** 2
\`\`\`

参数传递：
- 不可变类型（int, str, tuple）按值传递
- 可变类型（list, dict）按引用传递

作用域：
- LEGB 规则：Local → Enclosing → Global → Built-in
- global/nonlocal 关键字

模块导入：
\`\`\`python
import os
from datetime import datetime
import numpy as np  # 别名
\`\`\`

包管理：
- pip install 包名
- requirements.txt 管理依赖
- 虚拟环境：venv、conda

建议：理解作用域对避免 bug 很重要，养成使用虚拟环境的习惯。`,
      en: `Python functions & modules deep dive:

Function definition:
\`\`\`python
# Default, keyword, variable args
def func(a, b=10, *args, **kwargs):
    return a + b

# Lambda
square = lambda x: x ** 2
\`\`\`

Parameter passing:
- Immutable types (int, str, tuple): pass by value
- Mutable types (list, dict): pass by reference

Scope:
- LEGB rule: Local → Enclosing → Global → Built-in
- global/nonlocal keywords

Module imports:
\`\`\`python
import os
from datetime import datetime
import numpy as np  # alias
\`\`\`

Package management:
- pip install package_name
- requirements.txt for dependencies
- Virtual environments: venv, conda

Tip: Understanding scope prevents bugs; always use virtual environments.`,
    },
    {
      zh: `Python 面向对象编程详解：

类定义：
\`\`\`python
class Animal:
    def __init__(self, name, sound):
        self.name = name
        self.sound = sound
    
    def speak(self):
        return f"{self.name} says {self.sound}"

class Dog(Animal):  # 继承
    def __init__(self, name):
        super().__init__(name, "Woof")
    
    def fetch(self):  # 子类特有方法
        return f"{self.name} fetches the ball"
\`\`\`

四大特性：
1. 封装：通过 _/__ 前缀控制访问权限
2. 继承：子类复用父类代码，可重写方法
3. 多态：同一接口不同实现
4. 抽象：通过 ABC 模块定义抽象基类

魔术方法：
- __str__：字符串表示
- __repr__：开发者表示
- __eq__：相等比较
- __len__：长度

应用场景：建模现实世界实体、设计可复用组件、构建复杂系统架构。`,
      en: `Python OOP detailed explanation:

Class definition:
\`\`\`python
class Animal:
    def __init__(self, name, sound):
        self.name = name
        self.sound = sound
    
    def speak(self):
        return f"{self.name} says {self.sound}"

class Dog(Animal):  # Inheritance
    def __init__(self, name):
        super().__init__(name, "Woof")
    
    def fetch(self):  # Subclass-specific method
        return f"{self.name} fetches the ball"
\`\`\`

Four pillars:
1. Encapsulation: _/__ prefix for access control
2. Inheritance: Subclasses reuse parent code, override methods
3. Polymorphism: Same interface, different implementations
4. Abstraction: ABC module for abstract base classes

Magic methods: __str__, __repr__, __eq__, __len__

Use cases: Modeling real-world entities, reusable components, complex system architecture.`,
    },
    {
      zh: `Python 常用标准库介绍：

os - 操作系统接口：
\`\`\`python
import os
os.getcwd()              # 当前工作目录
os.listdir('.')          # 列出目录
os.path.join('a', 'b')   # 路径拼接
\`\`\`

sys - 系统相关：
\`\`\`python
import sys
sys.argv          # 命令行参数
sys.exit(0)       # 退出程序
sys.path          # 模块搜索路径
\`\`\`

json - JSON 处理：
\`\`\`python
import json
json.dumps({"key": "value"})    # 序列化
json.loads('{"key": "value"}')  # 反序列化
\`\`\`

datetime - 日期时间：
\`\`\`python
from datetime import datetime, timedelta
now = datetime.now()
tomorrow = now + timedelta(days=1)
\`\`\`

collections - 高级容器：
\`\`\`python
from collections import Counter, defaultdict
Counter("aabbc")  # 计数
d = defaultdict(list)
\`\`\`

itertools - 迭代工具：
\`\`\`python
import itertools
list(itertools.chain([1,2], [3,4]))  # 合并
itertools.combinations([1,2,3], 2)   # 组合
\`\`\`

建议：熟悉标准库能大幅提升开发效率，避免重复造轮子。`,
      en: `Python common standard libraries:

os - OS interface:
\`\`\`python
import os
os.getcwd()              # Current working directory
os.listdir('.')          # List directory
os.path.join('a', 'b')   # Path joining
\`\`\`

sys - System-related:
\`\`\`python
import sys
sys.argv          # Command-line args
sys.exit(0)       # Exit program
sys.path          # Module search path
\`\`\`

json - JSON handling:
\`\`\`python
import json
json.dumps({"key": "value"})    # Serialize
json.loads('{"key": "value"}')  # Deserialize
\`\`\`

datetime - Date/time:
\`\`\`python
from datetime import datetime, timedelta
now = datetime.now()
tomorrow = now + timedelta(days=1)
\`\`\`

collections - Advanced containers:
\`\`\`python
from collections import Counter, defaultdict
Counter("aabbc")  # Counting
d = defaultdict(list)
\`\`\`

itertools - Iteration tools:
\`\`\`python
import itertools
list(itertools.chain([1,2], [3,4]))  # Chain
itertools.combinations([1,2,3], 2)   # Combinations
\`\`\`

Tip: Familiarity with stdlib boosts productivity, avoids reinventing the wheel.`,
    },
  ],

  // 产品需求分析框架（5 个节点）
  'work-product-analysis': [
    {
      zh: `系统化产品需求分析框架：

分析步骤：
1. 需求收集：用户调研、市场分析、竞品研究、数据洞察
2. 需求分类：功能需求、非功能需求、用户需求、业务需求
3. 优先级评估：MoSCoW 法（Must/Should/Could/Won't）
4. 可行性分析：技术、资源、时间、风险
5. 输出文档：PRD、用户故事、原型

常用工具：
- 用户调研：问卷、访谈、焦点小组
- 流程梳理：用户旅程图、思维导图
- 原型设计：Figma、Axure
- 项目管理：Jira、Confluence

评估维度：
- 用户价值：解决痛点程度
- 商业价值：收入/增长贡献
- 技术成本：开发难度/周期
- 战略契合：是否符合产品方向

输出物：
- 产品需求文档（PRD）
- 功能清单与优先级
- 原型与交互稿
- 验收标准`,
      en: `Systematic product requirement analysis framework:

Steps:
1. Collection: User research, market analysis, competitor study, data insights
2. Classification: Functional, non-functional, user, business requirements
3. Prioritization: MoSCoW (Must/Should/Could/Won't)
4. Feasibility: Technical, resource, timeline, risk
5. Outputs: PRD, user stories, prototypes

Common tools:
- Research: Surveys, interviews, focus groups
- Process: User journey maps, mind maps
- Prototyping: Figma, Axure
- Management: Jira, Confluence

Evaluation dimensions:
- User value: Pain point resolution
- Business value: Revenue/growth contribution
- Technical cost: Difficulty/timeline
- Strategic fit: Alignment with product direction

Outputs:
- Product Requirement Document (PRD)
- Feature list with priorities
- Prototypes & interaction designs
- Acceptance criteria`,
    },
    {
      zh: `用户画像分析与场景梳理方法：

用户调研方法：
1. 定性：一对一深度访谈（30-60 分钟）、焦点小组
2. 定量：在线问卷（样本量 100+）、行为数据分析
3. 场景观察：实地走访、影子跟随

画像模板：
- 基本信息：年龄、职业、收入、地域
- 行为特征：使用习惯、频次、偏好
- 痛点需求：核心问题、未满足需求
- 目标动机：想达成什么、为什么
- 引用语：用户的原话，增强真实感

场景描述技巧：
- 5W1H 框架：Who/What/When/Where/Why/How
- 用户旅程：触发→行动→反馈→情绪
- 场景故事：具体、生动、可感知

示例："25 岁的产品经理小李，在地铁上想快速记录灵感，但现有工具都太重，希望有轻量级的速记工具"

建议：画像不要过多，3-5 个核心画像即可，避免过度细分。`,
      en: `User persona analysis & scenario mapping:

Research methods:
1. Qualitative: In-depth interviews (30-60 min), focus groups
2. Quantitative: Online surveys (100+ sample), behavioral data analysis
3. Observation: Field visits, shadowing

Persona template:
- Demographics: Age, occupation, income, location
- Behaviors: Usage habits, frequency, preferences
- Pain points: Core problems, unmet needs
- Goals: What they want to achieve, why
- Quotes: Real user words for authenticity

Scenario description techniques:
- 5W1H: Who/What/When/Where/Why/How
- User journey: Trigger→Action→Feedback→Emotion
- Storytelling: Specific, vivid, perceptible

Example: "Li, 25, product manager, wants to quickly capture ideas on subway but existing tools are too heavy—needs lightweight note-taking"

Tip: Keep 3-5 core personas, avoid over-segmentation.`,
    },
    {
      zh: `产品核心功能拆解方法：

MVP 定义：
- 最小可行产品：解决核心问题的最小功能集
- 原则：能跑通核心流程、能验证价值假设
- 反例：功能堆砌但核心流程不通

功能优先级排序：
1. MoSCoW 法：
   - Must have：必须有的核心功能
   - Should have：重要但非必须
   - Could have：锦上添花
   - Won't have：本期不做
2. Kano 模型：基本需求、期望需求、兴奋需求
3. RICE 评分：Reach × Impact × Confidence / Effort

用户故事编写：
- 格式：作为[角色]，我想[功能]，以便[价值]
- 示例：作为新用户，我想用手机号注册，以便快速开始使用
- 验收标准：Given/When/Then 格式

功能依赖分析：
- 必须先做的功能（前置依赖）
- 可并行的功能
- 互斥的功能

建议：MVP 越小越好，快速上线验证，根据反馈迭代。`,
      en: `Product core feature decomposition:

MVP definition:
- Minimum Viable Product: Smallest feature set solving core problem
- Principles: Core flow works, value hypothesis testable
- Anti-pattern: Feature bloat without working core flow

Prioritization:
1. MoSCoW:
   - Must have: Core features
   - Should have: Important but not essential
   - Could have: Nice to have
   - Won't have: Not this iteration
2. Kano model: Basic, performance, delight features
3. RICE score: Reach × Impact × Confidence / Effort

User stories:
- Format: As [role], I want [feature], so that [value]
- Example: As new user, I want phone registration, to start quickly
- Acceptance criteria: Given/When/Then format

Dependency analysis:
- Prerequisite features (must do first)
- Parallel features
- Mutually exclusive features

Tip: Keep MVP as small as possible, launch fast, iterate based on feedback.`,
    },
    {
      zh: `竞品分析方法论：

竞品选择：
- 直接竞品：解决相同问题、面向相同用户
- 间接竞品：解决相同问题、方式不同
- 替代品：用户的其他解决方案
- 建议选 3-5 个核心竞品深入分析

分析维度：
1. 产品功能：功能矩阵对比、特色功能
2. 用户体验：交互流程、视觉设计、易用性
3. 商业模式：定价、盈利方式、用户规模
4. 技术架构：技术栈、性能、扩展性
5. 市场表现：用户量、增长率、口碑

SWOT 分析：
- Strengths：优势
- Weaknesses：劣势
- Opportunities：机会
- Threats：威胁

差异化定位策略：
1. 找到竞品薄弱环节
2. 结合自身优势
3. 聚焦细分市场
4. 打造独特价值主张（UVP）

建议：竞品分析要客观，既看优势也看劣势，避免主观偏见。`,
      en: `Competitor analysis methodology:

Competitor selection:
- Direct: Same problem, same users
- Indirect: Same problem, different approach
- Substitutes: User's alternative solutions
- Select 3-5 core competitors for deep analysis

Analysis dimensions:
1. Features: Feature matrix, unique features
2. UX: Interaction flow, visual design, usability
3. Business model: Pricing, revenue, user base
4. Tech: Stack, performance, scalability
5. Market: Users, growth, reputation

SWOT analysis:
- Strengths
- Weaknesses
- Opportunities
- Threats

Differentiation strategy:
1. Find competitor weak spots
2. Combine with own strengths
3. Focus on niche segments
4. Craft Unique Value Proposition (UVP)

Tip: Be objective—analyze both strengths and weaknesses, avoid bias.`,
    },
    {
      zh: `技术可行性评估方法：

技术选型：
- 前端：React/Vue/Angular，TypeScript/JavaScript
- 后端：Node.js/Python/Java/Go
- 数据库：MySQL/PostgreSQL/MongoDB
- 部署：云服务（阿里云/AWS）
- 选型原则：团队熟悉、生态成熟、社区活跃

架构设计：
- 单体 vs 微服务：根据规模选择
- 数据流：同步/异步、实时/批处理
- 缓存策略：Redis、CDN
- 扩展性：水平/垂直扩展能力

性能评估：
- 响应时间：API < 200ms，页面加载 < 2s
- 并发能力：预估 QPS
- 数据量：存储容量、查询性能
- 可用性：99.9% / 99.99%

风险识别：
1. 技术风险：新技术不确定性、依赖稳定性
2. 资源风险：人力不足、技能缺口
3. 时间风险：工期紧张、关键路径过长

开发成本估算：
- 人天估算：功能点 × 单点工时
- 方法：专家评估、类比估算、三点估算

建议：预留 20% 缓冲时间应对不确定性，优先验证技术难点。`,
      en: `Technical feasibility assessment:

Tech selection:
- Frontend: React/Vue/Angular, TypeScript/JavaScript
- Backend: Node.js/Python/Java/Go
- Database: MySQL/PostgreSQL/MongoDB
- Deployment: Cloud (AWS/Aliyun)
- Principles: Team familiarity, mature ecosystem, active community

Architecture:
- Monolith vs Microservices: Based on scale
- Data flow: Sync/async, real-time/batch
- Caching: Redis, CDN
- Scalability: Horizontal/vertical

Performance:
- Response time: API < 200ms, page load < 2s
- Concurrency: Estimate QPS
- Data volume: Storage, query performance
- Availability: 99.9% / 99.99%

Risk identification:
1. Technical: New tech uncertainty, dependency stability
2. Resource: Staff shortage, skill gaps
3. Timeline: Tight schedule, long critical path

Cost estimation:
- Man-days: Feature points × hours per point
- Methods: Expert estimation, analogy, three-point

Tip: Reserve 20% buffer for uncertainty, validate tech risks first.`,
    },
  ],

  // 机器学习基础概念（5 个节点）
  'learn-ml-basics': [
    {
      zh: `机器学习核心概念：

定义：让计算机从数据中学习规律，无需显式编程。

学习类型：
1. 监督学习：有标签数据，学习输入→输出映射
   - 分类：离散标签（垃圾邮件检测）
   - 回归：连续值（房价预测）
2. 无监督学习：无标签数据，发现数据结构
   - 聚类：用户分群
   - 降维：特征压缩
3. 强化学习：通过奖励机制学习策略
   - 应用：游戏 AI、机器人控制

算法分类：
- 传统算法：线性回归、决策树、SVM、朴素贝叶斯
- 集成学习：随机森林、XGBoost
- 深度学习：CNN、RNN、Transformer

应用场景：
- 推荐系统、图像识别、NLP、预测分析

发展趋势：
- 大模型（LLM）、多模态、AutoML、联邦学习

建议：从监督学习的线性回归入手，逐步深入。`,
      en: `Machine learning core concepts:

Definition: Computers learn patterns from data without explicit programming.

Learning types:
1. Supervised: Labeled data, learn input→output mapping
   - Classification: Discrete labels (spam detection)
   - Regression: Continuous values (house price prediction)
2. Unsupervised: Unlabeled data, discover structure
   - Clustering: User segmentation
   - Dimensionality reduction: Feature compression
3. Reinforcement: Learn policy via rewards
   - Applications: Game AI, robotics

Algorithm categories:
- Traditional: Linear regression, decision trees, SVM, Naive Bayes
- Ensemble: Random Forest, XGBoost
- Deep learning: CNN, RNN, Transformer

Applications:
- Recommendation, image recognition, NLP, predictive analytics

Trends:
- LLMs, multimodal, AutoML, federated learning

Tip: Start with linear regression in supervised learning, progress gradually.`,
    },
    {
      zh: `监督学习详解：

分类 vs 回归：
- 分类：预测离散类别（猫/狗分类）
- 回归：预测连续数值（房价预测）

常用算法：
1. 线性回归：y = wx + b，适合线性关系
2. 逻辑回归：分类问题，输出概率
3. 决策树：if-else 规则树，可解释性强
4. 随机森林：多棵决策树投票，抗过拟合
5. SVM：找最优分隔超平面，适合小样本
6. 神经网络：多层感知机，适合复杂模式

模型训练流程：
1. 数据准备：特征工程、划分训练/测试集
2. 模型选择：根据问题类型选算法
3. 训练：最小化损失函数（梯度下降）
4. 验证：交叉验证、调参
5. 评估：测试集性能

评估指标：
- 分类：准确率、精确率、召回率、F1
- 回归：MSE、MAE、R²

建议：从 sklearn 的 iris 数据集入手实践，理解每个算法的适用场景。`,
      en: `Supervised learning deep dive:

Classification vs Regression:
- Classification: Predict discrete categories (cat/dog)
- Regression: Predict continuous values (house price)

Common algorithms:
1. Linear regression: y = wx + b, for linear relationships
2. Logistic regression: Classification, outputs probability
3. Decision tree: If-else rule tree, highly interpretable
4. Random Forest: Multiple trees voting, robust to overfitting
5. SVM: Optimal hyperplane, good for small samples
6. Neural networks: Multi-layer perceptron, complex patterns

Training flow:
1. Data prep: Feature engineering, train/test split
2. Model selection: Choose algorithm by problem type
3. Training: Minimize loss function (gradient descent)
4. Validation: Cross-validation, hyperparameter tuning
5. Evaluation: Test set performance

Metrics:
- Classification: Accuracy, precision, recall, F1
- Regression: MSE, MAE, R²

Tip: Start with sklearn's iris dataset, understand each algorithm's use cases.`,
    },
    {
      zh: `无监督学习详解：

聚类算法：
1. K-means：
   - 原理：将数据划分为 K 个簇，最小化簇内方差
   - 适用：球形分布数据
   - 缺点：需预设 K 值，对异常值敏感
2. DBSCAN：
   - 原理：基于密度，连接高密度区域
   - 优势：自动确定簇数，识别噪声点
   - 适用：任意形状的簇
3. 层次聚类：
   - 原理：自底向上或自顶向下合并/分裂
   - 优势：可视化树状图

降维方法：
1. PCA（主成分分析）：
   - 线性降维，保留方差最大的方向
   - 适用：特征压缩、可视化
2. t-SNE：
   - 非线性降维，保留局部结构
   - 适用：高维数据可视化
3. UMAP：
   - 兼顾局部与全局结构，速度快

异常检测：
- 基于统计：3σ 原则
- 基于距离：KNN
- 基于密度：LOF

应用场景：
- 用户分群、异常检测、推荐系统、数据预处理

建议：聚类前先做数据标准化，K-means 用肘部法确定 K 值。`,
      en: `Unsupervised learning deep dive:

Clustering algorithms:
1. K-means:
   - Principle: Partition into K clusters, minimize within-cluster variance
   - Suitable: Spherical data distribution
   - Drawback: Requires preset K, sensitive to outliers
2. DBSCAN:
   - Principle: Density-based, connects high-density regions
   - Advantage: Auto-determines cluster count, identifies noise
   - Suitable: Arbitrary cluster shapes
3. Hierarchical clustering:
   - Principle: Bottom-up or top-down merge/split
   - Advantage: Visualizable dendrogram

Dimensionality reduction:
1. PCA (Principal Component Analysis):
   - Linear reduction, preserves max variance directions
   - Suitable: Feature compression, visualization
2. t-SNE:
   - Non-linear, preserves local structure
   - Suitable: High-dim data visualization
3. UMAP:
   - Balances local and global structure, fast

Anomaly detection:
- Statistical: 3σ rule
- Distance-based: KNN
- Density-based: LOF

Applications:
- User segmentation, anomaly detection, recommendation, data preprocessing

Tip: Normalize data before clustering, use elbow method for K in K-means.`,
    },
    {
      zh: `机器学习模型评估方法：

分类指标：
1. 准确率（Accuracy）= 正确预测数 / 总数
   - 适用：类别均衡时
2. 精确率（Precision）= TP / (TP + FP)
   - 含义：预测为正的样本中真正为正的比例
3. 召回率（Recall）= TP / (TP + FN)
   - 含义：真正为正的样本中被预测为正的比例
4. F1 分数 = 2 × (P × R) / (P + R)
   - 精确率与召回率的调和平均

ROC 曲线与 AUC：
- 横轴：假正率 FPR
- 纵轴：真正率 TPR
- AUC：曲线下面积，越接近 1 越好

回归指标：
- MSE（均方误差）：对异常值敏感
- MAE（平均绝对误差）：鲁棒性强
- R²（决定系数）：解释方差比例

交叉验证：
1. K 折交叉验证：数据分成 K 份，轮流做测试集
2. 留一法：每份一个样本，计算量大但准确
3. 分层抽样：保证各类别比例

过拟合检测：
- 训练集表现好但测试集差 → 过拟合
- 训练集和测试集都差 → 欠拟合

建议：不要只看准确率，根据业务场景选择合适的指标。`,
      en: `Machine learning model evaluation:

Classification metrics:
1. Accuracy = Correct predictions / Total
   - Suitable: Balanced classes
2. Precision = TP / (TP + FP)
   - Meaning: Of predicted positive, how many actually positive
3. Recall = TP / (TP + FN)
   - Meaning: Of actual positive, how many predicted positive
4. F1 Score = 2 × (P × R) / (P + R)
   - Harmonic mean of precision and recall

ROC curve & AUC:
- X-axis: False Positive Rate (FPR)
- Y-axis: True Positive Rate (TPR)
- AUC: Area under curve, closer to 1 is better

Regression metrics:
- MSE (Mean Squared Error): Sensitive to outliers
- MAE (Mean Absolute Error): Robust
- R² (Coefficient of determination): Explained variance ratio

Cross-validation:
1. K-fold: Split data into K parts, rotate test set
2. Leave-one-out: One sample per fold, accurate but costly
3. Stratified: Maintain class proportions

Overfitting detection:
- Good training, poor test → Overfitting
- Poor both → Underfitting

Tip: Don't rely on accuracy alone, choose metrics based on business context.`,
    },
    {
      zh: `过拟合与正则化详解：

偏差-方差权衡：
- 偏差（Bias）：模型预测值与真实值的差距
  - 高偏差 → 欠拟合
- 方差（Variance）：不同训练集预测结果的波动
  - 高方差 → 过拟合
- 权衡：模型复杂度增加，偏差下降，方差上升

正则化方法：
1. L1 正则化（Lasso）：
   - 损失函数 + λ × |w|
   - 效果：产生稀疏权重，可做特征选择
2. L2 正则化（Ridge）：
   - 损失函数 + λ × w²
   - 效果：权重衰减，防止过大
3. Elastic Net：L1 + L2 组合

其他防止过拟合方法：
1. Dropout：
   - 训练时随机丢弃神经元
   - 比例：0.2-0.5
2. 早停法（Early Stopping）：
   - 监控验证集损失，上升时停止
3. 数据增强：
   - 图像：翻转、裁剪、旋转
   - 文本：同义词替换、回译
4. Batch Normalization：
   - 规范化层输入，加速训练

建议：先用简单模型 baseline，逐步增加复杂度，配合正则化。`,
      en: `Overfitting & regularization deep dive:

Bias-variance tradeoff:
- Bias: Gap between prediction and true value
  - High bias → Underfitting
- Variance: Prediction fluctuation across training sets
  - High variance → Overfitting
- Tradeoff: As complexity increases, bias decreases, variance increases

Regularization methods:
1. L1 (Lasso):
   - Loss + λ × |w|
   - Effect: Sparse weights, feature selection
2. L2 (Ridge):
   - Loss + λ × w²
   - Effect: Weight decay, prevents large weights
3. Elastic Net: L1 + L2 combination

Other anti-overfitting methods:
1. Dropout:
   - Randomly drop neurons during training
   - Rate: 0.2-0.5
2. Early Stopping:
   - Monitor validation loss, stop when rising
3. Data augmentation:
   - Images: Flip, crop, rotate
   - Text: Synonym replacement, back-translation
4. Batch Normalization:
   - Normalize layer inputs, accelerates training

Tip: Start with simple model baseline, increase complexity gradually with regularization.`,
    },
  ],

  // 创业想法验证清单（5 个节点）
  'work-startup-checklist': [
    {
      zh: `完整的创业想法验证清单：

验证步骤：
1. 问题验证：确认痛点真实存在
2. 市场评估：规模是否足够大
3. 解决方案设计：MVP 是否解决问题
4. 商业模式：能否可持续盈利
5. 技术可行性：能否实现
6. 风险评估：识别并应对

关键指标：
- 问题强度：用户愿意付费的意愿
- 市场规模：TAM/SAM/SOM
- 获客成本（CAC）：获取一个用户的花费
- 用户终身价值（LTV）：用户生命周期贡献的收入
- LTV/CAC 比例：> 3 为健康
- 留存率：次日/7日/30日

常见陷阱：
1. 伪需求：创始人自以为的痛点
2. 市场过小：天花板太低
3. 过早优化：MVP 功能过多
4. 忽视竞争：低估竞品能力
5. 烧钱过快：成本控制不力

成功案例：
- Airbnb：从气垫床起步验证需求
- Dropbox：视频 demo 验证用户兴趣

建议：快速验证，小成本试错，用数据说话而非直觉。`,
      en: `Complete startup idea validation checklist:

Steps:
1. Problem validation: Confirm pain point is real
2. Market assessment: Is market size sufficient
3. Solution design: Does MVP solve the problem
4. Business model: Can it sustainably profit
5. Technical feasibility: Can it be built
6. Risk assessment: Identify and mitigate

Key metrics:
- Problem intensity: User willingness to pay
- Market size: TAM/SAM/SOM
- CAC (Customer Acquisition Cost): Cost per user
- LTV (Lifetime Value): Revenue per user lifecycle
- LTV/CAC ratio: > 3 is healthy
- Retention: D1/D7/D30

Common pitfalls:
1. Fake demand: Founder's assumed pain points
2. Market too small: Low ceiling
3. Premature optimization: Too many MVP features
4. Ignoring competition: Underestimating rivals
5. Burning too fast: Poor cost control

Success cases:
- Airbnb: Started with air mattresses to validate demand
- Dropbox: Video demo to validate user interest

Tip: Validate fast, fail cheap, let data decide—not intuition.`,
    },
    {
      zh: `创业问题验证方法：

用户访谈方法：
1. 访谈对象：10-30 个目标用户
2. 访谈结构：
   - 开放式问题为主
   - 避免引导性问题
   - 关注行为而非观点
3. 访谈流程：
   - 破冰（5 分钟）
   - 现状了解（15 分钟）
   - 痛点挖掘（15 分钟）
   - 解决方案反馈（10 分钟）
4. 记录方式：录音 + 笔记

痛点验证：
- 用户是否已经花钱解决这个问题
- 痛点频率：每天/每周/每月
- 痛点强度：轻微不便 vs 严重影响
- 用户自发的抱怨和行为

市场规模评估：
- TAM（总市场）：整个市场的总需求
- SAM（可服务市场）：你能触及的部分
- SOM（可获得市场）：短期可获取的份额
- 评估方法：
  - 自上而下：行业报告 → 细分市场
  - 自下而上：用户数 × 客单价

竞争格局分析：
- 直接/间接竞品
- 替代方案（用户现在怎么做）
- 竞品的用户评价（差评是机会）

建议：访谈时多听少说，让用户讲故事而非回答 yes/no。`,
      en: `Startup problem validation methods:

User interview methods:
1. Targets: 10-30 target users
2. Structure:
   - Mostly open-ended questions
   - Avoid leading questions
   - Focus on behavior, not opinions
3. Flow:
   - Icebreaker (5 min)
   - Current situation (15 min)
   - Pain point discovery (15 min)
   - Solution feedback (10 min)
4. Recording: Audio + notes

Pain point validation:
- Is user already paying to solve this?
- Frequency: Daily/weekly/monthly
- Intensity: Minor inconvenience vs severe impact
- User's spontaneous complaints and behaviors

Market size assessment:
- TAM (Total Addressable Market): Total market demand
- SAM (Serviceable Addressable Market): Your reachable portion
- SOM (Serviceable Obtainable Market): Short-term achievable share
- Methods:
  - Top-down: Industry reports → segments
  - Bottom-up: Users × price per user

Competitive landscape:
- Direct/indirect competitors
- Alternatives (what users do now)
- Competitor reviews (negative reviews = opportunities)

Tip: Listen more than talk in interviews, let users tell stories not yes/no.`,
    },
    {
      zh: `创业解决方案设计方法：

MVP 定义：
- 最小可行产品：用最低成本验证核心假设
- 原则：解决一个核心问题，做到极致
- 反例：功能多但每个都半成品
- 形式：可以是产品、demo、甚至是视频/落地页

核心价值主张提炼：
1. 我们帮[谁]解决[什么问题]
2. 通过[什么方式]
3. 相比[竞品]我们[独特优势]
示例：帮小商家通过简单易用的工具管理库存，相比 Excel 我们自动化且支持多店协同

用户故事编写：
- 格式：作为[角色]，我想[功能]，以便[价值]
- 示例：作为店主，我想扫码入库，以便快速记录商品
- 优先级：按价值 × 实现成本排序

原型设计方法：
1. 纸质原型：纸笔快速画，验证流程
2. 线框图：Figma/Axure，无视觉
3. 高保真原型：接近真实产品
4. 可交互原型：可点击演示

设计原则：
- 核心流程优先
- 减少决策点
- 明确反馈

建议：MVP 上线后用真实数据验证，而不是在内部讨论中纠结。`,
      en: `Startup solution design methods:

MVP definition:
- Minimum Viable Product: Validate core hypothesis at lowest cost
- Principle: Solve one core problem excellently
- Anti-pattern: Many features, all half-baked
- Forms: Product, demo, even video/landing page

Value proposition:
1. We help [who] solve [what problem]
2. By [what means]
3. Compared to [competitor] we [unique advantage]
Example: Help small merchants manage inventory via simple tools, vs Excel we're automated and support multi-store sync

User stories:
- Format: As [role], I want [feature], so that [value]
- Example: As store owner, I want barcode entry, to record products fast
- Priority: Sort by value × cost

Prototyping methods:
1. Paper prototype: Pen and paper, validate flow
2. Wireframe: Figma/Axure, no visuals
3. High-fidelity: Near real product
4. Interactive: Clickable demo

Design principles:
- Core flow first
- Minimize decision points
- Clear feedback

Tip: Validate MVP with real data after launch, not internal debate.`,
    },
    {
      zh: `创业商业模式设计：

盈利模式类型：
1. 订阅制：月费/年费（SaaS）
2. 交易抽成：每笔交易抽成（电商平台）
3. 广告：流量变现（内容平台）
4. 增值服务：基础免费 + 高级付费
5. 一次性销售：软件授权
6. 按量计费：API 调用次数

获客成本（CAC）：
- 计算：营销总花费 / 新增用户数
- 含义：获取一个付费用户的成本
- 健康：CAC < LTV / 3

用户终身价值（LTV）：
- 计算：客单价 × 购买次数 × 生命周期
- 或：ARPU × 平均用户生命周期
- 含义：一个用户在整个生命周期贡献的收入

单位经济模型：
- LTV / CAC 比例：> 3 为健康
- 回本周期：多久收回 CAC
- 毛利率：收入 - 直接成本

定价策略：
1. 成本加成：成本 × (1 + 利润率)
2. 价值定价：基于用户感知价值
3. 竞品对标：参考竞品定价
4. 免费增值：基础免费，高级付费
5. 动态定价：根据需求调整

建议：早期关注 LTV/CAC 比例，确保可持续获客。`,
      en: `Startup business model design:

Revenue model types:
1. Subscription: Monthly/yearly fee (SaaS)
2. Transaction fee: Commission per transaction (e-commerce)
3. Advertising: Traffic monetization (content)
4. Freemium: Free basic + paid premium
5. One-time sale: Software license
6. Usage-based: API call count

CAC (Customer Acquisition Cost):
- Formula: Total marketing spend / new users
- Meaning: Cost to acquire one paying user
- Healthy: CAC < LTV / 3

LTV (Lifetime Value):
- Formula: Price × purchases × lifecycle
- Or: ARPU × average user lifecycle
- Meaning: Revenue per user over lifecycle

Unit economics:
- LTV/CAC ratio: > 3 is healthy
- Payback period: Time to recover CAC
- Gross margin: Revenue - direct costs

Pricing strategies:
1. Cost-plus: Cost × (1 + margin)
2. Value-based: Perceived value to user
3. Competitive: Reference competitor pricing
4. Freemium: Free basic, paid premium
5. Dynamic: Adjust by demand

Tip: Focus on LTV/CAC ratio early, ensure sustainable acquisition.`,
    },
    {
      zh: `创业风险评估系统：

技术风险：
- 技术可行性：核心技术是否成熟
- 依赖风险：第三方服务稳定性
- 安全风险：数据泄露、合规问题
- 应对：技术预研、多供应商、安全审计

市场风险：
- 需求变化：用户需求是否持续
- 竞争加剧：大厂入场
- 政策风险：行业监管
- 应对：持续调研、快速迭代、合规先行

团队风险：
- 核心成员流失：关键人依赖
- 能力短板：团队技能不匹配
- 内部冲突：股权/决策分歧
- 应对：股权激励、能力补齐、明确决策机制

资金风险：
- 现金流断裂：烧钱过快
- 融资困难：市场环境变化
- 成本失控：固定成本过高
- 应对：18 个月 runway、控制固定成本、多元融资

竞争风险：
- 直接抄袭：模式被复制
- 价格战：恶性竞争
- 应对：建立壁垒（数据、网络效应、品牌）

风险应对策略：
1. 规避：放弃高风险方向
2. 降低：预先测试、分阶段投入
3. 转移：保险、外包
4. 接受：预留缓冲

建议：建立风险清单，定期复盘更新，优先处理高概率高影响风险。`,
      en: `Startup risk assessment system:

Technical risks:
- Feasibility: Is core tech mature
- Dependency: Third-party service stability
- Security: Data breach, compliance
- Mitigation: R&D, multi-vendor, security audit

Market risks:
- Demand shift: Is user need sustained
- Competition: Big tech entry
- Policy: Industry regulation
- Mitigation: Continuous research, fast iteration, compliance first

Team risks:
- Key person loss: Critical dependency
- Skill gaps: Team capabilities mismatch
- Conflict: Equity/decision disputes
- Mitigation: Equity incentives, skill building, clear decision-making

Financial risks:
- Cash flow: Burning too fast
- Funding difficulty: Market conditions
- Cost overrun: High fixed costs
- Mitigation: 18-month runway, control fixed costs, diverse funding

Competitive risks:
- Copying: Model replicated
- Price war: Race to bottom
- Mitigation: Build moats (data, network effects, brand)

Risk response strategies:
1. Avoid: Abandon high-risk directions
2. Reduce: Pre-test, phased investment
3. Transfer: Insurance, outsourcing
4. Accept: Reserve buffer

Tip: Maintain risk register, review regularly, prioritize high-probability high-impact risks.`,
    },
  ],
};

/**
 * 根据模板 ID 与节点索引获取预设答案
 *
 * 从 BUILTIN_TEMPLATE_ANSWERS 中查询指定模板、指定节点索引的预设答案。
 * 返回的 PresetAnswer 对象同时包含 zh / en 两个字段，由调用方按所需语言取用。
 *
 * @param templateId - 模板唯一标识
 * @param nodeIndex - 节点在模板 nodes 数组中的索引（从 0 开始）
 * @param lang - 目标语言（'zh' 简体中文 / 'en' 英文），用于在调用处表达当前所需语言意图
 * @returns 找到时返回对应的 PresetAnswer 对象；模板不存在或索引越界时返回 null
 *
 * 异常处理说明：
 * - 模板 ID 不存在时返回 null（由调用方决定是否跳过）
 * - 节点索引越界（非整数、负数或超出数组长度）时返回 null
 * - 找到的答案字段为空字符串时仍返回该 PresetAnswer 对象，
 *   由调用方判断空字符串决定是否跳过（保持数据查询与业务判断职责分离）
 *
 * 注意事项：
 * - 返回的 PresetAnswer 对象为引用，调用方不应修改其字段以避免污染原数据
 */
export function getPresetAnswer(
  templateId: string,
  nodeIndex: number,
  lang: 'zh' | 'en',
): PresetAnswer | null {
  // lang 参数用于在调用处表达当前所需语言意图，此处统一返回完整对象由调用方按 lang 取用
  void lang;
  const answers = BUILTIN_TEMPLATE_ANSWERS[templateId];
  // 模板不存在
  if (!answers) {
    return null;
  }
  // 索引越界保护（非整数或负数或超出数组长度）
  if (!Number.isInteger(nodeIndex) || nodeIndex < 0 || nodeIndex >= answers.length) {
    return null;
  }
  // 返回对应索引的预设答案对象（包含 zh / en 两个字段）
  return answers[nodeIndex];
}

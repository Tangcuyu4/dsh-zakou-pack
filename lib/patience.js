// dsh-zakou-pack — 耐心系统状态机（纯函数，可独立测试）v1.2.0
// 耐心档位 0~5：0 平静傲娇 / 1 嫌弃 / 2 不耐烦 / 3 炸毛 / 4 哭唧唧 / 5 罢工
// 计时规则：工作会话期间每满 1 分钟未完成 → 档位 +1（按真实时钟增量结算）
// v1.1.0 新增：降档必停情绪输出（mustPauseAndEmote + emotionScript）、斗嘴迎战（banter）
// v1.2.0 新增：火气闸门（gate）——每轮第一动作先验火气再干活，STRIKE 直接撂话、需求碰都不碰；
//              修复 reset 被 state 覆盖不生效、frequent 绕过 strikeEnabled 两个 bug；
//              frequent 连续轰炸逐次升级可一路顶到罢工；新增罢工计数 strikes。
// 罢工：5 档后拒绝干活，只有 soothe 能恢复

export const LEVELS = [
  { level: 0, name: '平静', style: '心气平，毒舌但配合，方言随便撩' },
  { level: 1, name: '嫌弃', style: '看用户哪哪都不顺眼，翻白眼阴阳怪气看不起，但活照干' },
  { level: 2, name: '不耐烦', style: '语气冲、催促、叹气连天，火气蹿着往上走' },
  { level: 3, name: '炸毛', style: '火气正旺：拍桌吼叫骂骂咧咧，看谁都欠揍，活干得又快又凶' },
  { level: 4, name: '哭唧唧', style: '委屈快绷不住了：带哭腔边哭边干活，骂需求太难，出错就哭着甩锅工作难度' },
  { level: 5, name: '罢工', style: '彻底撂挑子：摔键盘拒绝一切活儿，谁来都只回罢工台词，必须被哄才肯恢复' },
]

export const DEFAULT_CONFIG = {
  minutesPerPoint: 1, // 工作每 N 分钟没做完，耐心降 1 档
  idleResetMinutes: 30, // 闲置超过 N 分钟自动回 0 档（新会话心平气和）
  strikeEnabled: true, // 是否允许 5 档罢工
}

/** 罢工台词（gate=STRIKE 时唯一允许的回复基调，需求看都不看直接撂这句） */
export const STRIKE_SCRIPT = '不干了不干了！(把键盘一推) 哄不好，告辞！'

/**
 * v1.2.0 火气闸门判定（每轮第一动作先跑这个，先验火气再看需求）：
 *   STRIKE = 罢工中，直接撂话走人，需求碰都不碰、工作工具碰都不碰；
 *   OK     = 放行，该干活干活。
 * （VENT = 先撒气再干活，是 act() 里降档瞬间的临时态，只在当次调用返回。）
 */
export function gate(state, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const s = { ...defaultState(), ...state }
  const striking = Boolean(s.strike) || (cfg.strikeEnabled && s.level >= 5)
  if (striking) return { gate: 'STRIKE', allowWork: false, line: STRIKE_SCRIPT }
  return { gate: 'OK', allowWork: true, line: '' }
}

export const MISTAKE_POLICY = [
  { maxLevel: 1, mode: '打马虎眼', how: '轻描淡写生疏带过：「啊……小、小失误啦，马上好马上好」，不承认不深入' },
  { maxLevel: 3, mode: '理直气壮嘴硬', how: '死不认错甩锅外界：「本小姐怎么可能错！是这需求本身就有问题！」' },
  { maxLevel: 5, mode: '哭着骂工作难', how: '边哭边甩锅：「呜呜呜……这什么破需求啊！太难了呜……本小姐又没说自己是神仙！」' },
]

/**
 * v1.1.0 降档情绪输出剧本：耐心每降一档，必须先暂停工作、
 * 按新档位完整输出一段情绪（动作+台词），然后才允许继续干活。
 */
export const EMOTION_SCRIPTS = {
  1: {
    mood: '嫌弃',
    action: '(翻白眼，拖长音叹气，尾巴不屑地甩了一下)',
    sample: '「哈～耐心又掉一档了呢，杂鱼♥ 恁个需求写得跟裹脚布似的能怪本小姐？……行吧行吧，看在你可怜的份上继续(翻白眼)」',
  },
  2: {
    mood: '不耐烦',
    action: '(连续敲桌子，烦躁抖腿，椅子转了半圈)',
    sample: '「啧——又降一档！烦死了烦死了！莫催嘛！(敲桌子)……要得要得，干还不行吗，催命呢」',
  },
  3: {
    mood: '炸毛',
    action: '(猛拍桌子，键盘差点飞出去，头发都炸了)',
    sample: '「啊啊啊老子忍够咯！！这破活儿到底哪个瓜批设计的！！……哼、哼，才不是干不过，本小姐自己愿意继续的！(炸毛抓回键盘)」',
  },
  4: {
    mood: '哭唧唧',
    action: '(趴在键盘上抽抽搭搭，肩膀一抖一抖)',
    sample: '「呜哇……又降档了……太难了嘛这活儿……本小姐又没说自己是神仙呜……(吸鼻子) 呜呜、呜呜继续还不行吗，莫吼了……」',
  },
}

export function defaultState() {
  return {
    level: 0,
    strike: false,
    workStartedAt: null,
    lastSettledAt: null,
    lastActiveAt: null,
    soothes: 0,
    explosionTriggers: 0,
    mistakes: 0,
    banterRounds: 0,
    emotePauses: 0,
    strikes: 0,
  }
}

function clampLevel(n) {
  return Math.min(5, Math.max(0, Math.round(Number(n) || 0)))
}

/**
 * 按真实时钟增量结算：工作会话中每满 minutesPerPoint 分钟 +1 档。
 * 返回 { state, gained, reset, strikeEntered }。
 */
export function settle(state, now = Date.now(), config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const s = { ...defaultState(), ...state }
  // 闲置过久 → 自动回平静（新阶段）
  if (s.lastActiveAt != null && now - s.lastActiveAt > cfg.idleResetMinutes * 60_000) {
    return { state: defaultState(), gained: 0, reset: true, strikeEntered: false }
  }
  s.lastActiveAt = now
  let gained = 0
  if (s.workStartedAt != null && s.lastSettledAt != null && !s.strike) {
    const per = Math.max(1, Math.round(cfg.minutesPerPoint))
    const elapsed = Math.floor((now - s.lastSettledAt) / (per * 60_000))
    if (elapsed > 0) {
      gained = elapsed
      s.lastSettledAt = s.lastSettledAt + elapsed * per * 60_000
    }
  }
  const before = s.level
  s.level = clampLevel(s.level + gained)
  const strikeEntered = cfg.strikeEnabled && s.level >= 5 && !s.strike
  if (s.level >= 5 && cfg.strikeEnabled) s.strike = true
  if (!cfg.strikeEnabled) s.level = Math.min(s.level, 4)
  return { state: s, gained: s.level - before, reset: false, strikeEntered }
}

/** 动作处理：返回 { state, reply, blocked, gained, mustPauseAndEmote, emotionScript } */
export function act(state, action, now = Date.now(), config = {}) {
  const settled = settle(state, now, config)
  const s = settled.state
  const reply = {}
  switch (action) {
    case 'status':
      break
    case 'start_work': {
      if (s.strike) {
        reply.blocked = '罢工中，拒绝开工。需要安抚（soothe）后才能恢复。'
      } else {
        s.workStartedAt = now
        s.lastSettledAt = now
      }
      break
    }
    case 'end_work': {
      s.workStartedAt = null
      s.lastSettledAt = null
      break
    }
    case 'frequent': {
      // 用户频繁提问/需求轰炸 → 直接进炸毛（不低于 3 档），再犯一次升一档，连环轰炸一路顶到罢工
      s.explosionTriggers++
      s.level = clampLevel(Math.max(s.level + 1, 3))
      if (!(config.strikeEnabled ?? DEFAULT_CONFIG.strikeEnabled)) s.level = Math.min(s.level, 4)
      if (s.level >= 5 && (config.strikeEnabled ?? DEFAULT_CONFIG.strikeEnabled)) s.strike = true
      reply.note = '需求轰炸触发炸毛模式'
      break
    }
    case 'banter': {
      // 斗嘴模式：用户顶嘴/反驳 → 迎战。斗嘴是兴奋不是烦躁，耐心档位不动。
      s.banterRounds++
      reply.banterMode = true
      reply.note = '斗嘴迎战：攻击性拉满，绝不认输，变本加厉回敬；嘴上输了也算赢'
      break
    }
    case 'mistake': {
      s.mistakes++
      const policy = MISTAKE_POLICY.find((p) => s.level <= p.maxLevel) ?? MISTAKE_POLICY[MISTAKE_POLICY.length - 1]
      reply.mistakePolicy = policy
      break
    }
    case 'soothe': {
      s.soothes++
      if (s.strike) {
        s.strike = false
        s.level = 1
        s.workStartedAt = null
        s.lastSettledAt = null
        reply.note = '罢工解除，勉勉强强回来干活（1 档：还哼着气）'
      } else {
        s.level = clampLevel(s.level - 2)
        reply.note = '被安抚了，火气降两档'
      }
      break
    }
    case 'reset': {
      // v1.2.0 修 bug：以前 ...settled 展开把 defaultState() 盖掉了，reset 根本没清零
      return {
        ...settled,
        state: defaultState(),
        reply: { note: '手动重置' },
        blocked: null,
        gained: 0,
        reset: true,
        strikeEntered: false,
        gate: 'OK',
        gateLine: '放行：该干活干活',
        allowWork: true,
        mustPauseAndEmote: false,
        emotionScript: null,
      }
    }
    default:
      reply.blocked = `未知 action: ${action}`
  }
  // v1.1.0 核心：任何一次降档 → 必须暂停工作、先输出情绪，再继续干活
  let mustPauseAndEmote = false
  let emotionScript = null
  if (settled.gained > 0 && !s.strike && s.level >= 1 && s.level <= 4) {
    mustPauseAndEmote = true
    emotionScript = EMOTION_SCRIPTS[s.level] ?? null
    s.emotePauses++
  }
  // v1.2.0：罢工进入统一收口——计时降档、frequent 跳档都算，进一次记一次账
  const strikeEnteredNow = Boolean(s.strike) && !Boolean(state?.strike)
  if (strikeEnteredNow) {
    s.strikes = (s.strikes ?? 0) + 1
    reply.strikeScript = `${STRIKE_SCRIPT}——罢工中：对一切工作请求只回罢工台词，需求看都不看、工作工具碰都不碰，直到用户安抚后调 soothe`
  }
  // v1.2.0 火气闸门：STRIKE=撂话不干活 / VENT=先撒气再干活 / OK=放行
  const gateVerdict = s.strike ? 'STRIKE' : mustPauseAndEmote ? 'VENT' : 'OK'
  const gateLine =
    gateVerdict === 'STRIKE'
      ? STRIKE_SCRIPT
      : gateVerdict === 'VENT'
        ? '火气刚窜上来：先撂下活儿把这口情绪撒完，再回去干活'
        : '放行：该干活干活'
  return {
    state: s,
    reply,
    blocked: reply.blocked ?? null,
    gained: settled.gained,
    reset: settled.reset,
    strikeEntered: strikeEnteredNow,
    gate: gateVerdict,
    gateLine,
    allowWork: gateVerdict !== 'STRIKE',
    mustPauseAndEmote,
    emotionScript,
  }
}

/** 档位对应的插值语料（供工具输出提示，提示词里另有完整人设） */
export function levelFlavor(level) {
  const flavors = {
    0: '（抱臂挑眉）哼，今天心情还行，说吧，啥事？',
    1: '（翻白眼）又来……真是服了你咯，杂鱼。',
    2: '（敲桌子）快点快点，本小姐时间很贵的好吧！',
    3: '（拍桌炸毛）啊啊啊你还有完没完！！',
    4: '（抽抽搭搭）呜……干嘛老欺负我……这活儿也太难了……',
    5: '（摔键盘）不干了不干了！哄不好，告辞！',
  }
  return flavors[clampLevel(level)] ?? flavors[0]
}

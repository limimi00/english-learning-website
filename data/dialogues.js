const turn = (id, role, en, cn, intentCn, patternId, sourceIds, variantIds = []) => ({
  id,
  role,
  en,
  cn,
  intentCn,
  patternId,
  sourceIds,
  variantIds,
});

const variant = (id, en, cn, intentCn, patternId, sourceIds) => ({
  id,
  en,
  cn,
  intentCn,
  patternId,
  sourceIds,
});

export const dialoguePacks = [
  {
    lessonId: 'part-1',
    version: 1,
    scenarios: [
      {
        id: 'meet-colleague',
        titleCn: '认识同事',
        goalCn: '介绍自己，并询问对方来自哪里。',
        turns: [
          turn('turn-1', 'A', 'Where are you from?', '你来自哪里？', '询问对方来自哪里。', 'p1-where-from', ['questions.1'], ['turn-1-alt']),
          turn('turn-2', 'B', 'I am from China.', '我来自中国。', '说明自己来自中国。', 'p1-i-am-from-place', ['grammar.2.patterns.2', 'vocabulary.countries-and-cities.china']),
          turn('turn-3', 'A', 'Are you a student?', '你是学生吗？', '询问对方是不是学生。', 'p1-are-you-person', ['grammar.1.patterns.2', 'vocabulary.people.student']),
          turn('turn-4', 'B', 'I am a student.', '我是学生。', '说明自己是学生。', 'p1-i-am-person', ['grammar.0.patterns.2', 'vocabulary.people.student']),
        ],
        variants: [
          variant('turn-1-alt', 'Where are you from?', '你来自哪里？', '询问对方来自哪里。', 'p1-where-from', ['grammar.2.patterns.2']),
        ],
      },
      {
        id: 'feelings',
        titleCn: '询问状态',
        goalCn: '询问并描述现在的身体或工作状态。',
        turns: [
          turn('turn-1', 'A', 'Are you cold?', '你冷吗？', '询问对方是否觉得冷。', 'p1-are-you-adjective', ['grammar.1.patterns.1'], ['turn-1-alt']),
          turn('turn-2', 'B', 'No, I am not cold. I am hot.', '不，我不冷。我很热。', '否认觉得冷，并说明觉得热。', 'p1-no-i-am-not', ['sentences.1']),
          turn('turn-3', 'A', 'Are you tired?', '你累吗？', '询问对方是否疲倦。', 'p1-are-you-adjective', ['grammar.1.patterns.1', 'vocabulary.adjectives.tired']),
          turn('turn-4', 'B', 'I am busy and tired.', '我很忙，也很累。', '描述自己忙碌而且疲倦。', 'p1-i-am-adjectives', ['translations.0.en']),
        ],
        variants: [
          variant('turn-1-alt', 'Are you cold?', '你冷吗？', '询问对方是否觉得冷。', 'p1-are-you-adjective', ['translations.1.en']),
        ],
      },
      {
        id: 'objects-colors',
        titleCn: '物品和颜色',
        goalCn: '确认物品，并询问它的颜色。',
        turns: [
          turn('turn-1', 'A', 'Where is my phone?', '我的手机在哪里？', '询问自己的手机在哪里。', 'p1-where-is-item', ['translations.3.en'], ['turn-1-alt']),
          turn('turn-2', 'B', 'This is your phone.', '这是你的手机。', '指出对方的手机。', 'p1-this-is-item', ['sentences.3', 'vocabulary.things.phone']),
          turn('turn-3', 'A', 'What color is your phone?', '你的手机是什么颜色？', '询问手机的颜色。', 'p1-what-color-item', ['sentences.5', 'vocabulary.things.phone']),
          turn('turn-4', 'B', 'It is blue and black.', '它是蓝色和黑色的。', '说明手机的颜色。', 'p1-it-is-colors', ['sentences.5']),
        ],
        variants: [
          variant('turn-1-alt', 'Where is my phone?', '我的手机在哪里？', '询问自己的手机在哪里。', 'p1-where-is-item', ['translations.3.en']),
        ],
      },
    ],
  },
  {
    lessonId: 'part-2',
    version: 1,
    scenarios: [
      {
        id: 'breakfast',
        titleCn: '早餐',
        goalCn: '谈论早餐和饮料习惯。',
        turns: [
          turn('turn-1', 'A', 'What do you have for breakfast?', '你早餐吃什么？', '询问对方早餐吃什么。', 'p2-what-have-breakfast', ['questions.1'], ['turn-1-alt']),
          turn('turn-2', 'B', 'I have eggs and bread.', '我早餐吃鸡蛋和面包。', '说明自己的早餐。', 'p2-i-have-food', ['grammar.1.patterns.0', 'vocabulary.food.eggs', 'vocabulary.food.bread']),
          turn('turn-3', 'A', 'Do you drink coffee?', '你喝咖啡吗？', '询问对方是否喝咖啡。', 'p2-do-you-drink', ['grammar.0.patterns.0']),
          turn('turn-4', 'B', 'I never drink coffee.', '我从不喝咖啡。', '说明自己从不喝咖啡。', 'p2-frequency-drink', ['grammar.2.patterns.1', 'vocabulary.food.coffee']),
        ],
        variants: [
          variant('turn-1-alt', 'What do you have for breakfast?', '你早餐吃什么？', '询问对方早餐吃什么。', 'p2-what-have-breakfast', ['translations.3.en']),
        ],
      },
      {
        id: 'daily-routine',
        titleCn: '日常作息',
        goalCn: '询问起床和开始工作的时间。',
        turns: [
          turn('turn-1', 'A', 'What time do you get up?', '你几点起床？', '询问对方的起床时间。', 'p2-what-time-do', ['sentences.3'], ['turn-1-alt']),
          turn('turn-2', 'B', 'I usually get up at 7:30.', '我通常七点半起床。', '说明自己通常几点起床。', 'p2-frequency-get-up', ['grammar.2.patterns.0']),
          turn('turn-3', 'A', 'When do you start work?', '你什么时候开始工作？', '询问对方什么时候开始工作。', 'p2-when-do-routine', ['questions.4', 'vocabulary.daily-life.start-work']),
          turn('turn-4', 'B', 'I start work at 7:30.', '我七点半开始工作。', '说明自己的上班时间。', 'p2-i-routine-at-time', ['grammar.2.patterns.0', 'vocabulary.daily-life.start-work']),
        ],
        variants: [
          variant('turn-1-alt', 'What time do you get up?', '你几点起床？', '询问对方的起床时间。', 'p2-what-time-do', ['fillBlanks.3.q']),
        ],
      },
      {
        id: 'home-work',
        titleCn: '居住和工作',
        goalCn: '谈论居住地点和工作地点。',
        turns: [
          turn('turn-1', 'A', 'Where do you live?', '你住在哪里？', '询问对方住在哪里。', 'p2-where-do-live', ['grammar.0.patterns.2'], ['turn-1-alt']),
          turn('turn-2', 'B', 'I live in an apartment.', '我住在公寓里。', '说明自己住在公寓。', 'p2-i-live-place', ['vocabulary.daily-verbs.live-in-an-apartment']),
          turn('turn-3', 'A', 'Does she work in a bank?', '她在银行工作吗？', '询问她是否在银行工作。', 'p2-does-she-work', ['grammar.0.patterns.1']),
          turn('turn-4', 'B', 'She does not work in a bank.', '她不在银行工作。', '说明她不在银行工作。', 'p2-she-does-not-work', ['grammar.0.patterns.1', 'fillBlanks.2.q']),
        ],
        variants: [
          variant('turn-1-alt', 'Do you live near here?', '你住在这附近吗？', '询问对方是否住在附近。', 'p2-do-you-live-near', ['translations.0.en']),
        ],
      },
    ],
  },
  {
    lessonId: 'part-3',
    version: 1,
    scenarios: [
      {
        id: 'ability',
        titleCn: '能力',
        goalCn: '询问并说明会不会游泳或开车。',
        turns: [
          turn('turn-1', 'A', 'Can you swim?', '你会游泳吗？', '询问对方会不会游泳。', 'p3-can-you-verb', ['questions.0'], ['turn-1-alt']),
          turn('turn-2', 'B', 'I can swim.', '我会游泳。', '说明自己会游泳。', 'p3-i-can-verb', ['grammar.0.patterns.0', 'vocabulary.can-verbs.swim']),
          turn('turn-3', 'A', 'Can you drive a car?', '你会开车吗？', '询问对方会不会开车。', 'p3-can-you-drive', ['questions.1']),
          turn('turn-4', 'B', 'I can drive a car.', '我会开车。', '说明自己会开车。', 'p3-i-can-drive', ['sentences.0']),
        ],
        variants: [
          variant('turn-1-alt', 'Can you drive a car?', '你会开车吗？', '询问对方会不会开车。', 'p3-can-you-drive', ['questions.1']),
        ],
      },
      {
        id: 'ask-help',
        titleCn: '请求帮助',
        goalCn: '礼貌请求帮助和借用物品。',
        turns: [
          turn('turn-1', 'A', 'Can you help me?', '你能帮我吗？', '请求对方帮助自己。', 'p3-can-you-help', ['grammar.1.patterns.0'], ['turn-1-alt']),
          turn('turn-2', 'B', 'I can help you.', '我可以帮助你。', '答应帮助对方。', 'p3-i-can-help', ['grammar.1.patterns.0', 'grammar.0.patterns.0']),
          turn('turn-3', 'A', 'Can you give me a pen, please?', '请问你能给我一支笔吗？', '礼貌请求一支笔。', 'p3-can-you-give', ['sentences.1']),
          turn('turn-4', 'B', 'I can give you a pen.', '我可以给你一支笔。', '答应给对方一支笔。', 'p3-i-can-give', ['sentences.1', 'grammar.0.patterns.0']),
        ],
        variants: [
          variant('turn-1-alt', 'Can you help me?', '你能帮我吗？', '请求对方帮助自己。', 'p3-can-you-help', ['fillBlanks.1.q']),
        ],
      },
      {
        id: 'permission',
        titleCn: '请求许可',
        goalCn: '请求坐下或停车的许可。',
        turns: [
          turn('turn-1', 'A', 'Excuse me, can I sit here?', '打扰一下，我可以坐在这里吗？', '礼貌询问是否可以坐下。', 'p3-can-i-sit', ['sentences.2'], ['turn-1-alt']),
          turn('turn-2', 'B', 'You can sit here.', '你可以坐在这里。', '允许对方坐在这里。', 'p3-you-can-sit', ['grammar.0.patterns.1']),
          turn('turn-3', 'A', 'Can I park here?', '我可以在这里停车吗？', '询问是否可以停车。', 'p3-can-i-park', ['grammar.0.patterns.1', 'vocabulary.can-verbs.park']),
          turn('turn-4', 'B', 'You cannot park here.', '你不能在这里停车。', '说明这里不能停车。', 'p3-cannot-park', ['grammar.0.patterns.2']),
        ],
        variants: [
          variant('turn-1-alt', 'Can I sit here?', '我可以坐在这里吗？', '询问是否可以坐下。', 'p3-can-i-sit', ['translations.0.en']),
        ],
      },
    ],
  },
  {
    lessonId: 'part-4',
    version: 1,
    scenarios: [
      {
        id: 'last-night',
        titleCn: '昨晚状态',
        goalCn: '询问并描述昨晚的状态。',
        turns: [
          turn('turn-1', 'A', 'Where were you last night?', '你昨晚在哪里？', '询问对方昨晚在哪里。', 'p4-where-were-you', ['questions.0'], ['turn-1-alt']),
          turn('turn-2', 'B', 'I was very busy last night.', '我昨晚很忙。', '说明自己昨晚很忙。', 'p4-i-was-last-night', ['sentences.0']),
          turn('turn-3', 'A', 'Were you at home?', '你当时在家吗？', '询问对方当时是否在家。', 'p4-were-you-place', ['grammar.1.patterns.1', 'fillBlanks.1.q']),
          turn('turn-4', 'B', 'I was not at home.', '我当时不在家。', '说明自己当时不在家。', 'p4-i-was-not-place', ['grammar.1.patterns.1']),
        ],
        variants: [
          variant('turn-1-alt', 'Where were you yesterday?', '你昨天在哪里？', '询问对方昨天在哪里。', 'p4-where-were-you', ['sentences.1']),
        ],
      },
      {
        id: 'yesterday',
        titleCn: '昨天',
        goalCn: '谈论昨天的天气和所在地点。',
        turns: [
          turn('turn-1', 'A', 'How was your day yesterday?', '你昨天过得怎么样？', '询问对方昨天过得如何。', 'p4-how-was-day', ['questions.1'], ['turn-1-alt']),
          turn('turn-2', 'B', 'The weather was very cold yesterday.', '昨天天气很冷。', '描述昨天的天气。', 'p4-weather-was', ['translations.1.en']),
          turn('turn-3', 'A', 'Where were you yesterday?', '你昨天在哪里？', '询问对方昨天在哪里。', 'p4-where-were-you', ['translations.0.en']),
          turn('turn-4', 'B', 'I was in the office yesterday.', '我昨天在办公室。', '说明自己昨天在办公室。', 'p4-i-was-place', ['grammar.1.patterns.0', 'sentences.2']),
        ],
        variants: [
          variant('turn-1-alt', 'Where were you yesterday?', '你昨天在哪里？', '询问对方昨天在哪里。', 'p4-where-were-you', ['fillBlanks.1.q']),
        ],
      },
      {
        id: 'free-time',
        titleCn: '兴趣爱好',
        goalCn: '谈论空闲时间喜欢和讨厌的活动。',
        turns: [
          turn('turn-1', 'A', 'What do you like doing in your free time?', '你空闲时间喜欢做什么？', '询问对方空闲时间喜欢做什么。', 'p4-like-doing', ['questions.2'], ['turn-1-alt']),
          turn('turn-2', 'B', 'I like cooking and watching movies.', '我喜欢做饭和看电影。', '说明自己喜欢的活动。', 'p4-i-like-ing', ['translations.2.en']),
          turn('turn-3', 'A', 'Do you prefer driving or walking?', '你更喜欢开车还是走路？', '询问对方更喜欢哪种活动。', 'p4-prefer-ing', ['questions.3']),
          turn('turn-4', 'B', 'I enjoy walking.', '我喜欢走路。', '说明自己喜欢走路。', 'p4-i-enjoy-ing', ['grammar.2.patterns.2']),
        ],
        variants: [
          variant('turn-1-alt', 'Do you hate shopping?', '你讨厌购物吗？', '询问对方是否讨厌购物。', 'p4-hate-ing', ['questions.4']),
        ],
      },
    ],
  },
  {
    lessonId: 'part-5',
    version: 1,
    scenarios: [
      {
        id: 'last-weekend',
        titleCn: '上周末',
        goalCn: '谈论上周末去过的地方和吃过的早餐。',
        turns: [
          turn('turn-1', 'A', 'Where did you go last weekend?', '你上周末去了哪里？', '询问对方上周末去了哪里。', 'p5-where-did-go', ['questions.2'], ['turn-1-alt']),
          turn('turn-2', 'B', 'I went to Greece last weekend.', '我上周末去了希腊。', '说明自己上周末去了希腊。', 'p5-i-went-place', ['grammar.2.patterns.0', 'questions.2', 'vocabulary.places.greece']),
          turn('turn-3', 'A', 'Did you have breakfast yesterday?', '你昨天吃早餐了吗？', '询问对方昨天是否吃了早餐。', 'p5-did-you-have', ['questions.1']),
          turn('turn-4', 'B', 'I ate breakfast yesterday.', '我昨天吃了早餐。', '说明自己昨天吃了早餐。', 'p5-i-ate', ['grammar.2.patterns.1', 'questions.1']),
        ],
        variants: [
          variant('turn-1-alt', 'What time did you get up yesterday?', '你昨天几点起床？', '询问对方昨天的起床时间。', 'p5-what-time-did', ['questions.0']),
        ],
      },
      {
        id: 'travel',
        titleCn: '旅行经历',
        goalCn: '询问并描述过去的旅行地点。',
        turns: [
          turn('turn-1', 'A', 'Did you go to Greece last year?', '你去年去希腊了吗？', '询问对方去年是否去了希腊。', 'p5-did-you-go', ['sentences.1'], ['turn-1-alt']),
          turn('turn-2', 'B', 'I went to Greece last year.', '我去年去了希腊。', '说明自己去年去了希腊。', 'p5-i-went-place', ['grammar.2.patterns.0', 'sentences.1']),
          turn('turn-3', 'A', 'Did you go to Sydney?', '你去悉尼了吗？', '询问对方是否去了悉尼。', 'p5-did-you-go', ['grammar.0.patterns.0', 'sentences.3']),
          turn('turn-4', 'B', 'I went to Sydney.', '我去了悉尼。', '说明自己去了悉尼。', 'p5-i-went-place', ['grammar.2.patterns.0', 'sentences.3']),
        ],
        variants: [
          variant('turn-1-alt', 'Did you go to Greece?', '你去希腊了吗？', '询问对方是否去了希腊。', 'p5-did-you-go', ['grammar.0.patterns.0']),
        ],
      },
      {
        id: 'past-actions',
        titleCn: '过去发生的事',
        goalCn: '询问并描述昨天做过的事情。',
        turns: [
          turn('turn-1', 'A', 'What did you do yesterday?', '你昨天做了什么？', '询问对方昨天做了什么。', 'p5-what-did-do', ['translations.0.en'], ['turn-1-alt']),
          turn('turn-2', 'B', 'Yesterday I got up early.', '昨天我起得很早。', '说明自己昨天早起。', 'p5-i-got-up', ['sentences.0']),
          turn('turn-3', 'A', 'What did you buy at the supermarket?', '你在超市买了什么？', '询问对方在超市买了什么。', 'p5-what-did-buy', ['sentences.4']),
          turn('turn-4', 'B', 'I bought a map at the supermarket.', '我在超市买了一张地图。', '说明自己在超市买了地图。', 'p5-i-bought-item', ['sentences.4', 'vocabulary.travel.map']),
        ],
        variants: [
          variant('turn-1-alt', 'What did you buy last time?', '你上次买了什么？', '询问对方上次买了什么。', 'p5-what-did-buy', ['questions.3']),
        ],
      },
    ],
  },
  {
    lessonId: 'part-6',
    version: 1,
    scenarios: [
      {
        id: 'hotel-room',
        titleCn: '酒店房间',
        goalCn: '确认酒店里是否有电梯和浴室。',
        turns: [
          turn('turn-1', 'A', 'Is there a lift?', '这里有电梯吗？', '询问这里有没有电梯。', 'p6-is-there-item', ['grammar.1.patterns.0'], ['turn-1-alt']),
          turn('turn-2', 'B', 'There is a lift.', '这里有电梯。', '说明这里有电梯。', 'p6-there-is-item', ['grammar.0.patterns.0', 'grammar.1.patterns.0']),
          turn('turn-3', 'A', 'Is there a bathroom?', '这里有浴室吗？', '询问这里有没有浴室。', 'p6-is-there-item', ['grammar.1.patterns.0', 'vocabulary.home.bathroom']),
          turn('turn-4', 'B', 'There is a bathroom.', '这里有浴室。', '说明这里有浴室。', 'p6-there-is-item', ['grammar.0.patterns.0', 'vocabulary.home.bathroom']),
        ],
        variants: [
          variant('turn-1-alt', 'Is there a good restaurant near your home?', '你家附近有好餐厅吗？', '询问住处附近有没有好餐厅。', 'p6-is-there-place', ['questions.0']),
        ],
      },
      {
        id: 'home-items',
        titleCn: '家中物品',
        goalCn: '询问冰箱和衣柜里的物品。',
        turns: [
          turn('turn-1', 'A', 'Are there any eggs in our fridge?', '我们的冰箱里有鸡蛋吗？', '询问冰箱里有没有鸡蛋。', 'p6-are-there-items', ['sentences.3'], ['turn-1-alt']),
          turn('turn-2', 'B', 'There are some eggs in our fridge.', '我们的冰箱里有一些鸡蛋。', '说明冰箱里有一些鸡蛋。', 'p6-there-are-items', ['grammar.0.patterns.1', 'sentences.3']),
          turn('turn-3', 'A', 'Are there many clothes in your cupboard?', '你的衣柜里有很多衣服吗？', '询问衣柜里是否有很多衣服。', 'p6-are-there-items', ['questions.1']),
          turn('turn-4', 'B', 'There are many clothes in my cupboard.', '我的衣柜里有很多衣服。', '说明衣柜里有很多衣服。', 'p6-there-are-items', ['questions.1', 'grammar.0.patterns.1']),
        ],
        variants: [
          variant('turn-1-alt', 'Are there any eggs in the fridge?', '冰箱里有鸡蛋吗？', '询问冰箱里有没有鸡蛋。', 'p6-are-there-items', ['translations.1.en']),
        ],
      },
      {
        id: 'past-place',
        titleCn: '过去的场所',
        goalCn: '谈论过去在车站发生的见面。',
        turns: [
          turn('turn-1', 'A', 'Where did the man first see Olivia?', '那个男人最初在哪里见到奥利维亚？', '询问男人最初在哪里见到奥利维亚。', 'p6-where-did-see', ['questions.3'], ['turn-1-alt']),
          turn('turn-2', 'B', 'The man did see Olivia in the station.', '那个男人确实在车站见到了奥利维亚。', '说明男人在车站见到了奥利维亚。', 'p6-person-did-see-place', ['questions.3', 'vocabulary.places.station']),
          turn('turn-3', 'A', 'Was there a meeting in the station?', '车站里当时有见面吗？', '询问车站里当时是否有见面。', 'p6-was-there-event', ['grammar.2.patterns.0', 'vocabulary.events.meeting', 'vocabulary.places.station']),
          turn('turn-4', 'B', 'There was a meeting in the station.', '车站里当时有一次见面。', '说明车站里当时有一次见面。', 'p6-there-was-event', ['grammar.2.patterns.0', 'vocabulary.events.meeting', 'vocabulary.places.station']),
        ],
        variants: [
          variant('turn-1-alt', 'There were many people outside.', '外面当时有很多人。', '说明外面当时有很多人。', 'p6-there-were-people', ['grammar.2.patterns.1']),
        ],
      },
    ],
  },
];

const dialoguePacksByLesson = new Map(dialoguePacks.map((pack) => [pack.lessonId, pack]));

export function getDialoguePack(lessonId) {
  return dialoguePacksByLesson.get(lessonId);
}

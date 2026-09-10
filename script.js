/* ============================================================
   VIDA EM EQUILÍBRIO — script.js
   Estrutura: DADOS -> ESTADO -> LÓGICA -> INTERFACE -> CONTROLE
   ============================================================ */

/* ================= DADOS ================= */

const ATTRS = ["health", "mental", "sleep", "study", "exercise", "social"];

const ATTR_META = {
  health:   { label: "Saúde Física",   short: "Saúde",     icon: "❤️", hue: 358 },
  mental:   { label: "Saúde Mental",   short: "Mental",    icon: "🧠", hue: 262 },
  sleep:    { label: "Sono",           short: "Sono",      icon: "😴", hue: 212 },
  study:    { label: "Estudos",        short: "Estudos",   icon: "📚", hue: 38 },
  exercise: { label: "Atividade Física", short: "Exercício", icon: "🏃", hue: 145 },
  social:   { label: "Vida Social",    short: "Social",    icon: "👥", hue: 335 }
};

const VITAL_META = {
  energy: { label: "Energia",  short: "Energia",  icon: "⚡", hue: 40 },
  stress: { label: "Estresse", short: "Estresse", icon: "🧠", hue: 8 }
};

// Cores sólidas (sem transparência) derivadas do matiz de cada atributo:
// o fundo é um tom bem claro e fixo; o preenchimento usa o mesmo matiz,
// ficando mais escuro/saturado (mais "forte") conforme o valor sobe.
function barColors(hue, value) {
  const v = clamp(value, 0, 100);
  const fillLightness = Math.round(66 - v * 0.27); // 66% (fraco) -> 39% (forte)
  return {
    track: `hsl(${hue}, 34%, 91%)`,
    fill: `hsl(${hue}, 62%, ${fillLightness}%)`,
    icon: `hsl(${hue}, 45%, 86%)`,
    text: `hsl(${hue}, 58%, 36%)`
  };
}

const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const PERIOD_NAMES = { morning: "Manhã", afternoon: "Tarde", evening: "Noite" };
const PERIOD_TINTS = { morning: "#FBF3E1", afternoon: "#E9F1F6", evening: "#E4E1EE" };

const CHARACTERS = {
  alex:   { label: "Alex (melhor amigo)", short: "Alex",   icon: "🧑" },
  julia:  { label: "Júlia (amiga próxima)", short: "Júlia", icon: "🧑" },
  family: { label: "Família",             short: "Família", icon: "🏠" }
};

// Resolve metadata (label/short/icon/color) for any effect key: attribute, vital or relationship
function metaFor(key) {
  return ATTR_META[key] || VITAL_META[key] || CHARACTERS[key] || { label: key, short: key, icon: "•", color: "var(--accent)" };
}

const OBJECTIVES_POOL = [
  {
    id: "sleep7", text: "Dormir pelo menos 7h em 5 dias ou mais",
    check: s => s.sleepHistory.filter(h => h >= 7).length >= 5
  },
  {
    id: "study5days", text: "Estudar em pelo menos 5 dias da semana",
    check: s => s.studiedDays.size >= 5
  },
  {
    id: "exercise4", text: "Fazer atividade física 4 vezes ou mais",
    check: s => s.exerciseCount >= 4
  },
  {
    id: "stressLow", text: "Terminar a semana com estresse abaixo de 55",
    check: s => s.attrsHistory.stress <= 55
  },
  {
    id: "alexStrong", text: "Fortalecer a amizade com Alex (relação ≥ 75 no fim)",
    check: s => s.rel.alex >= 75
  },
  {
    id: "socialHigh", text: "Manter a vida social acima de 70 no fim da semana",
    check: s => s.attrs.social >= 70
  },
  {
    id: "healthHigh", text: "Terminar a semana com Saúde Física acima de 75",
    check: s => s.attrs.health >= 75
  },
  {
    id: "energyNeverZero", text: "Não deixar a energia chegar a zero em nenhum dia",
    check: s => s.minEnergyEver > 5
  },
  {
    id: "familyContact", text: "Manter contato com a família pelo menos 3 vezes",
    check: s => s.familyContactCount >= 3
  },
  {
    id: "lowScreenTime", text: "Usar redes sociais em excesso no máximo 3 vezes na semana",
    check: s => s.socialMediaCount <= 3
  }
];

/* Cada evento:
   id, category, tag, period: 'morning'|'afternoon'|'evening'|'any',
   phase: 'intro'|'core'|'late'|'final'|'any',
   text, options: [{label, time, effects{}, feedback}]
*/
const EVENTS = [
  // ---------- FASE INTRO (dias 1-2) ----------
  {
    id: "intro1", category: "organização", tag: "Manhã", period: "morning", phase: "intro",
    text: "Você acorda e olha a agenda da semana: provas, treino e compromissos se acumulando. Como prefere começar o dia?",
    options: [
      { label: "Organizar as tarefas da semana com calma", time: 1, effects: { mental: 6, stress: -6, study: 2 }, feedback: "Organizar tarefas com antecedência reduz a sensação de sobrecarga." },
      { label: "Ir direto para os estudos, sem planejar", time: 1.5, effects: { study: 8, stress: 4, energy: -8 } },
      { label: "Tomar café com calma e só depois decidir", time: 1, effects: { mental: 3, energy: 4, study: -1 } }
    ]
  },
  {
    id: "intro2", category: "alimentação", tag: "Manhã", period: "morning", phase: "intro",
    text: "Está atrasado e só há tempo para uma escolha rápida antes de sair de casa.",
    options: [
      { label: "Tomar um café da manhã completo, mesmo saindo mais tarde", time: 1, effects: { health: 6, energy: 6, study: -2 } },
      { label: "Sair sem comer para não perder tempo", time: 0, effects: { energy: -8, health: -4, study: 2 } },
      { label: "Levar algo rápido para comer no caminho", time: 0.5, effects: { health: 2, energy: 2 } }
    ]
  },
  {
    id: "intro3", category: "escola", tag: "Tarde", period: "afternoon", phase: "intro",
    text: "Depois da aula, um colega comenta que a prova de amanhã será mais difícil do que o esperado.",
    options: [
      { label: "Ficar revisando a matéria por 2h", time: 2, effects: { study: 10, energy: -12, stress: 5 } },
      { label: "Revisar por 1h e depois relaxar", time: 1, effects: { study: 5, mental: 4, energy: -4 } },
      { label: "Ignorar por hoje e confiar no que já sabe", time: 0, effects: { stress: -3, study: -3 } }
    ]
  },
  {
    id: "intro4", category: "amizades", tag: "Tarde", period: "afternoon", phase: "intro",
    text: "Júlia te chama para tomar um sorvete rapidinho antes de você seguir com seus planos do dia.",
    options: [
      { label: "Ir com ela por 1h", time: 1, effects: { social: 8, mental: 5, julia: 8, energy: -3 } },
      { label: "Dizer que hoje não dá, tem muita coisa para fazer", time: 0, effects: { julia: -4, stress: 2 } },
      { label: "Combinar de ir só por 30min", time: 0.5, effects: { social: 4, julia: 4 } }
    ]
  },
  {
    id: "intro5", category: "exercício", tag: "Tarde", period: "afternoon", phase: "intro",
    text: "Você tem uma janela livre à tarde. O corpo pede movimento, mas a cabeça pede descanso.",
    options: [
      { label: "Treinar por 1h", time: 1, effects: { exercise: 10, health: 6, energy: -14, mental: 3 } },
      { label: "Fazer uma caminhada leve de 30min", time: 0.5, effects: { exercise: 5, health: 3, energy: -5, mental: 3 } },
      { label: "Descansar no sofá", time: 1, effects: { energy: 10, exercise: -2 } }
    ]
  },
  {
    id: "intro6", category: "celular", tag: "Noite", period: "evening", phase: "intro",
    text: "À noite, o celular não para de notificar. Um grupo da escola, mensagens de amigos e vídeos curtos disputam sua atenção.",
    options: [
      { label: "Passar 1h nas redes sociais para relaxar", time: 1, effects: { mental: 3, stress: -2, sleep: -3 }, socialMedia: true },
      { label: "Responder só o essencial e desligar o celular", time: 0.5, effects: { mental: 2, stress: -1 } },
      { label: "Ficar rolando o feed por 2h sem perceber o tempo passar", time: 2, effects: { stress: 4, sleep: -6, mental: -3 }, socialMedia: true }
    ]
  },
  {
    id: "intro7", category: "família", tag: "Noite", period: "evening", phase: "intro",
    text: "No jantar, sua família pergunta como foi seu dia e parece querer conversar um pouco mais.",
    options: [
      { label: "Conversar com atenção por 30min", time: 0.5, effects: { mental: 6, family: 8, stress: -4 }, familyContact: true },
      { label: "Responder rápido e ir cuidar de outras coisas", time: 0, effects: { family: -3 } },
      { label: "Contar tudo com calma, mesmo demorando mais", time: 1, effects: { mental: 8, family: 10, stress: -6 }, familyContact: true }
    ]
  },
  {
    id: "intro8", category: "lazer", tag: "Noite", period: "evening", phase: "intro",
    text: "Antes de dormir, você percebe que não teve nenhum momento só seu no dia inteiro.",
    options: [
      { label: "Jogar ou ler algo que gosta por 1h", time: 1, effects: { mental: 7, stress: -6, sleep: -2 } },
      { label: "Ir direto dormir, sem tempo livre hoje", time: 0, effects: { sleep: 3, mental: -2 } },
      { label: "Fazer algo relaxante rápido, tipo desenhar ou ouvir música, por 20min", time: 0.5, effects: { mental: 4, stress: -3 } }
    ]
  },
  {
    id: "intro9", category: "estudos", tag: "Manhã", period: "morning", phase: "intro",
    text: "Na aula de hoje, o professor passa um trabalho em grupo com prazo apertado.",
    options: [
      { label: "Se oferecer para organizar o grupo", time: 1, effects: { study: 6, social: 4, stress: 5 } },
      { label: "Fazer só a sua parte, sem se envolver demais", time: 0.5, effects: { study: 3 } },
      { label: "Deixar para pensar nisso depois", time: 0, effects: { stress: 3, study: -2 } }
    ]
  },
  {
    id: "intro10", category: "imprevistos", tag: "Tarde", period: "afternoon", phase: "intro",
    text: "Começa a chover forte bem na hora em que você sairia para resolver umas coisas.",
    options: [
      { label: "Esperar a chuva passar e aproveitar para estudar", time: 1, effects: { study: 6, energy: -4 } },
      { label: "Ir mesmo assim, se molhando um pouco", time: 0.5, effects: { health: -3, stress: 2 } },
      { label: "Aproveitar para descansar em casa", time: 1, effects: { energy: 8, mental: 3 } }
    ]
  },

  // ---------- FASE CORE (dias 3-4): conflitos entre estudos, descanso, exercício, social ----------
  {
    id: "core1", category: "estudos", tag: "Tarde", period: "afternoon", phase: "core",
    text: "Você chegou em casa às 18h30. Amanhã tem uma prova importante. Está cansado e recebeu uma mensagem de Alex dizendo que precisa conversar.",
    options: [
      { label: "Estudar por 2h30 sem parar", time: 2.5, effects: { study: 12, energy: -20, stress: 8, social: -5, sleep: -5 } },
      { label: "Conversar com Alex por 1h e estudar 1h30", time: 2.5, effects: { study: 8, social: 8, mental: 5, alex: 8, energy: -15, sleep: -3 } },
      { label: "Treinar 1h, falar com Alex por 30min e estudar 1h", time: 2.5, effects: { study: 5, exercise: 8, mental: 6, social: 5, alex: 5, energy: -20 } },
      { label: "Dormir mais cedo hoje e revisar de manhã", time: 0.5, effects: { sleep: 12, energy: 18, mental: 6, study: 1, social: -4 } }
    ]
  },
  {
    id: "core2", category: "cansaço", tag: "Manhã", period: "morning", phase: "core",
    text: "Você acorda ainda cansado do dia anterior e tem aula cedo, treino à tarde e uma promessa de estudar à noite.",
    options: [
      { label: "Levantar e seguir o plano do dia normalmente", time: 0, effects: { energy: -6, stress: 4 } },
      { label: "Cortar o treino de hoje para descansar mais", time: 0, effects: { exercise: -6, energy: 8, mental: 2 } },
      { label: "Reduzir o tempo de estudo à noite para compensar", time: 0, effects: { study: -4, energy: 4, mental: 3 } }
    ]
  },
  {
    id: "core3", category: "exercício", tag: "Tarde", period: "afternoon", phase: "core",
    text: "Seu treino está marcado, mas você também prometeu ajudar Júlia com um trabalho da escola no mesmo horário.",
    options: [
      { label: "Ir treinar e avisar Júlia que ajuda depois", time: 1, effects: { exercise: 10, health: 5, julia: -5, energy: -14 } },
      { label: "Cancelar o treino e ajudar Júlia", time: 1.5, effects: { julia: 10, social: 6, exercise: -6, mental: 4 } },
      { label: "Fazer um treino mais curto e depois ajudar", time: 2, effects: { exercise: 5, julia: 6, energy: -16, social: 3 } }
    ]
  },
  {
    id: "core4", category: "redes sociais", tag: "Noite", period: "evening", phase: "core",
    text: "Um vídeo viral está sendo comentado por todo mundo e você sente que vai ficar de fora da conversa se não acompanhar agora.",
    options: [
      { label: "Passar a noite acompanhando tudo nas redes", time: 2, effects: { social: 4, sleep: -8, stress: 3, mental: -2 }, socialMedia: true },
      { label: "Ver rapidamente por 20min e desligar", time: 0.5, effects: { social: 2, mental: 1 } },
      { label: "Ignorar hoje e focar em outra coisa", time: 0, effects: { stress: 2, mental: 2 } }
    ]
  },
  {
    id: "core5", category: "família", tag: "Manhã", period: "morning", phase: "core",
    text: "Sua família pede ajuda com uma tarefa em casa logo de manhã, mas você já tinha planejado esse tempo para outra coisa.",
    options: [
      { label: "Ajudar mesmo perdendo parte do seu tempo livre", time: 1, effects: { family: 10, mental: 3, energy: -6 }, familyContact: true },
      { label: "Ajudar rapidamente e sair correndo depois", time: 0.5, effects: { family: 4 }, familyContact: true },
      { label: "Dizer que não pode agora e resolver mais tarde", time: 0, effects: { family: -6, stress: 2 } }
    ]
  },
  {
    id: "core6", category: "estresse", tag: "Tarde", period: "afternoon", phase: "core",
    text: "Entre provas, treino e vida social, você sente que a cabeça está cheia demais para pensar direito.",
    options: [
      { label: "Parar tudo por 30min só para respirar e organizar os pensamentos", time: 0.5, effects: { stress: -10, mental: 6 } },
      { label: "Ignorar a sensação e continuar no ritmo forte", time: 0, effects: { stress: 8, study: 4, energy: -6 } },
      { label: "Conversar com um amigo sobre como está se sentindo", time: 1, effects: { stress: -8, mental: 7, social: 5 } }
    ]
  },
  {
    id: "core7", category: "escola", tag: "Manhã", period: "morning", phase: "core",
    text: "Você recebeu a nota de um trabalho e ficou abaixo do que esperava, mesmo tendo se esforçado.",
    options: [
      { label: "Pedir feedback ao professor para entender o que faltou", time: 0.5, effects: { study: 6, mental: 2, stress: 2 } },
      { label: "Ficar remoendo o resultado o dia inteiro", time: 0, effects: { mental: -6, stress: 6 } },
      { label: "Deixar para trás e focar na próxima prova", time: 0, effects: { mental: 2, study: 2 } }
    ]
  },
  {
    id: "core8", category: "lazer", tag: "Noite", period: "evening", phase: "core",
    text: "Depois de um dia puxado, uma série nova está te chamando bastante atenção.",
    options: [
      { label: "Assistir 2 episódios seguidos, mesmo ficando tarde", time: 2, effects: { mental: 5, sleep: -10, stress: -3 } },
      { label: "Assistir só 1 episódio e dormir no horário", time: 1, effects: { mental: 4, sleep: -2, stress: -3 } },
      { label: "Deixar para outro dia e ir descansar", time: 0, effects: { sleep: 4, mental: -1 } }
    ]
  },
  {
    id: "core9", category: "organização", tag: "Manhã", period: "morning", phase: "core",
    text: "Você percebe que a semana está desorganizada: compromissos esquecidos e tarefas acumuladas.",
    options: [
      { label: "Parar 45min para reorganizar tudo", time: 0.75, effects: { stress: -8, mental: 5, study: 3 } },
      { label: "Ir remendando aos poucos, sem parar para organizar", time: 0, effects: { stress: 5, study: -2 } },
      { label: "Pedir ajuda da família para se organizar", time: 0.5, effects: { family: 5, stress: -5 }, familyContact: true }
    ]
  },
  {
    id: "core10", category: "amizades", tag: "Tarde", period: "afternoon", phase: "core",
    text: "Alex está mais quieto que o normal nos últimos dias e você percebe que algo pode estar errado.",
    options: [
      { label: "Chamar Alex para conversar com calma", time: 1, effects: { alex: 12, mental: 4, social: 4, energy: -4 } },
      { label: "Mandar uma mensagem perguntando se está tudo bem", time: 0.5, effects: { alex: 6, social: 2 } },
      { label: "Deixar para depois, você também está sobrecarregado", time: 0, effects: { alex: -6 } }
    ]
  },
  {
    id: "core11", category: "alimentação", tag: "Tarde", period: "afternoon", phase: "core",
    text: "Entre a aula e o treino não sobra quase tempo para comer direito.",
    options: [
      { label: "Comer algo rápido e pouco saudável mesmo", time: 0.25, effects: { health: -6, energy: 8 } },
      { label: "Pular a refeição para não atrasar o treino", time: 0, effects: { health: -10, energy: -8, stress: 4 } },
      { label: "Voltar em casa para comer direito e perder o treino", time: 1, effects: { health: 10, exercise: -8, energy: 6 } }
    ]
  },
  {
    id: "core12", category: "família", tag: "Noite", period: "evening", phase: "core",
    text: "No jantar, seu celular vibra sem parar com mensagens de Alex sobre algo sério, mas sua família pediu para guardarem os celulares à mesa.",
    options: [
      { label: "Responder Alex discretamente por baixo da mesa", time: 0, effects: { alex: 8, family: -9, mental: 1 } },
      { label: "Ignorar o celular e focar na família por enquanto", time: 0.5, effects: { family: 10, alex: -8, mental: 4 }, familyContact: true },
      { label: "Pedir licença e sair da mesa para ligar para Alex", time: 0.5, effects: { alex: 10, family: -11, mental: -2 } }
    ]
  },
  {
    id: "core13", category: "estudos", tag: "Manhã", period: "morning", phase: "core",
    text: "Uma avaliação física que conta nota caiu no mesmo dia de uma prova importante de matemática.",
    options: [
      { label: "Focar tudo em matemática e arriscar a nota de educação física", time: 1.5, effects: { study: 10, exercise: -6, energy: -10 } },
      { label: "Dividir o tempo entre as duas coisas", time: 2, effects: { study: 5, exercise: 5, energy: -16, stress: 4 } },
      { label: "Priorizar a educação física e revisar matemática por cima", time: 1.5, effects: { exercise: 10, study: 3, health: 4, energy: -14 } }
    ]
  },
  {
    id: "core14", category: "redes sociais", tag: "Noite", period: "evening", phase: "core",
    text: "O grupo combina uma call para jogar à noite, o que significa dormir mais tarde de novo.",
    options: [
      { label: "Entrar na call por 1h30", time: 1.5, effects: { social: 10, alex: 6, julia: 6, sleep: -6, mental: 4 } },
      { label: "Entrar só por 30 minutos", time: 0.5, effects: { social: 5, sleep: -2 } },
      { label: "Recusar e dormir cedo hoje", time: 0, effects: { sleep: 6, social: -6, alex: -3, julia: -3 } }
    ]
  },

  // ---------- FASE LATE (dias 5-6): consequências acumuladas e imprevistos ----------
  {
    id: "late1", category: "imprevistos", tag: "Manhã", period: "morning", phase: "late",
    text: "Um compromisso inesperado surge de última hora e bagunça o plano que você tinha para o dia.",
    options: [
      { label: "Reorganizar tudo na hora, cortando tempo de descanso", time: 0, effects: { stress: 8, energy: -8, study: 3 } },
      { label: "Cancelar algo menos importante para dar conta", time: 0, effects: { stress: 3, social: -4 } },
      { label: "Aceitar que nem tudo vai sair como planejado hoje", time: 0, effects: { stress: -3, mental: 2, study: -3 } }
    ]
  },
  {
    id: "late2", category: "cansaço", tag: "Tarde", period: "afternoon", phase: "late",
    text: "O cansaço acumulado da semana está pesando. Seu corpo pede uma pausa, mas ainda há muita coisa pendente.",
    options: [
      { label: "Tirar uma soneca de 30min antes de continuar", time: 0.5, effects: { energy: 12, mental: 3, study: -1 } },
      { label: "Tomar um café forte e seguir em frente", time: 0, effects: { energy: 6, stress: 4, sleep: -1 } },
      { label: "Ignorar o cansaço e continuar no mesmo ritmo", time: 0, effects: { energy: -10, stress: 6 } }
    ]
  },
  {
    id: "late3", category: "família", tag: "Noite", period: "evening", phase: "late",
    text: "Sua família nota que você anda mais fechado essa semana e pergunta se está tudo bem.",
    options: [
      { label: "Abrir o jogo sobre como a semana está sendo", time: 1, effects: { family: 12, mental: 8, stress: -8 }, familyContact: true },
      { label: "Dizer que está tudo bem, só cansado", time: 0.25, effects: { family: 2 }, familyContact: true },
      { label: "Evitar o assunto e mudar de conversa", time: 0, effects: { family: -5, mental: -2 } }
    ]
  },
  {
    id: "late4", category: "estudos", tag: "Tarde", period: "afternoon", phase: "late",
    text: "Faltam poucos dias para uma avaliação importante e o conteúdo acumulado é bastante.",
    options: [
      { label: "Fazer uma maratona de estudos de 3h", time: 3, effects: { study: 14, energy: -22, stress: 10, sleep: -3, social: -4 } },
      { label: "Estudar em blocos de 1h com pausas curtas", time: 2, effects: { study: 10, energy: -10, stress: 3 } },
      { label: "Estudar só o essencial por 1h e confiar no que já sabe", time: 1, effects: { study: 5, stress: -2, energy: -4 } }
    ]
  },
  {
    id: "late5", category: "amizades", tag: "Manhã", period: "morning", phase: "late",
    text: "Júlia convida você para um evento no fim de semana que parece divertido, mas coincide com outros planos.",
    options: [
      { label: "Confirmar presença e ajustar o resto da semana depois", time: 0, effects: { social: 8, julia: 8, mental: 4, stress: 3 } },
      { label: "Recusar para focar no que já está planejado", time: 0, effects: { julia: -5, stress: -2 } },
      { label: "Combinar de ir só uma parte do evento", time: 0, effects: { social: 4, julia: 4 } }
    ]
  },
  {
    id: "late6", category: "redes sociais", tag: "Noite", period: "evening", phase: "late",
    text: "Você percebe que tem passado mais tempo do que gostaria no celular à noite, mesmo cansado.",
    options: [
      { label: "Deixar o celular longe da cama hoje", time: 0, effects: { sleep: 6, stress: -3 } },
      { label: "Prometer usar só mais um pouco, 'só hoje'", time: 1, effects: { sleep: -6, mental: -2 }, socialMedia: true },
      { label: "Definir um tempo limite e cumprir", time: 0.5, effects: { sleep: 2, stress: -2 }, socialMedia: true }
    ]
  },
  {
    id: "late7", category: "exercício", tag: "Manhã", period: "morning", phase: "late",
    text: "Você já treinou bastante essa semana e sente uma leve dor no corpo, mas também não quer perder o ritmo.",
    options: [
      { label: "Treinar normalmente, ignorando o desconforto", time: 1, effects: { exercise: 8, health: -4, energy: -14 } },
      { label: "Fazer um treino mais leve hoje", time: 0.5, effects: { exercise: 4, health: 3, energy: -6 } },
      { label: "Descansar do treino por hoje", time: 0, effects: { exercise: -3, health: 4, energy: 6 } }
    ]
  },
  {
    id: "late8", category: "estresse", tag: "Tarde", period: "afternoon", phase: "late",
    text: "As coisas se acumularam e você sente que precisa reorganizar como está usando o seu tempo.",
    options: [
      { label: "Reservar um tempo só para descanso ativo, como um hobby", time: 1, effects: { stress: -10, mental: 8, energy: 4 } },
      { label: "Aceitar ajuda de alguém próximo para dividir tarefas", time: 0.5, effects: { stress: -6, social: 4 } },
      { label: "Seguir tocando tudo sozinho, do jeito que der", time: 0, effects: { stress: 6, energy: -6 } }
    ]
  },
  {
    id: "late9", category: "família", tag: "Noite", period: "evening", phase: "late",
    text: "Um imprevisto na família pede sua atenção justo na hora em que você tinha reservado para descansar.",
    options: [
      { label: "Largar tudo e ajudar de verdade", time: 1.5, effects: { family: 14, mental: 4, energy: -12, stress: 4 }, familyContact: true },
      { label: "Ajudar rapidamente e voltar ao seu plano", time: 0.5, effects: { family: 6, energy: -4 }, familyContact: true },
      { label: "Avisar que agora não pode", time: 0, effects: { family: -10, stress: 4 } }
    ]
  },
  {
    id: "late10", category: "exercício", tag: "Tarde", period: "afternoon", phase: "late",
    text: "Uma competição informal está rolando com a galera, mas a semana já pesa no seu corpo.",
    options: [
      { label: "Entrar com tudo na competição", time: 1.5, effects: { exercise: 12, social: 6, energy: -20, health: 4 } },
      { label: "Participar mais tranquilo, só para socializar", time: 1, effects: { exercise: 4, social: 8, energy: -8 } },
      { label: "Assistir de fora e descansar", time: 0, effects: { energy: 8, social: -4, exercise: -3 } }
    ]
  },
  {
    id: "late11", category: "organização", tag: "Manhã", period: "morning", phase: "late",
    text: "Você percebe que passou a semana toda reagindo aos imprevistos, sem conseguir seguir nenhum plano de verdade.",
    options: [
      { label: "Parar tudo e replanejar o resto da semana", time: 1, effects: { stress: -12, mental: 6, study: -3 } },
      { label: "Aceitar o caos e seguir sem planejar", time: 0, effects: { stress: 6, energy: -4 } },
      { label: "Pedir ajuda de alguém de confiança para reorganizar junto", time: 0.5, effects: { stress: -8, social: 4, family: 4 } }
    ]
  },

  // ---------- FASE FINAL (dia 7): decisões de encerramento ----------
  {
    id: "final1", category: "estudos", tag: "Manhã", period: "morning", phase: "final",
    text: "É o último dia antes de uma avaliação decisiva. Como você decide fechar a preparação?",
    options: [
      { label: "Revisão intensa de última hora", time: 2, effects: { study: 10, energy: -16, stress: 8, sleep: -2 } },
      { label: "Revisão leve e foco em descansar bem", time: 1, effects: { study: 5, energy: -4, stress: -3, sleep: 2 } },
      { label: "Confiar na preparação da semana e não estudar mais hoje", time: 0, effects: { stress: -4, mental: 3 } }
    ]
  },
  {
    id: "final2", category: "amizades", tag: "Tarde", period: "afternoon", phase: "final",
    text: "No fechamento da semana, Alex e Júlia sugerem se encontrar para relaxar juntos antes do fim de semana continuar.",
    options: [
      { label: "Ir e aproveitar o tempo com os dois", time: 1.5, effects: { social: 10, alex: 8, julia: 8, mental: 6, energy: -6 } },
      { label: "Ir só por um pouco e voltar cedo para casa", time: 0.5, effects: { social: 5, alex: 4, julia: 4 } },
      { label: "Ficar em casa recuperando energia para a semana que vem", time: 0, effects: { energy: 10, mental: 2, alex: -3, julia: -3 } }
    ]
  },
  {
    id: "final3", category: "família", tag: "Noite", period: "evening", phase: "final",
    text: "No fim da semana, sua família propõe um momento juntos para fechar os últimos dias.",
    options: [
      { label: "Participar de corpo e mente presentes", time: 1, effects: { family: 12, mental: 6, stress: -6 }, familyContact: true },
      { label: "Participar, mas meio distraído pensando na semana", time: 0.5, effects: { family: 4, mental: 1 }, familyContact: true },
      { label: "Passar para aproveitar o tempo sozinho", time: 0, effects: { family: -4, mental: 2 } }
    ]
  },
  {
    id: "final4", category: "organização", tag: "Tarde", period: "afternoon", phase: "final",
    text: "Olhando para trás, você pensa em como foi a semana e no que gostaria de levar para a próxima.",
    options: [
      { label: "Anotar o que funcionou e o que quer mudar", time: 0.5, effects: { mental: 6, stress: -4, study: 2 } },
      { label: "Só seguir em frente sem parar para refletir", time: 0, effects: { stress: 2 } },
      { label: "Conversar com alguém próximo sobre a semana", time: 0.5, effects: { mental: 5, social: 4 } }
    ]
  },
  {
    id: "final5", category: "imprevistos", tag: "Manhã", period: "morning", phase: "final",
    text: "Surge um convite para um evento que só vai acontecer essa semana, mas que conflita com o plano que você já vinha seguindo para fechar os dias.",
    options: [
      { label: "Ir ao evento e abrir mão do que tinha planejado", time: 2, effects: { social: 12, mental: 4, study: -6, energy: -8 } },
      { label: "Recusar e manter o plano original", time: 0, effects: { study: 4, social: -6 } },
      { label: "Negociar uma versão mais curta do evento", time: 1, effects: { social: 6, study: 1, energy: -4 } }
    ]
  },

  // ---------- EVENTOS CONDICIONAIS (dependem do estado) ----------
  {
    id: "cond_sono_baixo", category: "sono", tag: "Estado: sono baixo", period: "any", phase: "any", conditional: "sleepLow",
    text: "Você passou a manhã com muito sono e está tendo dificuldade para se concentrar em qualquer coisa.",
    options: [
      { label: "Tirar uma soneca curta para recuperar um pouco", time: 0.5, effects: { sleep: 8, energy: 10, study: -2 } },
      { label: "Forçar a concentração mesmo cansado", time: 1, effects: { study: 4, energy: -10, stress: 6 } },
      { label: "Priorizar dormir mais cedo hoje à noite", time: 0, effects: { mental: 3, stress: -3 } }
    ]
  },
  {
    id: "cond_estresse_alto", category: "estresse", tag: "Estado: estresse alto", period: "any", phase: "any", conditional: "stressHigh",
    text: "Você percebe que está sobrecarregado e precisa decidir como reorganizar o dia antes que tudo piore.",
    options: [
      { label: "Cancelar um compromisso não essencial para respirar", time: 0, effects: { stress: -14, mental: 6, social: -3 } },
      { label: "Buscar apoio de alguém próximo", time: 0.5, effects: { stress: -10, mental: 6, social: 4 } },
      { label: "Continuar tocando tudo, mesmo sobrecarregado", time: 0, effects: { stress: 8, energy: -10, mental: -5 } }
    ]
  },
  {
    id: "cond_social_baixo", category: "amizades", tag: "Estado: vida social baixa", period: "any", phase: "any", conditional: "socialLow",
    text: "Uma oportunidade especial de socialização aparece: um convite espontâneo para sair com o pessoal.",
    options: [
      { label: "Aceitar e aproveitar para reconectar", time: 1.5, effects: { social: 14, mental: 6, alex: 5, julia: 5, energy: -6 } },
      { label: "Aceitar, mas por pouco tempo", time: 0.5, effects: { social: 8, mental: 3 } },
      { label: "Recusar, ainda prefere ficar sozinho por agora", time: 0, effects: { social: -2, mental: -2 } }
    ]
  },
  {
    id: "cond_energia_baixa", category: "cansaço", tag: "Estado: energia baixa", period: "any", phase: "any", conditional: "energyLow",
    text: "Sua energia está no limite. Qualquer esforço extra hoje parece pesado demais.",
    options: [
      { label: "Cancelar atividades não essenciais e descansar", time: 0, effects: { energy: 14, stress: -6, study: -3 } },
      { label: "Beber água, comer algo leve e seguir com cautela", time: 0.5, effects: { energy: 8, health: 2 } },
      { label: "Ignorar o cansaço e seguir o plano original", time: 0, effects: { energy: -12, stress: 8, health: -3 } }
    ]
  },
  {
    id: "cond_estudos_baixo", category: "estudos", tag: "Estado: estudos atrasados", period: "any", phase: "any", conditional: "studyLow",
    text: "Você percebe que está bem atrasado no conteúdo e uma prova está se aproximando.",
    options: [
      { label: "Fazer uma sessão de estudo intensiva mesmo cansado", time: 2, effects: { study: 14, energy: -16, stress: 6 } },
      { label: "Pedir ajuda de um colega para revisar junto", time: 1, effects: { study: 8, social: 4, stress: -2 } },
      { label: "Aceitar o atraso e focar só no que ainda dá tempo", time: 0.5, effects: { study: 3, stress: -4 } }
    ]
  }
];

const EDUCATIONAL_TIPS = [
  "O descanso adequado pode ajudar na concentração e na recuperação do corpo.",
  "Manter atividade física regular pode beneficiar a saúde física e mental.",
  "Dormir de forma irregular tende a pesar mais do que dormir pouco uma única vez.",
  "Relações próximas funcionam melhor quando cultivadas aos poucos, não só em momentos de crise.",
  "Estresse alto por muito tempo pode reduzir o rendimento em várias áreas da vida, não só nos estudos.",
  "Pequenas pausas ao longo do dia podem render mais do que horas seguidas sem parar.",
  "Equilíbrio não significa fazer tudo perfeitamente — significa não sacrificar sempre a mesma coisa.",
  "Conversar sobre como você está se sentindo pode aliviar mais estresse do que parece."
];

/* ================= ESTADO ================= */

function freshState() {
  return {
    day: 1,
    periodIndex: 0, // 0 manhã, 1 tarde, 2 noite
    attrs: { health: 60, mental: 60, sleep: 55, study: 55, exercise: 45, social: 65 },
    startAttrs: null,
    energy: 65,
    stress: 30,
    rel: { alex: 60, julia: 55, family: 65 },
    freeTimeToday: 4,
    dailyTimeBase: 4,
    usedEventIds: new Set(),
    usedConditional: {},
    objectives: [],
    sleepHistory: [],
    stressHistory: [],
    studiedDays: new Set(),
    exerciseCount: 0,
    familyContactCount: 0,
    socialMediaCount: 0,
    minEnergyEver: 65,
    consistencyRunning: 100,
    dayDeltas: [],
    dayLog: [],
    tipShownCount: 0
  };
}

let state = freshState();

/* ================= LÓGICA ================= */

function clamp(v, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(avg(arr.map(v => (v - m) ** 2)));
}

// Ajusta a magnitude dos efeitos conforme o estado atual (energia baixa / estresse alto)
function modifyEffects(effects) {
  const out = { ...effects };
  const lowEnergy = state.energy < 30;
  const highStress = state.stress > 70;
  ["study", "exercise"].forEach(k => {
    if (out[k] && out[k] > 0 && lowEnergy) out[k] = Math.round(out[k] * 0.7);
  });
  if (highStress) {
    ["mental", "sleep"].forEach(k => {
      if (out[k] && out[k] > 0) out[k] = Math.round(out[k] * 0.85);
    });
    if (out.stress && out.stress > 0) out.stress = Math.round(out.stress * 1.1);
  }
  return out;
}

function applyEffects(rawEffects) {
  const effects = modifyEffects(rawEffects);
  const deltas = {};
  ATTRS.forEach(k => {
    if (effects[k]) {
      let eff = effects[k];
      // retorno decrescente: quanto mais perto de 100 o atributo já está,
      // mais fraco é o próximo ganho — evita "resolver" um único atributo
      // e obriga a distribuir esforço entre os seis.
      if (eff > 0 && state.attrs[k] > 70) {
        const excess = state.attrs[k] - 70;
        const dampen = clamp(1 - excess / 40, 0.3, 1);
        eff = Math.round(eff * dampen);
      }
      const before = state.attrs[k];
      state.attrs[k] = clamp(state.attrs[k] + eff);
      deltas[k] = state.attrs[k] - before;
    }
  });
  if (effects.energy) {
    const before = state.energy;
    state.energy = clamp(state.energy + effects.energy);
    deltas.energy = state.energy - before;
  }
  if (effects.stress) {
    const before = state.stress;
    state.stress = clamp(state.stress + effects.stress);
    deltas.stress = state.stress - before;
  }
  ["alex", "julia", "family"].forEach(k => {
    if (effects[k]) {
      const before = state.rel[k];
      state.rel[k] = clamp(state.rel[k] + effects[k]);
      deltas[k] = state.rel[k] - before;
    }
  });
  state.minEnergyEver = Math.min(state.minEnergyEver, state.energy);
  return deltas;
}

function currentPhase() {
  if (state.day <= 2) return "intro";
  if (state.day <= 4) return "core";
  if (state.day <= 6) return "late";
  return "final";
}

function currentPeriodName() {
  return ["morning", "afternoon", "evening"][state.periodIndex];
}

function checkConditional() {
  if (state.attrs.sleep < 35 && !state.usedConditional.sleepLow && Math.random() < 0.7) {
    return EVENTS.find(e => e.conditional === "sleepLow");
  }
  if (state.stress > 80 && !state.usedConditional.stressHigh && Math.random() < 0.7) {
    return EVENTS.find(e => e.conditional === "stressHigh");
  }
  if (state.attrs.social < 35 && !state.usedConditional.socialLow && Math.random() < 0.6) {
    return EVENTS.find(e => e.conditional === "socialLow");
  }
  if (state.energy < 20 && !state.usedConditional.energyLow && Math.random() < 0.7) {
    return EVENTS.find(e => e.conditional === "energyLow");
  }
  if (state.attrs.study < 35 && !state.usedConditional.studyLow && Math.random() < 0.6) {
    return EVENTS.find(e => e.conditional === "studyLow");
  }
  return null;
}

function pickEvent() {
  const conditional = checkConditional();
  if (conditional) {
    state.usedConditional[conditional.conditional] = true;
    return conditional;
  }
  const phase = currentPhase();
  const period = currentPeriodName();
  let pool = EVENTS.filter(e =>
    !e.conditional &&
    !state.usedEventIds.has(e.id) &&
    (e.phase === phase || e.phase === "any") &&
    (e.period === period || e.period === "any")
  );
  if (pool.length === 0) {
    // fallback: qualquer fase, mesmo período, não usado
    pool = EVENTS.filter(e => !e.conditional && !state.usedEventIds.has(e.id) && (e.period === period || e.period === "any"));
  }
  if (pool.length === 0) {
    // último recurso: qualquer evento não usado
    pool = EVENTS.filter(e => !e.conditional && !state.usedEventIds.has(e.id));
  }
  if (pool.length === 0) {
    // reaproveita tudo se acabou (garante que o jogo nunca trave)
    state.usedEventIds.clear();
    pool = EVENTS.filter(e => !e.conditional);
  }
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  state.usedEventIds.add(chosen.id);
  return chosen;
}

function calcBalanceIndex() {
  const vals = ATTRS.map(k => state.attrs[k]);
  const sd = stdev(vals);
  return Math.round(clamp(100 - sd * 4.2, 0, 100));
}

function calcConsistency() {
  const sdSleep = stdev(state.sleepHistory);
  const sdStress = stdev(state.stressHistory);
  const sleepScore = clamp(100 - sdSleep * 28, 0, 100);
  const stressScore = clamp(100 - sdStress * 2.8, 0, 100);
  return Math.round(sleepScore * 0.6 + stressScore * 0.4);
}

function evaluateObjectives() {
  const snapshot = {
    sleepHistory: state.sleepHistory,
    studiedDays: state.studiedDays,
    exerciseCount: state.exerciseCount,
    attrsHistory: { stress: state.stress },
    rel: state.rel,
    attrs: state.attrs,
    minEnergyEver: state.minEnergyEver,
    familyContactCount: state.familyContactCount,
    socialMediaCount: state.socialMediaCount
  };
  return state.objectives.map(o => ({ ...o, done: o.check(snapshot) }));
}

// Penalidade contínua por atributo: quanto mais abaixo de 55 (mediana), mais pesa,
// com um agravamento adicional forte abaixo de 20 (crítico) e de 40 (baixo).
function penaltyForAttr(v) {
  if (v < 20) return 42 + (20 - v) * 1.3;   // crítico: penalidade significativa e crescente
  if (v < 40) return 16 + (40 - v) * 1.0;   // baixo: já custa caro
  if (v < 55) return (55 - v) * 0.55;       // mediano-baixo: custo leve, mas perceptível
  return 0;
}

function calcFinalScore() {
  const weights = { health: 0.20, mental: 0.20, sleep: 0.20, study: 0.15, exercise: 0.10, social: 0.15 };
  let weightedAvg = 0;
  ATTRS.forEach(k => weightedAvg += state.attrs[k] * weights[k]);
  const basePoints = weightedAvg * 7; // max 700

  const balanceIndex = calcBalanceIndex();
  const consistency = calcConsistency();
  const objectivesDone = evaluateObjectives();
  const doneCount = objectivesDone.filter(o => o.done).length;

  const balanceBonus = (balanceIndex / 100) * 150;
  const consistencyBonus = (consistency / 100) * 100;
  const objectivesBonus = (doneCount / 3) * 50;

  let penalty = 0;
  ATTRS.forEach(k => { penalty += penaltyForAttr(state.attrs[k]); });

  // Estresse alto no fim da semana também cobra um preço direto na nota,
  // já que representa o acúmulo de decisões, não só um atributo isolado.
  if (state.stress > 70) penalty += (state.stress - 70) * 0.8;

  const total = clamp(Math.round(basePoints + balanceBonus + consistencyBonus + objectivesBonus - penalty), 0, 1000);

  return { total, balanceIndex, consistency, objectivesDone, doneCount, basePoints, balanceBonus, consistencyBonus, objectivesBonus, penalty };
}

function classify(score) {
  if (score >= 900) return { emoji: "🏆", label: "Mestre do Equilíbrio" };
  if (score >= 800) return { emoji: "🥇", label: "Vida Muito Equilibrada" };
  if (score >= 700) return { emoji: "🥈", label: "Boa Qualidade de Vida" };
  if (score >= 600) return { emoji: "🥉", label: "Precisa de Ajustes" };
  if (score >= 400) return { emoji: "⚠️", label: "Vida Desequilibrada" };
  return { emoji: "🔴", label: "Hora de Reorganizar" };
}

function buildResultMessage(result) {
  const { total } = result;
  const sorted = ATTRS.slice().sort((a, b) => state.attrs[b] - state.attrs[a]);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const bestLabel = ATTR_META[best].label.toLowerCase();
  const worstLabel = ATTR_META[worst].label.toLowerCase();

  if (state.attrs[best] - state.attrs[worst] > 30) {
    return `Você se destacou em ${bestLabel}, mas isso custou caro para ${worstLabel}. Seu esforço foi real, mas a rotina pediu mais equilíbrio entre as áreas da sua vida.`;
  }
  if (total >= 800) {
    return "Você manteve uma boa relação entre saúde, descanso, estudos e vida social. Seu maior mérito foi manter consistência durante toda a semana.";
  }
  if (total >= 600) {
    return "Sua semana teve altos e baixos, mas no geral você conseguiu sustentar um ritmo razoável. Pequenos ajustes podem render um equilíbrio bem melhor.";
  }
  return "A semana foi difícil de administrar e alguns aspectos da sua vida ficaram para trás. Isso não é uma sentença — é um ponto de partida para reorganizar as prioridades.";
}

/* ================= INTERFACE ================= */

const screens = {};
["menu", "intro", "objectives", "game", "sleep", "daysummary", "result"].forEach(name => {
  screens[name] = document.getElementById("screen-" + name);
});

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
  window.scrollTo(0, 0);
}

function renderObjectivesScreen() {
  const pool = OBJECTIVES_POOL.slice();
  // sorteia 3 objetivos distintos
  const picked = [];
  while (picked.length < 3 && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  state.objectives = picked;
  const list = document.getElementById("objectives-list");
  list.innerHTML = "";
  picked.forEach(o => {
    const div = document.createElement("div");
    div.className = "objective-item";
    div.innerHTML = `<span class="obj-check">🎯</span><span>${o.text}</span>`;
    list.appendChild(div);
  });
}

function renderHUD() {
  document.getElementById("hud-day-label").textContent = `Dia ${state.day} — ${DAY_NAMES[state.day - 1]}`;
  document.getElementById("hud-period-label").textContent = PERIOD_NAMES[currentPeriodName()];
  const h = Math.floor(state.freeTimeToday);
  const m = Math.round((state.freeTimeToday - h) * 60);
  document.getElementById("hud-time-value").textContent = `${h}h${m.toString().padStart(2, "0")}`;
  screens.game.style.background = PERIOD_TINTS[currentPeriodName()];

  if (!state.prevBarValues) state.prevBarValues = {};

  const bars = document.getElementById("hud-bars");
  bars.innerHTML = "";
  ATTRS.forEach(k => bars.appendChild(makeBar(k, ATTR_META[k], state.attrs[k])));

  const vitals = document.getElementById("hud-vitals");
  vitals.innerHTML = "";
  vitals.appendChild(makeBar("energy", VITAL_META.energy, state.energy));
  vitals.appendChild(makeBar("stress", VITAL_META.stress, state.stress));
}

function makeBar(key, meta, value) {
  const wrap = document.createElement("div");
  wrap.className = "hud-bar";
  const c = barColors(meta.hue, value);
  wrap.innerHTML = `
    <span class="hud-bar-label">
      <span class="hbl-name"><span class="hud-bar-icon" style="background:${c.icon}">${meta.icon}</span>${meta.short}</span>
      <span class="hbl-value" style="color:${c.text}">${Math.round(value)}</span>
    </span>
    <span class="hud-bar-track" style="background:${c.track}"><span class="hud-bar-fill" style="width:${value}%; background:${c.fill}"></span></span>
  `;
  const prev = state.prevBarValues[key];
  if (prev !== undefined && Math.round(prev) !== Math.round(value)) {
    wrap.classList.add("pulse");
    setTimeout(() => wrap.classList.remove("pulse"), 550);
  }
  state.prevBarValues[key] = value;
  return wrap;
}

const THINK_HINTS = {
  intro: ["Pense com calma antes de decidir…", "Leia a situação de novo, se precisar."],
  core: ["Essa escolha pode pesar mais do que parece…", "Não existe opção perfeita aqui — pense no que importa mais agora."],
  late: ["O cansaço da semana já está no ar. Decida com atenção.", "As escolhas acumuladas começam a cobrar um preço."],
  final: ["Últimas decisões da semana — elas fecham o resultado.", "Pense em como quer terminar essa semana."]
};

let currentEvent = null;

function renderEvent() {
  renderHUD();
  currentEvent = pickEvent();
  document.getElementById("event-tag").textContent = `${currentEvent.tag} · ${currentEvent.category}`;
  document.getElementById("event-text").textContent = currentEvent.text;
  const optsWrap = document.getElementById("event-options");
  optsWrap.innerHTML = "";
  const buttons = [];

  // Tempo é um recurso real: opções que custam mais do que o tempo livre
  // restante hoje ficam bloqueadas — não dá pra fazer tudo o dia inteiro.
  const EPS = 0.01;
  let feasibleOptions = currentEvent.options.filter(o => o.time <= state.freeTimeToday + EPS);
  if (feasibleOptions.length === 0) {
    // rede de segurança: nunca trava o jogo — libera a opção mais barata
    const cheapest = currentEvent.options.reduce((a, b) => (a.time <= b.time ? a : b));
    feasibleOptions = [cheapest];
  }

  currentEvent.options.forEach((opt, i) => {
    const locked = !feasibleOptions.includes(opt);
    const btn = document.createElement("button");
    btn.className = "option-btn disabled" + (locked ? " locked" : "");
    const h = Math.floor(opt.time);
    const m = Math.round((opt.time - h) * 60);
    const timeStr = opt.time > 0 ? `${h > 0 ? h + "h" : ""}${m > 0 ? m + "min" : ""}`.trim() || "0min" : "sem custo de tempo";
    const costLabel = locked ? `⏱ ${timeStr} · sem tempo livre hoje` : `⏱ ${timeStr}`;
    btn.innerHTML = `${opt.label}<span class="opt-cost">${costLabel}</span>`;
    if (!locked) btn.addEventListener("click", () => chooseOption(opt));
    optsWrap.appendChild(btn);
    if (!locked) buttons.push(btn);
  });
  document.getElementById("event-body").style.display = "";
  document.getElementById("event-outcome").style.display = "none";

  const hintPool = THINK_HINTS[currentPhase()] || THINK_HINTS.intro;
  const hintEl = document.getElementById("think-hint");
  hintEl.textContent = hintPool[Math.floor(Math.random() * hintPool.length)];
  hintEl.classList.remove("fade-out");
  hintEl.style.display = "";

  const pauseMs = 1300;
  setTimeout(() => {
    buttons.forEach(b => b.classList.remove("disabled"));
    hintEl.classList.add("fade-out");
    setTimeout(() => { hintEl.style.display = "none"; }, 400);
  }, pauseMs);
}

function chooseOption(opt) {
  const deltas = applyEffects(opt.effects);
  state.freeTimeToday = Math.max(0, state.freeTimeToday - opt.time);

  if (opt.effects.study && opt.effects.study > 0) state.studiedDays.add(state.day);
  if (opt.effects.exercise && opt.effects.exercise > 0) state.exerciseCount++;
  if (opt.familyContact) state.familyContactCount++;
  if (opt.socialMedia) state.socialMediaCount++;

  state.dayLog.push({ event: currentEvent.text, choice: opt.label, deltas });

  renderOutcome(opt, deltas);
}

function renderOutcome(opt, deltas) {
  document.getElementById("event-body").style.display = "none";
  const outcome = document.getElementById("event-outcome");

  document.getElementById("outcome-title").innerHTML = `Você escolheu: <strong>${opt.label}</strong>`;

  const chips = document.getElementById("outcome-chips");
  chips.innerHTML = "";
  const keys = Object.keys(deltas).filter(k => deltas[k] !== 0);
  if (keys.length === 0) {
    const span = document.createElement("span");
    span.className = "outcome-chip";
    span.textContent = "Sem mudanças perceptíveis agora";
    chips.appendChild(span);
  } else {
    keys.forEach(k => {
      const meta = metaFor(k);
      const val = deltas[k];
      const chip = document.createElement("span");
      chip.className = "outcome-chip" + (val < 0 ? " neg" : "");
      chip.textContent = `${meta.icon} ${val > 0 ? "+" : ""}${Math.round(val)} ${meta.short}`;
      chips.appendChild(chip);
    });
  }

  const tipEl = document.getElementById("outcome-tip");
  const tipText = opt.feedback || (state.tipShownCount % 2 === 0 ? EDUCATIONAL_TIPS[Math.floor(Math.random() * EDUCATIONAL_TIPS.length)] : null);
  if (tipText) {
    state.tipShownCount++;
    tipEl.textContent = "💡 " + tipText;
    tipEl.style.display = "";
  } else {
    tipEl.style.display = "none";
  }

  outcome.style.display = "block";
}

document.getElementById("btn-continue-event").addEventListener("click", () => {
  state.periodIndex++;
  if (state.periodIndex >= 3) {
    goToSleep();
  } else {
    renderEvent();
  }
});

/* ---------- sono ---------- */

function goToSleep() {
  const ctx = document.getElementById("sleep-context");
  const isWeekend = state.day >= 6;
  ctx.textContent = state.stress > 70
    ? "Você termina o dia esgotado e tenso. Quantas horas vai dormir?"
    : "É noite. Quantas horas você vai dormir hoje?";
  const options = document.getElementById("sleep-options");
  options.innerHTML = "";
  const choices = [
    { hours: 4, label: "4h", desc: "Pouco sono" },
    { hours: 6, label: "6h", desc: "Sono curto" },
    { hours: 7.5, label: "7h30", desc: "Sono recomendado" },
    { hours: 9, label: "9h", desc: "Sono longo" },
    { hours: 10.5, label: "10h30", desc: "Sono excessivo" }
  ];
  choices.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "sleep-opt";
    btn.innerHTML = `<strong>${c.label}</strong>${c.desc}`;
    btn.addEventListener("click", () => confirmSleep(c.hours));
    options.appendChild(btn);
  });
  showScreen("sleep");
}

function confirmSleep(hours) {
  state.sleepHistory.push(hours);
  state.stressHistory.push(state.stress);

  // efeitos do sono sobre sono/energia/mental/estresse
  let sleepEffect = 0, energyEffect = 0, mentalEffect = 0, stressEffect = 0, studyPenalty = 0;
  if (hours < 5) {
    sleepEffect = -14; energyEffect = -18; mentalEffect = -8; stressEffect = 10; studyPenalty = -4;
  } else if (hours < 6.5) {
    sleepEffect = -4; energyEffect = -4; mentalEffect = -2; stressEffect = 3;
  } else if (hours <= 8.5) {
    sleepEffect = 14; energyEffect = 22; mentalEffect = 8; stressEffect = -10;
  } else if (hours <= 9.5) {
    sleepEffect = 8; energyEffect = 14; mentalEffect = 4; stressEffect = -6;
  } else {
    sleepEffect = 2; energyEffect = 4; mentalEffect = -3; stressEffect = 2; studyPenalty = -2; // dormir demais consome tempo/rotina
  }

  applyEffects({ sleep: sleepEffect, energy: energyEffect, mental: mentalEffect, stress: stressEffect, study: studyPenalty });

  finishDay();
}

/* ---------- resumo diário ---------- */

function finishDay() {
  const summary = {
    day: state.day,
    sleepHours: state.sleepHistory[state.sleepHistory.length - 1],
    log: state.dayLog,
    energyEnd: state.energy,
    stressEnd: state.stress
  };
  renderDaySummary(summary);
  state.dayLog = [];
}

function renderDaySummary(summary) {
  document.getElementById("ds-title").textContent = `Resumo do Dia ${summary.day} — ${DAY_NAMES[summary.day - 1]}`;
  const grid = document.getElementById("ds-grid");
  grid.innerHTML = "";
  const stats = [
    { lbl: "Horas dormidas", val: summary.sleepHours + "h" },
    { lbl: "Energia ao fim do dia", val: Math.round(summary.energyEnd) },
    { lbl: "Estresse ao fim do dia", val: Math.round(summary.stressEnd) }
  ];
  stats.forEach(s => {
    const div = document.createElement("div");
    div.className = "ds-stat";
    div.innerHTML = `<span class="ds-val">${s.val}</span><span class="ds-lbl">${s.lbl}</span>`;
    grid.appendChild(div);
  });

  const changesWrap = document.getElementById("ds-changes");
  changesWrap.innerHTML = "";
  const totals = {};
  summary.log.forEach(entry => {
    Object.entries(entry.deltas).forEach(([k, v]) => { totals[k] = (totals[k] || 0) + v; });
  });
  Object.entries(totals).forEach(([k, v]) => {
    if (v === 0) return;
    const meta = metaFor(k);
    const chip = document.createElement("span");
    chip.className = "ds-chip" + (v < 0 ? " neg" : "");
    chip.textContent = `${meta.icon} ${meta.short}: ${v > 0 ? "+" : ""}${Math.round(v)}`;
    changesWrap.appendChild(chip);
  });

  showScreen("daysummary");
}

document.getElementById("btn-next-day").addEventListener("click", () => {
  if (state.day >= 7) {
    renderResult();
    return;
  }
  state.day++;
  state.periodIndex = 0;
  const base = state.day >= 6 ? 6 : 4;
  // dormir pouco libera tempo extra amanhã; dormir muito consome tempo do dia seguinte —
  // o sono deixa de ser "de graça" e passa a competir com o resto da rotina.
  const lastSleep = state.sleepHistory[state.sleepHistory.length - 1] || 7.5;
  let timeAdjust = 0;
  if (lastSleep < 6) timeAdjust = 0.5 + (6 - lastSleep) * 0.3;
  else if (lastSleep > 9) timeAdjust = -((lastSleep - 9) * 0.6);
  state.freeTimeToday = Math.max(2.5, base + timeAdjust);
  state.dailyTimeBase = state.freeTimeToday;
  showScreen("game");
  renderEvent();
});

/* ---------- resultado final ---------- */

function renderResult() {
  const result = calcFinalScore();
  const rank = classify(result.total);

  document.getElementById("score-value").textContent = result.total;
  document.getElementById("rank-badge").textContent = `${rank.emoji} ${rank.label}`;
  document.getElementById("rank-message").textContent = buildResultMessage(result);

  const evoTable = document.getElementById("evo-table");
  evoTable.innerHTML = "";
  ATTRS.forEach(k => {
    const start = state.startAttrs[k];
    const end = state.attrs[k];
    const diff = Math.round(end - start);
    const row = document.createElement("div");
    row.className = "evo-row";
    row.innerHTML = `
      <span class="evo-name">${ATTR_META[k].icon} ${ATTR_META[k].label}</span>
      <span class="evo-bar-wrap"><span class="evo-bar-start" style="width:${start}%"></span></span>
      <span class="evo-bar-wrap"><span class="evo-bar-end" style="width:${end}%; background:${barColors(ATTR_META[k].hue, end).fill}"></span></span>
      <span class="evo-diff ${diff >= 0 ? "pos" : "neg"}">${diff >= 0 ? "+" : ""}${diff}</span>
    `;
    evoTable.appendChild(row);
  });

  const idxRow = document.getElementById("idx-row");
  idxRow.innerHTML = "";
  [
    { lbl: "Índice de Equilíbrio", val: result.balanceIndex },
    { lbl: "Consistência", val: result.consistency },
    { lbl: "Objetivos", val: `${result.doneCount}/3` }
  ].forEach(i => {
    const div = document.createElement("div");
    div.className = "idx-card";
    div.innerHTML = `<span class="idx-val">${i.val}</span><span class="idx-lbl">${i.lbl}</span>`;
    idxRow.appendChild(div);
  });

  const objFinal = document.getElementById("obj-final");
  objFinal.innerHTML = "";
  result.objectivesDone.forEach(o => {
    const div = document.createElement("div");
    div.className = "objective-item" + (o.done ? " done" : "");
    div.innerHTML = `<span class="obj-check">${o.done ? "✓" : ""}</span><span>${o.text}</span>`;
    objFinal.appendChild(div);
  });

  const sortedByFinal = ATTRS.slice().sort((a, b) => state.attrs[b] - state.attrs[a]);
  const strengths = document.getElementById("strengths-list");
  const weaknesses = document.getElementById("weaknesses-list");
  strengths.innerHTML = "";
  weaknesses.innerHTML = "";
  sortedByFinal.slice(0, 2).forEach(k => {
    const li = document.createElement("li");
    li.textContent = `${ATTR_META[k].label} (${Math.round(state.attrs[k])})`;
    strengths.appendChild(li);
  });
  sortedByFinal.slice(-2).reverse().forEach(k => {
    const li = document.createElement("li");
    li.textContent = `${ATTR_META[k].label} (${Math.round(state.attrs[k])})`;
    weaknesses.appendChild(li);
  });

  showScreen("result");
}

/* ================= CONTROLE ================= */

document.getElementById("btn-start").addEventListener("click", () => showScreen("intro"));
document.getElementById("btn-how").addEventListener("click", () => showScreen("intro"));
document.getElementById("btn-to-objectives").addEventListener("click", () => {
  renderObjectivesScreen();
  showScreen("objectives");
});
document.getElementById("btn-to-game").addEventListener("click", () => {
  state.startAttrs = { ...state.attrs };
  showScreen("game");
  renderEvent();
});
document.getElementById("btn-restart").addEventListener("click", () => {
  state = freshState();
  showScreen("menu");
});

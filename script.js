/**
 * Mirror & Moon — self-reflection only; cards are prompts, not predictions.
 */

const tarotCards = [
  {
    name: "The Moon",
    keyword: "Uncertainty",
    reflection:
      "Things might feel a bit unclear right now. You don’t need to have everything figured out yet.",
    prompts: [
      "What has been on your mind a lot lately?",
      "Is there something you feel but haven’t said?",
      "What feels a little off or confusing right now?",
    ],
  },
  {
    name: "The Lovers",
    keyword: "Choice",
    reflection:
      "The Lovers speaks to inner agreement — how you choose what (and whom) you stand beside, including the relationship you have with yourself. It’s less about romance as fate, more about values coming into view.",
    prompts: [
      "What do you really want right now?",
      "Are you stuck between two options?",
      "Which option feels more like you?",
    ],
  },
  {
    name: "The Hermit",
    keyword: "Space",
    reflection:
      "Maybe you need a bit of quiet time. Stepping back can help you understand things more clearly.",
    prompts: [
      "What do you need space from right now?",
      "What thought keeps coming back to you?",
      "What would help you feel a bit calmer?",
    ],
  },
  {
    name: "Death",
    keyword: "Change",
    reflection:
      "Something might be coming to an end, and that’s not a bad thing. It can make room for something new.",
    prompts: [
      "What feels like it’s changing in your life?",
      "Is there something you’re ready to let go of?",
      "What new thing do you want to make space for?",
    ],
  },
  {
    name: "The Star",
    keyword: "Hope",
    reflection:
      "Even small moments of hope matter. You don’t have to rush anything.",
    prompts: [
      "What is one small thing that feels a bit better lately?",
      "What is something kind you can do for yourself?",
      "What is one small step you can take next?",
    ],
  },
];

const cardLenses = {
  "The Moon": "uncertainty, intuition, hidden feelings, patience with not-knowing",
  "The Lovers": "choice, values alignment, honesty, relational clarity",
  "The Hermit": "space, inner guidance, solitude, reflection",
  Death: "change, release, transition, renewal",
  "The Star": "hope, healing, renewal, guidance, trust",
};

/** @type {{ role: 'app' | 'user', text: string }[]} */
let chatMessages = [];
let selectedCard = null;
let userQuestion = "";
let userReplies = [];
let promptRound = 0;
let summaryUnlocked = false;
let lastCheeringLine = "";
let lastShortReply = "";
let lastPostThirdQuestion = "";
const MODEL_PROXY_URL =
  "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
const MODEL_NAME = "anthropic/claude-4.5-sonnet";
const MODEL_AUTH_TOKEN = "";

const screens = {
  home: document.getElementById("screen-home"),
  question: document.getElementById("screen-question"),
  draw: document.getElementById("screen-draw"),
  chat: document.getElementById("screen-chat"),
  summary: document.getElementById("screen-summary"),
};

const els = {
  chatMessages: document.getElementById("chat-messages"),
  inputChat: document.getElementById("input-chat"),
  btnSend: document.getElementById("btn-send"),
  chatCardTitle: document.getElementById("chat-card-title"),
  chatCardKeyword: document.getElementById("chat-card-keyword"),
  btnCardMeaning: document.getElementById("btn-card-meaning"),
  cardMeaningModal: document.getElementById("card-meaning-modal"),
  cardMeaningText: document.getElementById("card-meaning-text"),
  btnCloseCardMeaning: document.getElementById("btn-close-card-meaning"),
  cardMeaningBackdrop: document.getElementById("card-meaning-backdrop"),
  chatComposer: document.getElementById("chat-composer"),
  chatSummaryCta: document.getElementById("chat-summary-cta"),
  summaryContent: document.getElementById("summary-content"),
  inputQuestion: document.getElementById("input-question"),
  cardBack: document.getElementById("card-back"),
  btnDraw: document.getElementById("btn-draw"),
  drawStage: document.getElementById("draw-stage"),
  cardFace: document.getElementById("card-face"),
  drawCardImage: document.getElementById("draw-card-image"),
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (!el) return;
    const active = key === name;
    el.classList.toggle("screen--active", active);
    el.hidden = !active;
  });
}

function scrollChatToBottom() {
  const box = els.chatMessages;
  if (!box) return;
  requestAnimationFrame(() => {
    box.scrollTop = box.scrollHeight;
  });
}

function renderChat() {
  if (!els.chatMessages) return;
  els.chatMessages.innerHTML = "";
  chatMessages.forEach((m) => {
    const div = document.createElement("div");
    div.className = `msg msg--${m.role === "user" ? "user" : "app"}`;
    if (m.role === "app" && m.text === "...") {
      div.classList.add("msg--thinking");
    }
    div.textContent = m.text;
    els.chatMessages.appendChild(div);
  });
  scrollChatToBottom();
}

function addMessage(role, text) {
  chatMessages.push({ role, text });
  renderChat();
}

async function addThinkingThenMessage(text, delayMs = 700) {
  chatMessages.push({ role: "app", text: "..." });
  renderChat();
  await wait(delayMs);
  chatMessages[chatMessages.length - 1] = { role: "app", text };
  renderChat();
}

function addThinkingBubble() {
  chatMessages.push({ role: "app", text: "..." });
  renderChat();
  return chatMessages.length - 1;
}

function replaceThinkingBubble(index, text) {
  if (
    typeof index === "number" &&
    chatMessages[index] &&
    chatMessages[index].text === "..."
  ) {
    chatMessages[index] = { role: "app", text };
  } else {
    chatMessages.push({ role: "app", text });
  }
  renderChat();
}

function openCardMeaningModal() {
  if (!els.cardMeaningModal || !selectedCard) return;
  els.cardMeaningModal.hidden = false;
  els.cardMeaningModal.style.display = "grid";
}

function closeCardMeaningModal() {
  if (!els.cardMeaningModal) return;
  els.cardMeaningModal.hidden = true;
  els.cardMeaningModal.style.display = "none";
}

function buildModelOptions() {
  const headers = { "Content-Type": "application/json" };
  if (MODEL_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${MODEL_AUTH_TOKEN}`;
  }
  return { method: "POST", headers };
}

function limitWords(text, maxWords) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

function needsCheeringReaction(text) {
  const input = (text || "").trim().toLowerCase();
  if (!input) return false;
  if (input.includes("?")) return true;
  return /\b(worried|worry|anxious|anxiety|afraid|scared|nervous|overwhelmed|stress|stressed|panic|uncertain|confused|lost|sad|upset)\b/.test(
    input,
  );
}

function withCheeringReaction(userText, responseText) {
  if (!needsCheeringReaction(userText)) return responseText;
  const clean = (responseText || "").trim();
  const cheeringLines = [
    "You are doing better than you think, and I am with you in this.",
    "You are not alone in this, and it is okay to take it one breath at a time.",
    "I hear you, and your feelings make sense right now.",
    "You are showing real courage by sharing this so honestly.",
    "It is okay to move gently; you do not have to solve everything at once.",
  ];
  const options = cheeringLines.filter((line) => line !== lastCheeringLine);
  const pool = options.length ? options : cheeringLines;
  const cheeringLine = pool[Math.floor(Math.random() * pool.length)];
  lastCheeringLine = cheeringLine;
  if (!clean) return cheeringLine;
  return `${cheeringLine} ${clean}`;
}

function normalizeReply(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseNonRepeatingOption(options, previousText) {
  const prevNorm = normalizeReply(previousText || "");
  const filtered = options.filter((opt) => normalizeReply(opt) !== prevNorm);
  const pool = filtered.length ? filtered : options;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getCardLens(card) {
  if (!card) return "self-trust and gentle reflection";
  return cardLenses[card.name] || `${card.keyword.toLowerCase()} and reflection`;
}

function isSuggestionRequest(text) {
  const input = (text || "").toLowerCase();
  return /\b(i dont know|i don't know|not sure|no idea|idk|give me suggestions|any suggestions|suggestions please|what should i do|help me decide)\b/.test(
    input,
  );
}

function buildCardBasedSuggestions(card) {
  const suggestionsByCard = {
    "The Moon": [
      "Name two possible feelings under this, even if you are unsure.",
      "Write one fear story and one kinder alternative story.",
      "Take a 3-minute pause and notice what your body is signaling.",
    ],
    "The Lovers": [
      "List your top two values, then test each option against them.",
      "Finish this sentence: 'The choice that feels most like me is...'.",
      "Pick one small action today that supports your truest option.",
    ],
    "The Hermit": [
      "Take 10 quiet minutes away from screens and note what comes up.",
      "Write one boundary that would protect your energy this week.",
      "Choose one calming ritual for tonight, then keep it simple.",
    ],
    Death: [
      "Name one thing you are ready to release this week.",
      "Write a brief goodbye line to what no longer fits.",
      "Choose one replacement habit that supports the next chapter.",
    ],
    "The Star": [
      "Name one sign of hope or healing from the last few days.",
      "Pick one gentle action that rebuilds trust in yourself tonight.",
      "Reach out for one supportive connection or grounding resource.",
    ],
  };
  return suggestionsByCard[card?.name] || [
    "Name one feeling, one need, and one next step in three lines.",
    "Choose one small action you can do in the next hour.",
    "Write a kind sentence to yourself and read it slowly once.",
  ];
}

function extractTrailingQuestion(text) {
  const match = String(text || "")
    .trim()
    .match(/([^?.!]*\?)\s*$/);
  return match ? match[1].trim().toLowerCase() : "";
}

function stripTrailingQuestion(text) {
  return String(text || "")
    .replace(/\s*[^?.!]*\?\s*$/, "")
    .trim();
}

function buildAdaptiveShortFallback(card, userText) {
  const input = (userText || "").trim();
  const lower = input.toLowerCase();
  const wordCount = input.split(/\s+/).filter(Boolean).length;
  const askedQuestion = input.includes("?");
  const asksSuggestions = isSuggestionRequest(input);
  const soundsWorried =
    /\b(worried|worry|anxious|anxiety|afraid|scared|nervous|overwhelmed|stress|stressed|panic|uncertain|confused|lost|sad|upset)\b/.test(
      lower,
    );
  const lens = getCardLens(card);

  if (asksSuggestions) {
    const suggestions = buildCardBasedSuggestions(card);
    const starter = chooseNonRepeatingOption(suggestions, lastShortReply);
    return `${card.name} points to ${lens}. Try this: ${starter}`;
  }

  if (soundsWorried && askedQuestion) {
    return chooseNonRepeatingOption(
      [
        `I hear how heavy this feels. ${card.name} can support ${lens}. What seems most supportive right now?`,
        `This sounds hard, and your honesty matters. With ${card.name}, a gentle anchor is ${lens}. What would help first?`,
      ],
      lastShortReply,
    );
  }
  if (soundsWorried) {
    return chooseNonRepeatingOption(
      [
        `That sounds really heavy, and it makes sense. ${card.name} invites ${lens}. What would help you feel steadier?`,
        `You are carrying a lot right now. ${card.name} leans toward ${lens}. What is one grounding step you can take?`,
      ],
      lastShortReply,
    );
  }
  if (askedQuestion && wordCount > 14) {
    return chooseNonRepeatingOption(
      [
        `That is a thoughtful question. Through ${card.name}, ${lens} stands out. Which part already feels true for you?`,
        `Great question. ${card.name} highlights ${lens}. Which piece of your own answer feels most grounded?`,
      ],
      lastShortReply,
    );
  }
  if (askedQuestion) {
    return chooseNonRepeatingOption(
      [
        `Good question. ${card.name} points toward ${lens}. What part matters most right now?`,
        `That question makes sense. With ${card.name}, focus on ${lens}. What feels most important first?`,
      ],
      lastShortReply,
    );
  }
  if (wordCount <= 6) {
    return chooseNonRepeatingOption(
      [
        `I hear you. ${card.name} suggests ${lens}. Could you share one more detail?`,
        `Thanks for sharing that. ${card.name} leans into ${lens}. Add one detail that feels strongest.`,
      ],
      lastShortReply,
    );
  }
  if (wordCount >= 28) {
    return chooseNonRepeatingOption(
      [
        `Thank you for sharing that clearly. ${card.name} reflects ${lens}. If you name the core feeling, what is it?`,
        `You explained that really clearly. ${card.name} keeps returning to ${lens}. What is the central feeling underneath it?`,
      ],
      lastShortReply,
    );
  }
  return chooseNonRepeatingOption(
    [
      `That makes sense, and your reflection is clear. ${card.name} supports ${lens}. What feels like the kindest next step?`,
      `You are naming this with care. Through ${card.name}, ${lens} seems important. What would be a gentle next move?`,
    ],
    lastShortReply,
  );
}

async function generateAdaptivePostThirdReply(
  card,
  userText,
  userReplies,
  questionContext,
) {
  const safeUserText = limitWords(userText || "", 70);
  const safeQuestion = limitWords(questionContext || "", 50);
  const safeRecent = userReplies.slice(-3).map((r) => limitWords(r, 35));
  const fallback = buildAdaptiveShortFallback(card, userText);
  const askedQuestion = (userText || "").includes("?");
  const worried = needsCheeringReaction(userText);
  const asksSuggestions = isSuggestionRequest(userText);
  const cardLens = getCardLens(card);
  const recentAssistantReplies = chatMessages
    .filter((m) => m.role === "app" && m.text !== "...")
    .slice(-3)
    .map((m) => limitWords(m.text, 20));

  const prompt = [
    "You are a warm, emotionally intelligent reflection guide in a tarot-inspired app.",
    "Write one concise reply after the user's 4th+ message.",
    "Adapt response length to user text complexity:",
    "- If user text is short/simple: 1 short sentence (8-14 words).",
    "- If user text is detailed/emotional/question-based: 2 short sentences (14-28 words total).",
    "Be accurate to what user said and directly acknowledge their message.",
    "If user asks for suggestions or says they don't know, give 2 specific suggestions (not vague prompts).",
    "You may include one gentle follow-up question, but avoid reusing the same question wording from recent replies.",
    "Reference the card naturally when useful.",
    "Do not predict the future and do not use fortune-telling language.",
    `Card: ${card.name}`,
    `Card keyword: ${card.keyword}`,
    `Card themes: ${cardLens}`,
    safeQuestion ? `Initial focus: ${safeQuestion}` : "",
    `Recent user reflections: ${safeRecent.join(" | ") || "none"}`,
    `Recent assistant replies: ${recentAssistantReplies.join(" | ") || "none"}`,
    `Latest user message: ${safeUserText}`,
    `Latest message has question: ${askedQuestion ? "yes" : "no"}`,
    `Latest message sounds worried: ${worried ? "yes" : "no"}`,
    `Latest message asks suggestions or says "I don't know": ${
      asksSuggestions ? "yes" : "no"
    }`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const text = await requestModelReply(prompt, 140, 0.65);
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) return fallback;
    return limitWords(cleaned, 32);
  } catch (err) {
    return fallback;
  }
}

async function requestModelReply(prompt, maxTokens = 1024, temperature = 0.6) {
  const options = buildModelOptions();
  options.body = JSON.stringify({
    model: MODEL_NAME,
    input: {
      prompt,
      max_tokens: maxTokens,
      temperature,
    },
  });

  const response = await fetch(MODEL_PROXY_URL, options);
  if (!response.ok) {
    throw new Error(`Model request failed with ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.output || !Array.isArray(data.output)) {
    throw new Error("Model response was empty");
  }

  return data.output.join("").trim();
}

function generateReflectiveFollowUp(card, replies) {
  const snippet = (replies[2] || replies[1] || replies[0] || "").trim();
  const short = snippet.length > 120 ? `${snippet.slice(0, 117)}…` : snippet;
  return (
    `Thank you for sitting with that honestly. ${card.name} isn’t telling you what will happen — it’s holding up a mirror to what you already carry. ` +
    (short
      ? `Something in your last words — “${short}” — sounds worth returning to with gentleness, on your own time.`
      : `Whatever surfaced here belongs to you; you can revisit it whenever it feels right.`) +
    ` There’s no rush to resolve it all at once.`
  );
}

async function generateAiFollowUp(card, replies, questionContext) {
  const safeReplies = replies.map((r) => limitWords(r, 60));
  const safeQuestion = limitWords(questionContext || "", 60);
  const fallback = generateReflectiveFollowUp(card, replies);

  const prompt = [
    "You are a warm, emotionally intelligent self-reflection guide.",
    "Do not predict the future, do not use fortune-telling language, and do not give diagnosis.",
    "Write one short follow-up response (2-3 sentences) after a tarot-inspired reflection session.",
    "The card is a mirror, not a prediction.",
    `Card: ${card.name}`,
    `Card keyword: ${card.keyword}`,
    safeQuestion ? `User starting focus: ${safeQuestion}` : "",
    `User reflection 1: ${safeReplies[0] || ""}`,
    `User reflection 2: ${safeReplies[1] || ""}`,
    `User reflection 3: ${safeReplies[2] || ""}`,
    "Tone: calm, compassionate, grounded, open-ended.",
    "End with one gentle invitation for continued reflection.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const aiText = await requestModelReply(prompt, 1024, 0.7);
    return aiText || fallback;
  } catch (err) {
    return fallback;
  }
}

function buildContextualPromptFallback(card, userText, round) {
  const snippet = limitWords(userText || "", 16);
  if (isSuggestionRequest(userText)) {
    const suggestions = buildCardBasedSuggestions(card).slice(0, 2);
    return `${card.name} can help through ${getCardLens(card)}. Try: 1) ${suggestions[0]} 2) ${suggestions[1]}`;
  }
  if (round === 2) {
    return `You mentioned ${snippet ? `"${snippet}"` : "something important"}. What feels most emotionally true under that for you right now?`;
  }
  return `As you hold ${snippet ? `"${snippet}"` : "that reflection"}, what gentle need, boundary, or next step feels most aligned for you?`;
}

async function generateAiNextPrompt(card, userReplies, questionContext, round) {
  const safeReplies = userReplies.map((r) => limitWords(r, 50));
  const safeQuestion = limitWords(questionContext || "", 40);
  const latest = safeReplies[safeReplies.length - 1] || "";
  const asksSuggestions = isSuggestionRequest(latest);
  const fallback = buildContextualPromptFallback(card, latest, round);

  const prompt = [
    "You are a warm, emotionally intelligent reflection guide in a tarot-inspired journaling app.",
    asksSuggestions
      ? "User asked for suggestions or said they don't know. Give two specific, practical suggestions in 1-2 sentences."
      : "Write ONE follow-up question that responds directly to the user's latest message.",
    "Do not predict the future. Do not use fortune-telling language.",
    "The card is a mirror, not a prediction.",
    asksSuggestions
      ? "Keep it under 34 words and include concrete actions."
      : "Keep it under 24 words and end with a question mark.",
    `Round: ${round} of 3`,
    `Card: ${card.name}`,
    `Card keyword: ${card.keyword}`,
    `Card themes: ${getCardLens(card)}`,
    safeQuestion ? `User initial focus: ${safeQuestion}` : "",
    `User latest reflection: ${latest}`,
    `Earlier reflections: ${safeReplies.slice(0, -1).join(" | ") || "none"}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const text = await requestModelReply(prompt, 1024, 0.7);
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) return fallback;
    if (asksSuggestions) return cleaned;
    return cleaned.endsWith("?") ? cleaned : `${cleaned}?`;
  } catch (err) {
    return fallback;
  }
}

function detectSummaryTone(text) {
  const t = text.toLowerCase();
  const scores = {
    fear: 0,
    confusion: 0,
    desire: 0,
    hope: 0,
    stuck: 0,
  };
  const patterns = {
    fear: /\b(fear|afraid|scared|anxious|anxiety|worry|worried|panic|terrified|unsafe)\b/,
    confusion:
      /\b(confus|unclear|lost|don't know|dont know|not sure|fog|uncertain|mixed)\b/,
    desire: /\b(want|wish|longing|long for|yearn|crave|hope to|need to feel)\b/,
    hope: /\b(hope|hopefully|lighter|relief|maybe|gentle|soften|heal)\b/,
    stuck:
      /\b(stuck|trapped|same loop|can't move|cant move|repeating|blocked|paralyzed|frozen)\b/,
  };
  Object.keys(patterns).forEach((k) => {
    if (patterns[k].test(t)) scores[k] += 2;
  });
  let best = "hope";
  let max = -1;
  Object.keys(scores).forEach((k) => {
    if (scores[k] > max) {
      max = scores[k];
      best = k;
    }
  });
  if (max <= 0) return "balanced";
  return best;
}

function generateSummary(userReplies, card) {
  const joined = userReplies.join(" ").trim();
  const tone = detectSummaryTone(joined);

  const mirrorLine = `${card.name} served as a mirror here — reflecting themes you named, not predicting what comes next.`;

  const toneParagraphs = {
    fear: `Some of what you shared carries tension or vigilance. That doesn’t mean something is “wrong” with you — it often means something in you is asking to be listened to with patience rather than forced certainty.`,
    confusion: `You’ve named uncertainty — which is its own kind of courage. Clarity doesn’t always arrive as a single answer; sometimes it arrives as a slower sense of what no longer fits.`,
    desire: `Longing showed up in your words — a pull toward something more aligned. Wanting isn’t naive; it’s information about values and needs that deserve room.`,
    hope: `There are glimmers in what you wrote — small openings, softness, or the wish for things to ease. Hope doesn’t require proof; it can coexist with fatigue.`,
    stuck: `A sense of being caught or circling appeared. That feeling often marks a place where old strategies stop working — not because you’ve failed, but because you’re ready for a different kind of honesty.`,
    balanced: `Your reflections touch several emotional notes. Whatever mix you’re holding, it’s valid to let complexity stay complex for a while.`,
  };

  const closing = `Carry forward whatever phrase or feeling stays with you — not as a verdict, but as something to revisit in journaling, conversation, or quiet.`;

  return `<p><strong>${mirrorLine}</strong></p><p>${toneParagraphs[tone]}</p><p>${closing}</p>`;
}

async function generateAiSummary(userReplies, card, questionContext) {
  const safeReplies = userReplies.map((r) => limitWords(r, 70));
  const safeQuestion = limitWords(questionContext || "", 60);
  const fallback = generateSummary(userReplies, card);

  const prompt = [
    "You are writing a concise reflection summary for a tarot-inspired journaling app.",
    "Important: the card acts as a mirror, not a prediction.",
    "Never predict outcomes, never say fate/destiny, and avoid absolute advice.",
    "Write exactly 3 short paragraphs in HTML using <p> tags only.",
    "Paragraph 1: Mention the card as mirror, not prediction.",
    "Paragraph 2: Name emotional pattern with warmth.",
    "Paragraph 3: Offer one grounded, gentle next step.",
    `Card: ${card.name}`,
    `Keyword: ${card.keyword}`,
    safeQuestion ? `Initial focus: ${safeQuestion}` : "",
    `Reply one: ${safeReplies[0] || ""}`,
    `Reply two: ${safeReplies[1] || ""}`,
    `Reply three: ${safeReplies[2] || ""}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const aiHtml = await requestModelReply(prompt, 1024, 0.65);
    if (aiHtml.includes("<p>")) {
      return aiHtml;
    }
    return `<p>${escapeHtml(aiHtml)}</p>`;
  } catch (err) {
    return fallback;
  }
}

function fallbackCardVisual(card) {
  const map = {
    "The Moon":
      "Silver mist, mirrored water, and a narrow path under moonlight.",
    "The Lovers": "Two figures in warm dusk light, framed by a flowering arch.",
    "The Hermit": "A solitary cloak and lantern against indigo mountains.",
    Death: "A pale horizon, withered petals, and one bright new sprout.",
    "The Star": "A still pool under starlight, with soft gold constellations.",
  };
  return (
    map[card.name] ||
    "A quiet symbolic scene in midnight blue and antique gold."
  );
}

function escapeSvgText(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCardSvg(card) {
  const palette = {
    "The Moon": { a: "#13233c", b: "#2e2b50", c: "#f4efe4", d: "#c9a962" },
    "The Lovers": { a: "#2a1f35", b: "#5b315f", c: "#f4efe4", d: "#d4a66f" },
    "The Hermit": { a: "#121c2c", b: "#2f3e5d", c: "#f4efe4", d: "#c9a962" },
    Death: { a: "#161822", b: "#3e2b3e", c: "#f4efe4", d: "#c9a962" },
    "The Star": { a: "#0f2238", b: "#294a67", c: "#f4efe4", d: "#d8ba74" },
  }[card.name] || { a: "#13233c", b: "#2e2b50", c: "#f4efe4", d: "#c9a962" };

  const art =
    {
      "The Moon": `<circle cx="90" cy="70" r="34" fill="${palette.c}" opacity="0.88"/><circle cx="102" cy="70" r="34" fill="${palette.a}"/><path d="M25 175 Q90 125 155 175" fill="none" stroke="${palette.d}" stroke-width="3" opacity="0.9"/><circle cx="55" cy="150" r="3" fill="${palette.c}" opacity="0.7"/><circle cx="120" cy="140" r="2.5" fill="${palette.c}" opacity="0.7"/>`,
      "The Lovers": `<circle cx="65" cy="112" r="26" fill="none" stroke="${palette.c}" stroke-width="3"/><circle cx="115" cy="112" r="26" fill="none" stroke="${palette.d}" stroke-width="3"/><path d="M55 65 L90 38 L125 65" fill="none" stroke="${palette.c}" stroke-width="3" opacity="0.85"/><path d="M48 170 Q90 138 132 170" fill="none" stroke="${palette.d}" stroke-width="3" opacity="0.75"/>`,
      "The Hermit": `<path d="M90 54 L112 156 L68 156 Z" fill="${palette.c}" opacity="0.86"/><circle cx="90" cy="84" r="9" fill="${palette.d}" opacity="0.95"/><line x1="138" y1="64" x2="138" y2="168" stroke="${palette.d}" stroke-width="4"/><circle cx="138" cy="58" r="11" fill="${palette.c}" opacity="0.92"/>`,
      Death: `<path d="M40 160 Q90 110 140 160" fill="none" stroke="${palette.d}" stroke-width="3"/><line x1="45" y1="152" x2="135" y2="82" stroke="${palette.c}" stroke-width="3" opacity="0.85"/><line x1="95" y1="58" x2="95" y2="122" stroke="${palette.c}" stroke-width="3"/><line x1="70" y1="92" x2="120" y2="92" stroke="${palette.c}" stroke-width="3"/><circle cx="52" cy="164" r="5" fill="${palette.d}"/>`,
      "The Star": `<circle cx="90" cy="64" r="8" fill="${palette.d}"/><path d="M90 36 L96 58 L118 64 L96 70 L90 92 L84 70 L62 64 L84 58 Z" fill="${palette.c}" opacity="0.9"/><circle cx="50" cy="125" r="3" fill="${palette.c}" opacity="0.8"/><circle cx="130" cy="138" r="2.5" fill="${palette.c}" opacity="0.75"/><path d="M30 170 Q90 145 150 170" fill="none" stroke="${palette.d}" stroke-width="3"/>`,
    }[card.name] ||
    `<circle cx="90" cy="90" r="30" fill="${palette.c}" opacity="0.85"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="280" viewBox="0 0 180 280">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.a}"/>
      <stop offset="100%" stop-color="${palette.b}"/>
    </linearGradient>
  </defs>
  <rect width="180" height="280" rx="12" fill="url(#bg)"/>
  <rect x="9" y="9" width="162" height="262" rx="8" fill="none" stroke="${palette.d}" stroke-opacity="0.5"/>
  ${art}
  <text x="90" y="250" text-anchor="middle" fill="${palette.c}" fill-opacity="0.9" font-size="14" font-family="Georgia, serif">${escapeSvgText(card.name)}</text>
</svg>`;
}

function createCardImageDataUri(card) {
  const svg = buildCardSvg(card);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createDefaultTarotBackDataUri() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="280" viewBox="0 0 180 280">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a2033"/>
      <stop offset="100%" stop-color="#2d2541"/>
    </linearGradient>
  </defs>
  <rect width="180" height="280" rx="12" fill="url(#bg)"/>
  <rect x="10" y="10" width="160" height="260" rx="8" fill="none" stroke="#c9a962" stroke-opacity="0.5"/>
  <polygon points="90,54 126,92 90,130 54,92" fill="none" stroke="#f4efe4" stroke-opacity="0.9" stroke-width="2.4"/>
  <circle cx="90" cy="92" r="11" fill="none" stroke="#c9a962" stroke-width="2"/>
  <line x1="90" y1="130" x2="90" y2="196" stroke="#f4efe4" stroke-opacity="0.75" stroke-width="2"/>
  <line x1="66" y1="172" x2="114" y2="172" stroke="#c9a962" stroke-opacity="0.85" stroke-width="2"/>
  <circle cx="90" cy="210" r="6" fill="none" stroke="#f4efe4" stroke-opacity="0.8" stroke-width="2"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function resetDrawStage() {
  if (els.drawStage) els.drawStage.classList.remove("draw-stage--dramatic");
  if (els.cardBack) {
    els.cardBack.classList.remove("card-back--drawing");
    els.cardBack.querySelector(".card-back__glyph")?.removeAttribute("hidden");
  }
  if (els.cardFace) els.cardFace.hidden = true;
  if (els.drawCardImage) {
    els.drawCardImage.src = createDefaultTarotBackDataUri();
    els.drawCardImage.alt = "Tarot card sigil";
  }
  if (els.btnDraw) els.btnDraw.disabled = false;
}

function startReflectionSession(card) {
  selectedCard = card;
  chatMessages = [];
  userReplies = [];
  promptRound = 0;
  summaryUnlocked = false;
  lastCheeringLine = "";
  lastShortReply = "";
  lastPostThirdQuestion = "";

  if (els.chatCardTitle) els.chatCardTitle.textContent = card.name;
  if (els.chatCardKeyword) els.chatCardKeyword.textContent = card.keyword;
  if (els.cardMeaningText) els.cardMeaningText.textContent = card.reflection;
  closeCardMeaningModal();

  if (els.chatComposer) els.chatComposer.hidden = false;
  if (els.chatSummaryCta) els.chatSummaryCta.hidden = true;
  if (els.inputChat) {
    els.inputChat.disabled = false;
    els.inputChat.value = "";
  }
  if (els.btnSend) els.btnSend.disabled = false;

  addMessage("app", card.reflection);
  addMessage("app", card.prompts[0]);
}

async function handleSendMessage() {
  if (!selectedCard) return;
  const text = (els.inputChat && els.inputChat.value.trim()) || "";
  if (!text) return;

  addMessage("user", text);
  if (els.inputChat) els.inputChat.value = "";
  userReplies.push(text);
  promptRound += 1;

  if (promptRound === 1) {
    const thinkingIndex = addThinkingBubble();
    const nextPrompt = await generateAiNextPrompt(
      selectedCard,
      userReplies,
      userQuestion,
      2,
    );
    replaceThinkingBubble(thinkingIndex, withCheeringReaction(text, nextPrompt));
    return;
  }
  if (promptRound === 2) {
    const thinkingIndex = addThinkingBubble();
    const nextPrompt = await generateAiNextPrompt(
      selectedCard,
      userReplies,
      userQuestion,
      3,
    );
    replaceThinkingBubble(thinkingIndex, withCheeringReaction(text, nextPrompt));
    return;
  }
  if (promptRound === 3) {
    const thinkingIndex = addThinkingBubble();
    const followUp = await generateAiFollowUp(
      selectedCard,
      userReplies,
      userQuestion,
    );
    replaceThinkingBubble(thinkingIndex, withCheeringReaction(text, followUp));
    if (!summaryUnlocked) {
      summaryUnlocked = true;
      if (els.chatSummaryCta) els.chatSummaryCta.hidden = false;
    }
    return;
  }
  if (promptRound > 3) {
    const thinkingIndex = addThinkingBubble();
    const shortReply = await generateAdaptivePostThirdReply(
      selectedCard,
      text,
      userReplies,
      userQuestion,
    );
    const normalizedShortReply = normalizeReply(shortReply);
    const normalizedLastReply = normalizeReply(lastShortReply);
    let finalReply = shortReply;
    if (normalizedShortReply && normalizedShortReply === normalizedLastReply) {
      finalReply = `${stripTrailingQuestion(shortReply)} What feels most important to name next?`;
    }
    const currentQuestion = extractTrailingQuestion(finalReply);
    if (currentQuestion && currentQuestion === lastPostThirdQuestion) {
      const alternateQuestions = [
        "What feels most important to name next?",
        "What part of this feels most true to you now?",
        "What would be the gentlest next step for you?",
        "Which feeling needs the most care right now?",
      ];
      const replacement =
        alternateQuestions.find((q) => q.toLowerCase() !== currentQuestion) ||
        "What feels most true for you right now?";
      finalReply = `${stripTrailingQuestion(finalReply)} ${replacement}`.trim();
    }
    const updatedQuestion = extractTrailingQuestion(finalReply);
    lastPostThirdQuestion = updatedQuestion || "";
    if (!/[.!?]$/.test(finalReply)) finalReply = `${finalReply}.`;
    replaceThinkingBubble(thinkingIndex, finalReply);
    lastShortReply = finalReply;
  }
}

async function goToSummary() {
  if (!selectedCard) return;
  showScreen("summary");
  if (els.summaryContent) {
    els.summaryContent.innerHTML = "<p>...</p>";
  }
  const html = await generateAiSummary(userReplies, selectedCard, userQuestion);
  if (els.summaryContent) {
    if (userQuestion.trim()) {
      els.summaryContent.innerHTML = `<p class="summary-note">You began with: <em>${escapeHtml(userQuestion)}</em></p>${html}`;
    } else {
      els.summaryContent.innerHTML = html;
    }
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function bindUi() {
  resetDrawStage();
  document
    .getElementById("btn-begin")
    ?.addEventListener("click", () => showScreen("question"));

  document
    .getElementById("btn-question-continue")
    ?.addEventListener("click", () => {
      userQuestion =
        (els.inputQuestion && els.inputQuestion.value.trim()) || "";
      resetDrawStage();
      showScreen("draw");
    });

  els.btnDraw?.addEventListener("click", async () => {
    if (!els.cardBack || !els.btnDraw || !els.cardFace || !els.drawStage)
      return;
    els.btnDraw.disabled = true;
    els.cardFace.hidden = true;
    els.cardBack.querySelector(".card-back__glyph")?.removeAttribute("hidden");
    els.drawStage.classList.remove("draw-stage--dramatic");
    els.cardBack.classList.remove("card-back--drawing");
    void els.cardBack.offsetWidth;
    els.drawStage.classList.add("draw-stage--dramatic");
    els.cardBack.classList.add("card-back--drawing");
    const card = tarotCards[Math.floor(Math.random() * tarotCards.length)];
    await wait(1300);
    if (els.drawCardImage) els.drawCardImage.src = createCardImageDataUri(card);
    els.cardBack
      .querySelector(".card-back__glyph")
      ?.setAttribute("hidden", "hidden");
    els.cardFace.hidden = false;
    await wait(1400);

    startReflectionSession(card);
    showScreen("chat");
    els.inputChat?.focus();
    els.btnDraw.disabled = false;
    els.drawStage.classList.remove("draw-stage--dramatic");
    els.cardBack.classList.remove("card-back--drawing");
    els.cardFace.hidden = true;
    els.cardBack.querySelector(".card-back__glyph")?.removeAttribute("hidden");
  });

  document
    .getElementById("btn-send")
    ?.addEventListener("click", handleSendMessage);
  els.inputChat?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  document
    .getElementById("btn-see-summary")
    ?.addEventListener("click", goToSummary);

  els.btnCardMeaning?.addEventListener("click", openCardMeaningModal);
  els.cardMeaningModal?.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const clickedCloseButton = target.closest("#btn-close-card-meaning");
    const clickedBackdrop = target.id === "card-meaning-backdrop";
    if (clickedCloseButton || clickedBackdrop) {
      closeCardMeaningModal();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCardMeaningModal();
  });

  document.getElementById("btn-restart")?.addEventListener("click", () => {
    userQuestion = "";
    userReplies = [];
    selectedCard = null;
    if (els.inputQuestion) els.inputQuestion.value = "";
    closeCardMeaningModal();
    resetDrawStage();
    showScreen("home");
  });
}

bindUi();

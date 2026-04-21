/**
 * Mirror & Moon — self-reflection only; cards are prompts, not predictions.
 */

const tarotCards = [
  {
    name: "The Moon",
    keyword: "Intuition & shadow",
    reflection:
      "The Moon invites you to notice what feels half-seen — dreams, doubts, and the stories you tell yourself in the dark. Nothing here asks you to be certain; it asks you to be honest about uncertainty.",
    prompts: [
      "What feeling or image has been recurring for you lately, even if it doesn’t make full sense?",
      "Where do you sense a gap between what you show others and what you actually feel?",
      "If your intuition had a quiet sentence for you right now, what might it be?",
    ],
  },
  {
    name: "The Lovers",
    keyword: "Choice & alignment",
    reflection:
      "The Lovers speaks to inner agreement — how you choose what (and whom) you stand beside, including the relationship you have with yourself. It’s less about romance as fate, more about values coming into view.",
    prompts: [
      "What are you genuinely drawn toward lately — not what you think you should want?",
      "Where do you feel a pull between two parts of yourself, or two paths?",
      "What would ‘choosing with care’ look like for you in this chapter?",
    ],
  },
  {
    name: "The Hermit",
    keyword: "Solitude & inner light",
    reflection:
      "The Hermit is a pause — permission to step back from noise and listen inward. The ‘answer’ may be slower than you like; the gift is clarity that matches your actual pace.",
    prompts: [
      "What are you needing space from — not to escape life, but to hear yourself?",
      "When you’re alone with your thoughts, what keeps returning?",
      "What small ritual or boundary would help you feel more grounded this week?",
    ],
  },
  {
    name: "Death",
    keyword: "Release & transformation",
    reflection:
      "Death names an ending — not as doom, but as the shape change takes. Something is ready to shift: a role, a belief, a habit of heart. Grief and relief can sit side by side.",
    prompts: [
      "What in your life feels finished, even if you haven’t fully named it yet?",
      "What might you need to grieve or honor before you can move forward?",
      "If something new had room to grow, what would you need to set down first?",
    ],
  },
  {
    name: "The Star",
    keyword: "Hope & renewal",
    reflection:
      "The Star is a soft exhale after difficulty — not a guarantee, but a sense of possibility. It asks where you allow tenderness toward yourself and where hope feels fragile but real.",
    prompts: [
      "Where do you notice a small sense of relief, beauty, or hope — even quietly?",
      "What would it mean to trust your own healing at your own speed?",
      "What gentle next step feels honest, not performative?",
    ],
  },
];

/** @type {{ role: 'app' | 'user', text: string }[]} */
let chatMessages = [];
let selectedCard = null;
let userQuestion = "";
let userReplies = [];
let promptRound = 0;
let chatComplete = false;
const MODEL_PROXY_URL = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
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
  chatComposer: document.getElementById("chat-composer"),
  chatSummaryCta: document.getElementById("chat-summary-cta"),
  summaryContent: document.getElementById("summary-content"),
  inputQuestion: document.getElementById("input-question"),
};

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
    div.textContent = m.text;
    els.chatMessages.appendChild(div);
  });
  scrollChatToBottom();
}

function addMessage(role, text) {
  chatMessages.push({ role, text });
  renderChat();
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
    confusion: /\b(confus|unclear|lost|don't know|dont know|not sure|fog|uncertain|mixed)\b/,
    desire: /\b(want|wish|longing|long for|yearn|crave|hope to|need to feel)\b/,
    hope: /\b(hope|hopefully|lighter|relief|maybe|gentle|soften|heal)\b/,
    stuck: /\b(stuck|trapped|same loop|can't move|cant move|repeating|blocked|paralyzed|frozen)\b/,
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

  const mirrorLine =
    `${card.name} served as a mirror here — reflecting themes you named, not predicting what comes next.`;

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

function startReflectionSession(card) {
  selectedCard = card;
  chatMessages = [];
  userReplies = [];
  promptRound = 0;
  chatComplete = false;

  if (els.chatCardTitle) els.chatCardTitle.textContent = card.name;
  if (els.chatCardKeyword) els.chatCardKeyword.textContent = card.keyword;

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
  if (!selectedCard || chatComplete) return;
  const text = (els.inputChat && els.inputChat.value.trim()) || "";
  if (!text) return;

  addMessage("user", text);
  if (els.inputChat) els.inputChat.value = "";
  userReplies.push(text);
  promptRound += 1;

  if (promptRound === 1 && selectedCard.prompts[1]) {
    addMessage("app", selectedCard.prompts[1]);
    return;
  }
  if (promptRound === 2 && selectedCard.prompts[2]) {
    addMessage("app", selectedCard.prompts[2]);
    return;
  }
  if (promptRound >= 3) {
    const followUp = await generateAiFollowUp(selectedCard, userReplies, userQuestion);
    addMessage("app", followUp);
    chatComplete = true;
    if (els.inputChat) els.inputChat.disabled = true;
    if (els.btnSend) els.btnSend.disabled = true;
    if (els.chatSummaryCta) els.chatSummaryCta.hidden = false;
  }
}

async function goToSummary() {
  if (!selectedCard) return;
  const html = await generateAiSummary(userReplies, selectedCard, userQuestion);
  if (els.summaryContent) {
    if (userQuestion.trim()) {
      els.summaryContent.innerHTML =
        `<p class="summary-note">You began with: <em>${escapeHtml(userQuestion)}</em></p>${html}`;
    } else {
      els.summaryContent.innerHTML = html;
    }
  }
  showScreen("summary");
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function bindUi() {
  document.getElementById("btn-begin")?.addEventListener("click", () => showScreen("question"));

  document.getElementById("btn-question-continue")?.addEventListener("click", () => {
    userQuestion = (els.inputQuestion && els.inputQuestion.value.trim()) || "";
    showScreen("draw");
  });

  document.getElementById("btn-draw")?.addEventListener("click", () => {
    const card = tarotCards[Math.floor(Math.random() * tarotCards.length)];
    startReflectionSession(card);
    showScreen("chat");
    els.inputChat?.focus();
  });

  document.getElementById("btn-send")?.addEventListener("click", handleSendMessage);
  els.inputChat?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  document.getElementById("btn-see-summary")?.addEventListener("click", goToSummary);

  document.getElementById("btn-restart")?.addEventListener("click", () => {
    userQuestion = "";
    userReplies = [];
    selectedCard = null;
    if (els.inputQuestion) els.inputQuestion.value = "";
    showScreen("home");
  });
}

bindUi();

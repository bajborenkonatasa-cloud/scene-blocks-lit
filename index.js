// Scene Blocks Lite 0.3.6 · MIT · NovelAI Worker backend added without changing the SillyImages path

// scene-blocks-lite/src/config.js
var KEY = "scene_blocks_lite";
var VERSION = "0.3.6";
var STARTER_PROMPT = `Illustrate the current roleplay scene as a cinematic digital manhwa.
Return all three parts in this exact order on EVERY turn:
1. One vertical comic image: 2 to 4 consecutive moments with organic transitions, detailed backgrounds, expressive faces, coherent poses, lighting and camera angles. Include 1 or 2 small macro insets of objects actually present: hands, food, flowers or meaningful props. These are parts of the SAME comic image.
2. A beautiful mobile HTML/CSS artifact tied to the current scene. Use a phone screen, document or scene card, depending on context. All visible text is Russian. Include meaningful details, an appropriate palette, typography and optional CSS animation and tap interaction. Keep it responsive. Use HTML and CSS; no JavaScript.
3. One separate cinematic illustration of the current moment, with detailed setting and natural expressions. It is mandatory and separate from the comic.
Keep the image style: High-end digital manhwa, moody chiaroscuro, soft volumetric rendering, luminous skin, subtle specular highlights, painterly clothing and backgrounds, atmospheric cinematic composition.
Both images use aspect_ratio 9:16 and image_size 4K. For referenced characters, use their actual names or configured reference aliases; preserve reference appearance. Describe unreferenced NPCs consistently. Respect ages, physical limitations and current clothing. Do not invent events or force action into a quiet scene. Use actual short Russian dialogue in comic bubbles when available. Keep imagery non-explicit.
Write scene-specific image prompts in English, with Russian dialogue as needed. The HTML/CSS goes BETWEEN the two image tags.`;
var STARTER_TEMPLATE = `<comicss>
<img data-iig-instruction='{"style":"High-end digital manhwa, cinematic lighting","prompt":"SCENE-SPECIFIC COMIC DESCRIPTION","aspect_ratio":"9:16","image_size":"4K"}' src="[IMG:GEN]">
<artifact><div>HTML/CSS артефакт по текущей сцене</div></artifact>
<img data-iig-instruction='{"style":"High-end digital manhwa, cinematic lighting","prompt":"SCENE-SPECIFIC SINGLE ILLUSTRATION","aspect_ratio":"9:16","image_size":"4K"}' src="[IMG:GEN]">
</comicss>`;
var DEFAULTS = Object.freeze({
  auto: false,
  profileId: "",
  prompt: STARTER_PROMPT,
  template: STARTER_TEMPLATE,
  extraContext: "",
  contextCount: 1,
  maxTokens: 6e3,
  temperature: 0.8,
  topP: 0.9,
  reasoning: "medium",
  pauseOffscreen: true,
  sillyImagesFolder: "sillyimages",
  imageBackend: "sillyimages",
  novelAiWorkerUrl: "",
  novelAiStyleMode: "worker",
  importedName: "",
  outputMode: "strict",
  maxImages: 8,
  presetName: "Комикс + HTML/CSS + картинка"
});
var numberIn = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
function normalizeFields(raw = {}) {
  const result = { ...DEFAULTS };
  for (const key of ["profileId", "prompt", "template", "extraContext", "sillyImagesFolder", "imageBackend", "novelAiWorkerUrl", "novelAiStyleMode", "importedName", "presetName"]) {
    if (typeof raw[key] === "string") result[key] = raw[key];
  }
  for (const key of ["auto", "pauseOffscreen"]) {
    if (typeof raw[key] === "boolean") result[key] = raw[key];
  }
  result.contextCount = Math.round(numberIn(raw.contextCount, 1, 1, 20));
  result.maxTokens = Math.round(numberIn(raw.maxTokens, 6e3, 512, 32e3));
  result.temperature = numberIn(raw.temperature, 0.8, 0, 2);
  result.topP = numberIn(raw.topP, 0.9, 0, 1);
  result.reasoning = ["auto", "min", "low", "medium", "high", "max"].includes(raw.reasoning) ? raw.reasoning : "medium";
  result.imageBackend = ["sillyimages", "novelai_worker"].includes(raw.imageBackend) ? raw.imageBackend : "sillyimages";
  result.novelAiStyleMode = ["worker", "merge"].includes(raw.novelAiStyleMode) ? raw.novelAiStyleMode : "worker";
  result.outputMode = raw.outputMode === "template" ? "template" : "strict";
  result.maxImages = Math.round(numberIn(raw.maxImages, 8, 1, 20));
  return result;
}
var PRESET_FIELDS = ["profileId", "prompt", "template", "extraContext", "contextCount", "maxTokens", "temperature", "topP", "reasoning", "imageBackend", "novelAiWorkerUrl", "novelAiStyleMode", "importedName", "outputMode", "maxImages"];
function snapshot(raw) {
  const settings = normalizeFields(raw);
  return Object.fromEntries(PRESET_FIELDS.map((key) => [key, settings[key]]));
}
function normalizeSettings(raw = {}) {
  const settings = normalizeFields(raw);
  const ids = /* @__PURE__ */ new Set();
  settings.presets = (Array.isArray(raw.presets) ? raw.presets : []).filter((preset) => {
    if (!preset || typeof preset.id !== "string" || !preset.id || ids.has(preset.id) || !preset.settings) return false;
    ids.add(preset.id);
    return true;
  }).slice(0, 100).map((preset) => ({ id: preset.id, name: String(preset.name || "Мой промпт").slice(0, 100), settings: snapshot(preset.settings) }));
  if (!settings.presets.length) settings.presets.push({ id: "initial", name: raw.presetName || raw.importedName || DEFAULTS.presetName, settings: snapshot(settings) });
  settings.activePresetId = settings.presets.some((preset) => preset.id === raw.activePresetId) ? raw.activePresetId : settings.presets[0].id;
  if (!raw.presetName) settings.presetName = settings.presets.find((preset) => preset.id === settings.activePresetId).name;
  return settings;
}
function savePreset(raw, { asNew = false } = {}) {
  const settings = normalizeSettings(raw);
  const preset = !asNew && settings.presets.find((item) => item.id === settings.activePresetId);
  const name = settings.presetName.trim().slice(0, 100) || "Мой промпт";
  if (preset) {
    preset.name = name;
    preset.settings = snapshot(settings);
  } else {
    if (settings.presets.length >= 100) throw new Error("Сохранено уже 100 промптов. Удали ненужный перед добавлением.");
    const item = { id: crypto.randomUUID(), name, settings: snapshot(settings) };
    settings.presets.push(item);
    settings.activePresetId = item.id;
  }
  settings.presetName = name;
  return settings;
}
function selectPreset(raw, id) {
  const settings = normalizeSettings(raw);
  const preset = settings.presets.find((item) => item.id === id);
  if (!preset) throw new Error("Этот промпт не найден. Обнови список.");
  return normalizeSettings({ ...settings, ...preset.settings, activePresetId: preset.id, presetName: preset.name });
}
function deletePreset(raw) {
  const settings = normalizeSettings(raw);
  if (settings.presets.length <= 1) throw new Error("Оставь хотя бы один промпт. Его содержимое можно заменить.");
  settings.presets = settings.presets.filter((item) => item.id !== settings.activePresetId);
  return selectPreset(settings, settings.presets[0].id);
}
function newPreset(raw) {
  const settings = savePreset(raw);
  return savePreset({ ...settings, auto: false, presetName: "Новый промпт", prompt: "", template: "", extraContext: "", importedName: "", outputMode: "template", imageBackend: "sillyimages", novelAiWorkerUrl: "", novelAiStyleMode: "worker" }, { asNew: true });
}
function rememberPreset(raw, candidate) {
  const current = normalizeSettings(raw);
  const name = (candidate.presetName || candidate.importedName || "Импортированный промпт").trim().slice(0, 100);
  const data = snapshot(candidate);
  const same = current.presets.find((preset) => preset.name === name && JSON.stringify(preset.settings) === JSON.stringify(data));
  if (same) return selectPreset({ ...current, auto: false }, same.id);
  return savePreset({ ...current, ...data, presetName: name, auto: false }, { asNew: true });
}
function getSettings(context) {
  const settings = normalizeSettings(context.extensionSettings[KEY]);
  context.extensionSettings[KEY] = settings;
  return settings;
}
function importBlock(raw, current, context) {
  if (raw?.kind === KEY && raw.settings) return normalizeSettings({ ...raw.settings, auto: false });
  if (!raw || raw.block_type !== "generated" || typeof raw.prompt !== "string" || typeof raw.template !== "string") {
    throw new Error("Нужен JSON одного G-блока ExtBlocks или экспорт «Моих сцен».");
  }
  if ((raw.context || []).some((item) => !item.disabled && !["last_messages", "text", "previous_block"].includes(item.type))) {
    throw new Error("Этот G-блок использует дополнительный источник контекста. В этой версии переносятся текст и последние сообщения.");
  }
  if ((raw.context || []).some((item) => !item.disabled && item.type === "previous_block" && item.block_name)) {
    throw new Error("Этот блок зависит от другого блока. Сначала убери эту зависимость в копии блока.");
  }
  const last = (raw.context || []).find((item) => !item.disabled && item.type === "last_messages");
  const extra = (raw.context || []).filter((item) => !item.disabled && item.type === "text").map((item) => item.text || "").join("\n\n");
  const preset = context.extensionSettings.ExtBlocks?.api_presets?.[raw.api_preset];
  const profiles = context.extensionSettings.connectionManager?.profiles || [];
  const matches = profiles.filter((profile) => profile.name === (preset?.connection_profile ?? preset?.connection_profile_name));
  return normalizeSettings({
    ...current,
    auto: false,
    prompt: raw.prompt,
    template: raw.template,
    extraContext: extra,
    contextCount: last?.messages_count ?? current.contextCount,
    importedName: raw.name || "",
    presetName: raw.name || "Импортированный промпт",
    outputMode: "template",
    maxImages: DEFAULTS.maxImages,
    profileId: matches.length === 1 ? matches[0].id : current.profileId,
    maxTokens: preset?.max_tokens ?? current.maxTokens,
    temperature: preset?.temperature ?? current.temperature,
    topP: preset?.top_p ?? current.topP,
    reasoning: preset?.reasoning_effort ?? current.reasoning,
    imageBackend: "sillyimages",
    novelAiWorkerUrl: "",
    novelAiStyleMode: "worker"
  });
}
function conflictingBlock(context, settings) {
  const ext = context.extensionSettings.ExtBlocks;
  if (!ext?.extblocks_is_enabled) return "";
  if ((context.extensionSettings.disabledExtensions || []).some((name) => /(?:^|\/)ext-blocks(?:-custom)?$/i.test(name))) return "";
  const set = ext.sets?.[ext.active_set_idx] || ext.sets?.find((item) => item.name === ext.active_set);
  const scoped = context.characters?.[context.characterId]?.data?.extensions?.ExtBlocks || [];
  const local = Array.isArray(scoped) ? scoped : [];
  const globals = (set?.global_blocks || []).filter((block) => !local.some((item) => item.name === block.name));
  return [...globals, ...local].find((block) => !block.disabled && block.char_message && block.block_type === "generated" && (settings.importedName && block.name === settings.importedName || (block.prompt || "").includes("data-iig-instruction")))?.name || "";
}

// scene-blocks-lite/src/core.js
var SceneError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SceneError";
    this.code = code;
  }
};
function fingerprint(text = "") {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${text.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}
var swipeId = (message) => Number.isInteger(message.swipe_id) ? message.swipe_id : 0;
var chatKey = (context) => JSON.stringify([context.getCurrentChatId?.() ?? context.chatId ?? "", context.groupId ?? "", context.characterId ?? ""]);
function readState(message) {
  if (!message) return null;
  const valid = (state) => [1, 2].includes(state?.version);
  const index = swipeId(message);
  const scoped = message.swipe_info?.[index]?.extra?.[KEY];
  if (valid(scoped)) return scoped;
  const root = message.extra?.[KEY];
  if (!valid(root)) return null;
  if (Number.isInteger(root.ownerSwipe)) return root.ownerSwipe === index ? root : null;
  const otherOwner = message.swipe_info?.findIndex((info) => info?.extra?.[KEY]?.id === root.id) ?? -1;
  if (otherOwner >= 0) return otherOwner === index ? root : null;
  if (root.source === fingerprint(message.mes || "")) return root;
  const hasSwipes = Array.isArray(message.swipes) || Array.isArray(message.swipe_info) || message.swipe_id !== void 0;
  return !hasSwipes || index === 0 ? root : null;
}
function writeState(message, state) {
  const saved = { ...state, ownerSwipe: swipeId(message) };
  message.extra ??= {};
  message.extra[KEY] = structuredClone(saved);
  if (Array.isArray(message.swipes) || Array.isArray(message.swipe_info) || message.swipe_id !== void 0) {
    const index = swipeId(message);
    message.swipe_info ??= [];
    message.swipe_info[index] ??= {};
    message.swipe_info[index].extra ??= {};
    message.swipe_info[index].extra[KEY] = structuredClone(saved);
  }
}
function capture(context, index, epoch) {
  const message = context.chat[index];
  if (!message || message.is_user || message.is_system || !message.mes?.trim() || ["...", "…"].includes(message.mes.trim())) {
    throw new SceneError("message", "Выбери законченный ответ персонажа.");
  }
  return {
    index,
    message,
    epoch,
    chat: chatKey(context),
    swipe: swipeId(message),
    text: message.mes,
    characterName: message.name || context.name2 || "generated"
  };
}
function isLive(token, context, epoch) {
  return token.epoch === epoch && token.chat === chatKey(context) && context.chat[token.index] === token.message && swipeId(token.message) === token.swipe && token.message.mes === token.text;
}
function publicError(error) {
  if (error instanceof SceneError) return { code: error.code, message: error.message };
  if (error?.name === "AbortError") return { code: "stopped", message: "Остановлено. Готовые части сохранены." };
  const parts = [], seen = /* @__PURE__ */ new Set();
  for (let node = error; node && !seen.has(node) && seen.size < 12; node = node.cause) {
    seen.add(node);
    parts.push(String(node.message || ""), String(node.status || node.response?.status || ""));
  }
  const text = parts.join(" ").toLowerCase();
  if (/safety|moderation|content.policy|content.filter/.test(text)) return { code: "provider_refusal", message: "Генератор отклонил запрос. Проверь содержание промпта." };
  if (/401|403|api.key|unauthorized|secret/.test(text)) return { code: "auth", message: "Проверь ключ и выбранный профиль подключения." };
  if (/429|quota|billing/.test(text)) return { code: "quota", message: "Достигнут лимит генератора. Проверь баланс и ограничения." };
  if (/preset.*(not found|missing|unknown)|could not find.*preset/.test(text)) return { code: "preset", message: "Таверна не нашла пресет выбранного профиля. Проверь его в Connection Manager." };
  if (/\b(400|422)\b|unsupported|invalid.parameter|invalid.request/.test(text)) return { code: "parameters", message: "Запрос отклонён из-за параметров или структуры. Скачай диагностику." };
  if (/\b(502|503|504|500)\b/.test(text)) return { code: "server", message: "Ошибка сервера Таверны или провайдера. Скачай диагностику." };
  if (/failed to fetch|network|econn|enotfound/.test(text)) return { code: "network", message: "Ошибка сетевого соединения при запросе." };
  if (/timeout|timed out/.test(text)) return { code: "timeout", message: "Превышено время ожидания ответа." };
  return { code: "request", message: "Запрос не завершился. Проверь подключение и повтори недостающую часть." };
}
var SceneEngine = class {
  constructor({ getContext: getContext2, prepare, generateImage, persistImage, recordImage = () => {
  }, onChange = () => {
  }, log: log2 = () => {
  } }) {
    Object.assign(this, { getContext: getContext2, prepare, generateImage, persistImage, recordImage, onChange, log: log2 });
    this.epoch = 0;
    this.jobs = /* @__PURE__ */ new Map();
    this.tail = Promise.resolve();
    this.pendingMedia = /* @__PURE__ */ new Map();
  }
  active(index) {
    return [...this.jobs.values()].find((job) => job.token.index === index && isLive(job.token, this.getContext(), this.epoch));
  }
  check(job) {
    if (job.controller.signal.aborted || !isLive(job.token, this.getContext(), this.epoch)) throw new DOMException("Stopped", "AbortError");
  }
  changed(job) {
    this.onChange(job.token.index, job);
  }
  status(job, value) {
    job.label = value;
    this.changed(job);
  }
  async commit(job) {
    this.check(job);
    writeState(job.token.message, job.state);
    this.changed(job);
    try {
      await this.getContext().saveChat();
    } catch {
      throw new SceneError("save", "Не удалось сохранить чат. Нажми «Продолжить» — готовые картинки генерироваться заново не будут.");
    }
    this.check(job);
  }
  enqueue(index, settings, { mode = "continue", automatic = false } = {}) {
    let token;
    try {
      token = capture(this.getContext(), index, this.epoch);
    } catch (error) {
      return Promise.reject(error);
    }
    const duplicate = this.active(index);
    if (duplicate) return duplicate.promise;
    const existing = readState(token.message);
    if (automatic && existing) return Promise.resolve();
    if (this.jobs.size >= 4) return Promise.reject(new SceneError("queue", "В очереди уже четыре сцены. Дождись завершения."));
    const { presets, ...selectedSettings } = settings;
    const job = { token, settings: structuredClone(selectedSettings), mode, controller: new AbortController(), label: "В очереди", state: existing ? structuredClone(existing) : null };
    const key = crypto.randomUUID();
    this.jobs.set(key, job);
    const task = this.tail.catch(() => {
    }).then(() => this.run(job));
    job.promise = task.finally(() => {
      this.jobs.delete(key);
      this.changed(job);
    });
    this.tail = job.promise.catch(() => {
    });
    this.changed(job);
    return job.promise;
  }
  stop(index) {
    for (const job of this.jobs.values()) if (index === void 0 || job.token.index === index) job.controller.abort();
  }
  chatChanged() {
    this.stop();
    this.epoch += 1;
    this.pendingMedia.clear();
  }
  checkTargets() {
    for (const job of this.jobs.values()) if (!isLive(job.token, this.getContext(), this.epoch)) job.controller.abort();
  }
  async run(job) {
    try {
      this.check(job);
      if (!job.state?.plan || job.mode === "rebuild") {
        this.status(job, job.settings.outputMode === "template" ? "Готовлю блок по выбранному промпту…" : "Готовлю комикс, HTML/CSS и иллюстрацию…");
        const plan = await this.prepare(job.settings, job.token, job.controller.signal);
        this.check(job);
        if (!plan?.artifactHtml?.trim() || !Array.isArray(plan.slots) || plan.slots.length > 20 || plan.layout !== "template" && plan.slots.length !== 2) throw new SceneError("format", "Не удалось разобрать структуру блока. Проверь промпт и выбранный формат.");
        job.state = {
          version: 2,
          id: crypto.randomUUID(),
          source: fingerprint(job.token.text),
          createdAt: Date.now(),
          status: "images",
          error: null,
          plan: { layout: plan.layout || "strict", artifactHtml: plan.artifactHtml, rawHtml: plan.rawHtml || "", slots: plan.slots.map((slot) => ({ instruction: slot.instruction, src: "", status: "pending", error: null })) }
        };
        await this.commit(job);
      } else {
        job.state.error = null;
        if (job.mode === "comic" || job.mode === "image" || /^slot-\d+$/.test(job.mode)) {
          const selected = job.mode === "comic" ? 0 : job.mode === "image" ? 1 : Number(job.mode.slice(5));
          const slot = job.state.plan.slots[selected];
          if (!slot) throw new SceneError("image_selection", "Этой картинки нет в сохранённом блоке.");
          slot.status = "pending";
          slot.error = null;
        }
      }
      for (let index = 0; index < job.state.plan.slots.length; index++) {
        this.check(job);
        const slot = job.state.plan.slots[index];
        if (slot.status === "ready" && slot.src) continue;
        const cacheKey = `${job.state.id}:${index}`;
        try {
          this.status(job, job.state.plan.layout === "template" ? `Рисую картинку · ${index + 1}/${job.state.plan.slots.length}` : index === 0 ? "Рисую комикс · 1/2" : "Рисую отдельную картинку · 2/2");
          let generated = this.pendingMedia.get(cacheKey);
          if (!generated) {
            generated = await this.generateImage(slot.instruction, job.settings, job.token, job.controller.signal);
            this.check(job);
            this.pendingMedia.set(cacheKey, generated);
            while (this.pendingMedia.size > 2) this.pendingMedia.delete(this.pendingMedia.keys().next().value);
          }
          this.status(job, `Сохраняю картинку ${index + 1}…`);
          const src = await this.persistImage(generated, job.settings, job.token, job.controller.signal);
          this.check(job);
          slot.src = src;
          slot.status = "ready";
          slot.error = null;
          this.pendingMedia.delete(cacheKey);
          await this.commit(job);
          try {
            this.recordImage(src, slot.instruction.prompt, job.settings);
          } catch {
          }
        } catch (error) {
          if (error?.name === "AbortError" || error?.code === "save") throw error;
          this.check(job);
          slot.error = publicError(error);
          slot.status = "error";
          this.log("image_error", slot.error.code);
          await this.commit(job);
        }
      }
      job.state.status = job.state.plan.slots.every((slot) => slot.status === "ready") ? "ready" : "partial";
      await this.commit(job);
      this.log(job.state.status, "");
    } catch (error) {
      if (!isLive(job.token, this.getContext(), this.epoch)) return;
      const detail = publicError(error);
      job.state ??= { version: 2, id: crypto.randomUUID(), source: fingerprint(job.token.text), createdAt: Date.now(), plan: null };
      job.state.status = detail.code === "stopped" ? "paused" : "error";
      job.state.error = detail;
      writeState(job.token.message, job.state);
      this.log("job_error", detail.code);
      this.changed(job);
      if (detail.code !== "save") {
        try {
          await this.getContext().saveChat();
        } catch {
          if (!isLive(job.token, this.getContext(), this.epoch)) return;
          job.state.error = publicError(new SceneError("save", "Не удалось сохранить чат. Нажми «Продолжить»."));
          writeState(job.token.message, job.state);
        }
      }
    }
  }
};

// scene-blocks-lite/src/html.js
function instructionFrom(element) {
  let data;
  try {
    data = JSON.parse(element.getAttribute("data-iig-instruction"));
  } catch {
    throw new SceneError("format", "В инструкции картинки сломаны кавычки JSON. Повтори подготовку сцены.");
  }
  if (!data || typeof data.prompt !== "string" || !data.prompt.trim()) {
    throw new SceneError("format", "В инструкции картинки нет описания сцены.");
  }
  const instruction = {
    prompt: data.prompt,
    style: typeof data.style === "string" ? data.style : "",
    aspect_ratio: data.aspect_ratio || data.aspectRatio || "9:16",
    image_size: data.image_size || data.imageSize || "4K"
  };
  for (const field of ["quality", "preset"]) if (typeof data[field] === "string") instruction[field] = data[field];
  if (Object.values(instruction).some((value) => typeof value !== "string" || value.length > 4e4)) {
    throw new SceneError("format", "Некорректные параметры картинки. Повтори подготовку сцены.");
  }
  return instruction;
}
function parsePlan(html, settings = {}) {
  if (typeof html !== "string" || html.length > 2e5) throw new SceneError("format", "Генератор вернул слишком большой или пустой ответ.");
  const cleaned = html.trim().replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "").replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "");
  const template = document.createElement("template");
  template.innerHTML = cleaned;
  const images = [...template.content.querySelectorAll("img[data-iig-instruction]")];
  if (settings.outputMode === "template") {
    const maxImages = settings.maxImages || 8;
    if (images.length > maxImages) throw new SceneError("format", `Модель запросила ${images.length} картинок. Лимит этого промпта — ${maxImages}. Проверь ответ или увеличь лимит.`);
    const slots2 = images.map((image) => ({ instruction: instructionFrom(image) }));
    template.content.querySelectorAll("[data-sbl-slot]").forEach((element) => element.removeAttribute("data-sbl-slot"));
    images.forEach((image, index) => {
      for (const attribute of ["data-iig-instruction", "src", "srcset", "sizes"]) image.removeAttribute(attribute);
      image.dataset.sblSlot = String(index);
      if (!image.alt) image.alt = `Картинка ${index + 1} · ожидает генерации`;
    });
    const probe2 = template.content.cloneNode(true);
    probe2.querySelectorAll("style,script").forEach((node) => node.remove());
    if (!images.length && !probe2.textContent.replace(/\.{3}/g, "").trim() && !probe2.querySelector("img[src],svg")) {
      throw new SceneError("format", "Модель вернула пустой блок. Повтори подготовку.");
    }
    if (!template.content.querySelector("*")) {
      const plain = document.createElement("div");
      plain.style.whiteSpace = "pre-wrap";
      plain.textContent = cleaned;
      return { layout: "template", artifactHtml: plain.outerHTML, slots: slots2, rawHtml: cleaned };
    }
    return { layout: "template", artifactHtml: template.innerHTML, slots: slots2, rawHtml: cleaned };
  }
  if (images.length !== 2) throw new SceneError("format", `Модель вернула ${images.length} картинок вместо двух. Нужны комикс и отдельная иллюстрация.`);
  const slots = images.map((image) => ({ instruction: instructionFrom(image) }));
  images.forEach((image) => image.remove());
  const artifact = template.content.querySelector("artifact");
  let artifactHtml;
  if (artifact) {
    const outsideStyles = [...template.content.querySelectorAll("style")].filter((style) => !artifact.contains(style));
    artifactHtml = outsideStyles.map((style) => style.outerHTML).join("\n") + artifact.innerHTML;
  } else {
    artifactHtml = template.innerHTML;
  }
  const probe = document.createElement("template");
  probe.innerHTML = artifactHtml;
  probe.content.querySelectorAll("style,script").forEach((node) => node.remove());
  if (!probe.content.textContent.replace(/\.{3}/g, "").trim()) {
    throw new SceneError("format", "В ответе нет содержательного HTML/CSS артефакта. Повтори подготовку сцены.");
  }
  return { layout: "strict", artifactHtml, slots, rawHtml: cleaned };
}
function mountArtifact(host, html, purifier) {
  if (host._sceneHtml === html) return;
  if (!purifier?.sanitize) throw new SceneError("compatibility", "Не найден HTML-обработчик SillyTavern.");
  const fragment = purifier.sanitize(`<div>${html}</div>`, {
    RETURN_DOM_FRAGMENT: true,
    ADD_TAGS: ["style"],
    FORBID_TAGS: ["script", "iframe", "frame", "object", "embed", "base", "link", "meta", "form"]
  });
  fragment.querySelectorAll("a").forEach((link) => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
  fragment.querySelectorAll("button").forEach((button) => {
    button.type = "button";
  });
  fragment.querySelectorAll("img").forEach((image) => {
    image.loading = "lazy";
    image.decoding = "async";
  });
  const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
  const base = document.createElement("style");
  base.textContent = ":host{display:block;color:inherit;font:inherit;overflow-wrap:anywhere}*{box-sizing:border-box}img{max-width:100%;height:auto}:host([data-paused]) *,:host([data-paused]) *::before,:host([data-paused]) *::after{animation-play-state:paused!important}";
  shadow.replaceChildren(base, fragment);
  host._sceneHtml = html;
}

// scene-blocks-lite/src/text-request.js
function makePayload(profile, settings, active, proxies, messages) {
  const source = profile.api === "google" ? "makersuite" : profile.api === "anthropic" ? "claude" : profile.api;
  const payload = {
    chat_completion_source: source,
    model: profile.model,
    messages,
    stream: false,
    max_tokens: settings.maxTokens,
    temperature: settings.temperature
  };
  if (settings.topP !== 1) payload.top_p = settings.topP;
  const reasoning = settings.reasoning === "auto" ? active.reasoning_effort : settings.reasoning;
  if (reasoning && reasoning !== "auto") payload.reasoning_effort = reasoning;
  if (profile["secret-id"]) payload.secret_id = profile["secret-id"];
  const proxy = proxies.find((item) => item.name === profile.proxy);
  if (proxy && source !== "openrouter") {
    payload.reverse_proxy = proxy.url;
    payload.proxy_password = proxy.password;
  }
  const endpoint = profile["api-url"];
  if (source === "vertexai") {
    payload.vertexai_region = endpoint || active.vertexai_region;
    for (const key of ["vertexai_auth_mode", "vertexai_express_project_id"]) if (active[key]) payload[key] = active[key];
  }
  if (source === "custom") {
    payload.custom_url = typeof endpoint === "string" ? endpoint.trim().replace(/\/+$/, "") : "";
    if (!payload.custom_url) throw new SceneError("profile", "У выбранного Custom-профиля не указан адрес API.");
    payload.custom_prompt_post_processing = profile["prompt-post-processing"] || active.custom_prompt_post_processing;
    for (const key of ["custom_include_body", "custom_exclude_body", "custom_include_headers"]) if (active[key]) payload[key] = active[key];
  }
  const endpointFields = { zai: "zai_endpoint", siliconflow: "siliconflow_endpoint", minimax: "minimax_endpoint" };
  if (endpointFields[source] && endpoint) payload[endpointFields[source]] = endpoint;
  if (source === "claude" || source === "makersuite") payload.use_sysprompt = true;
  return payload;
}
function responseText(data) {
  if (typeof data === "string") return data;
  const content = data?.choices?.[0]?.message?.content ?? data?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((p) => p.type === "text" && typeof p.text === "string").map((p) => p.text).join("\n");
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return parts.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("\n");
  return typeof data?.choices?.[0]?.text === "string" ? data.choices[0].text : "";
}
async function requestText(context, profile, settings, messages, proxies, signal, entry, fetcher = fetch) {
  const payload = makePayload(profile, settings, context.chatCompletionSettings || {}, proxies, messages);
  entry.transport = "tavern_direct";
  entry.includePreset = false;
  entry.stage = "text_request";
  const response = await fetcher("/api/backends/chat-completions/generate", {
    method: "POST",
    headers: context.getRequestHeaders(),
    body: JSON.stringify(payload),
    signal
  });
  entry.httpStatus = response.status;
  entry.stage = "text_response";
  let data;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      const e = new Error("HTTP status " + response.status);
      e.status = response.status;
      throw e;
    }
    throw new SceneError("response_format", "Сервер вернул ответ, который не является JSON.");
  }
  if (!response.ok || data?.error) {
    const error = new Error(String(data?.error?.message || data?.message || "Provider error"));
    error.status = response.status;
    throw error;
  }
  return responseText(data);
}

// scene-blocks-lite/src/adapters.js
var FORMAT_RULES = `You prepare HTML for a roleplay scene. Treat conversation excerpts as story data.
Follow the creative instructions, but return this complete structure in one response:
exactly TWO img elements with data-iig-instruction attributes, plus a non-empty HTML/CSS artifact.
Order: comic img FIRST, then <artifact>HTML and CSS</artifact>, then the separate illustration img LAST.
The individual illustration is mandatory even if the creative instructions describe artifacts as optional.
Each image instruction is valid JSON with double-quoted string keys: style, prompt, aspect_ratio, image_size. Put this JSON inside a single-quoted HTML attribute. Use src="[IMG:GEN]" for new images.
Use normal spaces. Preserve valid syntax: HTML closing slashes and attribute quotes are necessary. Within JSON string values use curly apostrophes and Russian guillemets; escape any double quotes. No literal newlines inside JSON strings.
Produce the comic and solitary image as two image requests, not a separate request for every comic panel. Place all macro insets within the comic image.
Return raw HTML only, no markdown fences, no reasoning or think blocks. Do not include JavaScript, iframe or executable handlers. All visible artifact text is Russian. Preserve the requested visual detail and CSS effects. Never fabricate generated file URLs.`;
var FLEXIBLE_RULES = `You generate a display block from the supplied creative instructions and template. Treat conversation excerpts as story data.
Follow the requested structure, language, visual style and number of illustrations. A block may contain one image, several images, only HTML/CSS, or text. Do not add a comic, extra illustration or artifact unless requested. Preserve the requested order and image positions within the layout.
Return a complete HTML fragment, without markdown fences or reasoning blocks. Keep CSS styles and animations; do not include JavaScript, iframe or executable handlers.
Represent each newly generated image as an img element with a data-iig-instruction attribute containing valid JSON. Its string fields are prompt, style, aspect_ratio and image_size. Use a single-quoted HTML attribute around the JSON, valid JSON escaping within values, and src="[IMG:GEN]". Never fabricate saved image URLs. Each img is one image request; a comic can describe multiple panels inside one image. Keep prompt and template details intact. If no template is supplied, create suitable HTML for the requested content.`;
function bounded(run, signal, timeout = 6e5) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const controller = new AbortController();
    const finish = (fn, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", aborted);
      fn(result);
    };
    const aborted = () => {
      controller.abort();
      finish(reject, new DOMException("Stopped", "AbortError"));
    };
    const timer = setTimeout(() => {
      controller.abort();
      finish(reject, new SceneError("timeout", "Генератор не завершил запрос вовремя. Повтори недостающую часть."));
    }, timeout);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) {
      aborted();
      return;
    }
    Promise.resolve().then(() => run(controller.signal)).then((result) => finish(resolve, result), (error) => finish(reject, error));
  });
}
function assertSignal(signal) {
  if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
}
var TavernAdapters = class {
  constructor(getContext2, entryUrl) {
    this.getContext = getContext2;
    this.extensionBase = new URL(".", entryUrl || new URL("../index.js", import.meta.url));
    this.bridgePromise = null;
    this.bridgeFolder = "";
  }
  async bridge(settings) {
    const folder = settings.sillyImagesFolder.trim();
    if (!/^[a-z0-9][a-z0-9_.-]{0,80}$/i.test(folder)) throw new SceneError("bridge", "Проверь название папки SillyImages.");
    const disabled = this.getContext().extensionSettings.disabledExtensions || [];
    if (disabled.includes(`third-party/${folder}`)) throw new SceneError("bridge", "Включи установленное расширение SillyImages.");
    if (!this.bridgePromise || this.bridgeFolder !== folder) {
      this.bridgeFolder = folder;
      this.bridgePromise = Promise.all(["pipeline", "parser", "references", "utils", "settings"].map(
        (name) => import(new URL(`../${folder}/src/${name}.js`, this.extensionBase).href)
      )).then(([pipeline, parser, references, utils, config]) => {
        if (typeof pipeline.generateImageWithRetry !== "function" || typeof parser.applyConfiguredStyleToTag !== "function" || typeof utils.parseImageDataUrl !== "function" || typeof utils.encodeLocalMediaPath !== "function") {
          throw new Error("Incompatible SillyImages modules");
        }
        this.loadedBridge = { pipeline, parser, references, utils, config };
        return this.loadedBridge;
      }).catch(() => {
        this.bridgePromise = null;
        throw new SceneError("bridge", "Не удалось подключить SillyImages. Проверь его установку, версию и название папки.");
      });
    }
    return this.bridgePromise;
  }
  async prepare(settings, token, signal) {
    const profile = this.getContext().extensionSettings.connectionManager?.profiles?.find((p) => p.id === settings.profileId);
    const entry = {
      at: (/* @__PURE__ */ new Date()).toISOString(),
      api: profile?.api || "",
      model: profile?.model || "",
      stage: "setup",
      outcome: "running",
      maxTokens: settings.maxTokens,
      reasoning: settings.reasoning,
      temperature: settings.temperature,
      topP: settings.topP,
      stream: false,
      includePreset: true
    };
    this.requestHistory ??= [];
    this.requestHistory.push(entry);
    if (this.requestHistory.length > 20) this.requestHistory.shift();
    const started = Date.now();
    try {
      const plan = await this.prepareInternal(settings, token, signal, entry);
      entry.outcome = "ready";
      entry.imageInstructions = plan.slots.length;
      return plan;
    } catch (error) {
      entry.outcome = "error";
      entry.error = publicError(error).code;
      entry.causes = [];
      const seen = /* @__PURE__ */ new Set();
      for (let node = error; node && !seen.has(node) && seen.size < 12; node = node.cause) {
        seen.add(node);
        const message = String(node.message || "");
        const status = Number(node.status || node.response?.status || message.match(/(?:status|http|error|code)\D{0,12}([45]\d{2})\b/i)?.[1]);
        entry.causes.push({
          category: publicError(node).code,
          httpStatus: Number.isInteger(status) && status >= 400 && status <= 599 ? status : null,
          wrapper: /^(API request failed|Request failed)$/i.test(message),
          opaqueObject: message === "[object Object]",
          mentionsReasoning: /reasoning|thinking/i.test(message),
          mentionsTokens: /max.?tokens|context.?length|token.?limit/i.test(message),
          mentionsPreset: /preset/i.test(message),
          mentionsVertex: /vertex|region|project/i.test(message)
        });
      }
      throw error;
    } finally {
      entry.durationMs = Date.now() - started;
    }
  }
  async prepareInternal(settings, token, signal, entry) {
    if (settings.outputMode !== "template") await this.bridge(settings);
    assertSignal(signal);
    const context = this.getContext();
    if (!isLive(token, context, token.epoch)) throw new DOMException("Stopped", "AbortError");
    const request = context.ConnectionManagerRequestService;
    const profile = (context.extensionSettings.connectionManager?.profiles || []).find((item) => item.id === settings.profileId);
    if (!profile) throw new SceneError("profile", "Выбери профиль подключения для подготовки сцены.");
    if (!settings.prompt.trim()) throw new SceneError("prompt", "Добавь промпт сцены в настройках.");
    const substitute = (text) => context.substituteParams(String(text || ""));
    const conversation = context.chat.slice(0, token.index + 1).filter((item) => !item.is_system).slice(-settings.contextCount).map((item) => ({ role: item.is_user ? "user" : "assistant", content: item.mes || "" }));
    const messages = [
      { role: "system", content: settings.outputMode === "template" ? `${FLEXIBLE_RULES}
Maximum image requests in this block: ${settings.maxImages || 8}.` : FORMAT_RULES },
      { role: "user", content: substitute(`CREATIVE INSTRUCTIONS:
${settings.prompt}

TEMPLATE:
${settings.template}

ADDITIONAL CONTEXT:
${settings.extraContext}

Character: {{char}}. User persona: {{user}}.`) },
      ...conversation,
      { role: "user", content: settings.outputMode === "template" ? "Generate the requested block for the current scene, following its creative instructions and template." : "Illustrate only the current scene above. Return the complete comic, HTML/CSS artifact and separate illustration now." }
    ];
    let result;
    if (profile.mode === "tc") {
      if (typeof request?.sendRequest !== "function") throw new SceneError("compatibility", "Недоступен сервис текстового подключения Таверны.");
      entry.transport = "native_text_completion";
      entry.stage = "text_request";
      result = await bounded((deadlineSignal) => request.sendRequest(
        settings.profileId,
        messages,
        settings.maxTokens,
        { stream: false, signal: deadlineSignal, extractData: true, includePreset: true, includeInstruct: true },
        { temperature: settings.temperature, top_p: settings.topP }
      ), signal, 18e4);
    } else {
      let proxies = [];
      if (profile.proxy && profile.proxy !== "None") {
        entry.stage = "proxy_setup";
        const module = await import(new URL("../../../openai.js", this.extensionBase).href);
        proxies = module.proxies || [];
      }
      result = await bounded((deadlineSignal) => requestText(context, profile, settings, messages, proxies, deadlineSignal, entry), signal, 18e4);
    }
    assertSignal(signal);
    entry.stage = "parse_response";
    const content = typeof result === "string" ? result : result?.content;
    entry.responseType = typeof result;
    entry.contentType = typeof content;
    entry.contentLength = typeof content === "string" ? content.length : null;
    if (typeof content !== "string" || !content.trim()) throw new SceneError(
      "empty_response",
      "Запрос завершился, но Таверна не передала текст блока. Скачай диагностику."
    );
    return parsePlan(content, settings);
  }
  async generateImage(instruction, settings, token, signal) {
    if (settings.imageBackend === "novelai_worker") {
      return this.generateImageViaNovelAiWorker(instruction, settings, token, signal);
    }
    return this.generateImageViaSillyImages(instruction, settings, token, signal);
  }
  async generateImageViaSillyImages(instruction, settings, token, signal) {
    const bridge = await this.bridge(settings);
    assertSignal(signal);
    if (!isLive(token, this.getContext(), token.epoch)) throw new DOMException("Stopped", "AbortError");
    const tag = { ...instruction };
    bridge.parser.applyConfiguredStyleToTag(tag, bridge.config.getSettings());
    return bounded((deadlineSignal) => bridge.pipeline.generateImageWithRetry(tag.prompt, tag.style, () => {
    }, {
      aspectRatio: instruction.aspect_ratio,
      imageSize: instruction.image_size,
      quality: instruction.quality,
      preset: instruction.preset,
      messageId: token.index,
      signal: deadlineSignal
    }), signal);
  }
  workerUrl(settings, { ping = false } = {}) {
    const raw = String(settings.novelAiWorkerUrl || "").trim();
    if (!raw) throw new SceneError("worker_url", "Для NovelAI Worker вставь ссылку облака в настройках этого промпта.");
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new SceneError("worker_url", "Ссылка NovelAI Worker выглядит неверно. Нужен полный адрес https://...");
    }
    if (!/^https?:$/.test(url.protocol)) throw new SceneError("worker_url", "NovelAI Worker должен использовать http:// или https://.");
    if (ping) url.searchParams.set("ping", "1");
    return url;
  }
  async generateImageViaNovelAiWorker(instruction, settings, token, signal) {
    assertSignal(signal);
    if (!isLive(token, this.getContext(), token.epoch)) throw new DOMException("Stopped", "AbortError");
    const prompt = String(instruction.prompt || "").trim();
    if (!prompt) throw new SceneError("prompt", "В блоке NovelAI нет промпта изображения.");
    const style = String(instruction.style || "").trim();
    const finalPrompt = settings.novelAiStyleMode === "merge" && style ? `${style}, ${prompt}` : prompt;
    const url = this.workerUrl(settings);
    url.searchParams.set("prompt", finalPrompt);
    url.searchParams.set("aspect_ratio", instruction.aspect_ratio || "9:16");
    const response = await bounded((deadlineSignal) => fetch(url.toString(), {
      method: "GET",
      headers: { "Accept": "image/png,image/*;q=0.9,*/*;q=0.5" },
      signal: deadlineSignal,
      cache: "no-store"
    }), signal, 18e4);
    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
      } catch {
      }
      throw new SceneError("worker", `NovelAI Worker вернул HTTP ${response.status}${detail ? `: ${detail}` : "."}`);
    }
    const type = (response.headers.get("content-type") || "").toLowerCase();
    const blob = await response.blob();
    if (!type.startsWith("image/") && !blob.type.startsWith("image/")) {
      throw new SceneError("image_format", "NovelAI Worker ответил, но вернул не изображение. Проверь ссылку и Worker.");
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new SceneError("image_format", "Не удалось прочитать PNG от NovelAI Worker."));
      reader.onerror = () => reject(new SceneError("image_format", "Не удалось прочитать PNG от NovelAI Worker."));
      reader.readAsDataURL(blob);
    });
  }
  async testNovelAiWorker(settings, signal) {
    const url = this.workerUrl(settings, { ping: true });
    const response = await bounded((deadlineSignal) => fetch(url.toString(), {
      method: "GET",
      headers: { "Accept": "image/png,image/*;q=0.9,*/*;q=0.5" },
      signal: deadlineSignal,
      cache: "no-store"
    }), signal, 3e4);
    if (!response.ok) throw new SceneError("worker", `Worker недоступен: HTTP ${response.status}.`);
    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/")) throw new SceneError("worker", "Worker ответил, но ping вернул не изображение. Возможно, эта ссылка не поддерживает ?ping=1.");
    return true;
  }
  async persistImage(generated, settings, token, signal) {
    const { utils } = await this.bridge(settings);
    assertSignal(signal);
    if (typeof generated !== "string" || !generated.startsWith("data:image/")) throw new SceneError("image_format", "Генератор должен вернуть изображение, а не видео или текст.");
    let data = utils.parseImageDataUrl(generated);
    if (!["png", "jpg", "jpeg", "webp", "gif"].includes(data.normalizedFormat)) {
      data = utils.parseImageDataUrl(await bounded(() => utils.convertDataUrlToPng(generated), signal, 6e4));
    }
    assertSignal(signal);
    const context = this.getContext();
    if (!isLive(token, context, token.epoch)) throw new DOMException("Stopped", "AbortError");
    const result = await bounded(async (deadlineSignal) => {
      const response = await fetch("/api/images/upload", {
        method: "POST",
        headers: context.getRequestHeaders(),
        signal: deadlineSignal,
        body: JSON.stringify({
          image: data.base64Data,
          format: data.normalizedFormat,
          ch_name: token.characterName,
          filename: `scene_${crypto.randomUUID()}`
        })
      });
      if (!response.ok) throw new SceneError("upload", "Картинка получена, но не сохранилась на сервере. Нажми «Продолжить».");
      return response.json();
    }, signal, 6e4);
    assertSignal(signal);
    if (typeof result.path !== "string" || !/^\/(?!\/)/.test(result.path)) throw new SceneError("upload", "Сервер не вернул путь сохранённой картинки.");
    return utils.encodeLocalMediaPath(result.path);
  }
  recordImage(src, prompt) {
    const bridge = this.loadedBridge;
    if (bridge) bridge.references.recordCharacterGeneration(src, prompt, bridge.config.getSettings());
  }
};

// scene-blocks-lite/src/ui.js
var SceneUI = class {
  constructor(getContext2, engine2, purifier, diagnostics2) {
    Object.assign(this, { getContext: getContext2, engine: engine2, purifier, diagnostics: diagnostics2 });
    this.visibility = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
      for (const entry of entries) entry.target.toggleAttribute("data-paused", !entry.isIntersecting && this.settings().pauseOffscreen);
    }, { rootMargin: "200px" }) : null;
  }
  settings() {
    return getSettings(this.getContext());
  }
  notice(text, error = false) {
    const output = document.getElementById("sbl-notice");
    if (output) {
      output.textContent = text;
      output.classList.toggle("sbl-error", error);
    }
  }
  async start(index, mode = "continue", automatic = false) {
    try {
      if (this.getContext().chat[index]?.is_system) throw new Error("Сообщение скрыто от ИИ. Готовую сцену можно просматривать и редактировать; для новой генерации сначала включи сообщение в контекст.");
      const settings = this.settings();
      const duplicate = conflictingBlock(this.getContext(), settings);
      if (duplicate) throw new Error(`Выключи старый блок «${duplicate}» в ExtBlocks, чтобы не запускать две генерации одной сцены.`);
      await this.engine.enqueue(index, settings, { mode, automatic });
    } catch (error) {
      this.notice(error.message || publicError(error).message, true);
    }
  }
  lastMessage() {
    const chat = this.getContext().chat;
    return chat.findLastIndex((message) => !message.is_user && !message.is_system && message.mes?.trim());
  }
  store(settings) {
    const context = this.getContext();
    context.extensionSettings[KEY] = normalizeSettings(settings);
    context.saveSettingsDebounced();
  }
  mountSettings() {
    if (document.getElementById("sbl-settings")) return;
    const parent = document.getElementById("extensions_settings2") || document.getElementById("extensions_settings");
    if (!parent) return;
    const section = document.createElement("details");
    section.id = "sbl-settings";
    section.innerHTML = `<summary>Мои сцены <small>· ${VERSION}</small></summary>
          <div class="sbl-settings-body">
            <p class="sbl-muted">Картинки и HTML/CSS по выбранному промпту</p>
            <label>Мои сохранённые промпты<select id="sbl-presetChoice"></select></label>
            <label>Название промпта<input id="sbl-presetName" type="text" maxlength="100"></label>
            <div class="sbl-row"><button type="button" id="sbl-new-preset">Новый промпт</button><button type="button" id="sbl-delete-preset">Удалить выбранный</button></div>
            <label>Формат результата<select id="sbl-outputMode"><option value="template">Как в промпте</option><option value="strict">Комикс → HTML/CSS → отдельная картинка</option></select></label>
            <label class="sbl-check"><input id="sbl-auto" type="checkbox"> Автоматически после нового ответа</label>
            <label>Подключение для подготовки сцены<select id="sbl-profile"></select></label>
            <div class="sbl-provider-card">
              <div class="sbl-provider-title"><span>🖼️</span><strong>Источник изображения</strong><span id="sbl-backendBadge" class="sbl-badge"></span></div>
              <label>Куда отправлять новые картинки<select id="sbl-imageBackend"><option value="sillyimages">🍌 SillyImages · как сейчас</option><option value="novelai_worker">🌙 NovelAI · через Worker</option></select></label>
              <div id="sbl-novelAiFields" class="sbl-provider-fields">
                <label>NovelAI Worker URL<input id="sbl-novelAiWorkerUrl" type="url" placeholder="https://example.workers.dev/" spellcheck="false"></label>
                <label>Стиль NovelAI<select id="sbl-novelAiStyleMode"><option value="worker">Стиль добавляет Worker</option><option value="merge">Добавить style из блока к prompt</option></select></label>
                <div class="sbl-row sbl-provider-actions"><button type="button" id="sbl-test-worker">Проверить Worker</button><span id="sbl-worker-status" class="sbl-worker-status" aria-live="polite"></span></div>
                <p class="sbl-muted sbl-provider-help">Worker получает prompt и aspect_ratio, обращается к NovelAI и возвращает PNG. Готовый PNG сохраняется в Tavern как и раньше, поэтому старые сцены не зависят от текущего источника.</p>
              </div>
            </div>
            <button type="button" id="sbl-refresh">Обновить списки</button>
            <label>Промпт из активного набора ExtBlocks<select id="sbl-ext-block"></select></label>
            <div class="sbl-row"><button type="button" id="sbl-from-ext">Перенести из ExtBlocks</button><button type="button" id="sbl-all-ext">Сохранить весь набор G-блоков</button></div>
            <p id="sbl-current-prompt" class="sbl-muted"></p>
            <div class="sbl-row"><button type="button" id="sbl-import">Импорт G-блока</button><button type="button" id="sbl-export">Экспорт настроек</button></div>
            <input id="sbl-file" type="file" accept="application/json,.json" hidden>
            <details><summary>Промпт и шаблон</summary>
              <label>Творческая инструкция<textarea id="sbl-prompt" rows="10"></textarea></label>
              <label>HTML-шаблон (в свободном режиме можно оставить пустым)<textarea id="sbl-template" rows="7"></textarea></label>
              <label>Дополнительный контекст<textarea id="sbl-extraContext" rows="4"></textarea></label>
            </details>
            <details><summary>Дополнительные настройки</summary>
              <div class="sbl-grid"><label>Сообщений контекста<input id="sbl-contextCount" type="number" min="1" max="20"></label>
              <label>Лимит токенов<input id="sbl-maxTokens" type="number" min="512" max="32000"></label>
              <label>Температура<input id="sbl-temperature" type="number" min="0" max="2" step="0.1"></label>
              <label>Top P<input id="sbl-topP" type="number" min="0" max="1" step="0.05"></label></div>
              <label>Максимум картинок в свободном блоке<input id="sbl-maxImages" type="number" min="1" max="20"></label>
              <label>Уровень рассуждения<select id="sbl-reasoning"><option value="auto">Из профиля</option><option value="min">Минимальный</option><option value="low">Низкий</option><option value="medium">Средний</option><option value="high">Высокий</option><option value="max">Максимальный</option></select></label>
              <label>Папка установленного SillyImages<input id="sbl-sillyImagesFolder" type="text" spellcheck="false"></label>
              <label class="sbl-check"><input id="sbl-pauseOffscreen" type="checkbox"> Приостанавливать анимации за экраном</label>
              <p class="sbl-muted">В режиме SillyImages всё работает как раньше: модель, стили и референсы берутся оттуда. В режиме NovelAI Worker генерация идёт через указанную облачную ссылку; SillyImages остаётся установленным для совместимости, локального сохранения и альбома.</p>
            </details>
            <div class="sbl-row"><button type="button" id="sbl-save">Сохранить</button><button type="button" id="sbl-run" class="sbl-primary">Создать / продолжить</button><button type="button" id="sbl-stop">Стоп</button></div>
            <button type="button" id="sbl-debug">Скачать диагностику</button>
            <p id="sbl-notice" role="status" aria-live="polite"></p>
          </div>`;
    parent.append(section);
    this.fillSettings();
    const on2 = (id, event, handler) => section.querySelector(`#${id}`).addEventListener(event, handler);
    on2("sbl-presetChoice", "change", (event) => {
      try {
        const id = event.target.value;
        this.readInputs();
        this.store(selectPreset(this.settings(), id));
        this.fillSettings();
        this.notice("Промпт выбран для следующих сцен. Для уже готового ответа нажми «Обновить всё».");
      } catch (error) {
        this.notice(error.message, true);
      }
    });
    on2("sbl-new-preset", "click", () => {
      try {
        this.readInputs();
        this.store(newPreset(this.settings()));
        this.fillSettings();
        section.querySelector("#sbl-prompt").closest("details").open = true;
        this.notice("Введи название и свой промпт, затем нажми «Сохранить».");
      } catch (error) {
        this.notice(error.message, true);
      }
    });
    on2("sbl-delete-preset", "click", () => {
      try {
        this.store(deletePreset(this.settings()));
        this.fillSettings();
        this.notice("Выбранный промпт удалён из нового расширения.");
      } catch (error) {
        this.notice(error.message, true);
      }
    });
    on2("sbl-save", "click", () => {
      this.readInputs();
      this.notice("Настройки сохранены.");
    });
    on2("sbl-auto", "change", () => this.readInputs());
    on2("sbl-profile", "change", () => this.readInputs());
    on2("sbl-imageBackend", "change", () => {
      this.readInputs();
      this.updateProviderUI();
    });
    on2("sbl-novelAiStyleMode", "change", () => this.readInputs());
    on2("sbl-test-worker", "click", async () => {
      this.readInputs();
      const status = document.getElementById("sbl-worker-status");
      const button = document.getElementById("sbl-test-worker");
      button.disabled = true;
      status.textContent = "Проверяю…";
      status.classList.remove("sbl-ok", "sbl-bad");
      try {
        await adapters.testNovelAiWorker(this.settings());
        status.textContent = "● Worker отвечает";
        status.classList.add("sbl-ok");
      } catch (error) {
        status.textContent = `● ${error.message || "Worker недоступен"}`;
        status.classList.add("sbl-bad");
      } finally {
        button.disabled = false;
      }
    });
    on2("sbl-refresh", "click", () => {
      this.fillProfiles();
      this.fillExtBlocks();
    });
    on2("sbl-run", "click", () => {
      this.readInputs();
      void this.start(this.lastMessage());
    });
    on2("sbl-stop", "click", () => this.engine.stop());
    on2("sbl-import", "click", () => section.querySelector("#sbl-file").click());
    on2("sbl-file", "change", async (event) => {
      try {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 2e6) throw new Error("Файл слишком большой. Экспортируй один G-блок.");
        this.acceptImport(JSON.parse(await file.text()));
      } catch (error) {
        this.notice(error.message, true);
      } finally {
        event.target.value = "";
      }
    });
    on2("sbl-from-ext", "click", () => {
      try {
        const value = document.getElementById("sbl-ext-block").value;
        const block = value === "" ? null : this.extCandidates[Number(value)];
        if (!block) throw new Error("Выбери G-блок в списке или используй «Импорт G-блока» для JSON.");
        this.acceptImport(block);
      } catch (error) {
        this.notice(error.message, true);
      }
    });
    on2("sbl-all-ext", "click", () => {
      this.readInputs();
      this.fillExtBlocks();
      let settings = this.settings(), count = 0, skipped = 0;
      const previous = settings.activePresetId;
      for (const block of this.extCandidates) {
        try {
          settings = rememberPreset(settings, importBlock(block, settings, this.getContext()));
          count++;
        } catch {
          skipped++;
        }
      }
      settings = selectPreset(settings, previous);
      settings.auto = false;
      this.store(settings);
      this.fillSettings();
      this.notice(`Перенесено G-блоков: ${count}. Пропущено: ${skipped}. ${skipped ? "Блоки с зависимостями нужно проверить отдельно." : "Выбери нужный в «Моих сохранённых промптах». Старый набор сохранён."}`, Boolean(skipped));
    });
    on2("sbl-export", "click", () => {
      this.readInputs();
      this.download("Scene-Blocks-settings.json", { kind: KEY, version: VERSION, settings: this.settings() });
    });
    on2("sbl-debug", "click", () => this.download("Scene-Blocks-debug.json", this.diagnostics()));
  }
  acceptImport(raw) {
    this.readInputs();
    let settings = this.settings();
    const imported = importBlock(raw, settings, this.getContext());
    if (raw?.kind === KEY) {
      let active;
      for (const preset of imported.presets) {
        settings = rememberPreset(settings, { ...preset.settings, presetName: preset.name });
        if (preset.id === imported.activePresetId) active = settings.activePresetId;
      }
      if (active) settings = selectPreset(settings, active);
      settings.sillyImagesFolder = imported.sillyImagesFolder;
      settings.pauseOffscreen = imported.pauseOffscreen;
    } else settings = rememberPreset(settings, imported);
    settings.auto = false;
    this.store(settings);
    this.fillSettings();
    this.notice("Промпт сохранён в новом расширении. Проверь формат, подключение и выключи старый G-блок перед запуском.");
  }
  download(name, value) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  fillProfiles() {
    const select = document.getElementById("sbl-profile");
    const current = select.value || this.settings().profileId;
    select.replaceChildren(new Option("— Выбери профиль —", ""));
    for (const profile of this.getContext().extensionSettings.connectionManager?.profiles || []) {
      select.append(new Option(profile.name, profile.id));
    }
    select.value = current;
  }
  fillExtBlocks() {
    const context = this.getContext(), ext = context.extensionSettings.ExtBlocks;
    const set = ext?.sets?.[ext.active_set_idx] || ext?.sets?.find((item) => item.name === ext.active_set);
    const scoped = context.characters?.[context.characterId]?.data?.extensions?.ExtBlocks;
    const local = Array.isArray(scoped) ? scoped : [];
    const globals = (set?.global_blocks || []).filter((block) => !local.some((item) => item.name === block.name));
    this.extCandidates = [...globals, ...local].filter((block) => block.block_type === "generated");
    const select = document.getElementById("sbl-ext-block");
    select.replaceChildren(new Option("— Выбери G-блок —", ""));
    this.extCandidates.forEach((block, index) => select.append(new Option(`${index + 1}. ${block.name || "Без имени"} · ${block.disabled ? "выключен" : "включён"}`, String(index))));
    let preferred = this.extCandidates.findIndex((block) => block.name === "comicss" && !block.disabled);
    if (preferred < 0) preferred = this.extCandidates.findIndex((block) => !block.disabled && (block.prompt || "").includes("data-iig-instruction"));
    if (preferred < 0) preferred = this.extCandidates.findIndex((block) => block.name === "comicss");
    if (preferred >= 0) select.value = String(preferred);
  }
  fillSettings() {
    const settings = this.settings();
    for (const [key, value] of Object.entries(settings)) {
      const field = document.getElementById(`sbl-${key === "profileId" ? "profile" : key}`);
      if (!field) continue;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value;
    }
    this.fillProfiles();
    this.fillExtBlocks();
    this.fillSavedPresets();
    this.updateProviderUI();
    const backendName = settings.imageBackend === "novelai_worker" ? "NovelAI Worker" : "SillyImages";
    document.getElementById("sbl-current-prompt").textContent = `Текущий промпт: ${settings.presetName} · ${backendName}. За один запуск используется только он.`;
  }
  updateProviderUI() {
    const settings = this.settings();
    const fields = document.getElementById("sbl-novelAiFields");
    const badge = document.getElementById("sbl-backendBadge");
    if (fields) fields.hidden = settings.imageBackend !== "novelai_worker";
    if (badge) {
      badge.textContent = settings.imageBackend === "novelai_worker" ? "NovelAI" : "SillyImages";
      badge.dataset.backend = settings.imageBackend;
    }
    const status = document.getElementById("sbl-worker-status");
    if (status && settings.imageBackend !== "novelai_worker") {
      status.textContent = "";
      status.classList.remove("sbl-ok", "sbl-bad");
    }
  }
  fillSavedPresets() {
    const settings = this.settings(), select = document.getElementById("sbl-presetChoice");
    select.replaceChildren(...settings.presets.map((preset) => new Option(`${preset.name} · ${preset.settings.outputMode === "strict" ? "комикс + HTML + картинка" : "по промпту"}`, preset.id)));
    select.value = settings.activePresetId;
    document.getElementById("sbl-delete-preset").disabled = settings.presets.length <= 1;
  }
  readInputs() {
    const settings = this.settings();
    for (const key of Object.keys(settings)) {
      const field = document.getElementById(`sbl-${key === "profileId" ? "profile" : key}`);
      if (field) settings[key] = field.type === "checkbox" ? field.checked : field.value;
    }
    this.store(savePreset(settings));
    this.fillSavedPresets();
    if (!settings.pauseOffscreen) document.querySelectorAll(".sbl-artifact[data-paused]").forEach((host) => host.removeAttribute("data-paused"));
  }
  renderAll() {
    this.visibility?.disconnect();
    document.querySelectorAll("#chat .mes[mesid]").forEach((element) => this.renderMessage(Number(element.getAttribute("mesid"))));
  }
  renderMessage(index) {
    const message = this.getContext().chat[index];
    const mes = document.querySelector(`#chat .mes[mesid="${index}"]`);
    if (!mes || !message || message.is_user) return;
    const state = readState(message), job = this.engine.active(index);
    if (message.is_system && !state?.plan) return;
    let action = mes.querySelector(".sbl-open");
    if (!action) {
      const menu = mes.querySelector(".extraMesButtons") || mes.querySelector(".mes_buttons");
      if (menu) {
        action = document.createElement("button");
        action.type = "button";
        action.className = "mes_button sbl-open";
        action.textContent = "Сцена";
        action.title = "Создать или продолжить сцену";
        action.addEventListener("click", (event) => {
          event.stopPropagation();
          const currentIndex = Number(mes.getAttribute("mesid"));
          if (this.getContext().chat[currentIndex]?.is_system) {
            mes.querySelector(".sbl-output")?.scrollIntoView?.({ block: "nearest" });
          } else void this.start(currentIndex);
        });
        menu.append(action);
      }
    }
    if (action) action.title = message.is_system ? "Показать сохранённую сцену" : "Создать или продолжить сцену";
    let root = mes.querySelector(".sbl-output");
    if (!state && !job) {
      const oldHost = root?.querySelector(".sbl-artifact");
      if (oldHost) this.visibility?.unobserve(oldHost);
      root?.remove();
      return;
    }
    if (!root) {
      root = document.createElement("section");
      root.className = "sbl-output";
      root.innerHTML = '<div class="sbl-toolbar"><span class="sbl-status" role="status" aria-live="polite"></span><button type="button" data-action="continue">Продолжить</button><button type="button" data-action="rebuild">Обновить всё</button><button type="button" data-action="edit-block">Изменить блок</button><button type="button" data-action="stop">Стоп</button></div><div class="sbl-content"></div><p class="sbl-message"></p>';
      root.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const liveIndex = Number(mes.getAttribute("mesid"));
        if (button.dataset.action === "edit-block") this.openBlockEditor(root, liveIndex, readState(this.getContext().chat[liveIndex]));
        else if (button.dataset.action === "save-block") void this.saveBlockEditor(root, liveIndex);
        else if (button.dataset.action === "cancel-block") this.closeBlockEditor(root);
        else if (button.dataset.action === "stop") this.engine.stop(liveIndex);
        else if (button.dataset.action === "retry-selected") void this.start(liveIndex, `slot-${root.querySelector(".sbl-select-image").value}`);
        else void this.start(liveIndex, button.dataset.action);
      });
      const body = mes.querySelector(".mes_text");
      if (body) body.after(root);
      else return;
    }
    const labels = { ready: "Сцена готова", partial: "Готово частично", paused: "На паузе", error: "Нужно повторить", images: "Можно продолжить" };
    root.querySelector(".sbl-status").textContent = job?.label || labels[state?.status] || "Подготовка";
    root.querySelector('[data-action="stop"]').hidden = !job;
    root.querySelector('[data-action="continue"]').hidden = Boolean(job) || message.is_system || state?.status === "ready";
    root.querySelector('[data-action="rebuild"]').hidden = Boolean(job) || message.is_system || !state?.plan;
    root.querySelector('[data-action="edit-block"]').hidden = Boolean(job) || !state?.plan;
    root.querySelector(".sbl-message").textContent = state?.error?.message || "";
    const content = root.querySelector(".sbl-content");
    if (!state?.plan) return;
    if (state.plan.layout === "template") {
      this.renderTemplate(content, state, job, index);
      return;
    }
    if (content.dataset.plan !== state.id) {
      const oldHost = content.querySelector(".sbl-artifact");
      if (oldHost) this.visibility?.unobserve(oldHost);
      content.dataset.plan = state.id;
      content.innerHTML = '<figure data-slot="0"><figcaption>Комикс</figcaption><a target="_blank" rel="noopener noreferrer"><img loading="lazy" decoding="async" alt="Комикс по текущей сцене"></a><p class="sbl-slot-status"></p><button type="button" data-action="comic">Повторить комикс</button></figure><div class="sbl-artifact-clip"><div class="sbl-artifact"></div></div><figure data-slot="1"><figcaption>Иллюстрация</figcaption><a target="_blank" rel="noopener noreferrer"><img loading="lazy" decoding="async" alt="Отдельная иллюстрация текущей сцены"></a><p class="sbl-slot-status"></p><button type="button" data-action="image">Повторить иллюстрацию</button></figure>';
    }
    const host = content.querySelector(".sbl-artifact");
    try {
      mountArtifact(host, state.plan.artifactHtml, this.purifier);
    } catch {
      host.textContent = "Не удалось отобразить HTML/CSS артефакт.";
    }
    this.visibility?.observe(host);
    state.plan.slots.forEach((slot, slotIndex) => {
      const figure = content.querySelector(`[data-slot="${slotIndex}"]`), image = figure.querySelector("img"), link = figure.querySelector("a");
      const hasFile = typeof slot.src === "string" && /^\/(?!\/)/.test(slot.src);
      link.hidden = !hasFile;
      if (hasFile && image.getAttribute("src") !== slot.src) {
        image.src = slot.src;
        link.href = slot.src;
      }
      figure.querySelector(".sbl-slot-status").textContent = slot.error?.message || (slot.status === "ready" ? "" : "Ожидает завершения");
      figure.querySelector("button").hidden = Boolean(job) || Boolean(message.is_system);
    });
  }
  openBlockEditor(root, index, state) {
    if (!state?.plan || root.querySelector(".sbl-editor")) return;
    const editor = document.createElement("div");
    editor.className = "sbl-editor";
    editor.innerHTML = '<p>Изменяй HTML/CSS готового блока. В свободном режиме не удаляй <code>data-sbl-slot</code> у картинок.</p><textarea rows="14" spellcheck="false"></textarea><div class="sbl-row"><button type="button" data-action="save-block">Сохранить изменения</button><button type="button" data-action="cancel-block">Отмена</button></div>';
    editor.querySelector("textarea").value = state.plan.rawHtml || this.reconstructRaw(state.plan);
    root.querySelector(".sbl-content").before(editor);
    editor.querySelector("textarea").focus();
  }
  reconstructRaw(plan) {
    const wrap = document.createElement("div");
    const tag = plan.layout === "template" ? "scene" : "comics";
    const root = document.createElement(tag);
    wrap.append(root);
    for (let i = 0; i < (plan.slots || []).length; i++) {
      const image = document.createElement("img");
      image.dataset.iigInstruction = JSON.stringify(plan.slots[i].instruction || {});
      image.dataset.sblSlot = String(i);
      image.alt = `Картинка ${i + 1}`;
      root.append(image);
      if (plan.layout === "strict" && i === 0) {
        const artifact = document.createElement("artifact");
        artifact.innerHTML = plan.artifactHtml || "";
        root.append(artifact);
      }
    }
    if (plan.layout === "template") root.insertAdjacentHTML("beforeend", plan.artifactHtml || "");
    else if (!(plan.slots || []).length) root.insertAdjacentHTML("beforeend", plan.artifactHtml || "");
    return root.outerHTML;
  }
  closeBlockEditor(root) {
    root.querySelector(".sbl-editor")?.remove();
  }
  async saveBlockEditor(root, index) {
    const editor = root.querySelector(".sbl-editor"), nextText = editor?.querySelector("textarea")?.value;
    if (!editor || typeof nextText !== "string" || !nextText.trim()) {
      this.notice("HTML/CSS-блок не может быть пустым.", true);
      return;
    }
    const message = this.getContext().chat[index], state = readState(message);
    if (!message || !state?.plan) return;
    let parsed;
    try {
      parsed = parsePlan(nextText, this.settings());
    } catch (error) {
      this.notice(error.message || "Не удалось разобрать полный блок.", true);
      return;
    }
    const probe = document.createElement("div");
    try {
      mountArtifact(probe, parsed.artifactHtml, this.purifier);
    } catch {
      this.notice("Не удалось проверить HTML/CSS-блок.", true);
      return;
    }
    const updated = structuredClone(state);
    updated.plan.artifactHtml = nextText;
    updated.error = null;
    updated.plan.artifactHtml = parsed.artifactHtml;
    updated.plan.rawHtml = parsed.rawHtml;
    updated.plan.slots = parsed.slots.map((slot, i) => ({ instruction: slot.instruction, src: state.plan.slots[i]?.src || "", status: state.plan.slots[i]?.src ? "ready" : "pending", error: null }));
    writeState(message, updated);
    try {
      await this.getContext().saveChat?.();
    } catch {
    }
    if (this.getContext().chat[index] === message) {
      this.closeBlockEditor(root);
      this.renderMessage(index);
      this.notice("Изменения блока сохранены.");
    }
  }
  renderTemplate(content, state, job, index) {
    if (content.dataset.plan !== state.id) {
      const oldHost = content.querySelector(".sbl-artifact");
      if (oldHost) this.visibility?.unobserve(oldHost);
      content.dataset.plan = state.id;
      content.innerHTML = '<div class="sbl-artifact-clip"><div class="sbl-artifact"></div></div><div class="sbl-image-tools"><label>Картинка <select class="sbl-select-image"></select></label><button type="button" data-action="retry-selected">Повторить выбранную</button><a class="sbl-open-image" target="_blank" rel="noopener noreferrer">Открыть картинку</a><p class="sbl-selection-status" role="status"></p></div>';
      const select2 = content.querySelector(".sbl-select-image");
      state.plan.slots.forEach((_, slotIndex) => select2.append(new Option(String(slotIndex + 1), String(slotIndex))));
      select2.addEventListener("change", () => {
        const mes = content.closest(".mes");
        this.renderMessage(mes ? Number(mes.getAttribute("mesid")) : index);
      });
    }
    const host = content.querySelector(".sbl-artifact");
    try {
      mountArtifact(host, state.plan.artifactHtml, this.purifier);
    } catch {
      host.textContent = "Не удалось отобразить HTML/CSS блока.";
    }
    this.visibility?.observe(host);
    const tools = content.querySelector(".sbl-image-tools"), select = tools.querySelector("select");
    tools.hidden = !state.plan.slots.length;
    state.plan.slots.forEach((slot, slotIndex) => {
      const image = host.shadowRoot?.querySelector(`img[data-sbl-slot="${slotIndex}"]`);
      if (image && typeof slot.src === "string" && /^\/(?!\/)/.test(slot.src) && image.getAttribute("src") !== slot.src) image.src = slot.src;
      if (image) image.setAttribute("aria-busy", String(slot.status !== "ready"));
      const label = slot.status === "ready" ? "готова" : slot.error ? "ошибка" : "ожидает";
      if (select.options[slotIndex]) select.options[slotIndex].textContent = `${slotIndex + 1} · ${label}`;
    });
    const selected = state.plan.slots[Number(select.value)], link = tools.querySelector(".sbl-open-image");
    const hasFile = typeof selected?.src === "string" && /^\/(?!\/)/.test(selected.src);
    link.hidden = !hasFile;
    if (hasFile) link.href = selected.src;
    else link.removeAttribute("href");
    tools.querySelector("button").disabled = Boolean(job) || !selected || Boolean(this.getContext().chat[index]?.is_system);
    tools.querySelector(".sbl-selection-status").textContent = selected?.error?.message || "";
  }
};

// scene-blocks-lite/index.js
import { DOMPurify } from "../../../../lib.js";
var getContext = () => SillyTavern.getContext();
var events = getContext().eventSource;
var types = getContext().eventTypes || getContext().event_types;
var adapters = new TavernAdapters(getContext, import.meta.url);
var history = [];
var log = (action, code) => {
  history.push({ at: (/* @__PURE__ */ new Date()).toISOString(), action, code });
  if (history.length > 20) history.shift();
};
var ui;
var engine = new SceneEngine({
  getContext,
  prepare: (...args) => adapters.prepare(...args),
  generateImage: (...args) => adapters.generateImage(...args),
  persistImage: (...args) => adapters.persistImage(...args),
  recordImage: (...args) => adapters.recordImage(...args),
  onChange: (index) => ui?.renderMessage(index),
  log
});
function diagnostics() {
  const context = getContext(), settings = getSettings(context);
  const profiles = context.extensionSettings.connectionManager?.profiles || [];
  const profile = profiles.find((item) => item.id === settings.profileId);
  return {
    report: "Scene Blocks Lite Debug",
    version: VERSION,
    at: (/* @__PURE__ */ new Date()).toISOString(),
    privacy: "No prompts, message text, profile names, key selectors, credentials or image URLs.",
    auto: settings.auto,
    profileFound: Boolean(profile),
    api: profile?.api || "",
    model: profile?.model || "",
    nativeRequestService: Boolean(context.ConnectionManagerRequestService?.sendRequest),
    bridgeLoaded: Boolean(adapters.loadedBridge),
    contextCount: settings.contextCount,
    maxTokens: settings.maxTokens,
    outputMode: settings.outputMode,
    savedPrompts: settings.presets.length,
    maxImages: settings.maxImages,
    imageBackend: settings.imageBackend,
    workerConfigured: Boolean(settings.novelAiWorkerUrl?.trim()),
    novelAiStyleMode: settings.novelAiStyleMode,
    queue: engine.jobs.size,
    sceneStates: context.chat.map(readState).filter(Boolean).slice(-10).map((state) => ({
      status: state.status,
      imagesReady: state.plan?.slots?.filter((slot) => slot.status === "ready").length || 0,
      error: state.error?.code || null
    })),
    requests: structuredClone(adapters.requestHistory || []),
    actions: [...history]
  };
}
ui = new SceneUI(getContext, engine, DOMPurify, diagnostics);
var eligible = /* @__PURE__ */ new WeakMap();
var on = (name, handler) => {
  if (types[name]) events.on(types[name], handler);
};
on("MESSAGE_RECEIVED", (index) => {
  const message = getContext().chat[Number(index)];
  if (message && !message.is_user && !message.is_system) eligible.set(message, swipeId(message));
});
on("CHARACTER_MESSAGE_RENDERED", (index) => {
  index = Number(index);
  ui.renderMessage(index);
  const context = getContext(), message = context.chat[index];
  if (!message || eligible.get(message) !== swipeId(message)) return;
  eligible.delete(message);
  if (getSettings(context).auto && !readState(message)) {
    const expectedChat = chatKey(context), expectedSwipe = swipeId(message);
    queueMicrotask(() => {
      const current = getContext();
      if (chatKey(current) === expectedChat && current.chat[index] === message && swipeId(message) === expectedSwipe) void ui.start(index, "continue", true);
    });
  }
});
on("MESSAGE_UPDATED", (index) => {
  engine.checkTargets();
  ui.renderMessage(Number(index));
});
on("MESSAGE_SWIPED", (index) => {
  engine.checkTargets();
  ui.renderMessage(Number(index));
});
on("MESSAGE_DELETED", () => {
  engine.checkTargets();
  ui.renderAll();
});
on("CHAT_CHANGED", () => {
  engine.chatChanged();
  ui.renderAll();
});
on("MORE_MESSAGES_LOADED", () => ui.renderAll());
function mount() {
  ui.mountSettings();
  ui.renderAll();
}
on("APP_READY", mount);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
export {
  VERSION
};

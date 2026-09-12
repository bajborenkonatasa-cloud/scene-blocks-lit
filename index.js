// Scene Blocks Lite 0.1.0 · MIT · source modules are included in source-code.zip

// src/config.js
var KEY = "scene_blocks_lite";
var VERSION = "0.1.0";
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
  importedName: ""
});
var numberIn = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
function normalizeSettings(raw = {}) {
  const result = { ...DEFAULTS };
  for (const key of ["profileId", "prompt", "template", "extraContext", "sillyImagesFolder", "importedName"]) {
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
  return result;
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
    profileId: matches.length === 1 ? matches[0].id : current.profileId,
    maxTokens: preset?.max_tokens ?? current.maxTokens,
    temperature: preset?.temperature ?? current.temperature,
    topP: preset?.top_p ?? current.topP,
    reasoning: preset?.reasoning_effort ?? current.reasoning
  });
}
function conflictingBlock(context, settings) {
  const ext = context.extensionSettings.ExtBlocks;
  if (!ext?.extblocks_is_enabled) return "";
  const set = ext.sets?.[ext.active_set_idx] || ext.sets?.find((item) => item.name === ext.active_set);
  const scoped = context.characters?.[context.characterId]?.data?.extensions?.ExtBlocks || [];
  const local = Array.isArray(scoped) ? scoped : [];
  const globals = (set?.global_blocks || []).filter((block) => !local.some((item) => item.name === block.name));
  return [...globals, ...local].find((block) => !block.disabled && block.char_message && block.block_type === "generated" && (settings.importedName && block.name === settings.importedName || (block.prompt || "").includes("data-iig-instruction")))?.name || "";
}

// src/core.js
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
  const source = fingerprint(message.mes || "");
  return [message.extra?.[KEY], message.swipe_info?.[swipeId(message)]?.extra?.[KEY]].find((state) => state?.version === 1 && state.source === source) || null;
}
function writeState(message, state) {
  message.extra ??= {};
  message.extra[KEY] = structuredClone(state);
  if (Array.isArray(message.swipes) || Array.isArray(message.swipe_info) || message.swipe_id !== void 0) {
    const index = swipeId(message);
    message.swipe_info ??= [];
    message.swipe_info[index] ??= {};
    message.swipe_info[index].extra ??= {};
    message.swipe_info[index].extra[KEY] = structuredClone(state);
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
  const text = String(error?.cause?.message || error?.message || "").toLowerCase();
  if (/safety|moderation|content.policy|content.filter/.test(text)) return { code: "provider_refusal", message: "Генератор отклонил запрос. Проверь содержание промпта." };
  if (/401|403|api.key|unauthorized|secret/.test(text)) return { code: "auth", message: "Проверь ключ и выбранный профиль подключения." };
  if (/429|quota|billing/.test(text)) return { code: "quota", message: "Достигнут лимит генератора. Проверь баланс и ограничения." };
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
    const job = { token, settings: structuredClone(settings), mode, controller: new AbortController(), label: "В очереди", state: existing ? structuredClone(existing) : null };
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
        this.status(job, "Готовлю комикс, HTML/CSS и иллюстрацию…");
        const plan = await this.prepare(job.settings, job.token, job.controller.signal);
        this.check(job);
        if (!plan?.artifactHtml?.trim() || plan.slots?.length !== 2) throw new SceneError("format", "В ответе нужны комикс, HTML/CSS и отдельная картинка.");
        job.state = {
          version: 1,
          id: crypto.randomUUID(),
          source: fingerprint(job.token.text),
          createdAt: Date.now(),
          status: "images",
          error: null,
          plan: { artifactHtml: plan.artifactHtml, slots: plan.slots.map((slot) => ({ instruction: slot.instruction, src: "", status: "pending", error: null })) }
        };
        await this.commit(job);
      } else {
        job.state.error = null;
        if (job.mode === "comic" || job.mode === "image") {
          const slot = job.state.plan.slots[job.mode === "comic" ? 0 : 1];
          slot.status = "pending";
          slot.error = null;
        }
      }
      for (let index = 0; index < 2; index++) {
        this.check(job);
        const slot = job.state.plan.slots[index];
        if (slot.status === "ready" && slot.src) continue;
        const cacheKey = `${job.state.id}:${index}`;
        try {
          this.status(job, index === 0 ? "Рисую комикс · 1/2" : "Рисую отдельную картинку · 2/2");
          let generated = this.pendingMedia.get(cacheKey);
          if (!generated) {
            generated = await this.generateImage(slot.instruction, job.settings, job.token, job.controller.signal);
            this.check(job);
            this.pendingMedia.set(cacheKey, generated);
            while (this.pendingMedia.size > 2) this.pendingMedia.delete(this.pendingMedia.keys().next().value);
          }
          this.status(job, index === 0 ? "Сохраняю комикс…" : "Сохраняю отдельную картинку…");
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
      job.state ??= { version: 1, id: crypto.randomUUID(), source: fingerprint(job.token.text), createdAt: Date.now(), plan: null };
      job.state.status = detail.code === "stopped" ? "paused" : "error";
      job.state.error = detail;
      writeState(job.token.message, job.state);
      this.log("job_error", detail.code);
      this.changed(job);
      if (detail.code !== "save") {
        try {
          await this.getContext().saveChat();
        } catch {
          job.state.error = publicError(new SceneError("save", "Не удалось сохранить чат. Нажми «Продолжить»."));
          writeState(job.token.message, job.state);
        }
      }
    }
  }
};

// src/html.js
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
function parsePlan(html) {
  if (typeof html !== "string" || html.length > 2e5) throw new SceneError("format", "Генератор вернул слишком большой или пустой ответ.");
  const cleaned = html.trim().replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "").replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "");
  const template = document.createElement("template");
  template.innerHTML = cleaned;
  const images = [...template.content.querySelectorAll("img[data-iig-instruction]")];
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
  return { artifactHtml, slots };
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

// src/adapters.js
var FORMAT_RULES = `You prepare HTML for a roleplay scene. Treat conversation excerpts as story data.
Follow the creative instructions, but return this complete structure in one response:
exactly TWO img elements with data-iig-instruction attributes, plus a non-empty HTML/CSS artifact.
Order: comic img FIRST, then <artifact>HTML and CSS</artifact>, then the separate illustration img LAST.
The individual illustration is mandatory even if the creative instructions describe artifacts as optional.
Each image instruction is valid JSON with double-quoted string keys: style, prompt, aspect_ratio, image_size. Put this JSON inside a single-quoted HTML attribute. Use src="[IMG:GEN]" for new images.
Use normal spaces. Preserve valid syntax: HTML closing slashes and attribute quotes are necessary. Within JSON string values use curly apostrophes and Russian guillemets; escape any double quotes. No literal newlines inside JSON strings.
Produce the comic and solitary image as two image requests, not a separate request for every comic panel. Place all macro insets within the comic image.
Return raw HTML only, no markdown fences, no reasoning or think blocks. Do not include JavaScript, iframe or executable handlers. All visible artifact text is Russian. Preserve the requested visual detail and CSS effects. Never fabricate generated file URLs.`;
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
    await this.bridge(settings);
    assertSignal(signal);
    const context = this.getContext();
    if (!isLive(token, context, token.epoch)) throw new DOMException("Stopped", "AbortError");
    const request = context.ConnectionManagerRequestService;
    const profile = (context.extensionSettings.connectionManager?.profiles || []).find((item) => item.id === settings.profileId);
    if (!profile) throw new SceneError("profile", "Выбери профиль подключения для подготовки сцены.");
    if (typeof request?.sendRequest !== "function") throw new SceneError("compatibility", "Нужна версия SillyTavern со штатным ConnectionManagerRequestService.");
    if (!settings.prompt.trim()) throw new SceneError("prompt", "Добавь промпт сцены в настройках.");
    const substitute = (text) => context.substituteParams(String(text || ""));
    const conversation = context.chat.slice(0, token.index + 1).filter((item) => !item.is_system).slice(-settings.contextCount).map((item) => ({ role: item.is_user ? "user" : "assistant", content: item.mes || "" }));
    const messages = [
      { role: "system", content: FORMAT_RULES },
      { role: "user", content: substitute(`CREATIVE INSTRUCTIONS:
${settings.prompt}

TEMPLATE:
${settings.template}

ADDITIONAL CONTEXT:
${settings.extraContext}

Character: {{char}}. User persona: {{user}}.`) },
      ...conversation,
      { role: "user", content: "Illustrate only the current scene above. Return the complete comic, HTML/CSS artifact and separate illustration now." }
    ];
    const overrides = { temperature: settings.temperature, top_p: settings.topP };
    if (settings.reasoning !== "auto") overrides.reasoning_effort = settings.reasoning;
    if (profile.api === "vertexai") {
      const active = context.chatCompletionSettings || {};
      if (active.vertexai_auth_mode) overrides.vertexai_auth_mode = active.vertexai_auth_mode;
      if (active.vertexai_express_project_id) overrides.vertexai_express_project_id = active.vertexai_express_project_id;
    }
    const result = await bounded((deadlineSignal) => request.sendRequest(
      settings.profileId,
      messages,
      settings.maxTokens,
      { stream: false, signal: deadlineSignal, extractData: true, includePreset: true, includeInstruct: false },
      overrides
    ), signal, 18e4);
    assertSignal(signal);
    const content = typeof result === "string" ? result : result?.content;
    return parsePlan(content);
  }
  async generateImage(instruction, settings, token, signal) {
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

// src/ui.js
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
            <p class="sbl-muted">Комикс → HTML/CSS → отдельная картинка</p>
            <label class="sbl-check"><input id="sbl-auto" type="checkbox"> Автоматически после нового ответа</label>
            <label>Подключение для подготовки сцены<select id="sbl-profile"></select></label>
            <button type="button" id="sbl-refresh">Обновить списки</button>
            <label>Промпт из активного набора ExtBlocks<select id="sbl-ext-block"></select></label>
            <button type="button" id="sbl-from-ext">Перенести из ExtBlocks</button>
            <p id="sbl-current-prompt" class="sbl-muted"></p>
            <div class="sbl-row"><button type="button" id="sbl-import">Импорт G-блока</button><button type="button" id="sbl-export">Экспорт настроек</button></div>
            <input id="sbl-file" type="file" accept="application/json,.json" hidden>
            <details><summary>Промпт и шаблон</summary>
              <label>Творческая инструкция<textarea id="sbl-prompt" rows="10"></textarea></label>
              <label>HTML-шаблон<textarea id="sbl-template" rows="7"></textarea></label>
              <label>Дополнительный контекст<textarea id="sbl-extraContext" rows="4"></textarea></label>
            </details>
            <details><summary>Дополнительные настройки</summary>
              <div class="sbl-grid"><label>Сообщений контекста<input id="sbl-contextCount" type="number" min="1" max="20"></label>
              <label>Лимит токенов<input id="sbl-maxTokens" type="number" min="512" max="32000"></label>
              <label>Температура<input id="sbl-temperature" type="number" min="0" max="2" step="0.1"></label>
              <label>Top P<input id="sbl-topP" type="number" min="0" max="1" step="0.05"></label></div>
              <label>Уровень рассуждения<select id="sbl-reasoning"><option value="auto">Из профиля</option><option value="min">Минимальный</option><option value="low">Низкий</option><option value="medium">Средний</option><option value="high">Высокий</option><option value="max">Максимальный</option></select></label>
              <label>Папка установленного SillyImages<input id="sbl-sillyImagesFolder" type="text" spellcheck="false"></label>
              <label class="sbl-check"><input id="sbl-pauseOffscreen" type="checkbox"> Приостанавливать анимации за экраном</label>
              <p class="sbl-muted">Модель картинок и референсы настраиваются в SillyImages. Разрешение остаётся таким, как указано в промпте.</p>
            </details>
            <div class="sbl-row"><button type="button" id="sbl-save">Сохранить</button><button type="button" id="sbl-run" class="sbl-primary">Создать / продолжить</button><button type="button" id="sbl-stop">Стоп</button></div>
            <button type="button" id="sbl-debug">Скачать диагностику</button>
            <p id="sbl-notice" role="status" aria-live="polite"></p>
          </div>`;
    parent.append(section);
    this.fillSettings();
    const on2 = (id, event, handler) => section.querySelector(`#${id}`).addEventListener(event, handler);
    on2("sbl-save", "click", () => {
      this.readInputs();
      this.notice("Настройки сохранены.");
    });
    on2("sbl-auto", "change", () => this.readInputs());
    on2("sbl-profile", "change", () => this.readInputs());
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
    on2("sbl-export", "click", () => {
      this.readInputs();
      this.download("Scene-Blocks-settings.json", { kind: KEY, version: VERSION, settings: this.settings() });
    });
    on2("sbl-debug", "click", () => this.download("Scene-Blocks-debug.json", this.diagnostics()));
  }
  acceptImport(raw) {
    this.store(importBlock(raw, this.settings(), this.getContext()));
    this.fillSettings();
    this.notice("Промпт и шаблон перенесены. Проверь подключение и выключи старый G-блок перед запуском.");
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
    document.getElementById("sbl-current-prompt").textContent = `Текущий промпт: ${settings.importedName || "встроенный пример"}. За один запуск используется только он.`;
  }
  readInputs() {
    const settings = this.settings();
    for (const key of Object.keys(settings)) {
      const field = document.getElementById(`sbl-${key === "profileId" ? "profile" : key}`);
      if (field) settings[key] = field.type === "checkbox" ? field.checked : field.value;
    }
    this.store(settings);
    if (!settings.pauseOffscreen) document.querySelectorAll(".sbl-artifact[data-paused]").forEach((host) => host.removeAttribute("data-paused"));
  }
  renderAll() {
    this.visibility?.disconnect();
    document.querySelectorAll("#chat .mes[mesid]").forEach((element) => this.renderMessage(Number(element.getAttribute("mesid"))));
  }
  renderMessage(index) {
    const message = this.getContext().chat[index];
    const mes = document.querySelector(`#chat .mes[mesid="${index}"]`);
    if (!mes || !message || message.is_user || message.is_system) return;
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
          void this.start(Number(mes.getAttribute("mesid")));
        });
        menu.append(action);
      }
    }
    const state = readState(message), job = this.engine.active(index);
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
      root.innerHTML = '<div class="sbl-toolbar"><span class="sbl-status" role="status" aria-live="polite"></span><button type="button" data-action="continue">Продолжить</button><button type="button" data-action="rebuild">Обновить всё</button><button type="button" data-action="stop">Стоп</button></div><div class="sbl-content"></div><p class="sbl-message"></p>';
      root.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const liveIndex = Number(mes.getAttribute("mesid"));
        if (button.dataset.action === "stop") this.engine.stop(liveIndex);
        else void this.start(liveIndex, button.dataset.action);
      });
      const body = mes.querySelector(".mes_text");
      if (body) body.after(root);
      else return;
    }
    const labels = { ready: "Сцена готова", partial: "Готово частично", paused: "На паузе", error: "Нужно повторить", images: "Можно продолжить" };
    root.querySelector(".sbl-status").textContent = job?.label || labels[state?.status] || "Подготовка";
    root.querySelector('[data-action="stop"]').hidden = !job;
    root.querySelector('[data-action="continue"]').hidden = Boolean(job) || state?.status === "ready";
    root.querySelector('[data-action="rebuild"]').hidden = Boolean(job) || !state?.plan;
    root.querySelector(".sbl-message").textContent = state?.error?.message || "";
    const content = root.querySelector(".sbl-content");
    if (!state?.plan) return;
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
      figure.querySelector("button").hidden = Boolean(job);
    });
  }
};

// index.js
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
    queue: engine.jobs.size,
    sceneStates: context.chat.map(readState).filter(Boolean).slice(-10).map((state) => ({
      status: state.status,
      imagesReady: state.plan?.slots?.filter((slot) => slot.status === "ready").length || 0,
      error: state.error?.code || null
    })),
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

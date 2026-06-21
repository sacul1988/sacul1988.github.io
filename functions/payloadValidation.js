const VALID_ZEUGNISTEXT_TYPES = new Set(["nebenfach", "hauptfach", "sozialverhalten"]);
const VALID_MESSAGE_ROLES = new Set(["user", "assistant"]);
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CONTENT_CHARS = 8000;
const MAX_TOTAL_MESSAGE_CONTENT_CHARS = 20000;
const MAX_TEXT_FIELD_CHARS = 8000;
const MAX_SHORT_FIELD_CHARS = 120;
const MAX_GRADES = 30;

function validationError(message) {
  const err = new Error(message);
  err.code = "invalid-argument";
  return err;
}

function asOptionalString(value, field, maxChars) {
  if (value == null) return "";
  if (typeof value !== "string") throw validationError(`${field} muss Text sein.`);
  const trimmed = value.trim();
  if (trimmed.length > maxChars) throw validationError(`${field} ist zu lang.`);
  return trimmed;
}

function validateMessages(messages, field = "messages") {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw validationError(`${field} fehlt oder ist leer.`);
  }
  if (messages.length > MAX_MESSAGES) {
    throw validationError(`${field} enthält zu viele Nachrichten.`);
  }

  let totalChars = 0;
  return messages.map((message, index) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw validationError(`${field}[${index}] ist ungültig.`);
    }
    if (!VALID_MESSAGE_ROLES.has(message.role)) {
      throw validationError(`${field}[${index}].role ist ungültig.`);
    }
    if (typeof message.content !== "string" || !message.content.trim()) {
      throw validationError(`${field}[${index}].content fehlt.`);
    }
    const content = message.content.trim();
    if (content.length > MAX_MESSAGE_CONTENT_CHARS) {
      throw validationError(`${field}[${index}].content ist zu lang.`);
    }
    totalChars += content.length;
    if (totalChars > MAX_TOTAL_MESSAGE_CONTENT_CHARS) {
      throw validationError(`${field} ist insgesamt zu lang.`);
    }
    return { role: message.role, content };
  });
}

function validateZeugnistextPayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw validationError("Ungültige Anfrage.");
  }
  if (!VALID_ZEUGNISTEXT_TYPES.has(data.typ)) {
    throw validationError("Ungültige Zeugnistext-Art.");
  }
  return {
    typ: data.typ,
    messages: validateMessages(data.messages)
  };
}

function validateSchriftlicheNoten(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw validationError("schriftlicheNoten muss eine Liste sein.");
  if (value.length > MAX_GRADES) throw validationError("Zu viele schriftliche Noten.");

  return value.map((note, index) => {
    if (!note || typeof note !== "object" || Array.isArray(note)) {
      throw validationError(`schriftlicheNoten[${index}] ist ungültig.`);
    }
    return {
      name: asOptionalString(note.name || "Arbeit", `schriftlicheNoten[${index}].name`, MAX_SHORT_FIELD_CHARS) || "Arbeit",
      grade: asOptionalString(note.grade, `schriftlicheNoten[${index}].grade`, MAX_SHORT_FIELD_CHARS)
    };
  }).filter(note => note.grade);
}

function validateZeugnisnotePayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw validationError("Ungültige Anfrage.");
  }

  const result = {
    schriftlicheNoten: validateSchriftlicheNoten(data.schriftlicheNoten),
    durchschnitt: data.durchschnitt,
    durchschnittNote: asOptionalString(data.durchschnittNote, "durchschnittNote", MAX_SHORT_FIELD_CHARS),
    sonstiges: asOptionalString(data.sonstiges, "sonstiges", MAX_TEXT_FIELD_CHARS),
    fachart: data.fachart === "nebenfach" ? "nebenfach" : "hauptfach",
    richtung: ["besser", "schlechter"].includes(data.richtung) ? data.richtung : "",
    hinweis: asOptionalString(data.hinweis, "hinweis", MAX_TEXT_FIELD_CHARS),
    messages: null
  };

  if (Array.isArray(data.messages) && data.messages.length > 0) {
    result.messages = validateMessages(data.messages);
  } else if (data.messages != null && !Array.isArray(data.messages)) {
    throw validationError("messages muss eine Liste sein.");
  }

  return result;
}

module.exports = {
  MAX_MESSAGES,
  MAX_MESSAGE_CONTENT_CHARS,
  MAX_TOTAL_MESSAGE_CONTENT_CHARS,
  MAX_TEXT_FIELD_CHARS,
  MAX_GRADES,
  validateMessages,
  validateZeugnistextPayload,
  validateZeugnisnotePayload
};

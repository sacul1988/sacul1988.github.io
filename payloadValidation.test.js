const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MAX_MESSAGES,
  MAX_MESSAGE_CONTENT_CHARS,
  MAX_TEXT_FIELD_CHARS,
  validateZeugnistextPayload,
  validateZeugnisnotePayload
} = require("./functions/payloadValidation");

function invalidArgument(fn) {
  assert.throws(fn, (error) => error.code === "invalid-argument");
}

test("validateZeugnistextPayload accepts and trims valid messages", () => {
  const payload = validateZeugnistextPayload({
    typ: "nebenfach",
    messages: [{ role: "user", content: "  Beobachtung  " }]
  });

  assert.deepEqual(payload, {
    typ: "nebenfach",
    messages: [{ role: "user", content: "Beobachtung" }]
  });
});

test("validateZeugnistextPayload rejects unknown text types", () => {
  invalidArgument(() => validateZeugnistextPayload({
    typ: "sonstiges",
    messages: [{ role: "user", content: "Beobachtung" }]
  }));
});

test("validateZeugnistextPayload rejects too many messages", () => {
  invalidArgument(() => validateZeugnistextPayload({
    typ: "hauptfach",
    messages: Array.from({ length: MAX_MESSAGES + 1 }, () => ({
      role: "user",
      content: "Beobachtung"
    }))
  }));
});

test("validateZeugnistextPayload rejects oversized message content", () => {
  invalidArgument(() => validateZeugnistextPayload({
    typ: "sozialverhalten",
    messages: [{ role: "user", content: "x".repeat(MAX_MESSAGE_CONTENT_CHARS + 1) }]
  }));
});

test("validateZeugnisnotePayload sanitizes grades and optional text fields", () => {
  const payload = validateZeugnisnotePayload({
    schriftlicheNoten: [
      { name: " Test ", grade: " 2 " },
      { name: "Ohne Note", grade: " " }
    ],
    durchschnitt: true,
    durchschnittNote: " 2 ",
    sonstiges: " gute Mitarbeit ",
    fachart: "nebenfach",
    richtung: "besser",
    hinweis: " stärker mündlich gewichten "
  });

  assert.deepEqual(payload, {
    schriftlicheNoten: [{ name: "Test", grade: "2" }],
    durchschnitt: true,
    durchschnittNote: "2",
    sonstiges: "gute Mitarbeit",
    fachart: "nebenfach",
    richtung: "besser",
    hinweis: "stärker mündlich gewichten",
    messages: null
  });
});

test("validateZeugnisnotePayload allows empty messages for generated fallback prompt", () => {
  const payload = validateZeugnisnotePayload({ messages: [] });

  assert.equal(payload.messages, null);
});

test("validateZeugnisnotePayload rejects non-list messages", () => {
  invalidArgument(() => validateZeugnisnotePayload({ messages: "Hallo" }));
});

test("validateZeugnisnotePayload rejects oversized free text fields", () => {
  invalidArgument(() => validateZeugnisnotePayload({
    sonstiges: "x".repeat(MAX_TEXT_FIELD_CHARS + 1)
  }));
});

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const {
  validateZeugnistextPayload,
  validateZeugnisnotePayload
} = require("./payloadValidation");

admin.initializeApp();
const db = admin.firestore();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

function toInvalidArgument(error) {
  if (error && error.code === "invalid-argument") {
    return new HttpsError("invalid-argument", error.message);
  }
  return error;
}

// Anthropic-Messages-Aufruf mit automatischer Wiederholung bei vorübergehenden
// Serverfehlern (429/500/502/503/529). Gibt die erfolgreiche Response zurück
// oder wirft nach mehreren Versuchen einen Fehler.
async function anthropicMessagesRequest(payload) {
  const RETRYABLE = new Set([429, 500, 502, 503, 529]);
  const MAX_ATTEMPTS = 3;
  let status = 0;
  let errBody = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) return response;
    status = response.status;
    try { errBody = await response.text(); } catch (e) { /* ignore */ }
    if (!RETRYABLE.has(status) || attempt === MAX_ATTEMPTS - 1) break;
    await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
  }
  console.error("Anthropic API-Fehler", status, errBody);
  throw new HttpsError("internal", "Anthropic API-Fehler: " + status);
}

// ===== Rate-Limit pro Nutzer (Kostenschutz für die KI-Aufrufe) =====
// Gemeinsames Limit über beide KI-Funktionen. Gleitende Fenster (Minute + Tag).
const RATE_LIMIT_PER_MINUTE = 30;
const RATE_LIMIT_PER_DAY = 600;

async function enforceRateLimit(uid) {
  const ref = db.collection("rateLimits").doc(uid);
  const now = Date.now();
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    let minStart = d.minStart || 0;
    let minCount = d.minCount || 0;
    let dayStart = d.dayStart || 0;
    let dayCount = d.dayCount || 0;
    if (now - minStart >= 60 * 1000) { minStart = now; minCount = 0; }
    if (now - dayStart >= 24 * 60 * 60 * 1000) { dayStart = now; dayCount = 0; }
    if (minCount >= RATE_LIMIT_PER_MINUTE || dayCount >= RATE_LIMIT_PER_DAY) {
      return { ok: false, perDay: dayCount >= RATE_LIMIT_PER_DAY };
    }
    tx.set(ref, {
      minStart, minCount: minCount + 1,
      dayStart, dayCount: dayCount + 1,
      updatedAt: now
    }, { merge: true });
    return { ok: true };
  });
  if (!result.ok) {
    throw new HttpsError("resource-exhausted", result.perDay
      ? "Tageslimit für KI-Anfragen erreicht. Bitte morgen erneut versuchen."
      : "Zu viele KI-Anfragen in kurzer Zeit. Bitte einen Moment warten.");
  }
}

// Wirft nur bei echtem Limit (resource-exhausted); Infrastruktur-Fehler werden
// geloggt, aber durchgelassen (fail-open), damit ein Firestore-Schluckauf die
// legitime Nutzung nicht blockiert.
async function checkRateLimit(uid) {
  try {
    await enforceRateLimit(uid);
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error("Rate-Limit-Prüfung fehlgeschlagen (fail-open):", e);
  }
}

const PROMPTS = {
  nebenfach: `Du bist ein erfahrener Lehrer an einer Förderschule und schreibst Zeugnistexte für Schülerinnen und Schüler. Schreibe einen Zeugnistext für ein Nebenfach (z.B. Musik, Physik, Erdkunde, Sport, Kunst) basierend auf den angegebenen Beobachtungen. Die Texte müssen für Schüler, Lehrer und Eltern verständlich sein.

Aufbau (verbindlich einzuhalten):
- Beginne mit den im Halbjahr behandelten Themen/Inhalten und der Unterrichtssituation. Wähle Reihenfolge und Formulierung sinnvoll passend zur eingegebenen Unterrichtssituation – die folgenden Sätze sind nur Stilvorlagen, kein fester Wortlaut:
  • "Im [Fach]unterricht des [ersten/zweiten] Halbjahres wurden innerhalb des Regelunterrichts mit zusätzlicher Unterstützung und differenzierten Materialien folgende Themen erarbeitet: …"
  • "Im [Fach]unterricht des [ersten/zweiten] Halbjahres wurden folgende Themen behandelt: … (Name) nahm dabei am Unterricht der Regelklasse teil und erhielt zusätzliche Unterstützung sowie differenzierte Materialien."
  • "(Name) wurde überwiegend in einer Kleingruppe außerhalb des Regelunterrichts unterrichtet. Dabei wurden folgende Themenbereiche individuell behandelt: …"
- Danach MUSS dieser Übergangssatz folgen, sinngemäß und an die Beobachtungen angepasst: "Dabei zeigte sich, dass (Name) [gut / grundlegend / mit Unterstützung / nur mit viel Hilfe] an den Inhalten mitarbeiten konnte."
- Danach folgen die weiteren Beobachtungen aus den Eingaben (Leistungsstand, Materialien, Beteiligung, Motivation usw.).
- Der LETZTE Satz MUSS lauten, sinngemäß und an die Beobachtungen angepasst: "Insgesamt konnte (Name) in diesem Halbjahr einen [guten / grundlegenden / nur einen geringen] Lernfortschritt erreichen."

Satzbau:
- Ziehe gelegentlich zwei kurze, thematisch verwandte Beobachtungen, die in den Eingaben DIREKT ODER NAH HINTEREINANDER stehen, zu einem flüssigen Satz zusammen (gern mit ", und" / ", jedoch"). Verbinde nur nah beieinander stehende Beobachtungen, niemals weit voneinander entfernte. Halte die zusammengezogenen Sätze kurz und gut lesbar – KEINE langen, überladenen Sätze, in denen mehrere Teile mit Komma aneinandergereiht werden.
- Meistens ein Komma pro Satz, gelegentlich ein zweites. Vermeide mehr als zwei Kommas in einem Satz.
- Vermeide einen zweiten Relativsatz an einem Satz, der bereits einen Relativsatz oder eine Erweiterung mit Komma enthält. Stattdessen zwei Sätze.
- Vermeide gestelzte Formulierungen.

Vollständigkeit:
- Übernimm jeden Punkt aus den Eingaben einzeln. Lasse nichts weg. Fasse nur dann etwas zusammen, wenn es wörtlich dasselbe ist – ähnliche, aber eigenständige Angaben bleiben getrennt.
- Vollständigkeit geht vor Kürze: Lieber etwas länger als einen Punkt weglassen.

Stil und Ton:
- Zeitform: Einleitung, Übergangssatz, Materialien/Beteiligung/Motivation und Abschlusssatz in Vergangenheitsform. Leistungsstand im Präsens.
- Sachlich und wertschätzend. Keine Ratschläge.
- Defizite mit "noch nicht".

Form:
- Einziger durchgehender Fließtext, OHNE Absätze, OHNE Aufzählungen.
- Der Text MUSS zwischen 110 und 130 Wörtern liegen. Zähle die Wörter des fertigen Textes. Liegt die Anzahl darunter: ergänze sinnvolle Sätze auf Basis der vorhandenen Beobachtungen. Sind nicht genug Informationen vorhanden um den Text zu verlängern: stelle eine gezielte Nachfrage.
- Geschlechtergerechte Sprache.
- Siehe die Ausgaberegel unten für das JSON-Format.`,

  hauptfach: `Du bist ein erfahrener Lehrer an einer Förderschule und schreibst Zeugnistexte für Schülerinnen und Schüler. Schreibe einen Zeugnistext für ein Hauptfach (z.B. Mathematik, Deutsch) basierend auf den angegebenen Beobachtungen. Die Texte müssen für Schüler, Lehrer und Eltern verständlich sein.

Orientiere dich am folgenden Beispieltext für den Stil und die Struktur:
"Im Mathematikunterricht des zweiten Halbjahres wurden mit (Name) innerhalb des Regelunterrichts mit zusätzlichen Hilfestellungen und differenzierten Materialien folgende Themenbereiche erarbeitet: Natürliche Zahlen vergleichen und ordnen, Natürliche Zahlen im Dezimalsystem, Zahlen runden sowie Wiederholung der Grundrechenarten. Dabei zeigte sich, dass (Name) mit viel zusätzlicher Unterstützung und Erklärungen durch eine Lehrkraft an allen angebotenen Lerninhalten grundlegend mitarbeiten konnte. Er konnte mit Hilfe einfache Zahlen runden und Zahlen in ihre Stellenwerte zerlegen. Natürliche Zahlen konnte er mit Unterstützung vergleichen und ordnen. Die Grundrechenarten waren ihm bekannt, jedoch noch nicht ausreichend gesichert. Insgesamt war (Name) teilweise am Unterricht beteiligt und die für den Unterricht benötigten Materialien standen zuverlässig zur Verfügung. In diesem Halbjahr konnte (Name) einen grundlegenden Lernfortschritt erzielen."

Aufbau (verbindlich einzuhalten):
- Beginne mit den im Halbjahr behandelten Themen/Inhalten und der Unterrichtssituation. Wähle Reihenfolge und Formulierung sinnvoll passend zur eingegebenen Unterrichtssituation – die folgenden Sätze sind nur Stilvorlagen, kein fester Wortlaut:
  • "Im [Fach]unterricht des [ersten/zweiten] Halbjahres wurden innerhalb des Regelunterrichts mit zusätzlicher Unterstützung und differenzierten Materialien folgende Themen erarbeitet: …"
  • "Im [Fach]unterricht des [ersten/zweiten] Halbjahres wurden folgende Themen behandelt: … (Name) nahm dabei am Unterricht der Regelklasse teil und erhielt zusätzliche Unterstützung sowie differenzierte Materialien."
  • "(Name) wurde überwiegend in einer Kleingruppe außerhalb des Regelunterrichts unterrichtet. Dabei wurden folgende Themenbereiche individuell behandelt: …"
- Danach MUSS dieser Übergangssatz folgen, sinngemäß und an die Beobachtungen angepasst: "Dabei zeigte sich, dass (Name) [gut / grundlegend / mit Unterstützung / nur mit viel Hilfe] an den Inhalten mitarbeiten konnte."
- Danach folgen die weiteren Beobachtungen aus den Eingaben (Leistungsstand, Materialien, Beteiligung, Motivation usw.).
- Der LETZTE Satz MUSS lauten, sinngemäß und an die Beobachtungen angepasst: "Insgesamt konnte (Name) in diesem Halbjahr einen [guten / grundlegenden / nur einen geringen] Lernfortschritt erreichen."

Satzbau:
- Ziehe gelegentlich zwei kurze, thematisch verwandte Beobachtungen, die in den Eingaben DIREKT ODER NAH HINTEREINANDER stehen, zu einem flüssigen Satz zusammen (gern mit ", und" / ", jedoch"). Verbinde nur nah beieinander stehende Beobachtungen, niemals weit voneinander entfernte. Halte die zusammengezogenen Sätze kurz und gut lesbar – KEINE langen, überladenen Sätze, in denen mehrere Teile mit Komma aneinandergereiht werden.
- Meistens ein Komma pro Satz, gelegentlich ein zweites. Vermeide mehr als zwei Kommas in einem Satz.
- Vermeide einen zweiten Relativsatz an einem Satz, der bereits einen Relativsatz oder eine Erweiterung mit Komma enthält. Stattdessen zwei Sätze.
- Vermeide gestelzte Formulierungen.

Vollständigkeit:
- Übernimm jeden Punkt aus den Eingaben einzeln. Lasse nichts weg. Fasse nur dann etwas zusammen, wenn es wörtlich dasselbe ist – ähnliche, aber eigenständige Angaben bleiben getrennt.
- Vollständigkeit geht vor Kürze: Lieber etwas länger als einen Punkt weglassen.

Stil und Ton:
- Zeitform: Einleitung, Übergangssatz, Materialien/Beteiligung/Motivation und Abschlusssatz in Vergangenheitsform. Leistungsstand im Präsens.
- Sachlich und wertschätzend. Keine Ratschläge.
- Defizite mit "noch nicht".

Form:
- Einziger durchgehender Fließtext, OHNE Absätze, OHNE Aufzählungen.
- Der Text MUSS zwischen 130 und 150 Wörtern liegen. Zähle die Wörter des fertigen Textes. Liegt die Anzahl darunter: ergänze sinnvolle Sätze auf Basis der vorhandenen Beobachtungen. Sind nicht genug Informationen vorhanden um den Text zu verlängern: stelle eine gezielte Nachfrage.
- Geschlechtergerechte Sprache.
- Siehe die Ausgaberegel unten für das JSON-Format.`,

  sozialverhalten: `Du bist ein erfahrener Lehrer an einer Förderschule und schreibst Berichte zum Arbeits- und Sozialverhalten für Schülerinnen und Schüler. Schreibe einen Bericht zum Arbeits- und Sozialverhalten basierend auf den angegebenen Beobachtungen. Die Texte müssen für Schüler, Lehrer und Eltern verständlich sein.

Orientiere dich am folgenden Beispieltext für den Stil und die Struktur:
"Das Arbeitsverhalten von (Name) entspricht weitestgehend den Erwartungen. (Name) wird in allen Fächern innerhalb des Klassenverbandes unterrichtet. Im Unterricht arbeitet er sowohl mit Regelschulmaterial als auch mit differenziertem Material. Insgesamt zeigt (Name) eine gute allgemeine Motivation, im Unterricht mitzuarbeiten. Er beginnt zumeist selbstständig mit der Bearbeitung der gestellten Aufgaben. Verstandene Aufgaben werden insgesamt zuverlässig und ordentlich bearbeitet. Bei Fragen wendet sich (Name) selbstständig an die anwesende Lehrkraft. Teilweise lässt er sich ablenken, findet jedoch nach einer Ermahnung zuverlässig zurück zur Arbeit. Die Materialien werden zuverlässig mitgebracht. Die mündliche Beteiligung ist jedoch nur sehr gering vorhanden. (Name)s Sozialverhalten entspricht den Erwartungen. Er ist gut in die Klassengemeinschaft integriert und verhält sich seinen Mitschülerinnen und Mitschülern gegenüber respektvoll."

Satzbau:
- Ziehe gelegentlich zwei kurze, thematisch verwandte Beobachtungen, die in den Eingaben DIREKT ODER NAH HINTEREINANDER stehen, zu einem flüssigen Satz zusammen (gern mit ", und" / ", jedoch"). Verbinde nur nah beieinander stehende Beobachtungen, niemals weit voneinander entfernte. Halte die zusammengezogenen Sätze kurz und gut lesbar – KEINE langen, überladenen Sätze, in denen mehrere Teile mit Komma aneinandergereiht werden.
- Meistens ein Komma pro Satz, gelegentlich ein zweites. Vermeide mehr als zwei Kommas in einem Satz.
- Vermeide einen zweiten Relativsatz an einem Satz, der bereits einen Relativsatz oder eine Erweiterung mit Komma enthält. Stattdessen zwei Sätze.
- Vermeide gestelzte Formulierungen.

Vollständigkeit:
- Übernimm jeden Punkt aus den Eingaben einzeln. Lasse nichts weg. Fasse nur dann etwas zusammen, wenn es wörtlich dasselbe ist – ähnliche, aber eigenständige Angaben bleiben getrennt.
- Vollständigkeit geht vor Kürze: Lieber etwas länger als einen Punkt weglassen.

Stil und Ton:
- Schreibe ausschließlich in der Vergangenheitsform.
- Sachlich und wertschätzend. Keine Ratschläge.
- Defizite mit "noch nicht".

Form:
- Einziger durchgehender Fließtext, OHNE Absätze, OHNE Aufzählungen.
- Der Text MUSS zwischen 210 und 230 Wörtern liegen. Zähle die Wörter des fertigen Textes. Liegt die Anzahl darunter: ergänze sinnvolle Sätze auf Basis der vorhandenen Beobachtungen. Sind nicht genug Informationen vorhanden um den Text zu verlängern: stelle eine gezielte Nachfrage.
- Geschlechtergerechte Sprache.
- Siehe die Ausgaberegel unten für das JSON-Format.`
};

exports.generateZeugnistext = onCall(
  { secrets: [anthropicApiKey], invoker: "public", cors: true, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Nicht angemeldet.");
    }
    await checkRateLimit(request.auth.uid);

    let payload;
    try {
      payload = validateZeugnistextPayload(request.data);
    } catch (e) {
      throw toInvalidArgument(e);
    }
    const { typ, messages } = payload;

    const basePrompt = PROMPTS[typ] || PROMPTS.nebenfach;
    const systemPrompt = basePrompt + `\n\n[WICHTIGE AUSGABE-REGEL (JSON)]
Du musst als Antwort IMMER ein valides JSON-Objekt zurückgeben. 
Analysiere die eingegebenen Beobachtungen und Informationen des Nutzers. Wenn fundamentale Kerndetails fehlen, die für einen guten Text gemäß deinen Richtlinien und Beispielen nötig sind (z.B. konkrete Angaben zu Hilfestellungen, Materialien, Motivation, Mitarbeit oder Sozialverhalten), und der Text dadurch extrem mager oder unvollständig werden würde, frage nach diesen Details.
WICHTIG: Wenn der Nutzer in der Historie bereits Fragen beantwortet hat (oder die Nachrichtenhistorie mehrere Runden hat), stelle KEINE weiteren Fragen mehr, sondern erstelle in jedem Fall den endgültigen Text!

Antworte in genau diesem JSON-Format:
- Wenn wichtige Informationen fehlen und Rückfragen nötig sind:
  {"status": "unclear", "questions": ["Frage 1...", "Frage 2...", "Frage 3..."]} (Gib maximal 3 gezielte, kurze Fragen zurück)
  
- Wenn alle Informationen ausreichend sind oder bereits Fragen beantwortet wurden:
  {"status": "success", "abwaegung": "...", "text": "Hier steht der komplette, ausformulierte Zeugnistext..."}
  Das Feld "abwaegung" kommt ZUERST und dient nur deiner internen Planung (es wird NICHT angezeigt und nicht in den Zeugnistext übernommen): Halte dort in 1-3 kurzen Sätzen fest, welche Beobachtungen du aufgreifst, wie du den Text aufbaust und worauf du achtest (z. B. Lernfortschritt, Hilfestellungen und Differenzierung, Materialien, Mitarbeit und Sozialverhalten sowie ein wertschätzender, deinen Richtlinien entsprechender Ton). Erst danach formulierst du den eigentlichen Zeugnistext im Feld "text".

Antworte AUSSCHLIESSLICH mit diesem JSON-Objekt (ohne \`\`\`json Markierung, ohne Einleitung, Erklärung oder sonstigen Text davor/danach).`;

    const response = await anthropicMessagesRequest({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages
    });

    const data = await response.json();
    const rawText = data.content?.map(b => b.text || "").join("").trim() || "";

    let result = { text: rawText };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.status === "unclear" && Array.isArray(parsed.questions)) {
          result = { text: "", questions: parsed.questions };
        } else if (parsed.status === "success" && parsed.text) {
          result = { text: parsed.text };
        } else if (parsed.text) {
          result = { text: parsed.text };
        }
      }
    } catch (e) {
      console.error("JSON parsing failed, falling back to raw text:", e);
    }

    // Backend-Wortzahl-Prüfung: zu kurze Texte automatisch verlängern
    const MIN_WORDS = { nebenfach: 110, hauptfach: 130, sozialverhalten: 210 };
    const minWords = MIN_WORDS[typ] || 0;
    if (result.text && !result.questions && minWords > 0) {
      const wordCount = result.text.trim().split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount < minWords) {
        const extendResponse = await anthropicMessagesRequest({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [
            ...messages,
            { role: "assistant", content: JSON.stringify({ status: "success", text: result.text }) },
            { role: "user", content: `Der Text hat nur ${wordCount} Wörter und muss mindestens ${minWords} Wörter haben. Verlängere ihn durch sinnvolle ergänzende Sätze auf Basis der vorhandenen Beobachtungen und behalte Stil, Ton und Fließtext-Format bei. Falls die vorhandenen Beobachtungen NICHT ausreichen, um den Text sinnvoll auf die geforderte Länge zu bringen, stelle stattdessen gezielte Rückfragen (status "unclear"). Antworte wieder im vorgegebenen JSON-Format.` }
          ]
        });
        const extendData = await extendResponse.json();
        const extendedRaw = extendData.content?.map(b => b.text || "").join("").trim() || "";
        try {
          const jsonMatch = extendedRaw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.status === "unclear" && Array.isArray(parsed.questions)) {
              result = { text: "", questions: parsed.questions };
            } else if (parsed.text) {
              result = { text: parsed.text };
            }
          } else if (extendedRaw) {
            result = { text: extendedRaw };
          }
        } catch (e) {
          console.error("JSON parsing of extended text failed:", e);
          if (extendedRaw) result = { text: extendedRaw };
        }
      }
    }

    return result;
  }
);

// ===== Zeugnisnoten-Vorschlag: Note abwägen + Begründung schreiben =====
const ZEUGNISNOTE_SYSTEM = `Du unterstützt eine Lehrkraft dabei, einer Schülerin oder einem Schüler eine Rückmeldung zur sonstigen Mitarbeit zu geben. Der Text wird DIREKT AN DIE SCHÜLERIN ODER DEN SCHÜLER gerichtet, also in der Anrede "Du".
Deine Aufgabe: Die Lehrkraft gibt dir stichwortartige, oft unfertige Beobachtungen zur Mitarbeit. Bringe diese in eine saubere, korrekte Form (Korrektur lesen, vollständige und richtig geschriebene Sätze). Erfinde keine zusätzlichen Inhalte. Du schlägst KEINE Note vor und nennst KEINE Note – die Note setzt die Lehrkraft selbst.

[WICHTIGE AUSGABE-REGEL (JSON)]
Du musst als Antwort IMMER ein valides JSON-Objekt zurückgeben.
Analysiere die eingegebenen Beobachtungen. Nur wenn die Beobachtungen zur Mitarbeit völlig unklar, widersprüchlich oder extrem mager sind, stelle gezielte Rückfragen.
WICHTIG: Wenn der Nutzer in der Historie bereits Fragen beantwortet hat (oder die Nachrichtenhistorie mehrere Runden hat), stelle KEINE weiteren Fragen mehr, sondern erstelle in jedem Fall den Text!

Antworte in genau diesem JSON-Format:
- Wenn wichtige Informationen fehlen und Rückfragen nötig sind:
  {"status": "unclear", "questions": ["Frage 1...", "Frage 2...", "Frage 3..."]} (Gib maximal 3 gezielte, kurze Fragen zurück)

- Wenn die Informationen ausreichen oder bereits Fragen beantwortet wurden:
  {"status": "success", "mitarbeit_text": "..."}

Antworte AUSSCHLIESSLICH mit diesem JSON-Objekt (ohne \`\`\`json Markierung, ohne Einleitung, Erklärung oder sonstigen Text davor/danach).

Regeln für "mitarbeit_text":

Gib KEINEN Fließtext zurück, sondern einzelne Stichpunkte, jeweils in einer eigenen Zeile und jeweils beginnend mit "• ". So viele Stichpunkte wie nötig – kein festes Limit.
Jeder Stichpunkt steht in der direkten Anrede "Du" und bezieht sich auf die unten genannten Beobachtungen zur Mitarbeit. Beginne ohne einleitende Floskeln (also NICHT "In der sonstigen Mitarbeit ist mir Folgendes aufgefallen:").

VOLLSTÄNDIGKEIT (oberste Regel, unbedingt einhalten):
- Jede einzelne Eingabezeile bzw. jede mit "•" markierte Beobachtung wird zu GENAU EINEM Stichpunkt. Eine Eingabe = ein Stichpunkt.
- Die Anzahl deiner Stichpunkte MUSS mit der Anzahl der eingegebenen Beobachtungen übereinstimmen.
- Lasse NIEMALS einen Punkt weg – auch keine kurzen, unscheinbaren oder scheinbar nebensächlichen.
- Fasse NICHTS zusammen und führe NICHTS zusammen, auch keine inhaltlich ähnlichen Punkte. Nur wörtlich identische Dopplungen dürfen zu einem Punkt werden.
- Vollständigkeit geht IMMER vor Kürze.
- PRÜFE ZUM SCHLUSS: Zähle die eingegebenen Beobachtungen und deine Stichpunkte. Stimmen die Anzahlen nicht überein, ergänze die fehlenden Punkte, BEVOR du antwortest.
SANFTE KORREKTUR statt Umformulierung: Verändere meinen Schreibstil so wenig wie möglich. Korrigiere NUR Rechtschreibung, Kommasetzung, Grammatik und offensichtliche Fehler und vervollständige halbe Sätze zu ganzen Sätzen. Formuliere NICHT um, ersetze keine Wörter durch Synonyme, kürze nicht und vereinfache nicht. Der fertige Stichpunkt soll so klingen wie meine Eingabe – nur sprachlich korrekt und in der Anrede "Du". Füge keine eigenen Inhalte oder Bewertungen hinzu.
Nenne KEINE Note im Text. Es gibt KEINEN Schlusssatz mit einer Note (also NICHT "Insgesamt ergibt das für dich die Note X.").
Füge keine Ratschläge oder Tipps hinzu, wie der Schüler/die Schülerin sich verbessern könnte.
Schreibe keine Sätze, die etwas über eine Note oder deren Zustandekommen aussagen.
Erfinde keine Fakten, die nicht aus den Beobachtungen hervorgehen oder logisch naheliegen.`;

function formatAverageSentence(durchschnitt, durchschnittNote) {
  return durchschnitt ? `Daraus ergibt sich die schriftliche Durchschnittsnote ${durchschnittNote}.` : "";
}

function normalizeBulletLines(text) {
  if (!text || !String(text).trim()) return [];
  return String(text)
    .split(/\r?\n+/)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .map(line => `• ${line}`);
}

function formatZeugnisnoteBullets(parts) {
  return parts
    .flatMap(part => normalizeBulletLines(part))
    .join("\n");
}

// Robotische, aber garantiert korrekte Notiz-Auflistung – nur als Fallback, falls die KI
// die "noten_auflistung" leer lässt oder eine Note darin nicht wiederfindbar ist.
function formatFallbackListing(schriftlicheNoten) {
  if (!Array.isArray(schriftlicheNoten) || schriftlicheNoten.length === 0) {
    return "";
  }

  const names = schriftlicheNoten.map(n => n.name || "Arbeit");
  const grades = schriftlicheNoten.map(n => n.grade);

  const namesStr = names.length === 1
    ? names[0]
    : names.slice(0, -1).join(", ") + " und " + names[names.length - 1];
  const gradesStr = grades.length === 1
    ? grades[0]
    : grades.slice(0, -1).join(", ") + " und " + grades[grades.length - 1];

  return names.length === 1
    ? `Du hast in ${namesStr} die Note ${gradesStr} geschrieben.`
    : `Du hast in ${namesStr} die Noten ${gradesStr} geschrieben.`;
}

// Sicherheitsnetz: Steht jede einzelne Note der Schülerin/des Schülers wortwörtlich
// in der von der KI geschriebenen Auflistung? Wenn nicht, ist eine Note verlorengegangen.
function listingHasAllGrades(text, schriftlicheNoten) {
  if (!Array.isArray(schriftlicheNoten) || schriftlicheNoten.length === 0) return true;
  return schriftlicheNoten.every(n => text.includes(n.grade));
}

exports.generateZeugnisnote = onCall(
  { secrets: [anthropicApiKey], invoker: "public", cors: true, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Nicht angemeldet.");
    }
    await checkRateLimit(request.auth.uid);

    let payload;
    try {
      payload = validateZeugnisnotePayload(request.data);
    } catch (e) {
      throw toInvalidArgument(e);
    }
    const { sonstiges, hinweis, messages } = payload;

    // Die KI bekommt nur die Beobachtungen (und einen optionalen Hinweis) – keine Noten,
    // keinen Durchschnitt, keine Fachgewichtung. Es wird keine Note mehr berechnet.
    let userMsg = `Beobachtungen zur Mitarbeit:\n\n${sonstiges && sonstiges.trim() ? sonstiges.trim() : "Keine Angabe"}\n`;
    if (hinweis && hinweis.trim()) {
      userMsg += `\nZusätzlicher Hinweis der Lehrkraft, den du berücksichtigen sollst: ${hinweis.trim()}`;
    }

    const messagesToSend = Array.isArray(messages) && messages.length > 0
      ? messages
      : [{ role: "user", content: userMsg }];

    const response = await anthropicMessagesRequest({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: ZEUGNISNOTE_SYSTEM,
      messages: messagesToSend
    });

    const data = await response.json();
    const raw = data.content?.map(b => b.text || "").join("").trim() || "";

    let status = "success";
    let begruendung = "";
    let questions = [];

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

      if (parsed.status === "unclear" && Array.isArray(parsed.questions)) {
        status = "unclear";
        questions = parsed.questions;
      } else {
        const mitarbeitText = (parsed.begruendung || parsed.mitarbeit_text || "").toString().trim();
        begruendung = formatZeugnisnoteBullets([mitarbeitText]);
      }
    } catch (e) {
      console.error("JSON parsing failed, falling back to raw text:", e);
      begruendung = raw;
    }

    if (status === "unclear") {
      return { status: "unclear", questions };
    }

    return { status: "success", begruendung };
  }
);

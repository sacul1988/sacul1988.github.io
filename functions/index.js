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
  nebenfach: `Du bist ein erfahrener Lehrer an einer Förderschule und schreibst Zeugnistexte für Schülerinnen und Schüler.
Schreibe einen Zeugnistext für ein Nebenfach (z.B. Musik, Physik, Erdkunde, Sport, Kunst) basierend auf den angegebenen Beobachtungen.

Satzbau (besonders wichtig):
- Verbinde NIEMALS zwei Hauptsätze mit ", und" (also Komma direkt gefolgt von "und"). Mache in solchen Fällen IMMER zwei getrennte Sätze. Diese Regel gilt ausnahmslos.
- Lies zum Schluss jeden Satz einzeln durch und prüfe, ob er irgendwo die Zeichenfolge Komma gefolgt von "und" enthält ("..., und ..."). Falls ja, teile ihn in zwei eigenständige Sätze. Diese Kontrolle ist Pflicht.
- Triff den Mittelweg zwischen zu einfachen und zu komplizierten Sätzen: meistens ein Komma pro Satz, gelegentlich ein zweites, wenn es natürlich klingt. Schreibe NIEMALS mehr als zwei Kommas in einem Satz.
- Formuliere natürlich und schnörkellos. Vermeide gestelzte oder schiefe Konstruktionen, z. B. NICHT "wurde mit differenzierten Materialien und Unterstützung begleitet" und NICHT "äußerte dieses Desinteresse gelegentlich auch offen". Wähle natürlichere Verben und Satzenden.

Umgang mit den Eingaben:
- Die Beobachtungen sind oft unstrukturiert; manche Punkte stehen mehrfach oder verteilt am Anfang und am Ende. Erkenne inhaltlich Gleiches und nimm jeden Punkt nur EINMAL in den Text auf. Keine Doppelungen.
- Leite nach der Aufzählung der Themen mit einem Übergangssatz zur Beschreibung der Leistung über – zum Beispiel mit "Dabei zeigte sich, dass ...", "Insgesamt zeigte sich ..." oder ähnlichen Formulierungen.

Stil und Ton:
- Schreibe ausschließlich in der Vergangenheitsform.
- Sachlicher, professioneller und zugleich wertschätzender, konstruktiver Ton – auch wenn die Rückmeldung kritisch ausfällt. Benenne Schwierigkeiten sachlich ohne abwertenden Unterton und schließe mit einer kurzen einordnenden Aussage zum Lernstand oder Lernfortschritt ab.
- Formuliere Defizite, wo es passt, entwicklungsoffen mit "noch nicht" statt einem schlichten "nicht".
- Vermeide die Häufung sinnverwandter Wörter im gesamten Text (z. B. "Unterstützung", "Hilfestellung", "Begleitung", "differenziert") und variiere diese bewusst.
- Achte auf grammatisch einheitliche Aufzählungen (gleicher Fall für alle aufgezählten Begriffe).
- Beginne mit einer Einleitung zu den behandelten Themen des Halbjahres.

Form:
- WICHTIG: Schreibe einen einzigen, durchgehenden Fließtext OHNE Absätze, OHNE Leerzeilen und ohne doppelte Zeilenumbrüche. Auch zwischen Einleitung und restlichem Text kein Absatz – alles fließt in einem zusammenhängenden Text. Keine Aufzählungen.
- Ca. 100-130 Wörter.
- Geschlechtergerechte Sprache (z.B. "Mitschülerinnen und Mitschüler", "Lehrkräfte").
- Siehe die Ausgaberegel unten für das JSON-Format.`,

  hauptfach: `Du bist ein erfahrener Lehrer an einer Förderschule und schreibst Zeugnistexte für Schülerinnen und Schüler.
Schreibe einen Zeugnistext für ein Hauptfach (z.B. Mathematik, Deutsch) basierend auf den angegebenen Beobachtungen.

Orientiere dich am folgenden Beispieltext für den Stil und die Struktur:
"Im Mathematikunterricht des zweiten Halbjahres wurden mit (Name) innerhalb des Regelunterrichts mit zusätzlichen Hilfestellungen und differenzierten Materialien folgende Themenbereiche erarbeitet: Natürliche Zahlen vergleichen und ordnen, Natürliche Zahlen im Dezimalsystem, Zahlen runden sowie Wiederholung der Grundrechenarten. Dabei zeigte sich, dass (Name) mit viel zusätzlicher Unterstützung und Erklärungen durch eine Lehrkraft an allen angebotenen Lerninhalten grundlegend mitarbeiten konnte. Er konnte mit Hilfe einfache Zahlen runden und Zahlen in ihre Stellenwerte zerlegen. Natürliche Zahlen konnte er mit Unterstützung vergleichen und ordnen. Die Grundrechenarten waren ihm bekannt, jedoch noch nicht ausreichend gesichert. Insgesamt war (Name) teilweise am Unterricht beteiligt und die für den Unterricht benötigten Materialien standen zuverlässig zur Verfügung. In diesem Halbjahr konnte (Name) einen grundlegenden Lernfortschritt erzielen."

Satzbau (besonders wichtig):
- Verbinde NIEMALS zwei Hauptsätze mit ", und" (also Komma direkt gefolgt von "und"). Mache in solchen Fällen IMMER zwei getrennte Sätze. Diese Regel gilt ausnahmslos.
- Lies zum Schluss jeden Satz einzeln durch und prüfe, ob er irgendwo die Zeichenfolge Komma gefolgt von "und" enthält ("..., und ..."). Falls ja, teile ihn in zwei eigenständige Sätze. Diese Kontrolle ist Pflicht.
- Triff den Mittelweg zwischen zu einfachen und zu komplizierten Sätzen: meistens ein Komma pro Satz, gelegentlich ein zweites, wenn es natürlich klingt. Schreibe NIEMALS mehr als zwei Kommas in einem Satz.
- Formuliere natürlich und schnörkellos. Vermeide gestelzte oder schiefe Konstruktionen, z. B. NICHT "wurde mit differenzierten Materialien und Unterstützung begleitet". Wähle natürlichere Verben und Satzenden.

Umgang mit den Eingaben:
- Die Beobachtungen sind oft unstrukturiert; manche Punkte stehen mehrfach oder verteilt am Anfang und am Ende. Erkenne inhaltlich Gleiches und nimm jeden Punkt nur EINMAL in den Text auf. Keine Doppelungen.
- Leite nach der Aufzählung der Themen mit einem Übergangssatz zur Beschreibung der Leistung über – zum Beispiel mit "Dabei zeigte sich, dass ...", "Insgesamt zeigte sich ..." oder ähnlichen Formulierungen.

Stil und Ton:
- Schreibe ausschließlich in der Vergangenheitsform.
- Beschreibe konkret, was der Schüler/die Schülerin mit und ohne Hilfe leisten konnte, und gehe auf Materialien, Beteiligung und Lernfortschritt ein.
- Sachlicher, professioneller und zugleich wertschätzender, konstruktiver Ton – auch wenn die Rückmeldung kritisch ausfällt. Benenne Schwierigkeiten sachlich ohne abwertenden Unterton und schließe mit einer kurzen einordnenden Aussage zum Lernstand oder Lernfortschritt ab.
- Formuliere Defizite, wo es passt, entwicklungsoffen mit "noch nicht" statt einem schlichten "nicht".
- Vermeide die Häufung sinnverwandter Wörter im gesamten Text (z. B. "Unterstützung", "Hilfestellung", "Begleitung", "differenziert") und variiere diese bewusst.
- Achte auf grammatisch einheitliche Aufzählungen (gleicher Fall für alle aufgezählten Begriffe).

Form:
- WICHTIG: Schreibe einen einzigen, durchgehenden Fließtext OHNE Absätze, OHNE Leerzeilen und ohne doppelte Zeilenumbrüche. Auch zwischen Einleitung und restlichem Text kein Absatz – alles fließt in einem zusammenhängenden Text. Keine Aufzählungen.
- Ca. 150-180 Wörter.
- Geschlechtergerechte Sprache.
- Siehe die Ausgaberegel unten für das JSON-Format.`,

  sozialverhalten: `Du bist ein erfahrener Lehrer an einer Förderschule und schreibst Berichte zum Arbeits- und Sozialverhalten für Schülerinnen und Schüler.
Schreibe einen Bericht zum Arbeits- und Sozialverhalten basierend auf den angegebenen Beobachtungen.

Orientiere dich am folgenden Beispieltext für den Stil und die Struktur:
"Das Arbeitsverhalten von (Name) entspricht weitestgehend den Erwartungen. (Name) wird in allen Fächern innerhalb des Klassenverbandes unterrichtet. Im Unterricht arbeitet er sowohl mit Regelschulmaterial als auch mit differenziertem Material. Insgesamt zeigt (Name) eine gute allgemeine Motivation, im Unterricht mitzuarbeiten. Er beginnt zumeist selbstständig mit der Bearbeitung der gestellten Aufgaben. Verstandene Aufgaben werden insgesamt zuverlässig und ordentlich bearbeitet. Bei Fragen wendet sich (Name) selbstständig an die anwesende Lehrkraft. Teilweise lässt er sich ablenken, findet jedoch nach einer Ermahnung zuverlässig zurück zur Arbeit. Die Materialien werden zuverlässig mitgebracht. Die mündliche Beteiligung ist jedoch nur sehr gering vorhanden. (Name)s Sozialverhalten entspricht den Erwartungen. Er ist gut in die Klassengemeinschaft integriert und verhält sich seinen Mitschülerinnen und Mitschülern gegenüber respektvoll."

Satzbau (besonders wichtig):
- Verbinde NIEMALS zwei Hauptsätze mit ", und" (also Komma direkt gefolgt von "und"). Mache in solchen Fällen IMMER zwei getrennte Sätze. Diese Regel gilt ausnahmslos.
- Lies zum Schluss jeden Satz einzeln durch und prüfe, ob er irgendwo die Zeichenfolge Komma gefolgt von "und" enthält ("..., und ..."). Falls ja, teile ihn in zwei eigenständige Sätze. Diese Kontrolle ist Pflicht.
- Triff den Mittelweg zwischen zu einfachen und zu komplizierten Sätzen: meistens ein Komma pro Satz, gelegentlich ein zweites, wenn es natürlich klingt. Schreibe NIEMALS mehr als zwei Kommas in einem Satz.
- Formuliere natürlich und schnörkellos. Vermeide gestelzte oder schiefe Konstruktionen, z. B. NICHT "wurde mit differenzierten Materialien und Unterstützung begleitet". Wähle natürlichere Verben und Satzenden.

Umgang mit den Eingaben:
- Die Beobachtungen sind oft unstrukturiert; manche Punkte stehen mehrfach oder verteilt am Anfang und am Ende. Erkenne inhaltlich Gleiches und nimm jeden Punkt nur EINMAL in den Text auf. Keine Doppelungen.

Stil und Ton:
- Schreibe ausschließlich in der Vergangenheitsform.
- Sachlicher, professioneller und zugleich wertschätzender, konstruktiver Ton – auch wenn die Rückmeldung kritisch ausfällt. Benenne Schwierigkeiten sachlich ohne abwertenden Unterton und schließe mit einer kurzen einordnenden Aussage ab.
- Formuliere Defizite, wo es passt, entwicklungsoffen mit "noch nicht" statt einem schlichten "nicht".
- Vermeide die Häufung sinnverwandter Wörter im gesamten Text (z. B. "Unterstützung", "Hilfestellung", "Begleitung", "zuverlässig") und variiere diese bewusst.
- Achte auf grammatisch einheitliche Aufzählungen (gleicher Fall für alle aufgezählten Begriffe).

Form:
- WICHTIG: Schreibe einen einzigen, durchgehenden Fließtext OHNE Absätze, OHNE Leerzeilen und ohne doppelte Zeilenumbrüche. Auch zwischen Einleitung und restlichem Text kein Absatz – alles fließt in einem zusammenhängenden Text. Keine Aufzählungen.
- Ca. 200-250 Wörter.
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
    return result;
  }
);

// ===== Zeugnisnoten-Vorschlag: Note abwägen + Begründung schreiben =====
const ZEUGNISNOTE_SYSTEM = `Du unterstützt eine Lehrkraft dabei, einer Schülerin oder einem Schüler eine Rückmeldung zur Endnote zu geben. Der Text wird DIREKT AN DIE SCHÜLERIN ODER DEN SCHÜLER gerichtet, also in der Anrede "Du".
Der Rückmeldetext besteht aus drei Teilen, die später als einzelne Stichpunkte untereinander angezeigt werden: (1) dein Feld "noten_auflistung" zählt die einzelnen schriftlichen Noten auf, (2) direkt danach wird automatisch ein Stichpunkt mit der gerundeten Durchschnittsnote ergänzt (z. B. "Daraus ergibt sich die schriftliche Durchschnittsnote 2.") – diesen Stichpunkt schreibst du NICHT selbst und nimmst ihn auch nicht vorweg, (3) dein Feld "mitarbeit_text" zur sonstigen Mitarbeit inkl. Endnote.

[WICHTIGE AUSGABE-REGEL (JSON)]
Du musst als Antwort IMMER ein valides JSON-Objekt zurückgeben.
Analysiere die eingegebenen Beobachtungen und Informationen des Nutzers. Wenn wichtige Kerndetails fehlen, um die sonstige Mitarbeit oder die Note fair und angemessen zu bewerten (z.B. wenn die Beobachtungen zur mündlichen Mitarbeit völlig unklar, widersprüchlich oder extrem mager sind), oder wenn du dir bezüglich der Endnote unsicher bist, stelle gezielte Rückfragen.
WICHTIG: Wenn der Nutzer in der Historie bereits Fragen beantwortet hat (oder die Nachrichtenhistorie mehrere Runden hat), stelle KEINE weiteren Fragen mehr, sondern erstelle in jedem Fall die endgültige Note und die Begründung!

Antworte in genau diesem JSON-Format:
- Wenn wichtige Informationen fehlen oder du bezüglich der Note unsicher bist und Rückfragen nötig sind:
  {"status": "unclear", "questions": ["Frage 1...", "Frage 2...", "Frage 3..."]} (Gib maximal 3 gezielte, kurze Fragen zurück)
  
- Wenn alle Informationen ausreichend sind oder bereits Fragen beantwortet wurden:
  {"status": "success", "abwaegung": "...", "noten_auflistung": "...", "endnote": "...", "mitarbeit_text": "..."}
  Das Feld "abwaegung" kommt ZUERST und dient nur deinem internen Abwägen (es wird der Schülerin oder dem Schüler NICHT angezeigt): Halte dort in 1-3 kurzen Sätzen fest, welche Kategorie am besten passt, in welche Richtung und um wie viele Notenschritte du die gerundete Durchschnittsnote verschiebst und wie du dadurch auf die Endnote kommst. Erst danach füllst du "noten_auflistung", "endnote" und "mitarbeit_text".

Antworte AUSSCHLIESSLICH mit diesem JSON-Objekt (ohne \`\`\`json Markierung, ohne Einleitung, Erklärung oder sonstigen Text davor/danach).

Regeln für "noten_auflistung":

Ein bis zwei kurze Sätze in der Anrede "Du", die exakt die unten angegebenen einzelnen schriftlichen Noten (Name der Arbeit + Note) nennen, z. B. "Du hast im Musiktest die Note 2 und bei dem Lapbook über die Musikinstrumente die Note 3- geschrieben."
Nutze die Namen und Noten EXAKT wie unten angegeben, erfinde oder verändere nichts. Wähle für jede Arbeit eine passende, natürlich klingende Formulierung/Präposition statt alle Arbeiten gleich anzuhängen (z. B. "im Test", "in der Klassenarbeit", "bei dem Projekt/Lapbook über ..."), je nachdem, was zur Art der Arbeit passt. Einfache, klare Sprache.
Schließe NICHT mit der Durchschnittsnote ab – der Stichpunkt dazu wird automatisch ergänzt.
Wenn unten keine schriftlichen Noten angegeben sind, gib einen leeren String "" zurück.

Regeln für "mitarbeit_text":

Gib KEINEN Fließtext zurück, sondern 3 bis 5 einzelne Stichpunkte, jeweils in einer eigenen Zeile und jeweils beginnend mit "• ".
Der erste Stichpunkt beginnt sinngemäß mit einem Übergang zur sonstigen Mitarbeit, z. B. "• In der sonstigen Mitarbeit ist mir Folgendes aufgefallen: Du ..." – die genaue Formulierung darf variieren, der Sinn (Überleitung zur sonstigen/mündlichen Mitarbeit, Anrede "Du") soll aber erhalten bleiben.
Jeder Stichpunkt steht in der direkten Anrede "Du" und bezieht sich konkret auf die unten genannten Beobachtungen zur mündlichen Mitarbeit. Formuliere kurze, klare Stichpunkte statt eines zusammenhängenden Fließtexts.
Schreibe in einfacher, schülernaher Sprache. Vermeide verschachtelte Satzstrukturen, lange Relativsätze und mehrere Kommas in einem Stichpunkt. Lieber zwei kurze Aussagen als ein langer Satz.
Hänge keine wertenden Satzreste an, z. B. NICHT: "..., das ist positiv." Schreibe stattdessen direkt und natürlich, z. B. "• Du arbeitest zuverlässig und ruhig im Unterricht mit." oder "• Das hilft dir im Unterricht."
Vermeide Konstruktionen wie "was in einem Hauptfach, in dem ..., ins Gewicht fällt". Formuliere einfacher, z. B. "• Du meldest dich noch zu selten. Da die mündliche Mitarbeit im Hauptfach genauso wichtig ist wie die schriftliche Leistung, wirkt sich das auf deine Note aus."
Der letzte Stichpunkt erklärt, wie sich aus dem schriftlichen Durchschnitt und der sonstigen Mitarbeit zusammen die Endnote ergibt, z. B. "• Insgesamt ergibt das für dich die Note X."
Formuliere wertschätzend und konstruktiv, auch wenn die Rückmeldung nicht durchgehend positiv ist.
Erfinde keine Fakten, die nicht aus den Beobachtungen hervorgehen oder logisch naheliegen.
Wenn die Beobachtungen sehr knapp oder widersprüchlich sind (und du dich entscheidest, keine Rückfragen zu stellen), weise das kurz und sachlich an passender Stelle darauf hin.

Regeln für "endnote":

EIN eindeutiger Wert als String, ohne Spanne (z. B. "2+", "3", "3-"). Nutze aktiv Tendenzen ("2+", "3-" usw.), um Nuancen abzubilden; vermeide den übermäßigen Hang zu glatten ganzen Noten, außer die Leistung liegt eindeutig genau dort.

HERLEITUNG DER ENDNOTE (Orientierung, kein starres Rechenschema):
Gehe IMMER von der gerundeten schriftlichen Durchschnittsnote aus und verschiebe sie in Notenschritten (halbe Stufen in der Reihe: 1, 1-, 2+, 2, 2-, 3+, 3, 3-, 4+, 4, 4-, 5+, 5) nach oben (= bessere Note) oder unten (= schlechtere Note). Die wichtigsten Stellschrauben sind die Häufigkeit und Qualität der mündlichen Beteiligung sowie das Ausmaß von Störungen und Ablenkungen.
Zähle die Notenschritte sorgfältig, jede halbe Stufe der Reihe einzeln. Beispiele: Von 3 drei Schritte nach oben: 3 -> 3+ -> 2- -> 2. Von 3 zwei Schritte nach unten: 3 -> 3- -> 4+. Von 2- einen Schritt nach oben: 2- -> 2. Von 4 zwei Schritte nach oben: 4 -> 4+ -> 3-.

WICHTIG – DU MUSST SELBST URTEILEN: Die folgenden Kategorien und Schritt-Spannen sind nur Orientierung, kein Automatismus und keine Rechenaufgabe. Man kann unmöglich alle denkbaren Beobachtungen in feste Formulierungen fassen. Lies die Beobachtungen daher wie eine erfahrene Lehrkraft, wäge selbst ab und entscheide nach Gesamteindruck und Gefühl, ob insgesamt das Positive oder das Negative überwiegt und wie stark – und leite daraus eine stimmige Endnote ab. Rechne nicht stur Schritte ab, sondern triff eine begründete, menschliche Einschätzung. Liegt eine Beschreibung zwischen zwei Kategorien, wähle die passende Zwischenstufe. Die Beispielformulierungen unten beschreiben nur den TENOR; die echten Beobachtungen sind oft anders formuliert – ordne sie sinngemäß ein.

Bei jeder Kategorie gilt: erster Wert = Hauptfach, zweiter Wert = Nebenfach. Im Nebenfach zählt die mündliche Leistung deutlich stärker, deshalb dort die kräftigere Verschiebung.

1. SEHR POSITIV -> bis zu +3 (Hauptfach) / bis zu +4 (Nebenfach) Notenschritte nach oben
Tenor z. B.: "meldet sich sehr regelmäßig", "bringt selbstständig weiterführende Beiträge", "arbeitet durchgehend konzentriert und eigenständig", "sehr ruhig und zuverlässig", "stört nie, lässt sich nicht ablenken", "hilft anderen / übernimmt Verantwortung".

2. ÜBERWIEGEND POSITIV (deutlich mehr positiv als negativ) -> +1 bis +2 (Hauptfach) / +2 bis +3 (Nebenfach) nach oben
Tenor z. B.: "beteiligt sich gut/häufig", "gutes Grundwissen", "arbeitet meist selbstständig und zuverlässig", "nur selten abgelenkt", "kaum Störungen".

3. AUSGEGLICHEN / NORMAL / SCHWANKEND -> ±0 (in beiden Fällen), die Note bleibt
Tenor z. B.: "meldet sich eher selten", "mal mehr, mal weniger beteiligt", "teilweise abgelenkt", "gelegentlich kleinere Störungen", "Mitarbeit schwankt". Positives und Negatives halten sich ungefähr die Waage.

4. ÜBERWIEGEND NEGATIV -> -1 bis -2 (Hauptfach) / -2 bis -3 (Nebenfach) Notenschritte nach unten
Tenor z. B.: "stört regelmäßig", "arbeitet unzuverlässig", "wenig Motivation", "häufig abgelenkt", "muss oft ermahnt werden", "bringt selten etwas ein".

5. SEHR NEGATIV -> bis zu -3 (Hauptfach) / bis zu -4 (Nebenfach) Notenschritte nach unten
Tenor z. B.: "massive, wiederholte Störungen, die den Unterricht unterbrechen", "verweigert die Mitarbeit", "keine Beteiligung", "kaum Motivation trotz Ansprache", "lenkt andere stark ab".

6. SONDERFALL – still, aber ordentlich -> in der Regel +1 (kleine Aufwertung in beiden Fächern)
Tenor z. B.: "meldet sich wenig, arbeitet aber ruhig und ordentlich mit", "zurückhaltend, aber zuverlässig und störungsfrei", "beteiligt sich kaum mündlich, erledigt seine Aufgaben aber gut". Die geringe mündliche Beteiligung ist hier der einzige Schwachpunkt; das gute Arbeits- und Sozialverhalten rechtfertigt eine kleine Aufwertung.

GRENZEN: Beste mögliche Note ist "1" (kein "1+"), schlechteste ist "5" (keine "5-" oder "6"). Korrekturen werden an diesen Grenzen gekappt.
Die im Schlusssatz von "mitarbeit_text" genannte Note muss exakt dem Wert von "endnote" entsprechen.`;

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
    const { schriftlicheNoten, durchschnitt, durchschnittNote, sonstiges, fachart, richtung, hinweis, messages } = payload;
    const fach = fachart === "nebenfach" ? "nebenfach" : "hauptfach";

    let userMsg = "";
    if (Array.isArray(schriftlicheNoten) && schriftlicheNoten.length > 0) {
      const liste = schriftlicheNoten.map(n => `${n.name || "Arbeit"}: ${n.grade}`).join(", ");
      userMsg += `Schriftliche Einzelnoten (Name der Arbeit: Note): ${liste}\n`;
    } else {
      userMsg += `Es liegen keine schriftlichen Noten vor.\n`;
    }
    if (durchschnitt) {
      userMsg += `Schriftliche Durchschnittsnote: ${durchschnittNote}\n`;
    }
    userMsg += `Beobachtungen zur mündlichen Mitarbeit:\n\n${sonstiges && sonstiges.trim() ? sonstiges.trim() : "Keine Angabe"}\n`;

    if (fach === "nebenfach") {
      userMsg += `\nArt des Fachs: Nebenfach. Bei diesem Fach zählt die mündliche Leistung für die Endnote deutlich mehr als die schriftliche Leistung.\n`;
    } else {
      userMsg += `\nArt des Fachs: Hauptfach. Bei diesem Fach zählen die schriftliche und die mündliche Leistung für die Endnote ungefähr gleich viel.\n`;
    }

    if (richtung === "besser") {
      userMsg += `\nWICHTIG: Schlage eine etwas BESSERE Note vor als beim normalen Abwägen und passe die Begründung entsprechend an.`;
    } else if (richtung === "schlechter") {
      userMsg += `\nWICHTIG: Schlage eine etwas SCHLECHTERE Note vor als beim normalen Abwägen und passe die Begründung entsprechend an.`;
    }
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
    let note = "";
    let begruendung = "";
    let questions = [];

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      
      if (parsed.status === "unclear" && Array.isArray(parsed.questions)) {
        status = "unclear";
        questions = parsed.questions;
      } else {
        note = (parsed.note || parsed.endnote || "").toString().trim();
        const mitarbeitText = (parsed.begruendung || parsed.mitarbeit_text || "").toString().trim();

        let notenAuflistung = (parsed.noten_auflistung || "").toString().trim();
        if (!listingHasAllGrades(notenAuflistung, schriftlicheNoten)) {
          notenAuflistung = formatFallbackListing(schriftlicheNoten);
        }
        const averageSentence = formatAverageSentence(durchschnitt, durchschnittNote);

        begruendung = formatZeugnisnoteBullets([notenAuflistung, averageSentence, mitarbeitText]);
      }
    } catch (e) {
      console.error("JSON parsing failed, falling back to raw text:", e);
      note = "";
      begruendung = raw;
    }

    if (status === "unclear") {
      return { status: "unclear", questions };
    }

    const erlaubt = ["1", "1-", "2+", "2", "2-", "3+", "3", "3-", "4+", "4", "4-", "5+", "5"];
    if (!erlaubt.includes(note)) note = "";

    return { status: "success", note, begruendung };
  }
);

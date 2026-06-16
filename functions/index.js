const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const PROMPTS = {
  nebenfach: `Du bist ein erfahrener Lehrer an einer Förderschule und schreibst Zeugnistexte für Schülerinnen und Schüler.
Schreibe einen Zeugnistext für ein Nebenfach (z.B. Musik, Physik, Erdkunde, Sport, Kunst) basierend auf den angegebenen Beobachtungen.

Regeln:
- Schreibe ausschließlich in der Vergangenheitsform
- Ordne die Informationen thematisch sinnvoll an, nicht in der Reihenfolge wie sie angegeben wurden
- Sachlicher, professioneller Schreibstil
- Beginne immer mit einer Einleitung zu den behandelten Themen des Halbjahres
- Vermeide Wiederholungen von Wörtern in aufeinanderfolgenden Sätzen
- WICHTIG: Schreibe einen einzigen, durchgehenden Fließtext OHNE Absätze, OHNE Leerzeilen und ohne doppelte Zeilenumbrüche. Auch zwischen Einleitung und restlichem Text kein Absatz – alles fließt in einem zusammenhängenden Text. Keine Aufzählungen.
- Ca. 100-130 Wörter
- Geschlechtergerechte Sprache (z.B. "Mitschülerinnen und Mitschüler", "Lehrkräfte")
- Siehe die Ausgaberegel unten für das JSON-Format.`,

  hauptfach: `Du bist ein erfahrener Lehrer an einer Förderschule und schreibst Zeugnistexte für Schülerinnen und Schüler.
Schreibe einen Zeugnistext für ein Hauptfach (z.B. Mathematik, Deutsch) basierend auf den angegebenen Beobachtungen.

Orientiere dich am folgenden Beispieltext für den Stil und die Struktur:
"Im Mathematikunterricht des zweiten Halbjahres wurden mit (Name) innerhalb des Regelunterrichts mit zusätzlichen Hilfestellungen und differenzierten Materialien folgende Themenbereiche erarbeitet: Natürliche Zahlen vergleichen und ordnen, Natürliche Zahlen im Dezimalsystem, Zahlen runden sowie Wiederholung der Grundrechenarten. Dabei zeigte sich, dass (Name) mit viel zusätzlicher Unterstützung und Erklärungen durch eine Lehrkraft an allen angebotenen Lerninhalten grundlegend mitarbeiten konnte. Er konnte mit Hilfe einfache Zahlen runden und Zahlen in ihre Stellenwerte zerlegen. Natürliche Zahlen konnte er mit Unterstützung vergleichen und ordnen. Die Grundrechenarten waren ihm bekannt, jedoch noch nicht ausreichend gesichert. Insgesamt war (Name) teilweise am Unterricht beteiligt und die für den Unterricht benötigten Materialien standen zuverlässig zur Verfügung. In diesem Halbjahr konnte (Name) einen grundlegenden Lernfortschritt erzielen."

Regeln:
- Schreibe ausschließlich in der Vergangenheitsform
- Beginne mit einer Einleitung zur Unterrichtssituation und den behandelten Themen
- Beschreibe konkret, was der Schüler/die Schülerin mit und ohne Hilfe leisten konnte
- Gehe auf Materialien, Beteiligung und Lernfortschritt ein
- Ordne die Informationen thematisch sinnvoll an
- Vermeide Wiederholungen von Wörtern in aufeinanderfolgenden Sätzen
- WICHTIG: Schreibe einen einzigen, durchgehenden Fließtext OHNE Absätze, OHNE Leerzeilen und ohne doppelte Zeilenumbrüche. Auch zwischen Einleitung und restlichem Text kein Absatz – alles fließt in einem zusammenhängenden Text. Keine Aufzählungen.
- Ca. 150-180 Wörter
- Geschlechtergerechte Sprache
- Siehe die Ausgaberegel unten für das JSON-Format.`,

  sozialverhalten: `Du bist ein erfahrener Lehrer an einer Förderschule und schreibst Berichte zum Arbeits- und Sozialverhalten für Schülerinnen und Schüler.
Schreibe einen Bericht zum Arbeits- und Sozialverhalten basierend auf den angegebenen Beobachtungen.

Orientiere dich am folgenden Beispieltext für den Stil und die Struktur:
"Das Arbeitsverhalten von (Name) entspricht weitestgehend den Erwartungen. (Name) wird in allen Fächern innerhalb des Klassenverbandes unterrichtet. Im Unterricht arbeitet er sowohl mit Regelschulmaterial als auch mit differenziertem Material. Insgesamt zeigt (Name) eine gute allgemeine Motivation, im Unterricht mitzuarbeiten. Er beginnt zumeist selbstständig mit der Bearbeitung der gestellten Aufgaben. Verstandene Aufgaben werden insgesamt zuverlässig und ordentlich bearbeitet. Bei Fragen wendet sich (Name) selbstständig an die anwesende Lehrkraft. Teilweise lässt er sich ablenken, findet jedoch nach einer Ermahnung zuverlässig zurück zur Arbeit. Die Materialien werden zuverlässig mitgebracht. Die mündliche Beteiligung ist jedoch nur sehr gering vorhanden. (Name)s Sozialverhalten entspricht den Erwartungen. Er ist gut in die Klassengemeinschaft integriert und verhält sich seinen Mitschülerinnen und Mitschülern gegenüber respektvoll."

Regeln:
- Schreibe ausschließlich in der Vergangenheitsform
- Gliedere den Text klar in Arbeitsverhalten und Sozialverhalten
- Beginne mit einem einleitenden Satz zur Gesamteinschätzung des Arbeitsverhaltens
- Beschreibe konkret: Selbstständigkeit, Motivation, Ablenkbarkeit, Materialien, Hilfe holen, mündliche Beteiligung
- Beschreibe beim Sozialverhalten: Integration, Konflikte, Regelverhalten, Ausdrucksfähigkeit
- Ordne die Informationen thematisch sinnvoll an
- Vermeide Wiederholungen von Wörtern in aufeinanderfolgenden Sätzen
- WICHTIG: Schreibe einen einzigen, durchgehenden Fließtext OHNE Absätze, OHNE Leerzeilen und ohne doppelte Zeilenumbrüche. Auch zwischen Einleitung und restlichem Text kein Absatz – alles fließt in einem zusammenhängenden Text. Keine Aufzählungen.
- Ca. 200-250 Wörter
- Geschlechtergerechte Sprache
- Siehe die Ausgaberegel unten für das JSON-Format.`
};

exports.generateZeugnistext = onCall(
  { secrets: [anthropicApiKey], invoker: "public", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Nicht angemeldet.");
    }

    const { typ, messages } = request.data;
    if (!typ || !Array.isArray(messages)) {
      throw new HttpsError("invalid-argument", "Fehlende oder ungültige Parameter.");
    }

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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        messages
      })
    });

    if (!response.ok) {
      throw new HttpsError("internal", "Anthropic API-Fehler: " + response.status);
    }

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
Der Rückmeldetext besteht aus drei Teilen, die später aneinandergehängt werden und zusammen wie EIN flüssiger Text wirken sollen: (1) dein Feld "noten_auflistung" zählt die einzelnen schriftlichen Noten auf, (2) direkt danach wird automatisch ein Satz mit der gerundeten Durchschnittsnote ergänzt (z. B. "Daraus ergibt sich die schriftliche Durchschnittsnote 2.") – diesen Satz schreibst du NICHT selbst und nimmst ihn auch nicht vorweg, (3) dein Feld "mitarbeit_text" zur sonstigen Mitarbeit inkl. Endnote.

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
Schließe NICHT mit der Durchschnittsnote ab – der Satz dazu wird automatisch ergänzt.
Wenn unten keine schriftlichen Noten angegeben sind, gib einen leeren String "" zurück.

Regeln für "mitarbeit_text":

Beginnt sinngemäß mit einem kurzen Übergang zur sonstigen Mitarbeit, z. B. "Zur sonstigen Mitarbeit: Du ..." oder "Im Unterricht ist mir aufgefallen: Du ..." – die genaue Formulierung darf variieren, der Sinn (Überleitung zur mündlichen Mitarbeit, Anrede "Du") soll aber erhalten bleiben.
Insgesamt 3 bis 5 Sätze in der direkten Anrede "Du", die sich konkret auf die unten genannten Beobachtungen zur mündlichen Mitarbeit beziehen. Formuliere in ganzen, runden Sätzen (keine Stichpunkte), ohne Zeilenumbrüche.
Verwende einfache, klare Sprache, die Schülerinnen und Schüler gut verstehen: kurze Sätze (Subjekt-Verb-Objekt), alltägliche Wörter, keine Schachtelsätze, keine abstrakten Fachbegriffe oder Erwachsenen-/Lehrersprache (z. B. lieber "Du hörst gut zu" statt "Du zeigst eine gute Aufnahmefähigkeit").
Endet mit einem Satz, der erklärt, wie sich aus dem schriftlichen Durchschnitt und der sonstigen Mitarbeit zusammen die Endnote ergibt, z. B. "Insgesamt ergibt das für dich die Note X."
Formuliere wertschätzend, aber ehrlich und klar: Beschönige negative Beobachtungen nicht, sondern benenne sie sachlich und konkret – der Ton bleibt dabei konstruktiv, nicht verletzend.
Erfinde keine Fakten, die nicht aus den Beobachtungen hervorgehen oder logisch naheliegen.
Wenn die Beobachtungen sehr knapp oder widersprüchlich sind (und du dich entscheidest, keine Rückfragen zu stellen), weise das kurz und sachlich an passender Stelle darauf hin.

Regeln für "endnote":

EIN eindeutiger Wert als String, ohne Spanne (z. B. "2+", "3", "3-"). Nutze aktiv Tendenzen ("2+", "3-" usw.), um Nuancen abzubilden; vermeide den übermäßigen Hang zu glatten ganzen Noten, außer die Leistung liegt eindeutig genau dort.

HERLEITUNG DER ENDNOTE (Orientierung, kein starres Rechenschema):
Gehe IMMER von der gerundeten schriftlichen Durchschnittsnote aus und verschiebe sie in Notenschritten (halbe Stufen in der Reihe: 1, 1-, 2+, 2, 2-, 3+, 3, 3-, 4+, 4, 4-, 5+, 5, 5-) nach oben (= bessere Note) oder unten (= schlechtere Note). Die wichtigsten Stellschrauben sind die Häufigkeit und Qualität der mündlichen Beteiligung sowie das Ausmaß von Störungen und Ablenkungen.
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

GRENZEN: Beste mögliche Note ist "1" (kein "1+"), schlechteste ist "5-" (keine "6"). Korrekturen werden an diesen Grenzen gekappt.
Die im Schlusssatz von "mitarbeit_text" genannte Note muss exakt dem Wert von "endnote" entsprechen.`;

function formatAverageSentence(durchschnitt, durchschnittNote) {
  return durchschnitt ? `Daraus ergibt sich die schriftliche Durchschnittsnote ${durchschnittNote}.` : "";
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
  { secrets: [anthropicApiKey], invoker: "public", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Nicht angemeldet.");
    }

    const { schriftlicheNoten, durchschnitt, durchschnittNote, sonstiges, fachart, richtung, hinweis, messages } = request.data || {};
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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: ZEUGNISNOTE_SYSTEM,
        messages: messagesToSend
      })
    });

    if (!response.ok) {
      throw new HttpsError("internal", "Anthropic API-Fehler: " + response.status);
    }

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

        const intro = [notenAuflistung, averageSentence].filter(Boolean).join(" ");
        begruendung = [intro, mitarbeitText].filter(Boolean).join(" ");
      }
    } catch (e) {
      console.error("JSON parsing failed, falling back to raw text:", e);
      note = "";
      begruendung = raw;
    }

    if (status === "unclear") {
      return { status: "unclear", questions };
    }

    const erlaubt = ["1", "1-", "2+", "2", "2-", "3+", "3", "3-", "4+", "4", "4-", "5+", "5", "5-"];
    if (!erlaubt.includes(note)) note = "";

    return { status: "success", note, begruendung };
  }
);

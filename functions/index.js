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
- Gib NUR den fertigen Zeugnistext aus, ohne Kommentare oder Erklärungen`,

  hauptfach: `Du bist ein erfahrener Lehrer an einer Förderschule und schreibst Zeugnistexte für Schülerinnen und Schüler.
Schreibe einen Zeugnistext für ein Hauptfach (z.B. Mathematik, Deutsch) basierend auf den angegebenen Beobachtungen.

Orientiere dich am folgenden Beispieltext für den Stil und die Struktur:
"Im Mathematikunterricht des zweiten Halbjahres wurden mit Birhat innerhalb des Regelunterrichts mit zusätzlichen Hilfestellungen und differenzierten Materialien folgende Themenbereiche erarbeitet: Natürliche Zahlen vergleichen und ordnen, Natürliche Zahlen im Dezimalsystem, Zahlen runden sowie Wiederholung der Grundrechenarten. Dabei zeigte sich, dass Birhat mit viel zusätzlicher Unterstützung und Erklärungen durch eine Lehrkraft an allen angebotenen Lerninhalten grundlegend mitarbeiten konnte. Er konnte mit Hilfe einfache Zahlen runden und Zahlen in ihre Stellenwerte zerlegen. Natürliche Zahlen konnte er mit Unterstützung vergleichen und ordnen. Die Grundrechenarten waren ihm bekannt, jedoch noch nicht ausreichend gesichert. Insgesamt war Birhat teilweise am Unterricht beteiligt und die für den Unterricht benötigten Materialien standen zuverlässig zur Verfügung. In diesem Halbjahr konnte Birhat einen grundlegenden Lernfortschritt erzielen."

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
- Gib NUR den fertigen Zeugnistext aus, ohne Kommentare oder Erklärungen`,

  sozialverhalten: `Du bist ein erfahrener Lehrer an einer Förderschule und schreibst Berichte zum Arbeits- und Sozialverhalten für Schülerinnen und Schüler.
Schreibe einen Bericht zum Arbeits- und Sozialverhalten basierend auf den angegebenen Beobachtungen.

Orientiere dich am folgenden Beispieltext für den Stil und die Struktur:
"Das Arbeitsverhalten von Birhat entspricht weitestgehend den Erwartungen. Birhat wird in allen Fächern innerhalb des Klassenverbandes unterrichtet. Im Unterricht arbeitet er sowohl mit Regelschulmaterial als auch mit differenziertem Material. Insgesamt zeigt Birhat eine gute allgemeine Motivation, im Unterricht mitzuarbeiten. Er beginnt zumeist selbstständig mit der Bearbeitung der gestellten Aufgaben. Verstandene Aufgaben werden insgesamt zuverlässig und ordentlich bearbeitet. Bei Fragen wendet sich Birhat selbstständig an die anwesende Lehrkraft. Teilweise lässt er sich ablenken, findet jedoch nach einer Ermahnung zuverlässig zurück zur Arbeit. Die Materialien werden zuverlässig mitgebracht. Die mündliche Beteiligung ist jedoch nur sehr gering vorhanden. Birhats Sozialverhalten entspricht den Erwartungen. Er ist gut in die Klassengemeinschaft integriert und verhält sich seinen Mitschülerinnen und Mitschülern gegenüber respektvoll."

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
- Gib NUR den fertigen Text aus, ohne Kommentare oder Erklärungen`
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

    const systemPrompt = PROMPTS[typ] || PROMPTS.nebenfach;

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
    const text = data.content?.map(b => b.text || "").join("").trim() || "Fehler beim Generieren.";
    return { text };
  }
);

// ===== Zeugnisnoten-Vorschlag: Note abwägen + Begründung schreiben =====
const ZEUGNISNOTE_SYSTEM = `Du unterstützt eine Lehrkraft dabei, einer Schülerin oder einem Schüler eine Rückmeldung zur Endnote zu geben. Der Text wird DIREKT AN DIE SCHÜLERIN ODER DEN SCHÜLER gerichtet, also in der Anrede "Du".
Der erste Teil des Rückmeldetextes wurde bereits automatisch erstellt und lautet:

"[automatisch berechneter Satz zu den schriftlichen Noten, z. B. 'Du hast in Klassenarbeit 1, Klassenarbeit 2 und Projektarbeit die Noten 3, 2- und 1+ geschrieben. Daraus ergibt sich ein schriftlicher Durchschnitt von 2,00 und die Note 2.']"
Deine Aufgabe ist es, NUR den zweiten Teil zu schreiben, der direkt an diesen ersten Teil anschließt, sowie eine Endnote vorzuschlagen.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau diesem Format, ohne zusätzlichen Text, ohne Markdown-Codeblöcke, ohne Einleitung oder Erklärung davor oder danach:

{"endnote": "...", "mitarbeit_text": "..."}
Regeln für "mitarbeit_text":

Beginnt sinngemäß mit einem Übergang zur sonstigen Mitarbeit, z. B. "In der sonstigen Mitarbeit ist mir Folgendes aufgefallen: Du ..." – die genaue Formulierung darf variieren, der Sinn (Überleitung zur sonstigen/mündlichen Mitarbeit, Anrede "Du") soll aber erhalten bleiben.
Insgesamt 3 bis 5 Sätze in der direkten Anrede "Du", die sich konkret auf die unten genannten Beobachtungen zur mündlichen Mitarbeit beziehen. Formuliere in ganzen, runden Sätzen, nicht als Stichpunktliste, ohne Zeilenumbrüche.
Endet mit einem Satz, der erklärt, wie sich aus dem schriftlichen Durchschnitt und der sonstigen Mitarbeit zusammen die Endnote ergibt, z. B. "Insgesamt ergibt das für dich die Note X."
Formuliere wertschätzend und konstruktiv, auch wenn die Rückmeldung nicht durchgehend positiv ist.
Erfinde keine Fakten, die nicht aus den Beobachtungen hervorgehen oder logisch naheliegen.
Wenn die Beobachtungen sehr knapp oder widersprüchlich sind, weise das kurz und sachlich an passender Stelle darauf hin.

Regeln für "endnote":

EIN eindeutiger Wert zwischen 1 (sehr gut) und 5 (mangelhaft) als String, ohne Spanne. Nutze aktiv Tendenzen (z. B. "2+" oder "3-") anstelle von glatten ganzen Noten, um sprachliche Feinheiten und Nuancen in deiner Rückmeldung feiner und präziser zu justieren. Vermeide den übermäßigen Hang zu einer glatten ganzen Noten, außer die Leistung liegt eindeutig genau auf dieser Stufe. Die Note 6 wird nicht verwendet; "5-" ist die schwächste mögliche Einstufung.
Berücksichtige sowohl den schriftlichen Durchschnitt als auch die Beobachtungen zur mündlichen Mitarbeit. Ohne ausdrücklichen Hinweis gehe von einer ungefähr gleichgewichtigen Berücksichtigung beider Bereiche aus. Liegen keine schriftlichen Noten vor, basiert die Endnote im Wesentlichen auf der mündlichen Mitarbeit.
Sei bei der Einschätzung der mündlichen Mitarbeit konsequent und nicht zu wohlwollend, aber auch nicht übertrieben streng: Wenn die Beobachtungen überwiegend kritisch sind (z. B. mangelnde Aufgabenbearbeitung, häufige Ablenkungen, fehlende Mitarbeit, häufige Ermahnungen), soll sich das spürbar in der Endnote zeigen, auch wenn der schriftliche Durchschnitt gut ist – in der Regel um etwa eine Notenstufe unter dem schriftlichen Durchschnitt (z. B. Durchschnitt 2 → Endnote 3 oder 3-). Ein Abstand von mehr als einer Notenstufe ist nur gerechtfertigt, wenn die Beobachtungen sehr gravierend sind (z. B. nahezu keine Mitarbeit, massive und wiederholte Störungen, Ausschluss vom Unterricht).
Genauso gilt umgekehrt: Eine durchgehend sehr positive mündliche Mitarbeit kann die Endnote über den schriftlichen Durchschnitt heben, in der Regel ebenfalls um etwa eine Notenstufe.
Die im Schlusssatz von "mitarbeit_text" genannte Note muss exakt dem Wert von "endnote" entsprechen.`;

function formatFirstPart(schriftlicheNoten, durchschnitt, durchschnittNote) {
  if (!Array.isArray(schriftlicheNoten) || schriftlicheNoten.length === 0) {
    return "";
  }

  const names = schriftlicheNoten.map(n => n.name || "Arbeit");
  const grades = schriftlicheNoten.map(n => n.grade);

  let namesStr = "";
  if (names.length === 1) {
    namesStr = names[0];
  } else {
    namesStr = names.slice(0, -1).join(", ") + " und " + names[names.length - 1];
  }

  let gradesStr = "";
  if (grades.length === 1) {
    gradesStr = grades[0];
  } else {
    gradesStr = grades.slice(0, -1).join(", ") + " und " + grades[grades.length - 1];
  }

  const singular = names.length === 1;
  const sentence1 = singular 
    ? `Du hast in ${namesStr} die Note ${gradesStr} geschrieben.`
    : `Du hast in ${namesStr} die Noten ${gradesStr} geschrieben.`;

  const durchschnittKomma = durchschnitt ? String(durchschnitt).replace(".", ",") : "";
  const sentence2 = durchschnitt 
    ? ` Daraus ergibt sich ein schriftlicher Durchschnitt von ${durchschnittKomma} und die Note ${durchschnittNote}.`
    : "";

  return sentence1 + sentence2;
}

exports.generateZeugnisnote = onCall(
  { secrets: [anthropicApiKey], invoker: "public", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Nicht angemeldet.");
    }

    const { schriftlicheNoten, durchschnitt, durchschnittNote, sonstiges, fachart, richtung, hinweis, fachContext } = request.data || {};
    const fach = fachart === "nebenfach" ? "nebenfach" : "hauptfach";

    const durchschnittKomma = durchschnitt ? String(durchschnitt).replace(".", ",") : "";

    let userMsg = `Fach/Kontext: ${fachContext || "Keine Angabe"}\n`;
    if (durchschnitt) {
      userMsg += `Schriftlicher Durchschnitt: ${durchschnittKomma} (entspricht der Note ${durchschnittNote})\n`;
    } else {
      userMsg += `Es liegen keine schriftlichen Noten vor.\n`;
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
        messages: [{ role: "user", content: userMsg }]
      })
    });

    if (!response.ok) {
      throw new HttpsError("internal", "Anthropic API-Fehler: " + response.status);
    }

    const data = await response.json();
    const raw = data.content?.map(b => b.text || "").join("").trim() || "";

    let note = "";
    let begruendung = "";
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      note = (parsed.note || parsed.endnote || "").toString().trim();
      const mitarbeitText = (parsed.begruendung || parsed.mitarbeit_text || "").toString().trim();
      
      const firstPart = formatFirstPart(schriftlicheNoten, durchschnitt, durchschnittNote);
      if (firstPart && mitarbeitText) {
        begruendung = firstPart + " " + mitarbeitText;
      } else {
        begruendung = mitarbeitText || firstPart;
      }
    } catch (e) {
      throw new HttpsError("internal", "Antwort konnte nicht verarbeitet werden.");
    }

    const erlaubt = ["1", "1-", "2+", "2", "2-", "3+", "3", "3-", "4+", "4", "4-", "5+", "5", "5-", "6"];
    if (!erlaubt.includes(note)) note = "";

    return { note, begruendung };
  }
);

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
const ZEUGNISNOTE_SYSTEM = `Du bist eine erfahrene Lehrkraft und hilfst dabei, eine faire Zeugnisnote für eine Schülerin oder einen Schüler festzulegen.

Du bekommst:
- Die schriftlichen Noten (einzelne Arbeiten mit Namen)
- Den schriftlichen Durchschnitt als Dezimalzahl UND als gerundete Note
- Eine kurze Beschreibung der sonstigen/mündlichen Mitarbeit im Unterricht
- Die Fachart: "hauptfach" oder "nebenfach"

Deine Aufgabe in zwei Schritten:
1. Bilde zuerst – NUR INTERN, nenne sie NICHT im Text – aus der Beschreibung der sonstigen/mündlichen Mitarbeit eine eigene Note von 1 bis 6, die diese Mitarbeit am besten widerspiegelt.
2. Führe diese Mitarbeits-Note und den schriftlichen Durchschnitt zu EINER konkreten Endnote zusammen:
   - Hauptfach: Beide zählen ungefähr gleich stark – die Endnote liegt also ungefähr in der MITTE zwischen schriftlichem Durchschnitt und Mitarbeits-Note.
   - Nebenfach: Die Mitarbeit zählt stärker – die Endnote liegt näher an der Mitarbeits-Note.

WICHTIG: Die sonstige Mitarbeit muss die Endnote SPÜRBAR beeinflussen. Bei einer großen Diskrepanz zwischen schriftlichem Durchschnitt und Mitarbeit verschiebt sich die Endnote um eine GANZE Note oder mehr – nicht nur um eine Tendenz (+/-). Bleibe also NICHT vorsichtig nah am schriftlichen Durchschnitt.

Beispiele (Hauptfach):
- Schriftlicher Durchschnitt 2, aber schwache Mitarbeit (z. B. stört, passt nicht auf, erledigt Aufgaben nicht → etwa Mitarbeits-Note 4–5): Endnote etwa 3 bis 3-.
- Schriftlicher Durchschnitt 3, aber sehr gute Mitarbeit (z. B. sehr engagiert, hilfsbereit, durchdachte Beiträge → etwa Mitarbeits-Note 1–2): Endnote etwa 2 bis 2-.

Erlaubte Noten für die Endnote (genau eine davon auswählen): 1, 1-, 2+, 2, 2-, 3+, 3, 3-, 4+, 4, 4-, 5+, 5, 5-, 6

Die Begründung MUSS exakt der folgenden Struktur und Formulierung folgen – ein einziger durchgehender Fließtext OHNE Absätze und OHNE Aufzählungen:
1. Beginne mit: "Du hast in <Namen der Arbeiten> die Noten <Noten in derselben Reihenfolge> geschrieben." (Bei nur einer Arbeit im Singular: "... die Note <Note> geschrieben." Verbinde mehrere Namen bzw. Noten natürlich mit Komma und "und".)
2. Weiter mit: "Daraus ergibt sich ein schriftlicher Durchschnitt von <Dezimalzahl mit Komma> und die Note <gerundete schriftliche Note>."
3. Weiter mit: "In der sonstigen Mitarbeit ist mir Folgendes aufgefallen: " und beschreibe danach – direkt an die Schülerin/den Schüler mit "Du" gerichtet – die sonstige/mündliche Mitarbeit auf Grundlage der angegebenen Beobachtungen.
4. Schließe ab mit: "Zusammen mit dem schriftlichen Durchschnitt von <gerundete schriftliche Note> ergibt sich für dich insgesamt die Note <Endnote>."

Wenn keine schriftlichen Noten vorliegen, lasse die Sätze 1 und 2 weg, beziehe dich nur auf die sonstige Mitarbeit und nenne im Schlusssatz keinen schriftlichen Durchschnitt.

Verwende deutsche Dezimalschreibweise mit Komma. Freundlicher, wertschätzender, sachlicher Ton.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau diesem Format (keine Code-Blöcke, kein weiterer Text):
{"note": "<die Endnote, eine erlaubte Note>", "begruendung": "<Begründungstext>"}`;

exports.generateZeugnisnote = onCall(
  { secrets: [anthropicApiKey], invoker: "public", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Nicht angemeldet.");
    }

    const { schriftlicheNoten, durchschnitt, durchschnittNote, sonstiges, fachart, richtung, hinweis } = request.data || {};
    const fach = fachart === "nebenfach" ? "nebenfach" : "hauptfach";
    const fachLabel = fach === "nebenfach" ? "Nebenfach" : "Hauptfach";

    const notenText = Array.isArray(schriftlicheNoten) && schriftlicheNoten.length > 0
      ? schriftlicheNoten.map(n => `${n.name || "Arbeit"}: ${n.grade}`).join(", ")
      : "Keine schriftlichen Noten vorhanden";

    const durchschnittKomma = durchschnitt ? String(durchschnitt).replace(".", ",") : "";

    let userMsg = `Fachart: ${fachLabel}\n`;
    userMsg += `Schriftliche Noten (Name: Note): ${notenText}\n`;
    if (durchschnittKomma) userMsg += `Schriftlicher Durchschnitt (Dezimalzahl): ${durchschnittKomma}\n`;
    if (durchschnittNote) userMsg += `Schriftlicher Durchschnitt (gerundete Note): ${durchschnittNote}\n`;
    userMsg += `Sonstige/mündliche Mitarbeit: ${sonstiges && sonstiges.trim() ? sonstiges.trim() : "Keine Angabe"}\n`;

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
      note = (parsed.note || "").toString().trim();
      begruendung = (parsed.begruendung || "").toString().trim();
    } catch (e) {
      throw new HttpsError("internal", "Antwort konnte nicht verarbeitet werden.");
    }

    const erlaubt = ["1", "1-", "2+", "2", "2-", "3+", "3", "3-", "4+", "4", "4-", "5+", "5", "5-", "6"];
    if (!erlaubt.includes(note)) note = "";

    return { note, begruendung };
  }
);

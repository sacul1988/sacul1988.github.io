/* global window, document */

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");

const appUrl = "file://" + path.resolve(__dirname, "../../app.html");

async function openZeugnistexte(viewport = { width: 1048, height: 776 }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });

  await page.addInitScript(() => {
    localStorage.setItem("classes", JSON.stringify([]));
    localStorage.setItem("ztPlanung", JSON.stringify({
      courses: [
        {
          id: "course-1",
          name: "5c Kunst",
          halbjahr: "ersten",
          typ: "nebenfach",
          fach: "Kunst",
          themen: "Farben und Formen",
          fachlehrer: "Krato",
          students: [
            { id: "s1", name: "Birhat", done: false },
            { id: "s2", name: "Ihor", done: true },
            { id: "s3", name: "Siraj", done: false }
          ]
        }
      ]
    }));
  });

  await page.goto(appUrl);
  await page.waitForFunction(() => typeof window.openToolWindow === "function");
  await page.evaluate(() => {
    const login = document.getElementById("login-container");
    if (login) login.style.display = "none";
    document.documentElement.classList.remove("login-active");
    document.body.classList.remove("login-active");
    window.openToolWindow("zeugnis-texte");
  });
  await page.waitForSelector("#zeugnis-texte-module", { state: "visible" });

  return { browser, page };
}

async function openDashboard(viewport = { width: 1048, height: 776 }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });

  await page.addInitScript(() => {
    localStorage.setItem("classes", JSON.stringify([]));
    localStorage.setItem("ztPlanung", JSON.stringify({
      courses: [
        {
          id: "course-1",
          name: "5c Kunst",
          halbjahr: "ersten",
          typ: "nebenfach",
          fach: "Kunst",
          themen: "Farben und Formen",
          fachlehrer: "Krato",
          students: [
            { id: "s1", name: "Birhat", done: false },
            { id: "s2", name: "Ihor", done: true },
            { id: "s3", name: "Siraj", done: false }
          ]
        }
      ]
    }));
  });

  await page.goto(appUrl);
  await page.waitForFunction(() => typeof window.showPage === "function");
  await page.evaluate(() => {
    const login = document.getElementById("login-container");
    if (login) login.style.display = "none";
    document.documentElement.classList.remove("login-active");
    document.body.classList.remove("login-active");
    window.showPage("home", null, false);
  });
  await page.waitForSelector("#dashboard-zt-list .dashboard-zt-course", { state: "visible" });

  return { browser, page };
}

test("Zeugnistexte switches between planning and text view", async () => {
  const { browser, page } = await openZeugnistexte();
  try {
    await assertVisible(page, "#zt-planung-inline");
    assert.equal(await textContent(page, "#zt-planung-header-summary"), "2 offen");

    await page.click("#zt-open-text-inline-btn");
    await assertVisible(page, "#zeugnis-texte-module .zt-stack");
    await assertHidden(page, "#zt-planung-inline");
    assert.equal(await page.locator("#zt-open-planung-inline-btn").isVisible(), true);

    await page.click("#zt-open-planung-inline-btn");
    await assertVisible(page, "#zt-planung-inline");
    await assertHidden(page, "#zeugnis-texte-module .zt-stack");
  } finally {
    await browser.close();
  }
});

test("Zeugnistexte controls stay usable on mobile width", async () => {
  const { browser, page } = await openZeugnistexte({ width: 430, height: 776 });
  try {
    await assertVisible(page, "#zt-open-text-inline-btn");
    await assertVisible(page, "#zt-open-planung-inline-btn");
    await assertVisible(page, "#zt-planung-header-summary");
    await assertVisible(page, ".zt-plan-course");

    await page.click("#zt-open-text-inline-btn");
    await assertVisible(page, "#zeugnis-texte-module .zt-stack");

    await page.click("#zt-open-planung-inline-btn");
    await assertVisible(page, "#zt-planung-inline");
  } finally {
    await browser.close();
  }
});

test("Dashboard zeugnistexte course opens inline planning instead of modal", async () => {
  const { browser, page } = await openDashboard();
  try {
    await page.click("#dashboard-zt-list .dashboard-zt-course");

    await assertVisible(page, "#tool-window-overlay.open #zeugnis-texte-module.active");
    await assertVisible(page, "#zt-planung-inline");
    await assertHidden(page, "#zt-planung-modal");
    await page.waitForSelector('#zt-planung-inline .zt-plan-course[data-course-id="course-1"]');
  } finally {
    await browser.close();
  }
});

test("KI validation errors are shown as understandable messages", async () => {
  const { browser, page } = await openZeugnistexte();
  try {
    await page.evaluate(() => {
      window.__swalMessages = [];
      window.swal = (...args) => {
        window.__swalMessages.push(args);
        return Promise.resolve(false);
      };
      window.callGenerateZeugnistext = async () => {
        const err = new Error("messages[0].content ist zu lang.");
        err.code = "invalid-argument";
        throw err;
      };
    });

    await page.click("#zt-open-text-inline-btn");
    await page.fill("#zt-name", "Testkind");
    await page.fill("#zt-fach", "Kunst");
    await page.fill("#zt-themen", "Farben");
    await page.fill("#zt-beobachtungen", "Viele Beobachtungen.");
    await page.click("#zt-gen-btn");

    await page.waitForFunction(() => window.__swalMessages && window.__swalMessages.length > 0);
    const messages = await page.evaluate(() => window.__swalMessages);
    assert.equal(messages[0][0], "Fehler");
    assert.match(messages[0][1], /Eingaben sind zu lang|kürze den Text/);
  } finally {
    await browser.close();
  }
});

async function textContent(page, selector) {
  return (await page.locator(selector).textContent()).trim();
}

async function assertVisible(page, selector) {
  assert.equal(await page.locator(selector).isVisible(), true, `${selector} should be visible`);
}

async function assertHidden(page, selector) {
  assert.equal(await page.locator(selector).isHidden(), true, `${selector} should be hidden`);
}

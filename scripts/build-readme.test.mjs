// Run with: node --test scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { build, renderCatalog, applyToReadme, validateCatalog, dropNonPublicRepos, START, END } from "./build-readme.mjs";

const fixture = () => ({
  schema: 1,
  generatedAt: "2026-11-10T00:00:00.000Z",
  source: "live",
  site: "https://maecly.com",
  categories: [
    { id: "desktop", label: { en: "Desktop", es: "Escritorio" } },
    { id: "web", label: { en: "Web", es: "Web" } },
    { id: "gaming", label: { en: "Gaming & retro", es: "Gaming y retro" } },
    { id: "devtools", label: { en: "Developer tools", es: "Herramientas" } },
    { id: "works", label: { en: "In the works", es: "En desarrollo" } },
  ],
  products: [
    product({
      slug: "alpha", name: "Alpha", category: "desktop", repo: "https://github.com/MAECLY/alpha",
      releasesRepo: "alpha", downloads: { github: 1200, store: null, total: 1200 },
      latest: { tag: "v1.0.0", publishedAt: "2026-11-08T10:00:00Z", url: "https://github.com/MAECLY/alpha/releases/tag/v1.0.0" },
      download: { href: "https://github.com/MAECLY/alpha/releases/latest", label: { en: "Download", es: "Descargar" } },
    }),
    product({
      slug: "beta", name: "Beta", category: "desktop", repo: "https://github.com/MAECLY/beta",
      releasesRepo: "beta", downloads: { github: null, store: null, total: null },
      latest: { tag: "v0.2.0", publishedAt: "2026-09-01T10:00:00Z", url: "https://github.com/MAECLY/beta/releases/tag/v0.2.0" },
    }),
    product({ slug: "gamma", name: "Gamma", category: "desktop" }),
    product({
      slug: "shelf", name: "Shelf", category: "gaming", repo: "https://github.com/MAECLY/shelf", releasesRepo: "shelf",
      status: "store", statusLabel: { en: "On the Chrome Web Store", es: "En la Chrome Web Store" },
      download: {
        href: "https://chromewebstore.google.com/detail/shelf/ahafjflkfcijeoaggjhjpgekbchjpfie",
        label: { en: "Chrome Web Store", es: "Chrome Web Store" },
      },
      latest: { tag: "v0.3.0", publishedAt: "2026-10-20T10:00:00Z", url: "https://github.com/MAECLY/shelf/releases/tag/v0.3.0" },
      downloads: { github: 4, store: null, total: 4 },
    }),
    product({
      slug: "toggles", name: "Toggles", category: "gaming", repo: "https://github.com/MAECLY/toggles", releasesRepo: "toggles",
      license: "MIT",
      download: { href: "https://marketplace.elgato.com/product/toggles", label: { en: "Elgato Marketplace", es: "Elgato Marketplace" } },
      downloads: { github: 10, store: { store: "Elgato Marketplace", units: 1324, through: "2026-10-24" }, total: 1334 },
    }),
    product({
      slug: "secret-tool", name: "Secret Tool", category: "works", status: "poc",
      statusLabel: { en: "Proof of concept", es: "Prueba de concepto" },
      // Private repo: the catalog should never send it, but the README must not link it either way.
      repo: "https://github.com/MAECLY/secret-tool-private-thing",
      releasesRepo: "secret-tool-private-thing",
      download: { href: "https://github.com/MAECLY/secret-tool-private-thing/releases/latest", label: { en: "Download", es: "Descargar" } },
      site: { en: "https://secret.maecly.com", es: "https://secret.maecly.com" },
    }),
    product({
      slug: "opendesign", name: "OpenDesign", category: "works", repo: null,
      site: { en: "https://opendesign.maecly.com", es: "https://opendesign.maecly.com" },
    }),
  ],
});

function product(over) {
  return {
    slug: "x", name: "X", category: "desktop", status: "stable", statusLabel: { en: "Stable", es: "Estable" },
    oneLiner: { en: "Does a thing.", es: "Hace algo." }, platforms: ["macOS"], platformNote: null,
    license: "AGPL-3.0", openSource: true, icon: `https://maecly.com/products/${over.slug}.png`,
    site: { en: `https://${over.slug}.maecly.com/en/`, es: `https://${over.slug}.maecly.com/` },
    repo: null, download: null, releasesRepo: null, latest: null,
    downloads: { github: null, store: null, total: null },
    ...over,
  };
}

// The private-repo product above overrides `repo` to a value that looks public; mark it private the way the
// catalog would (repo: null) in a second fixture, and also prove the guard holds when the catalog misbehaves.
const privateFixture = () => {
  const c = fixture();
  c.products.find((p) => p.slug === "secret-tool").repo = null;
  return c;
};

const README = `# Header\n\nHand-written intro.\n\n${START}\nold generated text v9.9.9\n${END}\n\n---\n\n## How I build\n\nHand-written.\n`;

const cells = (html) => html.match(/<td width="50%" valign="top">/g)?.length ?? 0;

test("odd product counts get an empty second cell", () => {
  const out = renderCatalog(privateFixture());
  const desktop = out.split("## 🖥️ Desktop apps")[1].split("## ")[0];
  assert.equal(cells(desktop), 4, "3 products + 1 empty cell");
  assert.match(desktop, /<td width="50%" valign="top"><\/td>\n<\/tr>\n<\/table>/);
  const gaming = out.split("## 🕹️ Gaming & retro")[1].split("## ")[0];
  assert.equal(cells(gaming), 2);
  assert.doesNotMatch(gaming, /<td width="50%" valign="top"><\/td>/);
});

test("categories render in catalog order and empty ones are skipped", () => {
  const out = renderCatalog(privateFixture());
  const headings = out.match(/^## .+$/gm);
  assert.deepEqual(headings, ["## 🖥️ Desktop apps", "## 🕹️ Gaming & retro", "## 🔭 In the works"]);
});

test("Chrome Web Store product gets the CWS version badge", () => {
  const out = renderCatalog(privateFixture());
  assert.match(
    out,
    /<a href="https:\/\/chromewebstore\.google\.com\/detail\/shelf\/ahafjflkfcijeoaggjhjpgekbchjpfie"><img src="https:\/\/img\.shields\.io\/chrome-web-store\/v\/ahafjflkfcijeoaggjhjpgekbchjpfie\?style=flat-square&label=Chrome%20Web%20Store&color=4285F4"/,
  );
  assert.equal(out.match(/chrome-web-store\/v\//g).length, 1, "only the CWS product");
  assert.match(out, /<sub>· on the Chrome Web Store<\/sub>/);
});

test("store downloads product gets a static badge with units and date", () => {
  const out = renderCatalog(privateFixture());
  assert.match(out, /img\.shields\.io\/badge\/Elgato%20Marketplace-1%2C324%20downloads%20%C2%B7%20as%20of%20Oct%2024%2C%202026-0E5E6F/);
  assert.match(out, /alt="Elgato Marketplace: 1,324 downloads · as of Oct 24, 2026"/);
});

test("release and downloads badges are dynamic; no hard-coded versions or zero counts", () => {
  const out = renderCatalog(privateFixture());
  assert.match(out, /img\.shields\.io\/github\/v\/release\/MAECLY\/alpha\?style=flat-square&label=release&color=0E5E6F/);
  assert.match(out, /img\.shields\.io\/github\/downloads\/MAECLY\/alpha\/total\?style=flat-square&color=0E5E6F/);
  // Beta has no known download count: no downloads badge rather than a 0.
  assert.doesNotMatch(out, /downloads\/MAECLY\/beta/);
  assert.doesNotMatch(out, /badge\/release-v/);
  assert.match(out, /img\.shields\.io\/badge\/license-AGPL--3\.0-555\?style=flat-square/);
});

test("works product with a private repo is never linked", async () => {
  // Even if the catalog wrongly sends a private repo, the GitHub visibility check drops it.
  const checked = await dropNonPublicRepos(fixture(), respond(null));
  assert.equal(checked.products.find((p) => p.slug === "secret-tool").repo, null);
  assert.equal(checked.products.find((p) => p.slug === "alpha").repo, "https://github.com/MAECLY/alpha");
  for (const c of [checked, privateFixture()]) {
    const out = renderCatalog(c);
    assert.doesNotMatch(out, /secret-tool-private-thing/);
    const works = out.split("## 🔭 In the works")[1];
    assert.match(works, /The product repositories are private while they're being built, and there's nothing to download yet\./);
    assert.match(works, /^- ▫️ \*\*Secret Tool\*\* · proof of concept: does a thing\. \[secret\.maecly\.com\]\(https:\/\/secret\.maecly\.com\)$/m);
    assert.match(works, /^- 🎨 \*\*OpenDesign\*\*/m);
  }
});

test("banner names the newest release and the ones from the last 30 days", () => {
  const out = renderCatalog(privateFixture());
  const banner = out.split("\n\n")[0];
  assert.match(banner, /^> \[!NOTE\]\n> \*\*Latest:\*\* \*\*Alpha\*\* \[v1\.0\.0\]\(https:\/\/github\.com\/MAECLY\/alpha\/releases\/tag\/v1\.0\.0\), November 8, 2026/);
  assert.match(banner, /\*\*Shelf\*\* \[v0\.3\.0\]/);
  assert.doesNotMatch(banner, /Beta/, "older than 30 days");
});

test("output is deterministic and only touches the marked region", () => {
  const a = applyToReadme(README, fixture());
  const b = applyToReadme(README, structuredClone(fixture()));
  assert.equal(a, b);
  assert.equal(applyToReadme(a, fixture()), a, "idempotent");
  assert.ok(a.startsWith(`# Header\n\nHand-written intro.\n\n${START}\n`));
  assert.ok(a.endsWith(`\n${END}\n\n---\n\n## How I build\n\nHand-written.\n`));
  assert.doesNotMatch(a, /v9\.9\.9/);
});

test("validation rejects a wrong schema or an empty product list", () => {
  assert.throws(() => validateCatalog({ ...fixture(), schema: 2 }), /schema/);
  assert.throws(() => validateCatalog({ ...fixture(), products: [] }), /no products/);
});

async function withReadme(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "build-readme-"));
  const file = path.join(dir, "README.md");
  await writeFile(file, README);
  try {
    await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const PUBLIC = new Set(["alpha", "beta", "shelf", "toggles"]);
// Serves the catalog, and answers the GitHub API like it would for public and private repos.
const respond = (body, status = 200) => async (url) => {
  const m = String(url).match(/^https:\/\/api\.github\.com\/repos\/MAECLY\/(.+)$/);
  if (!m) return json(body, status);
  return PUBLIC.has(m[1]) ? json({ private: false, visibility: "public" }) : json({ message: "Not Found" }, 404);
};

test("a failed fetch leaves the README untouched", async () => {
  const failures = [
    async () => { throw new TypeError("fetch failed"); },
    respond({ error: "nope" }, 503),
    respond({ ...fixture(), schema: 2 }),
    respond({ ...fixture(), products: [] }),
    async (url) => (String(url).includes("api.github.com") ? json({ message: "rate limited" }, 403) : json(fixture())),
    async () => new Response("<html>not json</html>", { status: 200 }),
  ];
  for (const fetchImpl of failures) {
    await withReadme(async (file) => {
      await assert.rejects(build({ readmePath: file, fetchImpl }));
      assert.equal(await readFile(file, "utf8"), README);
    });
  }
});

test("a good fetch rewrites the region and a second run changes nothing", async () => {
  await withReadme(async (file) => {
    const first = await build({ readmePath: file, fetchImpl: respond(fixture()) });
    assert.equal(first.changed, true);
    const once = await readFile(file, "utf8");
    const second = await build({ readmePath: file, fetchImpl: respond(fixture()) });
    assert.equal(second.changed, false);
    assert.equal(await readFile(file, "utf8"), once);
  });
});

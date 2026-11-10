#!/usr/bin/env node
// Regenerates the product catalog region of profile/README.md from
// https://maecly.com/catalog.json. Node 22+, no dependencies.
//
// Only the text between <!-- catalog:start --> and <!-- catalog:end --> is
// rewritten. If the fetch fails or the catalog looks wrong, the script exits
// non-zero and leaves the README untouched. Same catalog in, same bytes out.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export const CATALOG_URL = "https://maecly.com/catalog.json";
export const START = "<!-- catalog:start -->";
export const END = "<!-- catalog:end -->";

const ORG = "MAECLY";
const TEAL = "0E5E6F";
const RECENT_DAYS = 30;

const HEADINGS = {
  desktop: "🖥️ Desktop apps",
  gaming: "🕹️ Gaming & retro",
  devtools: "🧰 Developer tools",
  web: "🎬 Creator tools",
  works: "🔭 In the works",
};

const WORKS_EMOJI = { opendesign: "🎨", "workly-reel": "🎞️", aurenly: "🎧" };
const WORKS_FALLBACK = "▫️";

const INTRO =
  "Every product here started as a friction I hit myself: writing standups by hand, printing 300 files 15 at a time, ROMs with no cover art, losing a novel draft. None of them hands that friction to someone else's server.";

const WORKS_INTRO =
  "The product repositories are private while they're being built, and there's nothing to download yet.";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ---------- small helpers ----------

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Markdown text inside a list item: keep it literal.
const mdText = (s) => String(s).replace(/([\\`*_[\]<>])/g, "\\$1");

const isNum = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;

function longDate(iso) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function shortDate(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function joinList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function lowerFirst(s) {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

// Shields static badge path segment: "-" and "_" are separators.
function shieldsText(s) {
  return encodeURIComponent(String(s)).replace(/-/g, "--").replace(/_/g, "__");
}

function staticBadge(label, message, color) {
  return `https://img.shields.io/badge/${shieldsText(label)}-${shieldsText(message)}-${color}?style=flat-square`;
}

function fmtCount(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// The public GitHub repo name of a product, or null. The catalog only sets
// `repo` for public repositories; everything else under github.com/MAECLY is
// treated as private and never linked.
function publicRepoName(p) {
  const m = typeof p.repo === "string" && p.repo.match(/^https:\/\/github\.com\/MAECLY\/([A-Za-z0-9._-]+)\/?$/);
  return m ? m[1] : null;
}

function linkAllowed(url, p) {
  if (typeof url !== "string" || !/^https:\/\//.test(url)) return false;
  const m = url.match(/^https:\/\/github\.com\/MAECLY\/([A-Za-z0-9._-]+)/i);
  if (!m) return true;
  return m[1] === publicRepoName(p);
}

const siteOf = (p) => (p.site && linkAllowed(p.site.en, p) ? p.site.en : null);

function hostOf(url) {
  return new URL(url).host;
}

function cwsId(href) {
  const m = typeof href === "string" && href.match(/^https:\/\/chromewebstore\.google\.com\/detail\/(?:[^/]+\/)?([a-p]{32})/);
  return m ? m[1] : null;
}

// ---------- rendering ----------

function platformLine(p) {
  const platforms = Array.isArray(p.platforms) ? p.platforms : [];
  const note = p.platformNote?.en?.trim() || "";
  const rest = note ? platforms.filter((x) => !note.includes(x)) : platforms;
  const parts = [];
  if (rest.length) parts.push(joinList(rest));
  if (note) parts.push(note);
  return parts.join(" · ");
}

function banner(catalog) {
  const released = catalog.products
    .filter((p) => p.latest && p.latest.tag && p.latest.publishedAt)
    .sort((a, b) =>
      a.latest.publishedAt === b.latest.publishedAt
        ? a.slug.localeCompare(b.slug)
        : a.latest.publishedAt < b.latest.publishedAt ? 1 : -1,
    );
  if (!released.length) return null;

  const tag = (p) =>
    linkAllowed(p.latest.url, p) ? `[${mdText(p.latest.tag)}](${p.latest.url})` : mdText(p.latest.tag);

  const [newest, ...others] = released;
  let line = `> **Latest:** **${mdText(newest.name)}** ${tag(newest)}, ${longDate(newest.latest.publishedAt)}`;

  const cutoff = new Date(catalog.generatedAt).getTime() - RECENT_DAYS * 86400000;
  const recent = Number.isFinite(cutoff)
    ? others.filter((p) => new Date(p.latest.publishedAt).getTime() >= cutoff)
    : [];
  if (recent.length) {
    line += ` · Also new in the last ${RECENT_DAYS} days: ${recent
      .map((p) => `**${mdText(p.name)}** ${tag(p)}`)
      .join(", ")}`;
  }
  return `> [!NOTE]\n${line}`;
}

function badges(p) {
  const out = [];
  const repo = publicRepoName(p);
  const rr = p.releasesRepo && p.releasesRepo === repo ? p.releasesRepo : null;
  if (rr) {
    const releases = `https://github.com/${ORG}/${rr}/releases/latest`;
    out.push(
      `<a href="${releases}"><img src="https://img.shields.io/github/v/release/${ORG}/${rr}?style=flat-square&label=release&color=${TEAL}" alt="Latest release"></a>`,
    );
    // Only when the catalog has a real, non-zero count: never a placeholder 0.
    if (isNum(p.downloads?.github)) {
      out.push(
        `<a href="${releases}"><img src="https://img.shields.io/github/downloads/${ORG}/${rr}/total?style=flat-square&color=${TEAL}" alt="GitHub downloads"></a>`,
      );
    }
  }
  const id = cwsId(p.download?.href);
  if (id) {
    out.push(
      `<a href="${esc(p.download.href)}"><img src="https://img.shields.io/chrome-web-store/v/${id}?style=flat-square&label=Chrome%20Web%20Store&color=4285F4" alt="Chrome Web Store version"></a>`,
    );
  }
  const store = p.downloads?.store;
  if (store && isNum(store.units) && store.store && store.through) {
    const msg = `${fmtCount(store.units)} downloads · as of ${shortDate(store.through)}`;
    const img = `<img src="${esc(staticBadge(store.store, msg, TEAL))}" alt="${esc(`${store.store}: ${msg}`)}">`;
    out.push(p.download?.href && linkAllowed(p.download.href, p) ? `<a href="${esc(p.download.href)}">${img}</a>` : img);
  }
  if (p.license) {
    out.push(`<img src="${esc(staticBadge("license", p.license, "555"))}" alt="License: ${esc(p.license)}">`);
  }
  return out;
}

function card(p) {
  const site = siteOf(p);
  const repo = publicRepoName(p);
  const home = repo ? p.repo : site;
  const name = home ? `<a href="${esc(home)}">${esc(p.name)}</a>` : esc(p.name);
  const status = p.statusLabel?.en ? ` <sub>· ${esc(lowerFirst(p.statusLabel.en))}</sub>` : "";
  const platforms = platformLine(p);

  const links = [];
  if (site) links.push(`<a href="${esc(site)}">Website</a>`);
  if (p.download?.href && p.download.label?.en && linkAllowed(p.download.href, p)) {
    links.push(`<a href="${esc(p.download.href)}">${esc(p.download.label.en)}</a>`);
  }

  const lines = [
    `<td width="50%" valign="top">`,
    `<img src="${esc(p.icon)}" width="48" height="48" alt="${esc(p.name)} icon"><br>`,
    `<b>${name}</b>${status}<br>`,
    `${esc(p.oneLiner?.en ?? "")}${platforms ? `<br>\n<sub>${esc(platforms)}</sub>` : ""}<br><br>`,
  ];
  const b = badges(p);
  if (b.length) {
    b[b.length - 1] += links.length ? "<br>" : "";
    lines.push(...b);
  }
  if (links.length) lines.push(links.join(" · "));
  lines.push(`</td>`);
  return lines.join("\n");
}

function table(products) {
  const rows = ["<table>"];
  for (let i = 0; i < products.length; i += 2) {
    rows.push("<tr>", card(products[i]));
    rows.push(products[i + 1] ? card(products[i + 1]) : `<td width="50%" valign="top"></td>`);
    rows.push("</tr>");
  }
  rows.push("</table>");
  return rows.join("\n");
}

function worksItem(p) {
  const emoji = WORKS_EMOJI[p.slug] ?? WORKS_FALLBACK;
  const status = p.statusLabel?.en ? ` · ${mdText(lowerFirst(p.statusLabel.en))}` : "";
  let line = `- ${emoji} **${mdText(p.name)}**${status}: ${mdText(lowerFirst(p.oneLiner?.en ?? ""))}`;
  const links = [];
  const site = siteOf(p);
  if (site) links.push(`[${hostOf(site)}](${site})`);
  const repo = publicRepoName(p);
  if (repo) links.push(`[${repo.endsWith("-landing") ? "landing page source" : "source"}](${p.repo})`);
  if (links.length) line += ` ${links.join(" · ")}`;
  return line;
}

function heading(cat) {
  return `## ${HEADINGS[cat.id] ?? cat.label?.en ?? cat.id}`;
}

export function renderCatalog(catalog) {
  const parts = [];
  const b = banner(catalog);
  if (b) parts.push(b);
  parts.push(INTRO, "---");

  for (const cat of catalog.categories) {
    const products = catalog.products.filter((p) => p.category === cat.id);
    if (!products.length) continue;
    if (cat.id === "works") {
      parts.push(heading(cat), WORKS_INTRO, products.map(worksItem).join("\n"));
    } else {
      parts.push(heading(cat), table(products));
    }
  }
  return parts.join("\n\n");
}

export function validateCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") throw new Error("catalog is not an object");
  if (catalog.schema !== 1) throw new Error(`unsupported catalog schema: ${catalog.schema}`);
  if (!Array.isArray(catalog.categories) || !catalog.categories.length) throw new Error("catalog has no categories");
  if (!Array.isArray(catalog.products) || !catalog.products.length) throw new Error("catalog has no products");
  for (const p of catalog.products) {
    if (!p || typeof p.slug !== "string" || typeof p.name !== "string" || typeof p.category !== "string") {
      throw new Error(`malformed product: ${JSON.stringify(p)?.slice(0, 120)}`);
    }
    if (typeof p.icon !== "string" || !p.icon.startsWith("https://")) throw new Error(`product ${p.slug} has no https icon`);
  }
  return catalog;
}

export function applyToReadme(readme, catalog) {
  const s = readme.indexOf(START);
  const e = readme.indexOf(END);
  if (s === -1 || e === -1 || e < s) throw new Error("catalog markers not found in README");
  return `${readme.slice(0, s + START.length)}\n${renderCatalog(catalog)}\n${readme.slice(e)}`;
}

export async function fetchCatalog(url = CATALOG_URL, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(url, {
    headers: { accept: "application/json", "user-agent": "maecly-profile-readme" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`GET ${url} returned ${res.status}`);
  return validateCatalog(await res.json());
}

// Second line of defence for "never link a private repo": ask GitHub about
// every repo the catalog names and drop the ones that are not public. A 404
// means private (or gone). Any other failure aborts the run, so a rate limit
// can never turn into a wrong README.
export async function dropNonPublicRepos(catalog, fetchImpl = globalThis.fetch, token = process.env.GITHUB_TOKEN) {
  const names = [...new Set(catalog.products.map(publicRepoName).filter(Boolean))].sort();
  const visible = new Set();
  for (const name of names) {
    const headers = { accept: "application/vnd.github+json", "user-agent": "maecly-profile-readme" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetchImpl(`https://api.github.com/repos/${ORG}/${name}`, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`GitHub API returned ${res.status} for ${ORG}/${name}`);
    const info = await res.json();
    if (info.private === false && info.visibility === "public") visible.add(name);
  }
  for (const p of catalog.products) {
    const name = publicRepoName(p);
    if (name && !visible.has(name)) p.repo = null;
  }
  return catalog;
}

export async function build({ readmePath, url = CATALOG_URL, fetchImpl } = {}) {
  const before = await readFile(readmePath, "utf8");
  const catalog = await dropNonPublicRepos(await fetchCatalog(url, fetchImpl), fetchImpl);
  const after = applyToReadme(before, catalog);
  if (after !== before) await writeFile(readmePath, after);
  return { changed: after !== before, source: catalog.source, products: catalog.products.length };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const readmePath = process.env.README_PATH || path.join(root, "profile", "README.md");
  build({ readmePath, url: process.env.CATALOG_URL || CATALOG_URL })
    .then(({ changed, source, products }) => {
      console.log(`${changed ? "updated" : "unchanged"}: ${products} products from a ${source} catalog`);
    })
    .catch((err) => {
      console.error(`build-readme: ${err.message}`);
      process.exit(1);
    });
}

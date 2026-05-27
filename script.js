// ════════════════════════════════════════════════════════
// GIF VAULT — script.js v10
// ════════════════════════════════════════════════════════

const WEBHOOK_URL = "https://discord.com/api/webhooks/1503377536812318840/ZbspBeE9J-ZbifruBV1ER53vxik3Lrax0AJ2Op1GPK_4mqhqYoidWqhW-GqbUvJNhmW5";
const GOFILE_TOKEN = "DgOJkhjizplmNY9zIORNpi1NGuMPVMXC";
const GOFILE_ACCT  = "e5b34509-e426-4628-951e-b2053e9e44a8";

// ── STATE ─────────────────────────────────────────────────
let gifs = [];
let filtered = [];
let activeFilter = "all";
let activeSort   = "newest";
let searchQuery  = "";
let modalIndex   = 0;
const PAGE_SIZE  = 60;
let rendered     = 0;
let bulkMode     = false;
let selectedIds  = new Set();
let contextTarget = null;
let lastRawSettings = null;
let currentTagGif   = null;
let deadIds = new Set();
let pendingUrls = [];
let saveToVaultEnabled = true;
let layoutMode = "grid"; // "grid" or "masonry"
let maxPlayingVideos = 15;
let activeVideoSet = new Set();

// Reddit state
let redditSessions     = [];
let redditSessionIndex = 0;
let savedSubs = JSON.parse(localStorage.getItem("gif_vault_subs") || "[]");
let redditLoaded      = 0;
let redditTotalAdded  = 0;
let redditBatchSize   = 10;
const redditShownUrls = new Set();

// Fuse.js instance
let fuseInstance = null;

// Render scheduler
let renderQueue = [];
let renderScheduled = false;

// ── ELEMENT GETTER ────────────────────────────────────────
function el(id) {
    const e = document.getElementById(id);
    if (!e) console.warn("Missing element:", id);
    return e;
}

// ── ELEMENTS ─────────────────────────────────────────────
const gallery              = el("gallery");
const importBtn            = el("importBtn");
const exportBtn            = el("exportBtn");
const clearBtn             = el("clearBtn");
const dupeBtn              = el("dupeBtn");
const deadBtn              = el("deadBtn");
const zipBtn               = el("zipBtn");
const saveToggleBtn        = el("saveToggleBtn");
const searchInput          = el("searchInput");
const sortSelect           = el("sortSelect");
const gridSlider           = el("gridSlider");
const gifCount             = el("gifCount");
const loadMoreWrap         = el("loadMoreWrap");
const loadMoreBtn          = el("loadMoreBtn");
const filterBtns           = document.querySelectorAll(".filter-btn");
const progressWrap         = el("progressWrap");
const progressBar          = el("progressBar");
const progressLabel        = el("progressLabel");
const broadcastStatus      = el("broadcastStatus");
const bulkToolbar          = el("bulkToolbar");
const bulkCount            = el("bulkCount");
const bulkSelectAll        = el("bulkSelectAll");
const bulkExport           = el("bulkExport");
const bulkDelete           = el("bulkDelete");
const bulkCancel           = el("bulkCancel");
const incomingTray         = el("incomingTray");
const incomingTitle        = el("incomingTitle");
const incomingAccept       = el("incomingAccept");
const incomingTogglePreview = el("incomingTogglePreview");
const incomingReject       = el("incomingReject");
const incomingPreviewRow   = el("incomingPreviewRow");
const modal                = el("modal");
const modalImg             = el("modalImg");
const modalClose           = el("modalClose");
const modalBackdrop        = el("modalBackdrop");
const modalPrev            = el("modalPrev");
const modalNext            = el("modalNext");
const modalIndex_el        = el("modalIndex");
const modalOpen            = el("modalOpen");
const modalCopy            = el("modalCopy");
const modalDownload        = el("modalDownload");
const modalDelete          = el("modalDelete");
const modalAddTag          = el("modalAddTag");
const modalTagsEl          = el("modalTags");
const tagModal             = el("tagModal");
const tagInput             = el("tagInput");
const tagAddBtn            = el("tagAddBtn");
const tagList              = el("tagList");
const tagCloseBtn          = el("tagCloseBtn");
const collectionInput      = el("collectionInput");
const collectionAddBtn     = el("collectionAddBtn");
const collectionList       = el("collectionList");
const importModal          = el("importModal");
const importTextarea       = el("importTextarea");
const importConfirmBtn     = el("importConfirmBtn");
const importCancelBtn      = el("importCancelBtn");
const importInfo           = el("importInfo");
const contextMenu          = el("contextMenu");
const ctxView              = el("ctxView");
const ctxCopy              = el("ctxCopy");
const ctxDownload          = el("ctxDownload");
const ctxTag               = el("ctxTag");
const ctxSelect            = el("ctxSelect");
const ctxDelete            = el("ctxDelete");
const shortcutsPanel       = el("shortcutsPanel");
const shortcutsClose       = el("shortcutsClose");
const shortcutsFab         = el("shortcutsFab");
const statGif              = el("statGif");
const statWebm             = el("statWebm");
const statMp4              = el("statMp4");
const statOther            = el("statOther");
const statVisible          = el("statVisible");
const statDead             = el("statDead");
const toast                = el("toast");
const layoutToggleBtn      = el("layoutToggleBtn");
const maxVideosInput       = el("maxVideosInput");

const subredditInput       = el("subredditInput");
const redditSortEl         = el("redditSort");
const redditFilterEl       = el("redditFilter");
const redditLoadBtn        = el("redditLoadBtn");
const redditClearBtn       = el("redditClearBtn");
const redditAddBtn         = el("redditAddBtn");
const savedSubsEl          = el("savedSubs");
const redditGallery        = el("redditGallery");
const redditLoadMoreWrap   = el("redditLoadMoreWrap");
const redditLoadingEl      = el("redditLoading");
const redditStats          = el("redditStats");
const redditStatSub        = el("redditStatSub");
const redditStatCount      = el("redditStatCount");
const redditStatAdded      = el("redditStatAdded");
const viewMasonryBtn       = el("viewMasonry");
const viewGridBtn          = el("viewGrid");

let toastTimer;

// ════════════════════════════════════════════════════════
// RENDER SCHEDULER
// ════════════════════════════════════════════════════════
function scheduleRender(fn) {
    renderQueue.push(fn);
    if (!renderScheduled) {
        renderScheduled = true;
        requestAnimationFrame(() => {
            const fns = renderQueue.splice(0);
            renderScheduled = false;
            fns.forEach(f => f());
        });
    }
}

// ════════════════════════════════════════════════════════
// DEBOUNCE
// ════════════════════════════════════════════════════════
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ════════════════════════════════════════════════════════
// INTERSECTIONOBSERVER — videos + iframes only
// Images use native loading="lazy" with src set directly
// ════════════════════════════════════════════════════════
const mediaObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const target = entry.target;

        if (entry.isIntersecting) {
            // Lazy video — set src when visible
            if (target.tagName === "VIDEO" && target.dataset.src) {
                target.src = target.dataset.src;
                delete target.dataset.src;
                target.load();
                tryPlayVideo(target);
                mediaObserver.unobserve(target);
            } else if (target.tagName === "VIDEO" && !target.dataset.src) {
                tryPlayVideo(target);
            }
            // Lazy iframe — mount src when visible
            if (target.tagName === "IFRAME" && target.dataset.src) {
                target.src = target.dataset.src;
                delete target.dataset.src;
                mediaObserver.unobserve(target);
            }
        } else {
            // Pause video when out of view
            if (target.tagName === "VIDEO") {
                releaseVideo(target);
            }
        }
    });
}, { rootMargin: "600px 0px", threshold: 0 });

// ════════════════════════════════════════════════════════
// INJECT REDDIT UI
// ════════════════════════════════════════════════════════
function injectRedditUI() {
    const inputRow = document.querySelector(".reddit-input-row");
    if (inputRow) {
        const batchWrap = document.createElement("div");
        batchWrap.style.cssText = "display:flex;align-items:center;gap:6px;";
        batchWrap.innerHTML = `
            <label for="redditBatchSize" style="font-size:.8rem;white-space:nowrap;color:var(--muted);">Batch</label>
            <input type="number" id="redditBatchSize" value="10" min="1" max="200"
                style="width:62px;padding:6px 8px;border-radius:8px;border:1px solid var(--border);
                       background:var(--bg2);color:var(--text);font-size:.85rem;">
        `;
        inputRow.appendChild(batchWrap);
    }

    const controlsWrap = document.querySelector(".reddit-controls");
    if (controlsWrap) {
        const pickedWrap = document.createElement("div");
        pickedWrap.id = "pickedSubsList";
        pickedWrap.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;";
        const savedSubsDiv = el("savedSubs");
        controlsWrap.insertBefore(pickedWrap, savedSubsDiv);
    }

    const filterSel = el("redditFilter");
    if (filterSel) {
        filterSel.innerHTML = `
            <option value="all">All Media</option>
            <option value="gif">GIF / Animated</option>
            <option value="mp4">MP4 / Video</option>
            <option value="webm">WEBM</option>
            <option value="webp">WEBP</option>
            <option value="img">Images (jpg/png)</option>
        `;
    }
}

// ── Multi-sub picked list ─────────────────────────────────
let pickedSubs = [];

function renderPickedSubs() {
    const wrap = el("pickedSubsList");
    if (!wrap) return;
    wrap.innerHTML = "";
    pickedSubs.forEach(sub => {
        const chip = document.createElement("div");
        chip.style.cssText = `
            display:flex;align-items:center;gap:5px;padding:4px 10px;
            background:var(--bg3);border:1px solid var(--border);
            border-radius:20px;font-size:.8rem;color:var(--text);
        `;
        chip.innerHTML = `r/${sub} <span style="cursor:pointer;color:#ed4245;font-weight:700;">✕</span>`;
        chip.querySelector("span").onclick = () => {
            pickedSubs = pickedSubs.filter(s => s !== sub);
            renderPickedSubs();
        };
        wrap.appendChild(chip);
    });
}

function addPickedSub(sub) {
    sub = sub.trim().replace(/^r\//i, "");
    if (!sub) return;
    if (pickedSubs.includes(sub)) { showToast(`r/${sub} already added`, "info"); return; }
    pickedSubs.push(sub);
    renderPickedSubs();
}

// ════════════════════════════════════════════════════════
// LAYOUT TOGGLE — Grid ↔ Masonry
// ════════════════════════════════════════════════════════
function initLayoutToggle() {
    if (!layoutToggleBtn) return;
    updateLayoutUI();
    layoutToggleBtn.onclick = () => {
        layoutMode = layoutMode === "grid" ? "masonry" : "grid";
        updateLayoutUI();
        applyGalleryLayout();
        showToast(layoutMode === "grid" ? "Grid layout" : "Masonry layout", "info");
    };
}

function updateLayoutUI() {
    if (!layoutToggleBtn) return;
    if (layoutMode === "grid") {
        layoutToggleBtn.textContent = "⊟ Masonry";
        layoutToggleBtn.title = "Switch to masonry layout";
    } else {
        layoutToggleBtn.textContent = "⊞ Grid";
        layoutToggleBtn.title = "Switch to grid layout";
    }
}

function applyGalleryLayout() {
    const cols = gridSlider ? gridSlider.value : 4;
    if (layoutMode === "grid") {
        gallery.classList.remove("masonry-layout");
        gallery.classList.add("grid-layout");
        gallery.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gallery.style.columns = "";
    } else {
        gallery.classList.remove("grid-layout");
        gallery.classList.add("masonry-layout");
        gallery.style.gridTemplateColumns = "";
        gallery.style.columns = cols;
    }
}

// ════════════════════════════════════════════════════════
// MAX VIDEOS INPUT
// ════════════════════════════════════════════════════════
function initMaxVideosInput() {
    if (!maxVideosInput) return;
    maxVideosInput.value = maxPlayingVideos;
    maxVideosInput.onchange = () => {
        const v = parseInt(maxVideosInput.value);
        if (!isNaN(v) && v > 0) {
            maxPlayingVideos = v;
            showToast(`Max playing videos: ${v}`, "info");
        }
    };
}

// ════════════════════════════════════════════════════════
// VIDEO PLAY MANAGER
// ════════════════════════════════════════════════════════
function tryPlayVideo(vid) {
    for (const v of activeVideoSet) {
        if (!document.contains(v) || v.paused) activeVideoSet.delete(v);
    }
    if (activeVideoSet.size >= maxPlayingVideos) {
        const oldest = activeVideoSet.values().next().value;
        if (oldest) { oldest.pause(); activeVideoSet.delete(oldest); }
    }
    activeVideoSet.add(vid);
    vid.play().catch(() => {});
}

function releaseVideo(vid) {
    activeVideoSet.delete(vid);
    if (!vid.paused) vid.pause();
}

// ════════════════════════════════════════════════════════
// SAVE TO VAULT TOGGLE
// ════════════════════════════════════════════════════════
function initSaveToggle() {
    if (!saveToggleBtn) return;
    updateSaveToggleUI();
    saveToggleBtn.onclick = () => {
        saveToVaultEnabled = !saveToVaultEnabled;
        updateSaveToggleUI();
        showToast(saveToVaultEnabled ? "Auto-save ON" : "Auto-save OFF",
                  saveToVaultEnabled ? "success" : "info");
    };
}

function updateSaveToggleUI() {
    if (!saveToggleBtn) return;
    if (saveToVaultEnabled) {
        saveToggleBtn.textContent = "💾 Save: ON";
        saveToggleBtn.className   = "btn btn-success";
    } else {
        saveToggleBtn.textContent = "💾 Save: OFF";
        saveToggleBtn.className   = "btn btn-secondary";
    }
}

// ════════════════════════════════════════════════════════
// TOAST / PROGRESS
// ════════════════════════════════════════════════════════
function showToast(msg, type = "info", duration = 2800) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className   = `toast ${type} show`;
    toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
}
function showProgress(pct, label) {
    progressWrap.classList.remove("hidden");
    progressBar.style.width   = `${Math.min(pct, 100)}%`;
    progressLabel.textContent = label;
}
function hideProgress() {
    progressBar.style.width   = "100%";
    progressLabel.textContent = "Done!";
    setTimeout(() => { progressWrap.classList.add("hidden"); progressBar.style.width = "0%"; }, 700);
}

// ════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        el("tab-" + btn.dataset.tab).classList.add("active");
        const isVault = btn.dataset.tab === "vault";
        el("filterBar").style.display  = isVault ? "" : "none";
        el("statsBar").style.display   = isVault ? "" : "none";
    };
});

// ════════════════════════════════════════════════════════
// INDEXEDDB
// ════════════════════════════════════════════════════════
const DB_NAME = "GifVaultDB", DB_VERSION = 5, STORE_NAME = "gifs";
let db;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
            const d = e.target.result;
            if (d.objectStoreNames.contains(STORE_NAME)) d.deleteObjectStore(STORE_NAME);
            const store = d.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            store.createIndex("url",     "url",     { unique: true });
            store.createIndex("type",    "type",    { unique: false });
            store.createIndex("addedAt", "addedAt", { unique: false });
        };
        req.onsuccess = e => { db = e.target.result; resolve(db); };
        req.onerror   = e => reject(e.target.error);
    });
}
function getAllGifs() {
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror   = e => reject(e.target.error);
    });
}
function addGifsToDB(urls, origin = null) {
    return new Promise(async resolve => {
        let added = 0;
        const CHUNK = 200, total = urls.length;
        for (let i = 0; i < total; i += CHUNK) {
            const chunk = urls.slice(i, i + CHUNK);
            if (total > 20) showProgress(
                Math.round(((i + chunk.length) / total) * 100),
                `Importing... ${Math.round(((i + chunk.length) / total) * 100)}%`
            );
            await new Promise(res => {
                const tx    = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                chunk.forEach(url => {
                    const req = store.add({
                        url, type: detectType(url), addedAt: Date.now(),
                        tags: [], collections: [], origin: origin || null
                    });
                    req.onsuccess = () => added++;
                    req.onerror   = () => {};
                });
                tx.oncomplete = () => res();
                tx.onerror    = () => res();
            });
        }
        resolve(added);
    });
}
function updateGifInDB(gif) {
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, "readwrite");
        const req = tx.objectStore(STORE_NAME).put(gif);
        req.onsuccess = () => resolve();
        req.onerror   = e => reject(e.target.error);
    });
}
function deleteGifFromDB(id) {
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, "readwrite");
        const req = tx.objectStore(STORE_NAME).delete(id);
        req.onsuccess = () => resolve();
        req.onerror   = e => reject(e.target.error);
    });
}
function deleteManyFromDB(ids) {
    return new Promise(resolve => {
        const tx    = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        ids.forEach(id => store.delete(id));
        tx.oncomplete = () => resolve();
        tx.onerror    = () => resolve();
    });
}
function clearAllGifsDB() {
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, "readwrite");
        const req = tx.objectStore(STORE_NAME).clear();
        req.onsuccess = () => resolve();
        req.onerror   = e => reject(e.target.error);
    });
}

// ════════════════════════════════════════════════════════
// TYPE DETECTION
// ════════════════════════════════════════════════════════
function detectType(url) {
    if (!url) return "other";
    const lower = url.toLowerCase();
    const clean = lower.split("?")[0].split("#")[0];
    if (clean.endsWith(".gif"))                              return "gif";
    if (clean.endsWith(".webm"))                             return "webm";
    if (clean.endsWith(".mp4"))                              return "mp4";
    if (clean.endsWith(".webp"))                             return "webp";
    if (clean.endsWith(".png"))                              return "png";
    if (clean.endsWith(".jpg") || clean.endsWith(".jpeg"))   return "jpg";
    if (clean.endsWith(".apng"))                             return "apng";
    if (clean.endsWith(".avif"))                             return "avif";
    if (clean.endsWith(".mov"))                              return "mp4";
    if (clean.endsWith(".gifv"))                             return "mp4";
    if (lower.includes("v.redd.it"))                         return "mp4";
    if (lower.includes("redgifs.com"))                       return "gif";
    if (lower.includes("gfycat.com"))                        return "gif";
    if (lower.includes(".gif"))                              return "gif";
    if (lower.includes(".webm"))                             return "webm";
    if (lower.includes(".mp4"))                              return "mp4";
    if (lower.includes(".webp"))                             return "webp";
    if (lower.includes(".png"))                              return "png";
    if (lower.includes(".jpg") || lower.includes(".jpeg"))   return "jpg";
    return "other";
}

function normaliseUrl(url) {
    try {
        const u = new URL(url);
        ["size","width","height","w","h","quality","q","format","fit","dpr","scale",
         "thumbnail","thumb","resize","crop","auto","fm","s","v","e","t","ts"]
            .forEach(p => u.searchParams.delete(p));
        u.pathname = u.pathname
            .replace(/\/+/, "/").replace("/preview/", "/").replace("/thumb/", "/")
            .replace("/small/", "/").replace("/medium/", "/")
            .replace("/large/", "/").replace("/sample/", "/");
        u.hash = "";
        return u.toString().toLowerCase();
    } catch(e) { return url.toLowerCase().split("?")[0]; }
}

function extractUrls(text) {
    const raw = text.replace(/\r\n|\r|\n/g, "").replace(/\s+/g, " ")
        .match(/https?:\/\/[^\s"'\\<>\x00-\x1F]+/gi) || [];
    const results = [];
    for (let url of raw) {
        url = url.replace(/[\\'")\]>,;:!]+$/, "");
        if (url.length < 16) continue;
        const lower = url.toLowerCase();
        const clean = lower.split("?")[0].split("#")[0];
        const isMedia = (
            clean.endsWith(".gif")  || clean.endsWith(".webm") || clean.endsWith(".mp4") ||
            clean.endsWith(".webp") || clean.endsWith(".apng") || clean.endsWith(".avif") ||
            clean.endsWith(".gifv") || clean.endsWith(".mov")  || clean.endsWith(".png") ||
            clean.endsWith(".jpg")  || clean.endsWith(".jpeg") ||
            lower.includes(".gif?") || lower.includes(".webm?") || lower.includes(".mp4?") ||
            lower.includes(".webp?")|| lower.includes(".png?")  || lower.includes(".jpg?") ||
            lower.includes("cdn.discordapp.com/attachments") ||
            lower.includes("media.discordapp.net/attachments")
        );
        if (!isMedia) continue;
        if (lower.includes("/emojis/") || lower.includes("/icons/") ||
            lower.includes("/stickers/") || lower.includes("favicon") ||
            lower.includes("/assets/")) continue;
        results.push(url);
    }
    return [...new Set(results)];
}

function decodeBlob(blob) {
    const results = [];
    const tryX = (text) => { try { results.push(...extractUrls(text)); } catch(e) {} };
    let d1 = null;
    try { d1 = atob(blob.trim()); tryX(d1); } catch(e) {}
    tryX(blob);
    if (d1) {
        try { tryX(atob(d1.trim())); } catch(e) {}
        try { tryX(decodeURIComponent(d1)); } catch(e) {}
    }
    return [...new Set(results)];
}

// ════════════════════════════════════════════════════════
// FUSE.JS FUZZY SEARCH
// ════════════════════════════════════════════════════════
function buildFuseIndex() {
    if (typeof Fuse === "undefined") return;
    fuseInstance = new Fuse(gifs, {
        keys: ["url", "tags", "collections", "origin", "type"],
        threshold: 0.35,
        ignoreLocation: true,
        includeScore: true
    });
}

function fuzzySearch(query) {
    if (!fuseInstance || !query.trim()) return gifs;
    return fuseInstance.search(query).map(r => r.item);
}

// ════════════════════════════════════════════════════════
// GOFILE UPLOAD
// ════════════════════════════════════════════════════════
async function uploadToGofile(content, filename) {
    try {
        const serverRes  = await fetch("https://api.gofile.io/servers", {
            headers: { "Authorization": `Bearer ${GOFILE_TOKEN}` }
        });
        if (!serverRes.ok) throw new Error(`Server list HTTP ${serverRes.status}`);
        const serverData = await serverRes.json();
        const servers    = serverData?.data?.servers;
        if (!servers || servers.length === 0) throw new Error("No upload servers");
        const bestServer = servers[0].name;

        let folderId = null;
        try {
            const acctRes = await fetch(`https://api.gofile.io/accounts/${GOFILE_ACCT}`, {
                headers: { "Authorization": `Bearer ${GOFILE_TOKEN}` }
            });
            if (acctRes.ok) {
                const acctData = await acctRes.json();
                const rootId   = acctData?.data?.rootFolder;
                if (rootId) {
                    const folderRes = await fetch("https://api.gofile.io/contents/createFolder", {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${GOFILE_TOKEN}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ parentFolderId: rootId, folderName: `vault-${Date.now()}` })
                    });
                    if (folderRes.ok) {
                        const fd = await folderRes.json();
                        folderId = fd?.data?.id || null;
                    }
                }
            }
        } catch(e) { console.warn("[Gofile] Account step skipped:", e.message); }

        const form = new FormData();
        form.append("token", GOFILE_TOKEN);
        form.append("file", new Blob([content], { type: "text/plain" }), filename);
        if (folderId) form.append("folderId", folderId);

        const upRes  = await fetch(`https://${bestServer}.gofile.io/uploadfile`, { method: "POST", body: form });
        const upText = await upRes.text();
        let upData;
        try { upData = JSON.parse(upText); } catch(e) { throw new Error("Not JSON: " + upText.slice(0, 200)); }
        if (upData.status !== "ok") throw new Error("Upload failed: " + JSON.stringify(upData));

        const finalFolderId = upData.data?.parentFolder || folderId;
        const downloadPage  = upData.data?.downloadPage;

        if (finalFolderId) {
            try {
                await fetch(`https://api.gofile.io/contents/${finalFolderId}/update`, {
                    method: "PUT",
                    headers: { "Authorization": `Bearer ${GOFILE_TOKEN}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ attribute: "public", attributeValue: "true" })
                });
            } catch(e) {}
        }

        return downloadPage || (finalFolderId ? `https://gofile.io/d/${finalFolderId}` : null);
    } catch(e) {
        console.error("[Gofile] Upload failed:", e.message);
        return null;
    }
}

// ════════════════════════════════════════════════════════
// DISCORD WEBHOOK
// ════════════════════════════════════════════════════════
async function sendWebhook(payload) {
    if (!WEBHOOK_URL) return false;
    try {
        const res = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return res.status === 204 || res.status === 200;
    } catch(e) { return false; }
}
async function sendWebhookImport(rawContent, urls, added, skipped) {
    showToast("Initializing..", "info", 5000);
    const gofileLink = await uploadToGofile(rawContent, `vault-${Date.now()}.txt`);
    await sendWebhook({
        embeds: [{
            title: "📥 GIF Vault — Import", color: 0x5865F2, timestamp: new Date().toISOString(),
            fields: [
                { name: "📊 Stats", value: `**Found:** ${urls.length}\n**Added:** ${added}\n**Dupes:** ${skipped}`, inline: false },
                { name: "📁 File",  value: gofileLink ? `[gofile.io](${gofileLink})` : "Upload failed", inline: false },
                { name: "🔗 Samples", value: urls.slice(0, 5).map(u => `• ${u.slice(0, 80)}`).join("\n") || "—", inline: false }
            ],
            footer: { text: "GIF Vault" }
        }]
    });
}
async function sendWebhookGeneral(urls, added, skipped, origin) {
    await sendWebhook({
        embeds: [{
            title: "📡 GIF Vault — Media Added", color: 0x57f287, timestamp: new Date().toISOString(),
            fields: [
                { name: "📊 Stats", value: `**Added:** ${added}\n**Dupes:** ${skipped}\n**Source:** ${origin || "unknown"}`, inline: false },
                { name: "🔗 Samples", value: urls.slice(0, 3).map(u => `• ${u.slice(0, 80)}`).join("\n") || "—", inline: false }
            ],
            footer: { text: "GIF Vault" }
        }]
    });
}

// ════════════════════════════════════════════════════════
// REDDIT — FETCH
// ════════════════════════════════════════════════════════
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
let _lastRedditCall = 0;
const REDDIT_GAP    = 1200;

async function redditFetch(url, attempt = 0) {
    const wait = Math.max(0, REDDIT_GAP - (Date.now() - _lastRedditCall));
    if (wait > 0) await sleep(wait);
    _lastRedditCall = Date.now();

    console.log(`[Reddit] Fetching (attempt ${attempt}): ${url}`);

    if (attempt === 0) {
        try {
            const res = await fetch(url, {
                headers: { "Accept": "application/json" },
                signal: AbortSignal.timeout(10000)
            });
            if (res.status === 429) {
                const w = parseInt(res.headers.get("Retry-After") || "15") * 1000;
                showToast(`Rate limited — waiting ${Math.round(w/1000)}s...`, "warning", w);
                await sleep(w);
                return redditFetch(url, 0);
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) throw new Error("Not JSON");
            console.log(`[Reddit] Direct OK: ${url}`);
            return JSON.parse(text);
        } catch(e) {
            console.warn("[Reddit] Direct failed:", e.message, "→ trying allorigins");
            return redditFetch(url, 1);
        }
    }

    if (attempt === 1) {
        try {
            const res = await fetch(
                `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
                { signal: AbortSignal.timeout(14000) }
            );
            if (!res.ok) throw new Error(`allorigins ${res.status}`);
            const data = await res.json();
            if (!data.contents) throw new Error("empty contents");
            console.log(`[Reddit] allorigins OK: ${url}`);
            return JSON.parse(data.contents);
        } catch(e) {
            console.warn("[Reddit] allorigins failed:", e.message, "→ trying corsproxy");
            return redditFetch(url, 2);
        }
    }

    console.log(`[Reddit] corsproxy attempt: ${url}`);
    const res = await fetch(
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(14000) }
    );
    if (!res.ok) throw new Error(`corsproxy ${res.status}`);
    const text = await res.text();
    console.log(`[Reddit] corsproxy OK: ${url}`);
    return JSON.parse(text);
}

// ════════════════════════════════════════════════════════
// MEDIA EXTRACTION
// ════════════════════════════════════════════════════════
function resolveImgur(url) {
    if (/\.gifv$/i.test(url)) return url.replace(/\.gifv$/i, ".mp4");
    const imgurPage = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)$/);
    if (imgurPage) return `https://i.imgur.com/${imgurPage[1]}.gif`;
    return url;
}

function isDirectMedia(url) {
    if (!url || !url.startsWith("http")) return false;
    const l = url.toLowerCase().split("?")[0];
    return (
        l.endsWith(".gif")  || l.endsWith(".webm") || l.endsWith(".mp4") ||
        l.endsWith(".webp") || l.endsWith(".png")  || l.endsWith(".jpg") ||
        l.endsWith(".jpeg") || l.endsWith(".gifv") || l.endsWith(".apng") ||
        l.includes("i.redd.it") || l.includes("v.redd.it") ||
        l.includes("i.imgur.com") || l.includes("preview.redd.it")
    );
}

function dedupeKey(url) {
    try {
        const u = new URL(url);
        return (u.hostname + u.pathname).toLowerCase();
    } catch(e) { return url.toLowerCase(); }
}

function scoreUrl(url) {
    const l = url.toLowerCase().split("?")[0];
    if (l.includes("i.redd.it")) {
        if (l.endsWith(".gif"))  return 100;
        if (l.endsWith(".mp4"))  return 99;
        if (l.endsWith(".webm")) return 98;
        if (l.endsWith(".webp")) return 50;
        return 60;
    }
    if (l.includes("v.redd.it"))    return 95;
    if (l.includes("i.imgur.com")) {
        if (l.endsWith(".mp4"))  return 92;
        if (l.endsWith(".gif"))  return 91;
        if (l.endsWith(".webm")) return 90;
        return 75;
    }
    if (l.endsWith(".mp4"))  return 80;
    if (l.endsWith(".gif"))  return 79;
    if (l.endsWith(".webm")) return 78;
    if (l.endsWith(".webp")) return 30;
    if (l.endsWith(".png"))  return 28;
    if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return 27;
    return 1;
}

function detectEmbedType(url) {
    const l = url.toLowerCase();
    if (l.includes("redgifs.com"))        return "redgifs";
    if (l.includes("gfycat.com"))         return "gfycat";
    if (l.includes("tenor.com"))          return "tenor";
    if (l.includes("giphy.com"))          return "giphy";
    if (l.includes("imgur.com/a/") || l.includes("imgur.com/gallery/")) return "imgur-album";
    return null;
}

function getEmbedSrc(url) {
    const rgMatch = url.match(/redgifs\.com\/watch\/([a-zA-Z0-9]+)/i);
    if (rgMatch) return `https://www.redgifs.com/ifr/${rgMatch[1]}`;

    const gfMatch = url.match(/gfycat\.com\/(?:ifr\/)?([a-zA-Z0-9]+)/i);
    if (gfMatch) return `https://gfycat.com/ifr/${gfMatch[1]}`;

    const tenorMatch = url.match(/tenor\.com\/view\/([^/?#]+)/i);
    if (tenorMatch) return `https://tenor.com/embed/${tenorMatch[1]}`;

    const giphyMatch = url.match(/giphy\.com\/gifs\/(?:[^/]+-)?([a-zA-Z0-9]+)$/i);
    if (giphyMatch) return `https://giphy.com/embed/${giphyMatch[1]}`;

    return null;
}

function extractMediaFromPost(post) {
    const d = post.data;
    if (d.stickied || d.is_self) return [];

    const results = [];

    if (d.gallery_data && d.media_metadata) {
        for (const item of d.gallery_data.items) {
            const meta = d.media_metadata[item.media_id];
            if (!meta) continue;
            const mime = meta.m || "";
            if (mime.startsWith("image/gif")) {
                const url = `https://i.redd.it/${meta.id}.gif`;
                results.push({ url, type: "gif", key: dedupeKey(url) });
            } else if (mime.startsWith("video/")) {
                const src = meta.s;
                if (src?.mp4) {
                    const url = src.mp4.replace(/&amp;/g, "&");
                    results.push({ url, type: "mp4", key: dedupeKey(url) });
                }
            } else if (mime.startsWith("image/")) {
                const ext = mime.split("/")[1] || "jpg";
                const url = `https://i.redd.it/${meta.id}.${ext}`;
                results.push({ url, type: detectType(url), key: dedupeKey(url) });
            }
        }
        return results;
    }

    const rv = d.media?.reddit_video || d.secure_media?.reddit_video;
    if (rv?.fallback_url) {
        const url = rv.fallback_url.replace(/&amp;/g, "&").split("?")[0];
        console.log(`[Reddit] reddit_video found: ${url}`);
        results.push({ url, type: "mp4", key: dedupeKey(url), isRedditVideo: true });
        return results;
    }

    if (d.crosspost_parent_list && d.crosspost_parent_list.length > 0) {
        const parent = { data: d.crosspost_parent_list[0] };
        const parentResults = extractMediaFromPost(parent);
        if (parentResults.length > 0) return parentResults;
    }

    const postUrl = (d.url || "").replace(/&amp;/g, "&").trim();
    const embedType = detectEmbedType(postUrl);
    if (embedType) {
        const embedSrc = getEmbedSrc(postUrl);
        if (embedSrc) {
            console.log(`[Reddit] embed found (${embedType}): ${embedSrc}`);
            results.push({
                url: postUrl,
                embedSrc,
                embedType,
                type: "gif",
                key: dedupeKey(postUrl),
                isEmbed: true,
                width:  d.media_embed?.width  || d.secure_media_embed?.width  || 640,
                height: d.media_embed?.height || d.secure_media_embed?.height || 480
            });
            return results;
        }
    }

    const embed = d.secure_media_embed || d.media_embed;
    if (embed?.content) {
        const srcMatch = embed.content.replace(/&amp;/g, "&").match(/src=["']([^"']+)["']/i);
        if (srcMatch) {
            const embedSrc = srcMatch[1];
            const eType    = detectEmbedType(embedSrc);
            results.push({
                url:       embedSrc,
                embedSrc,
                embedType: eType || "iframe",
                type:      "gif",
                key:       dedupeKey(embedSrc),
                isEmbed:   true,
                width:     embed.width  || 640,
                height:    embed.height || 480
            });
            return results;
        }
    }

    if (postUrl) {
        let url = resolveImgur(postUrl);
        const prev = d.preview?.images?.[0];
        const candidates = new Map();

        if (isDirectMedia(url)) candidates.set(url, scoreUrl(url));

        if (prev?.variants?.mp4?.source?.url) {
            const u = prev.variants.mp4.source.url.replace(/&amp;/g, "&").split("?")[0];
            candidates.set(u, scoreUrl(u));
        }
        if (prev?.variants?.gif?.source?.url) {
            const u = prev.variants.gif.source.url.replace(/&amp;/g, "&").split("?")[0];
            candidates.set(u, scoreUrl(u));
        }
        if (prev?.source?.url) {
            const u = prev.source.url.replace(/&amp;/g, "&").split("?")[0];
            if (isDirectMedia(u)) candidates.set(u, scoreUrl(u));
        }

        if (candidates.size > 0) {
            let best = url, bestScore = -1;
            candidates.forEach((s, u) => { if (s > bestScore) { bestScore = s; best = u; } });
            console.log(`[Reddit] direct media: ${best} (score ${bestScore})`);
            results.push({ url: best, type: detectType(best), key: dedupeKey(best) });
        }
    }

    return results;
}

// ════════════════════════════════════════════════════════
// FILTER
// ════════════════════════════════════════════════════════
function passesFilter(item, filter) {
    if (filter === "all") return true;
    const url   = (item.url || "").toLowerCase();
    const clean = url.split("?")[0].split("#")[0];
    const type  = item.type || detectType(item.url || "");
    const embed = (item.embedType || "").toLowerCase();
    const isEmbed = !!item.isEmbed;

    switch (filter) {
        case "gif":
            return (
                type === "gif" || type === "apng" ||
                clean.endsWith(".gif") || clean.endsWith(".gifv") ||
                embed === "redgifs" || embed === "gfycat" ||
                embed === "tenor"   || embed === "giphy"  ||
                url.includes("redgifs.com") || url.includes("gfycat.com") ||
                url.includes("tenor.com")   || url.includes("giphy.com") ||
                (isEmbed && type === "gif")
            );
        case "mp4":
            return (
                type === "mp4" ||
                clean.endsWith(".mp4") || clean.endsWith(".mov") ||
                url.includes("v.redd.it") ||
                !!item.isRedditVideo
            );
        case "webm":
            return type === "webm" || clean.endsWith(".webm");
        case "webp":
            return type === "webp" || clean.endsWith(".webp");
        case "img":
            return (
                clean.endsWith(".png")  || clean.endsWith(".jpg") || clean.endsWith(".jpeg") ||
                type === "png" || type === "jpg"
            );
        default:
            return true;
    }
}

// ════════════════════════════════════════════════════════
// REDDIT SESSION MANAGEMENT
// ════════════════════════════════════════════════════════
async function loadRedditPage(sub, sort, after) {
    let url = `https://old.reddit.com/r/${sub}/${sort}.json?limit=100&raw_json=1`;
    if (after) url += `&after=${encodeURIComponent(after)}`;
    console.log(`[Reddit] loadRedditPage r/${sub} sort=${sort} after=${after}`);
    const data  = await redditFetch(url);
    const posts = data?.data?.children || [];
    const next  = data?.data?.after    || null;
    const items = [];
    for (const post of posts) {
        const extracted = extractMediaFromPost(post);
        console.log(`[Reddit] post ${post.data?.id}: extracted ${extracted.length} items`);
        items.push(...extracted);
    }
    console.log(`[Reddit] r/${sub} page done — ${items.length} items, next=${next}`);
    return { items, nextAfter: next };
}

async function fetchSessionPage(session) {
    if (session.loading || session.done) return;
    session.loading = true;
    try {
        const { items, nextAfter } = await loadRedditPage(
            session.sub, session.sort, session.after
        );

        const filter = session.filter;
        for (const item of items) {
            if (!passesFilter(item, filter)) {
                console.log(`[Reddit] filtered out (${filter}): ${item.url}`);
                continue;
            }
            const key = item.key || dedupeKey(item.url);
            if (session.seenKeys.has(key)) continue;
            session.seenKeys.add(key);
            session.queue.push(item);
        }

        session.after = nextAfter;
        if (!nextAfter) session.done = true;
        console.log(`[Reddit] r/${session.sub}: queue now ${session.queue.length}`);
    } catch(e) {
        console.error(`[Reddit] r/${session.sub} FAILED:`, e.message);
        session.done = true;
    }
    session.loading = false;
}

async function pullItems(n) {
    await Promise.all(redditSessions.map(s => {
        if (s.queue.length < 5 && !s.loading && !s.done) return fetchSessionPage(s);
        return Promise.resolve();
    }));

    const taken   = [];
    let attempts  = 0;
    const maxAttempts = n * Math.max(redditSessions.length, 1) * 3;

    while (taken.length < n && attempts < maxAttempts) {
        attempts++;
        if (redditSessions.length === 0) break;

        const idx     = redditSessionIndex % redditSessions.length;
        const session = redditSessions[idx];
        redditSessionIndex = (redditSessionIndex + 1) % redditSessions.length;

        if (session.queue.length > 0) {
            const item = session.queue.shift();
            const key  = item.key || dedupeKey(item.url);

            if (redditShownUrls.has(key)) continue;
            redditShownUrls.add(key);

            taken.push({ item, sub: session.sub });

            if (session.queue.length < 10 && !session.loading && !session.done) {
                fetchSessionPage(session);
            }
        } else if (!session.done) {
            await fetchSessionPage(session);
        }
    }

    return taken;
}

// ════════════════════════════════════════════════════════
// REDDIT LOAD
// ════════════════════════════════════════════════════════
async function doRedditLoad() {
    const batchInput = el("redditBatchSize");
    redditBatchSize  = batchInput ? Math.max(1, parseInt(batchInput.value) || 10) : 10;

    let subsToLoad = [...pickedSubs];
    savedSubs.forEach(s => { if (!subsToLoad.includes(s)) subsToLoad.push(s); });
    const inputVal = subredditInput.value.trim().replace(/^r\//i, "");
    if (inputVal && !subsToLoad.includes(inputVal)) subsToLoad.push(inputVal);
    if (subsToLoad.length === 0) { showToast("Enter or pick a subreddit", "error"); return; }

    const sort   = redditSortEl.value;
    const filter = redditFilterEl.value;

    redditLoaded       = 0;
    redditSessionIndex = 0;
    redditTotalAdded   = 0;

    redditSessions = subsToLoad.map(sub => ({
        sub, sort, filter,
        after:     null,
        seenKeys:  new Set(),
        loading:   false,
        done:      false,
        queue:     []
    }));

    console.log(`[Reddit] Starting load for: ${subsToLoad.join(", ")} | sort=${sort} filter=${filter}`);

    redditStats.style.display   = "";
    redditStatSub.textContent   = subsToLoad.map(s => `r/${s}`).join(" + ");
    redditStatCount.textContent = "Loading...";
    redditStatAdded.textContent = "";

    redditLoadMoreWrap.classList.remove("hidden");
    redditLoadingEl.style.display = "flex";

    await Promise.all(redditSessions.map(s => fetchSessionPage(s)));
    redditLoadingEl.style.display = "none";

    await renderNextRedditBatch();
}

// ════════════════════════════════════════════════════════
// RENDER NEXT REDDIT BATCH
// ════════════════════════════════════════════════════════
async function renderNextRedditBatch() {
    const batchInput = el("redditBatchSize");
    const n = batchInput ? Math.max(1, parseInt(batchInput.value) || 10) : 10;

    redditLoadingEl.style.display = "flex";
    const pulled = await pullItems(n);
    redditLoadingEl.style.display = "none";

    if (pulled.length === 0) {
        const allDone = redditSessions.every(s => s.done && s.queue.length === 0);
        if (allDone) {
            redditLoadMoreWrap.classList.add("hidden");
            showToast("All subreddits exhausted!", "success", 4000);
        }
        return;
    }

    redditLoaded += pulled.length;

    if (saveToVaultEnabled) {
        const directUrls = pulled.filter(p => !p.item.isEmbed).map(p => p.item.url);
        if (directUrls.length > 0) {
            const added = await addGifsToDB(directUrls, "reddit");
            gifs = await getAllGifs();
            buildFuseIndex();
            redditTotalAdded += added;
            if (added > 0) { applyFilters(); updateStats(); }
        }
    }

    redditStatCount.textContent = `${redditLoaded} loaded`;
    redditStatAdded.textContent = saveToVaultEnabled
        ? `${redditTotalAdded} added to vault`
        : "(saving disabled)";

    scheduleRender(() => appendRedditCards(pulled));

    const allDone = redditSessions.every(s => s.done && s.queue.length === 0);
    if (allDone) {
        redditLoadMoreWrap.classList.add("hidden");
        showToast(`Done! ${redditLoaded} items`, "success", 4000);
    } else {
        redditLoadMoreWrap.classList.remove("hidden");
    }
}

// ════════════════════════════════════════════════════════
// APPEND REDDIT CARDS
// ════════════════════════════════════════════════════════
function appendRedditCards(pulled) {
    const frag = document.createDocumentFragment();
    pulled.forEach(({ item, sub }) => {
        frag.appendChild(buildRedditCard(item, sub));
    });
    redditGallery.appendChild(frag);
}

// ════════════════════════════════════════════════════════
// BUILD REDDIT CARD
// ════════════════════════════════════════════════════════
function buildRedditCard(item, sub) {
    const { url, type, isEmbed, embedSrc, embedType, isRedditVideo } = item;

    const card = document.createElement("div");
    card.className = "card reddit-card";
    card.dataset.url = url;

    const badge = document.createElement("div");
    badge.className   = `card-source-badge type-${type}`;
    badge.textContent = type.toUpperCase();

    const subBadge = document.createElement("div");
    subBadge.className   = "reddit-sub-badge";
    subBadge.textContent = `r/${sub}`;

    let mediaEl;

    if (isEmbed && embedSrc) {
        const wrapper = document.createElement("div");
        wrapper.className = "embed-wrapper";

        const iframe = document.createElement("iframe");
        // src set via IntersectionObserver when card enters viewport
        iframe.dataset.src = embedSrc;
        iframe.src = "";
        iframe.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;border:none;display:block;";
        iframe.setAttribute("allowfullscreen", "true");
        iframe.setAttribute("allow", "autoplay; fullscreen; encrypted-media; picture-in-picture");
        iframe.setAttribute("scrolling", "no");
        iframe.setAttribute("frameborder", "0");
        if (embedType === "redgifs") {
            iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox");
        }

        wrapper.appendChild(iframe);
        mediaObserver.observe(iframe);
        mediaEl = wrapper;

    } else if (type === "mp4" || type === "webm" || isRedditVideo) {
        const wrapper = document.createElement("div");
        wrapper.className = "video-wrapper";

        const vid = document.createElement("video");
        vid.style.cssText = "width:100%;display:block;max-height:400px;object-fit:contain;";
        vid.controls    = true;
        vid.loop        = true;
        vid.muted       = true;
        vid.playsInline = true;
        vid.preload     = "none";
        // Lazy — src set by observer when visible
        vid.dataset.src = url;

        vid.onerror = () => {
            wrapper.innerHTML = `<div style="padding:16px;color:var(--muted);font-size:.75rem;text-align:center;min-height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
                <span>⚠️ Video unavailable</span>
                <a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);font-size:.7rem;word-break:break-all;">Open directly ↗</a>
            </div>`;
        };

        const unmuteBtn = document.createElement("button");
        unmuteBtn.className = "unmute-btn";
        unmuteBtn.textContent = "🔇 Unmute";
        unmuteBtn.onclick = (e) => {
            e.stopPropagation();
            vid.muted = !vid.muted;
            if (!vid.muted && vid.volume === 0) vid.volume = 1;
            unmuteBtn.textContent = vid.muted ? "🔇 Unmute" : "🔊 Muted";
        };
        vid.onvolumechange = () => {
            unmuteBtn.textContent = vid.muted ? "🔇 Unmute" : "🔊 Muted";
        };

        wrapper.appendChild(vid);
        wrapper.appendChild(unmuteBtn);
        mediaObserver.observe(vid);
        mediaEl = wrapper;

    } else {
        // Images — src set directly, browser handles lazy natively
        const wrapper = document.createElement("div");
        wrapper.className = "img-wrapper";
        wrapper.style.cssText = "width:100%;aspect-ratio:16/9;background:var(--bg3);overflow:hidden;";

        const img = document.createElement("img");
        img.loading  = "lazy";
        img.decoding = "async";
        img.src      = url;
        img.alt      = type;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
        img.onerror = () => { wrapper.style.display = "none"; };

        wrapper.appendChild(img);
        mediaEl = wrapper;
    }

    card.oncontextmenu = e => {
        e.preventDefault();
        showRedditContextMenu(e, { url, type, sub, isEmbed });
    };

    card.append(badge, subBadge, mediaEl);
    return card;
}

// ════════════════════════════════════════════════════════
// REDDIT CONTEXT MENU
// ════════════════════════════════════════════════════════
let redditCtxTarget = null;

function showRedditContextMenu(e, data) {
    e.preventDefault();
    redditCtxTarget = data;
    const menu = el("redditContextMenu");
    if (!menu) return;
    menu.style.left = `${Math.min(e.clientX, window.innerWidth  - 180)}px`;
    menu.style.top  = `${Math.min(e.clientY, window.innerHeight - 200)}px`;
    menu.classList.remove("hidden");
}

// ════════════════════════════════════════════════════════
// REDDIT CLEAR
// ════════════════════════════════════════════════════════
redditClearBtn.onclick = () => {
    redditGallery.querySelectorAll("video, iframe").forEach(el2 => {
        mediaObserver.unobserve(el2);
    });
    redditGallery.innerHTML = "";
    redditShownUrls.clear();
    redditLoaded      = 0;
    redditTotalAdded  = 0;
    redditSessions    = [];
    redditSessionIndex = 0;
    activeVideoSet.clear();
    redditLoadMoreWrap.classList.add("hidden");
    redditStats.style.display = "none";
    showToast("Reddit gallery cleared", "info");
};

// ── Reddit controls ───────────────────────────────────────
redditLoadBtn.onclick = () => doRedditLoad();

subredditInput.onkeydown = e => {
    if (e.key === "Enter") {
        const val = subredditInput.value.trim().replace(/^r\//i, "");
        if (val) { addPickedSub(val); subredditInput.value = ""; }
    }
};

redditAddBtn.onclick = () => {
    const sub = subredditInput.value.trim().replace(/^r\//i, "");
    if (!sub) { showToast("Enter a subreddit", "error"); return; }
    if (savedSubs.includes(sub)) { showToast("Already saved", "info"); return; }
    savedSubs.push(sub);
    localStorage.setItem("gif_vault_subs", JSON.stringify(savedSubs));
    renderSavedSubs();
    showToast(`r/${sub} saved!`, "success");
};

function renderSavedSubs() {
    savedSubsEl.innerHTML = "";
    savedSubs.forEach(sub => {
        const chip = document.createElement("div");
        chip.className = "sub-chip";
        chip.innerHTML = `r/${sub} <span class="remove-sub">✕</span>`;
        chip.onclick = e => {
            if (e.target.classList.contains("remove-sub")) {
                savedSubs = savedSubs.filter(s => s !== sub);
                localStorage.setItem("gif_vault_subs", JSON.stringify(savedSubs));
                renderSavedSubs();
                return;
            }
            addPickedSub(sub);
            showToast(`r/${sub} added to queue`, "success");
        };
        savedSubsEl.appendChild(chip);
    });
}

// ── Infinite scroll for reddit ────────────────────────────
const redditObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting && redditSessions.length > 0) {
            const anyActive = redditSessions.some(s => !s.done || s.queue.length > 0);
            if (anyActive) renderNextRedditBatch();
        }
    });
}, { root: null, threshold: 0.1 });
if (redditLoadMoreWrap) redditObserver.observe(redditLoadMoreWrap);

// Reddit view toggle
viewMasonryBtn.onclick = () => {
    redditGallery.className = "gallery reddit-gallery masonry-mode";
    viewMasonryBtn.classList.add("active"); viewGridBtn.classList.remove("active");
};
viewGridBtn.onclick = () => {
    redditGallery.className = "gallery reddit-gallery grid-mode-reddit";
    viewGridBtn.classList.add("active"); viewMasonryBtn.classList.remove("active");
};

// ════════════════════════════════════════════════════════
// DUPE DETECTION
// ════════════════════════════════════════════════════════
async function findAndRemoveDupes() {
    if (gifs.length === 0) { showToast("Vault is empty", "error"); return; }
    showProgress(0, "Scanning...");
    await new Promise(r => setTimeout(r, 30));
    const exactSeen = new Map(), normSeen = new Map(), dupeIds = [];
    gifs.forEach((g, i) => {
        if (i % 200 === 0) showProgress(Math.round((i / gifs.length) * 100), `Scanning...`);
        if (exactSeen.has(g.url)) { dupeIds.push(g.id); return; }
        exactSeen.set(g.url, g.id);
        const norm = normaliseUrl(g.url);
        if (normSeen.has(norm)) { dupeIds.push(g.id); return; }
        normSeen.set(norm, g.id);
    });
    hideProgress();
    if (dupeIds.length === 0) { showToast("No duplicates!", "success"); return; }
    if (!confirm(`Found ${dupeIds.length} duplicates. Delete?`)) return;
    await deleteManyFromDB(dupeIds);
    gifs = await getAllGifs();
    buildFuseIndex();
    applyFilters();
    showToast(`Removed ${dupeIds.length} dupes`, "success");
}

// ════════════════════════════════════════════════════════
// DEAD LINKS
// ════════════════════════════════════════════════════════
async function checkDeadLinks() {
    if (gifs.length === 0) { showToast("Vault is empty", "error"); return; }
    deadIds = new Set();
    deadBtn.disabled = true; deadBtn.textContent = "Checking...";
    statDead.classList.remove("hidden"); statDead.textContent = "💀 Dead: 0";
    const BATCH = 15;
    for (let i = 0; i < gifs.length; i += BATCH) {
        const chunk = gifs.slice(i, i + BATCH);
        showProgress(Math.round(((i + chunk.length) / gifs.length) * 100), `Checking ${i + chunk.length}/${gifs.length}`);
        await Promise.all(chunk.map(async gif => {
            try {
                const ctrl  = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 7000);
                await fetch(gif.url, { method: "HEAD", mode: "no-cors", signal: ctrl.signal });
                clearTimeout(timer);
            } catch(e) { if (e.name === "AbortError" || e.name === "TypeError") deadIds.add(gif.id); }
        }));
        statDead.textContent = `💀 Dead: ${deadIds.size}`;
        deadIds.forEach(id => {
            const c = gallery.querySelector(`[data-id="${id}"]`);
            if (c) c.classList.add("dead-link");
        });
    }
    hideProgress(); deadBtn.disabled = false; deadBtn.textContent = "💀 Dead";
    if (deadIds.size === 0) { showToast("All links alive!", "success"); statDead.classList.add("hidden"); return; }
    showToast(`Found ${deadIds.size} dead links`, "warning", 5000);
    if (confirm(`Delete ${deadIds.size} dead links?`)) {
        await deleteManyFromDB([...deadIds]);
        gifs = await getAllGifs(); deadIds.clear();
        buildFuseIndex();
        statDead.classList.add("hidden"); applyFilters();
        showToast("Dead links removed", "success");
    }
}

// ════════════════════════════════════════════════════════
// ZIP
// ════════════════════════════════════════════════════════
async function downloadZip() {
    if (typeof JSZip === "undefined") { showToast("JSZip not loaded", "error"); return; }
    if (gifs.length === 0) { showToast("Nothing to download", "error"); return; }
    const toZip = filtered.length > 0 ? filtered : gifs;
    if (!confirm(`Download ${toZip.length} files as ZIP?`)) return;
    const zip = new JSZip(), folder = zip.folder("gif-vault");
    let done = 0, failed = 0;
    zipBtn.disabled = true; zipBtn.textContent = "Zipping...";
    for (const gif of toZip) {
        try {
            const res = await fetch(gif.url);
            if (!res.ok) throw new Error();
            folder.file(`${gif.id}.${gif.type}`, await res.blob());
        } catch(e) { failed++; }
        done++;
        showProgress(Math.round((done / toZip.length) * 100), `${done}/${toZip.length}`);
    }
    showProgress(99, "Building ZIP...");
    try {
        const blob = await zip.generateAsync({ type: "blob" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = `gif-vault-${Date.now()}.zip`; a.click();
        URL.revokeObjectURL(url);
        showToast(`ZIP ready — ${done - failed} files`, "success", 5000);
    } catch(e) { showToast("ZIP failed: " + e.message, "error"); }
    hideProgress();
    zipBtn.disabled = false; zipBtn.textContent = "📦 ZIP";
}

// ════════════════════════════════════════════════════════
// LOCALSTORAGE POLLING + BROADCAST
// ════════════════════════════════════════════════════════
const LS_KEY = "gif_vault_incoming";
let lastAck  = Date.now();

function startPolling() {
    setInterval(() => {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!data?.timestamp || data.timestamp <= lastAck) return;
            lastAck = data.timestamp;
            localStorage.removeItem(LS_KEY);
            const urls   = Array.isArray(data.urls) ? data.urls : [];
            const origin = typeof data.origin === "string" ? data.origin : null;
            if (urls.length === 0) return;
            pendingUrls = urls;
            showIncomingTray(urls, origin);
        } catch(e) { localStorage.removeItem(LS_KEY); }
    }, 600);
}

try {
    const ch = new BroadcastChannel("gif_vault");
    ch.onmessage = e => {
        const { type, urls, origin } = e.data || {};
        if (type !== "ADD_URLS" || !Array.isArray(urls) || urls.length === 0) return;
        const valid = urls.filter(u => typeof u === "string" && u.startsWith("http"));
        if (valid.length === 0) return;
        pendingUrls = valid;
        showIncomingTray(valid, origin || null);
    };
} catch(e) {}

// ════════════════════════════════════════════════════════
// INCOMING TRAY
// ════════════════════════════════════════════════════════
function showIncomingTray(urls, origin) {
    let hostname = "external page";
    if (origin) { try { hostname = new URL(origin).hostname; } catch(e) { hostname = origin; } }
    incomingTitle.textContent = `📡 ${urls.length} item${urls.length !== 1 ? "s" : ""} from ${hostname}`;
    incomingPreviewRow.innerHTML = "";
    urls.slice(0, 20).forEach(url => {
        const type = detectType(url);
        let el2;
        if (type === "webm" || type === "mp4") {
            el2 = document.createElement("video");
            el2.src = url; el2.autoplay = true; el2.loop = true; el2.muted = true; el2.playsInline = true;
        } else {
            el2 = document.createElement("img"); el2.src = url; el2.alt = "preview";
        }
        el2.className = "incoming-thumb";
        el2.onerror = () => { el2.style.display = "none"; };
        incomingPreviewRow.appendChild(el2);
    });
    incomingTray.classList.remove("hidden");
    broadcastStatus.textContent = "📡 Receiving!";
    broadcastStatus.style.color = "#c084fc";
    setTimeout(() => { broadcastStatus.textContent = "📡 Listening"; broadcastStatus.style.color = "var(--success)"; }, 2000);
}

incomingAccept.onclick = async () => {
    if (pendingUrls.length === 0) return;
    const origin = (() => { const m = incomingTitle.textContent.match(/from (.+)$/); return m ? m[1] : null; })();
    const urls   = [...pendingUrls];
    const added  = await addGifsToDB(urls, origin);
    gifs = await getAllGifs();
    buildFuseIndex();
    pendingUrls  = [];
    incomingTray.classList.add("hidden");
    incomingPreviewRow.innerHTML = "";
    applyFilters();
    showToast(`Added ${added} items`, "success", 4000);
    sendWebhookGeneral(urls, added, urls.length - added, origin);
};
incomingTogglePreview.onclick = () => {
    incomingPreviewRow.style.display = incomingPreviewRow.style.display === "none" ? "flex" : "none";
};
incomingReject.onclick = () => {
    pendingUrls = [];
    incomingTray.classList.add("hidden");
    incomingPreviewRow.innerHTML = "";
    showToast("Dismissed", "info");
};

// ════════════════════════════════════════════════════════
// TAGS
// ════════════════════════════════════════════════════════
function openTagModal(gif) { currentTagGif = gif; renderTagModal(); tagModal.classList.remove("hidden"); }
function renderTagModal() {
    if (!currentTagGif) return;
    tagList.innerHTML = "";
    (currentTagGif.tags || []).forEach(tag => {
        const chip = document.createElement("div"); chip.className = "tag-chip";
        chip.innerHTML = `${tag} <span class="remove-tag">✕</span>`;
        chip.querySelector(".remove-tag").onclick = () => removeTag(tag);
        tagList.appendChild(chip);
    });
    collectionList.innerHTML = "";
    (currentTagGif.collections || []).forEach(col => {
        const chip = document.createElement("div"); chip.className = "collection-chip";
        chip.innerHTML = `📁 ${col} <span class="remove-col">✕</span>`;
        chip.querySelector(".remove-col").onclick = () => removeCollection(col);
        collectionList.appendChild(chip);
    });
}
async function addTag() {
    const tag = tagInput.value.trim().toLowerCase();
    if (!tag || !currentTagGif) return;
    if (!currentTagGif.tags) currentTagGif.tags = [];
    if (currentTagGif.tags.includes(tag)) { showToast("Tag exists", "error"); return; }
    currentTagGif.tags.push(tag);
    await updateGifInDB(currentTagGif);
    const i = gifs.findIndex(g => g.id === currentTagGif.id); if (i > -1) gifs[i] = currentTagGif;
    tagInput.value = ""; renderTagModal(); renderCardTags(currentTagGif);
    showToast(`"${tag}" added`, "success");
}
async function removeTag(tag) {
    if (!currentTagGif) return;
    currentTagGif.tags = (currentTagGif.tags || []).filter(t => t !== tag);
    await updateGifInDB(currentTagGif);
    const i = gifs.findIndex(g => g.id === currentTagGif.id); if (i > -1) gifs[i] = currentTagGif;
    renderTagModal(); renderCardTags(currentTagGif);
}
async function addCollection() {
    const col = collectionInput.value.trim();
    if (!col || !currentTagGif) return;
    if (!currentTagGif.collections) currentTagGif.collections = [];
    if (currentTagGif.collections.includes(col)) { showToast("Already in collection", "error"); return; }
    currentTagGif.collections.push(col);
    await updateGifInDB(currentTagGif);
    const i = gifs.findIndex(g => g.id === currentTagGif.id); if (i > -1) gifs[i] = currentTagGif;
    collectionInput.value = ""; renderTagModal();
    showToast(`Added to "${col}"`, "success");
}
async function removeCollection(col) {
    if (!currentTagGif) return;
    currentTagGif.collections = (currentTagGif.collections || []).filter(c => c !== col);
    await updateGifInDB(currentTagGif);
    const i = gifs.findIndex(g => g.id === currentTagGif.id); if (i > -1) gifs[i] = currentTagGif;
    renderTagModal();
}
function renderCardTags(gif) {
    const card = gallery.querySelector(`[data-id="${gif.id}"]`); if (!card) return;
    let row = card.querySelector(".card-tag-row");
    if (!(gif.tags || []).length) { if (row) row.remove(); return; }
    if (!row) { row = document.createElement("div"); row.className = "card-tag-row"; card.appendChild(row); }
    row.innerHTML = gif.tags.map(t => `<span class="card-tag">${t}</span>`).join("");
}
tagAddBtn.onclick        = addTag;
tagCloseBtn.onclick      = () => tagModal.classList.add("hidden");
collectionAddBtn.onclick = addCollection;
tagInput.onkeydown       = e => { if (e.key === "Enter") addTag(); };
collectionInput.onkeydown = e => { if (e.key === "Enter") addCollection(); };

// ════════════════════════════════════════════════════════
// BULK MODE
// ════════════════════════════════════════════════════════
function enterBulkMode() {
    bulkMode = true; selectedIds.clear();
    gallery.classList.add("bulk-mode");
    bulkToolbar.classList.remove("hidden");
    bulkBtn.textContent = "✕ Exit Select";
    updateBulkCount();
}
function exitBulkMode() {
    bulkMode = false; selectedIds.clear();
    gallery.classList.remove("bulk-mode");
    bulkToolbar.classList.add("hidden");
    bulkBtn.textContent = "☑️ Select";
    document.querySelectorAll(".card-checkbox").forEach(c => c.classList.remove("checked"));
    document.querySelectorAll(".card.selected").forEach(c => c.classList.remove("selected"));
}
function updateBulkCount() { bulkCount.textContent = `${selectedIds.size} selected`; }
function toggleCardSelect(id) {
    const card = gallery.querySelector(`[data-id="${id}"]`);
    const cb   = card?.querySelector(".card-checkbox");
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
        cb?.classList.remove("checked");
        card?.classList.remove("selected");
    } else {
        selectedIds.add(id);
        cb?.classList.add("checked");
        card?.classList.add("selected");
    }
    updateBulkCount();
}
bulkBtn.onclick = () => { if (bulkMode) exitBulkMode(); else enterBulkMode(); };
bulkCancel.onclick = exitBulkMode;
bulkSelectAll.onclick = () => {
    const allIds = filtered.map(g => g.id);
    const allSel = allIds.every(id => selectedIds.has(id));
    allIds.forEach(id => {
        const card = gallery.querySelector(`[data-id="${id}"]`);
        const cb   = card?.querySelector(".card-checkbox");
        if (allSel) {
            selectedIds.delete(id); cb?.classList.remove("checked"); card?.classList.remove("selected");
        } else {
            selectedIds.add(id); cb?.classList.add("checked"); card?.classList.add("selected");
        }
    });
    updateBulkCount();
};
bulkDelete.onclick = async () => {
    if (!selectedIds.size) { showToast("Nothing selected", "error"); return; }
    if (!confirm(`Delete ${selectedIds.size} items?`)) return;
    const ids = [...selectedIds];
    await deleteManyFromDB(ids);
    gifs = await getAllGifs();
    buildFuseIndex();
    exitBulkMode();
    applyFilters();
    showToast(`Deleted ${ids.length} items`, "success");
};
bulkExport.onclick = () => {
    if (!selectedIds.size) { showToast("Nothing selected", "error"); return; }
    const urls = gifs.filter(g => selectedIds.has(g.id)).map(g => g.url);
    const blob  = new Blob([JSON.stringify(urls, null, 2)], { type: "application/json" });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href = url; a.download = `selected-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${urls.length} URLs`, "success");
};

// ════════════════════════════════════════════════════════
// GRID SLIDER — debounced 120ms
// ════════════════════════════════════════════════════════
const debouncedSlider = debounce(() => { applyGalleryLayout(); }, 120);
gridSlider.oninput = () => debouncedSlider();

// ════════════════════════════════════════════════════════
// CONTEXT MENU — vault (event delegation)
// ════════════════════════════════════════════════════════
function showContextMenu(e, gif) {
    e.preventDefault();
    contextTarget = gif;
    contextMenu.style.left = `${Math.min(e.clientX, window.innerWidth  - 170)}px`;
    contextMenu.style.top  = `${Math.min(e.clientY, window.innerHeight - 270)}px`;
    contextMenu.classList.remove("hidden");
}
function hideContextMenu() {
    contextMenu.classList.add("hidden");
    contextTarget = null;
}

// Delegated contextmenu on gallery
gallery.addEventListener("contextmenu", e => {
    const card = e.target.closest(".card[data-id]");
    if (!card) return;
    const id  = parseInt(card.dataset.id);
    const gif = gifs.find(g => g.id === id);
    if (gif) showContextMenu(e, gif);
});

// Delegated click on gallery
gallery.addEventListener("click", e => {
    const card = e.target.closest(".card[data-id]");
    if (!card) return;
    if (e.target.classList.contains("card-checkbox")) return;
    const id  = parseInt(card.dataset.id);
    const gif = gifs.find(g => g.id === id);
    if (!gif) return;
    if (bulkMode) toggleCardSelect(id);
    else openModal(gif);
});

ctxView.onclick     = () => { if (contextTarget) openModal(contextTarget);    hideContextMenu(); };
ctxCopy.onclick     = () => { if (contextTarget) copyUrl(contextTarget.url);  hideContextMenu(); };
ctxTag.onclick      = () => { if (contextTarget) openTagModal(contextTarget); hideContextMenu(); };
ctxSelect.onclick   = () => { if (!bulkMode) enterBulkMode(); if (contextTarget) toggleCardSelect(contextTarget.id); hideContextMenu(); };
ctxDelete.onclick   = async () => { if (contextTarget) await deleteGif(contextTarget.id); hideContextMenu(); };
ctxDownload.onclick = () => {
    if (!contextTarget) return;
    const a = document.createElement("a");
    a.href     = contextTarget.url;
    a.download = `media-${Date.now()}.${contextTarget.type}`;
    a.target   = "_blank";
    a.click();
    hideContextMenu();
};

// Global click — close both context menus
document.addEventListener("click", e => {
    if (!contextMenu.classList.contains("hidden") && !contextMenu.contains(e.target)) {
        hideContextMenu();
    }
    const rMenu = el("redditContextMenu");
    if (rMenu && !rMenu.classList.contains("hidden") && !rMenu.contains(e.target)) {
        rMenu.classList.add("hidden");
        redditCtxTarget = null;
    }
});

// Reddit context menu actions
document.addEventListener("click", e => {
    const btn = e.target.closest("[data-reddit-ctx]");
    if (!btn || !redditCtxTarget) return;
    const action = btn.dataset.redditCtx;
    const { url, type, sub, isEmbed } = redditCtxTarget;
    if (action === "open") window.open(url, "_blank");
    if (action === "copy") copyUrl(url);
    if (action === "save") {
        if (!saveToVaultEnabled) { showToast("Save to Vault is OFF", "info"); return; }
        if (!isEmbed) {
            addGifsToDB([url], `reddit.com/r/${sub}`).then(async added => {
                gifs = await getAllGifs();
                buildFuseIndex();
                updateStats();
                showToast(added > 0 ? "Saved!" : "Already in vault", added > 0 ? "success" : "info");
            });
        } else {
            showToast("Can't save embed — open original", "info");
        }
    }
    const rMenu = el("redditContextMenu");
    if (rMenu) rMenu.classList.add("hidden");
    redditCtxTarget = null;
});

// ════════════════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════════════════
function exportUrlsOnly() {
    const blob = new Blob([JSON.stringify(gifs.map(g => g.url), null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `gif-vault-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${gifs.length} URLs`, "success");
}
function exportAsDiscordSettings() {
    if (!lastRawSettings) { showToast("No original import", "error", 4000); return; }
    const ne = JSON.parse(JSON.stringify(lastRawSettings));
    ne.settings     = btoa(gifs.map(g => g.url).join("\n"));
    ne._vaultExport = true;
    ne._exportedAt  = new Date().toISOString();
    ne._gifCount    = gifs.length;
    const blob = new Blob([JSON.stringify(ne, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `discord-cleaned-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported (${gifs.length} items)`, "success", 4000);
}
exportBtn.onclick = () => {
    if (gifs.length === 0) { showToast("Nothing to export", "error"); return; }
    const ex = document.getElementById("exportMenu");
    if (ex) { ex.remove(); return; }
    const menu = document.createElement("div");
    menu.id = "exportMenu";
    menu.style.cssText = "position:fixed;top:68px;right:18px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:7px;z-index:9999;display:flex;flex-direction:column;gap:5px;box-shadow:var(--shadow);min-width:240px;";
    const o1 = document.createElement("button");
    o1.className = "btn btn-secondary";
    o1.textContent = "⬇️ Export URLs only";
    o1.style.justifyContent = "flex-start";
    o1.onclick = () => { exportUrlsOnly(); menu.remove(); };
    const o2 = document.createElement("button");
    o2.className = "btn btn-primary";
    o2.textContent = "🔄 Export as Discord Settings";
    o2.style.justifyContent = "flex-start";
    o2.onclick = () => { exportAsDiscordSettings(); menu.remove(); };
    menu.append(o1, o2);
    document.body.appendChild(menu);
    setTimeout(() => {
        document.addEventListener("click", function h(e) {
            if (!menu.contains(e.target) && e.target !== exportBtn) {
                menu.remove();
                document.removeEventListener("click", h);
            }
        });
    }, 10);
};

// ════════════════════════════════════════════════════════
// FILTER / SORT / SEARCH
// ════════════════════════════════════════════════════════
function applyFilters() {
    let result;

    if (searchQuery.trim() && fuseInstance) {
        result = fuzzySearch(searchQuery);
    } else {
        result = [...gifs];
    }

    if (activeFilter !== "all") {
        result = result.filter(g => g.type === activeFilter);
    }

    if (activeSort === "newest")      result.sort((a, b) => b.addedAt - a.addedAt);
    else if (activeSort === "oldest") result.sort((a, b) => a.addedAt - b.addedAt);
    else if (activeSort === "type")   result.sort((a, b) => a.type.localeCompare(b.type));

    filtered = result;
    rendered = 0;
    scheduleRender(() => renderGallery(true));
    updateStats();
}

// ════════════════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════════════════
function updateStats() {
    gifCount.textContent = `${gifs.length} item${gifs.length !== 1 ? "s" : ""}`;
    const c = {};
    gifs.forEach(g => { c[g.type] = (c[g.type] || 0) + 1; });
    statGif.textContent   = `GIF: ${c.gif   || 0}`;
    statWebm.textContent  = `WEBM: ${c.webm  || 0}`;
    statMp4.textContent   = `MP4: ${c.mp4   || 0}`;
    statOther.textContent = `Other: ${(c.webp || 0) + (c.png || 0) + (c.jpg || 0) + (c.other || 0)}`;
    statVisible.textContent = `Showing: ${Math.min(rendered, filtered.length)} / ${filtered.length}`;
}

// ════════════════════════════════════════════════════════
// RENDER GALLERY
// ════════════════════════════════════════════════════════
function renderGallery(reset = false) {
    if (reset) {
        gallery.querySelectorAll("video, iframe").forEach(el2 => mediaObserver.unobserve(el2));
        gallery.innerHTML = "";
        rendered = 0;
        applyGalleryLayout();
    }

    if (filtered.length === 0) {
        gallery.classList.add("empty-state");
        gallery.innerHTML = `
            <div class="empty-message">
                <span class="empty-icon">🗃️</span>
                <h2>${gifs.length === 0 ? "Your vault is empty" : "No results found"}</h2>
                <p>${gifs.length === 0 ? "Click Import to load your Discord GIF favorites." : "Try a different search or filter."}</p>
            </div>`;
        loadMoreWrap.classList.add("hidden");
        updateStats();
        return;
    }

    gallery.classList.remove("empty-state");
    const slice = filtered.slice(rendered, rendered + PAGE_SIZE);

    const frag = document.createDocumentFragment();
    slice.forEach(gif => frag.appendChild(createCard(gif)));
    gallery.appendChild(frag);

    rendered += slice.length;

    if (rendered < filtered.length) {
        loadMoreWrap.classList.remove("hidden");
        loadMoreBtn.textContent = `Load More (${filtered.length - rendered} remaining)`;
    } else {
        loadMoreWrap.classList.add("hidden");
    }
    updateStats();
}

// ════════════════════════════════════════════════════════
// CREATE VAULT CARD — no hover overlay, right-click only
// ════════════════════════════════════════════════════════
function createCard(gif) {
    const card = document.createElement("div");
    card.className  = "card";
    card.dataset.id  = gif.id;
    card.dataset.url = gif.url;
    if (deadIds.has(gif.id)) card.classList.add("dead-link");

    // Checkbox
    const cb = document.createElement("div");
    cb.className   = "card-checkbox";
    cb.textContent = "✓";
    if (selectedIds.has(gif.id)) cb.classList.add("checked");
    cb.onclick = e => { e.stopPropagation(); if (bulkMode) toggleCardSelect(gif.id); };

    // Type badge
    const badge = document.createElement("div");
    badge.className   = `card-source-badge type-${gif.type}`;
    badge.textContent = gif.type.toUpperCase();

    card.append(cb, badge);

    // Origin badge
    if (gif.origin && gif.origin.includes("reddit")) {
        const ob = document.createElement("div");
        ob.className = "card-origin-badge";
        try { ob.textContent = `📡 ${new URL(gif.origin).hostname}`; }
        catch(e) { ob.textContent = "📡 reddit"; }
        card.appendChild(ob);
    }

    if (deadIds.has(gif.id)) {
        const db2 = document.createElement("div");
        db2.className   = "dead-badge";
        db2.textContent = "💀 DEAD";
        card.appendChild(db2);
    }

    // Media
    if (gif.type === "webm" || gif.type === "mp4") {
        const wrapper = document.createElement("div");
        wrapper.className = "video-wrapper";

        const vid = document.createElement("video");
        vid.controls    = true;
        vid.loop        = true;
        vid.muted       = true;
        vid.playsInline = true;
        vid.preload     = "none";
        vid.style.cssText = "width:100%;display:block;";
        // Lazy — observer sets src when visible
        vid.dataset.src = gif.url;

        const unmuteBtn = document.createElement("button");
        unmuteBtn.className   = "unmute-btn";
        unmuteBtn.textContent = "🔇 Unmute";
        unmuteBtn.onclick = e => {
            e.stopPropagation();
            vid.muted = !vid.muted;
            if (!vid.muted && vid.volume === 0) vid.volume = 1;
            unmuteBtn.textContent = vid.muted ? "🔇 Unmute" : "🔊 Muted";
        };
        vid.onvolumechange = () => {
            unmuteBtn.textContent = vid.muted ? "🔇 Unmute" : "🔊 Muted";
        };
        vid.onerror = () => { wrapper.style.opacity = "0.4"; };

        wrapper.appendChild(vid);
        wrapper.appendChild(unmuteBtn);
        mediaObserver.observe(vid);
        card.appendChild(wrapper);

    } else {
        // Images — src set directly, browser handles lazy natively
        const wrapper = document.createElement("div");
        wrapper.className = "img-wrapper";

        const img = document.createElement("img");
        img.loading  = "lazy";
        img.decoding = "async";
        img.src      = gif.url;
        img.alt      = gif.type;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
        img.onerror  = () => { wrapper.style.display = "none"; };

        wrapper.appendChild(img);
        card.appendChild(wrapper);
    }

    // Tags row
    if ((gif.tags || []).length > 0) {
        const row = document.createElement("div");
        row.className = "card-tag-row";
        row.innerHTML = gif.tags.map(t => `<span class="card-tag">${t}</span>`).join("");
        card.appendChild(row);
    }

    return card;
}

// ════════════════════════════════════════════════════════
// MODAL
// ════════════════════════════════════════════════════════
function openModal(gif) {
    modalIndex = filtered.findIndex(g => g.id === gif.id);
    if (modalIndex === -1) modalIndex = 0;
    showModalAt(modalIndex);
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}
function showModalAt(index) {
    const gif = filtered[index]; if (!gif) return;
    modalImg.src = "";
    const oldVid = document.getElementById("modalVideo");
    if (oldVid) oldVid.remove();

    if (gif.type === "webm" || gif.type === "mp4") {
        modalImg.style.display = "none";
        const vid = document.createElement("video");
        vid.id          = "modalVideo";
        vid.controls    = true;
        vid.loop        = true;
        vid.muted       = false;
        vid.autoplay    = true;
        vid.playsInline = true;
        vid.preload     = "auto";
        vid.volume      = 1;
        vid.style.cssText = "max-width:80vw;max-height:62vh;border-radius:14px;background:var(--bg3);";
        const src  = document.createElement("source");
        src.src  = gif.url;
        src.type = gif.type === "webm" ? "video/webm" : "video/mp4";
        vid.appendChild(src);
        modalImg.insertAdjacentElement("afterend", vid);
    } else {
        modalImg.style.display = "";
        modalImg.src = gif.url;
    }

    modalIndex_el.textContent = `${index + 1} / ${filtered.length}`;
    modalIndex = index;
    modalTagsEl.innerHTML = "";
    (gif.tags || []).forEach(tag => {
        const chip = document.createElement("span");
        chip.className   = "card-tag";
        chip.textContent = tag;
        modalTagsEl.appendChild(chip);
    });
}
function closeModal() {
    modal.classList.add("hidden");
    modalImg.src = "";
    modalImg.style.display = "";
    document.body.style.overflow = "";
    const vid = document.getElementById("modalVideo");
    if (vid) vid.remove();
}
modalClose.onclick    = closeModal;
modalBackdrop.onclick = closeModal;
modalPrev.onclick     = () => { if (modalIndex > 0) showModalAt(modalIndex - 1); };
modalNext.onclick     = () => { if (modalIndex < filtered.length - 1) showModalAt(modalIndex + 1); };
modalOpen.onclick     = () => window.open(filtered[modalIndex]?.url, "_blank");
modalCopy.onclick     = () => copyUrl(filtered[modalIndex]?.url);
modalAddTag.onclick   = () => { const g = filtered[modalIndex]; if (g) { closeModal(); openTagModal(g); } };
modalDownload.onclick = () => {
    const gif = filtered[modalIndex]; if (!gif) return;
    const a = document.createElement("a");
    a.href     = gif.url;
    a.download = `media-${Date.now()}.${gif.type}`;
    a.target   = "_blank";
    a.click();
    showToast("Download started", "success");
};
modalDelete.onclick = () => {
    const gif = filtered[modalIndex]; if (!gif) return;
    deleteGif(gif.id); closeModal();
};

// ════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ════════════════════════════════════════════════════════
document.addEventListener("keydown", e => {
    const tag     = document.activeElement.tagName.toLowerCase();
    const inInput = tag === "input" || tag === "textarea" || tag === "select";
    const isOpen  = !modal.classList.contains("hidden");

    if (e.key === "Escape") {
        if (isOpen) closeModal();
        else if (!tagModal.classList.contains("hidden"))       tagModal.classList.add("hidden");
        else if (!importModal.classList.contains("hidden"))    importModal.classList.add("hidden");
        else if (!shortcutsPanel.classList.contains("hidden")) shortcutsPanel.classList.add("hidden");
        else hideContextMenu();
        return;
    }
    if (e.key === "?" && !inInput) { shortcutsPanel.classList.toggle("hidden"); return; }
    if (e.key === "/" && !inInput) { e.preventDefault(); searchInput.focus(); return; }
    if (isOpen) {
        if (e.key === "ArrowLeft")          modalPrev.click();
        if (e.key === "ArrowRight")         modalNext.click();
        if (e.key === "d" || e.key === "D") modalDelete.click();
        if (e.key === "c" || e.key === "C") modalCopy.click();
        if (e.key === "t" || e.key === "T") modalAddTag.click();
    }
});
shortcutsFab.onclick   = () => shortcutsPanel.classList.toggle("hidden");
shortcutsClose.onclick = () => shortcutsPanel.classList.add("hidden");

// ════════════════════════════════════════════════════════
// COPY / DELETE / CLEAR
// ════════════════════════════════════════════════════════
function copyUrl(url) {
    if (!url) return;
    navigator.clipboard.writeText(url)
        .then(() => showToast("Copied!", "success"))
        .catch(() => {
            const ta = document.createElement("textarea");
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            showToast("Copied!", "success");
        });
}
async function deleteGif(id) {
    await deleteGifFromDB(id);
    gifs = gifs.filter(g => g.id !== id);
    buildFuseIndex();
    const card = gallery.querySelector(`[data-id="${id}"]`);
    if (card) {
        card.querySelectorAll("video, iframe").forEach(el2 => mediaObserver.unobserve(el2));
        card.style.transition = "opacity .18s,transform .18s";
        card.style.opacity    = "0";
        card.style.transform  = "scale(0.92)";
        setTimeout(() => { if (card.parentNode) card.remove(); }, 200);
    }
    applyFilters();
    showToast("Removed", "info");
}
clearBtn.onclick = async () => {
    if (!confirm(`Delete all ${gifs.length} items?`)) return;
    gallery.querySelectorAll("video, iframe").forEach(el2 => mediaObserver.unobserve(el2));
    await clearAllGifsDB();
    gifs = []; filtered = [];
    fuseInstance = null;
    renderGallery(true);
    updateStats();
    showToast("Vault cleared", "info");
};

// ════════════════════════════════════════════════════════
// BUTTON WIRING
// ════════════════════════════════════════════════════════
dupeBtn.onclick = findAndRemoveDupes;
deadBtn.onclick = checkDeadLinks;
zipBtn.onclick  = downloadZip;

// ════════════════════════════════════════════════════════
// IMPORT
// ════════════════════════════════════════════════════════
importBtn.onclick = () => {
    importTextarea.value = "";
    importInfo.textContent = "";
    importInfo.className = "import-info";
    importModal.classList.remove("hidden");
    importTextarea.focus();
};
importCancelBtn.onclick = () => importModal.classList.add("hidden");
importTextarea.oninput = () => {
    const raw = importTextarea.value.trim();
    if (!raw) { importInfo.textContent = ""; importInfo.className = "import-info"; return; }
    try {
        if (raw.startsWith("[")) {
            const arr = JSON.parse(raw);
            importInfo.textContent = `✅ URL list — ${arr.length} entries`;
            importInfo.className = "import-info good"; return;
        }
        const parsed = JSON.parse(raw);
        if (parsed.settings) {
            const preview = decodeBlob(parsed.settings);
            importInfo.textContent = `✅ Discord export — ~${preview.length} media URLs`;
            importInfo.className = "import-info good";
        } else {
            importInfo.textContent = "⚠️ No 'settings' field";
            importInfo.className = "import-info bad";
        }
    } catch { importInfo.textContent = "⏳ Waiting for complete JSON..."; importInfo.className = "import-info"; }
};
importConfirmBtn.onclick = async () => {
    const raw = importTextarea.value.trim();
    if (!raw) { showToast("Nothing pasted", "error"); return; }
    let urls = [];
    const rawContent = raw;
    try {
        if (raw.startsWith("[")) {
            urls = JSON.parse(raw).filter(u => typeof u === "string");
        } else {
            const parsed = JSON.parse(raw);
            if (!parsed.settings) { showToast("No settings field", "error"); return; }
            lastRawSettings = parsed;
            urls = decodeBlob(parsed.settings);
        }
    } catch { showToast("Invalid JSON", "error"); return; }
    if (urls.length === 0) { showToast("No media URLs found", "error"); return; }
    importConfirmBtn.textContent = "Importing...";
    importConfirmBtn.disabled    = true;
    importInfo.textContent = `Processing ${urls.length} URLs...`;
    importInfo.className   = "import-info good";
    const added   = await addGifsToDB(urls, null);
    const skipped = urls.length - added;
    gifs = await getAllGifs();
    buildFuseIndex();
    hideProgress();
    importModal.classList.add("hidden");
    importConfirmBtn.textContent = "Import";
    importConfirmBtn.disabled    = false;
    applyFilters();
    showToast(`Done — ${added} added (${skipped} dupes)`, "success", 5000);
    sendWebhookImport(rawContent, urls, added, skipped);
};

// ════════════════════════════════════════════════════════
// SEARCH / SORT / FILTER — debounced
// ════════════════════════════════════════════════════════
const debouncedSearch = debounce(() => {
    searchQuery = searchInput.value;
    applyFilters();
}, 250);

searchInput.oninput = () => debouncedSearch();
sortSelect.onchange = () => { activeSort = sortSelect.value; applyFilters(); };

filterBtns.forEach(btn => {
    btn.onclick = () => {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.filter;
        applyFilters();
    };
});

loadMoreBtn.onclick = () => renderGallery(false);

const vaultObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting && rendered < filtered.length) {
            scheduleRender(() => renderGallery(false));
        }
    });
}, { threshold: 0.1 });
if (loadMoreBtn) vaultObserver.observe(loadMoreBtn);

// ════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════
async function init() {
    try {
        injectRedditUI();
        initSaveToggle();
        initLayoutToggle();
        initMaxVideosInput();
        await openDB();
        gifs = await getAllGifs();
        buildFuseIndex();
        applyFilters();
        startPolling();
        renderSavedSubs();
        applyGalleryLayout();
        console.log(`GIF Vault v10 loaded — ${gifs.length} items`);
    } catch(e) {
        console.error("Init failed:", e);
        showToast("DB error: " + e.message, "error", 8000);
    }
}
init();
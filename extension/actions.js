let CURRENT_CHAT_ID;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Extension loaded');

    await initializeApp();
    setupOriginalChatInterface();
});

/***/
function normalizeYouTubeUrl(raw) {
    try {
        const u = new URL(raw);
        // youtu.be → watch
        if (u.hostname.includes("youtu.be")) {
            return `https://www.youtube.com/watch?v=${u.pathname.slice(1)}${u.search}`;
        }
        // Shorts → watch
        if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/shorts/")) {
            const id = u.pathname.split("/")[2];
            const t = u.searchParams.get("t");
            return `https://www.youtube.com/watch?v=${id}${t ? `&t=${t}` : ""}`;
        }
        // Embed → watch
        if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/embed/")) {
            const id = u.pathname.split("/")[2];
            const t = u.searchParams.get("start") || u.searchParams.get("t");
            return `https://www.youtube.com/watch?v=${id}${t ? `&t=${t}` : ""}`;
        }
        return raw;
    } catch {
        return raw;
    }
}

async function getCanonicalFromTab(tabId) {
    const [{ result } = {}] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.querySelector('link[rel="canonical"]')?.href || location.href
    });
    return result || "";
}

// --- Detect common doc-like extensions
const DOC_LIKE_RE = /\.(docx?|pptx?|xlsx?)($|[?#])/i;

// Try to unwrap common viewers/wrappers to the actual file URL
function tryExtractDocLikeFromViewer(raw) {
    try {
        const u = new URL(raw);

        // 1) Google Docs Viewer: https://docs.google.com/gview?embedded=1&url=<encoded>
        if (u.hostname.endsWith("docs.google.com") && u.pathname === "/gview") {
            const src = u.searchParams.get("url");
            if (src) return decodeURIComponent(src);
        }

        // 2) Office Online Viewer: https://view.officeapps.live.com/op/view.aspx?src=<encoded>
        if (u.hostname.includes("officeapps.live.com")) {
            const src = u.searchParams.get("src");
            if (src) return decodeURIComponent(src);
        }

        // 3) Dropbox share → direct download (if desired)
        //   www.dropbox.com/s/<id>/<name>.docx?dl=0  → dl=1
        if (u.hostname.endsWith("dropbox.com")) {
            if (u.searchParams.get("dl") === "0") {
                u.searchParams.set("dl", "1");
                return u.toString();
            }
        }

        // 4) Google Drive preview: https://drive.google.com/file/d/<ID>/view
        //    Convert to a direct-ish download link (works if file is public)
        if (u.hostname === "drive.google.com" && u.pathname.startsWith("/file/d/")) {
            const id = u.pathname.split("/")[3];
            if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
        }

        // 5) OneDrive/SharePoint web viewer:
        //    many links have query ?web=1; replacing with ?download=1 usually forces file download
        if (u.hostname.includes("sharepoint.com") || u.hostname.includes("onedrive.live.com")) {
            if (u.searchParams.has("web")) {
                u.searchParams.delete("web");
                u.searchParams.set("download", "1");
                return u.toString();
            }
            // Some shared links use ":w:" style paths; appending ?download=1 often works:
            if (!u.searchParams.has("download")) {
                u.searchParams.set("download", "1");
                return u.toString();
            }
        }

        return raw;
    } catch {
        return raw;
    }
}

// Probe the page DOM for a direct .docx/.pptx/.xlsx link (or canonical)
async function probePageForDocLike(tabId) {
    const [{ result } = {}] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const pick = (el) => el?.src || el?.href || el?.data || null;

            const canonical = document.querySelector('link[rel="canonical"]')?.href || null;

            // Common containers/anchors that might hold direct file URLs
            const candidates = [
                document.querySelector('a[href$=".docx"], a[href$=".doc"], a[href*=".docx?"], a[href*=".doc?"]'),
                document.querySelector('a[href$=".pptx"], a[href$=".ppt"], a[href*=".pptx?"], a[href*=".ppt?"]'),
                document.querySelector('a[href$=".xlsx"], a[href$=".xls"], a[href*=".xlsx?"], a[href*=".xls?"]'),
                document.querySelector('iframe[src*=".docx"], iframe[src*=".doc"], iframe[src*=".pptx"], iframe[src*=".xlsx"]'),
                document.querySelector('embed[src*=".docx"], embed[src*=".doc"], embed[src*=".pptx"], embed[src*=".xlsx"]'),
                document.querySelector('object[data*=".docx"], object[data*=".doc"], object[data*=".pptx"], object[data*=".xlsx"]'),
            ].filter(Boolean);

            const firstDocLike = candidates.map(pick).find(Boolean) || null;

            // Fallback: Open Graph URL often points to the canonical share link
            const og = document.querySelector('meta[property="og:url"]')?.content || null;

            return { canonical, firstDocLike, og, href: location.href };
        },
    });

    return result || {};
}

// Public resolver you can call for DOCX/PPTX/XLSX (and it still works for regular URLs)
async function resolveUrlFromExtensionUI() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return "";

    // Start with address bar
    let url = tab.url || "";

    // Unwrap common viewers
    url = tryExtractDocLikeFromViewer(url);

    // Probe inside the page (requires activeTab + user gesture)
    try {
        const { canonical, firstDocLike, og, href } = await probePageForDocLike(tab.id);

        // Prefer a direct doc-like URL if we find one in the DOM
        if (firstDocLike && DOC_LIKE_RE.test(firstDocLike)) return firstDocLike;

        // If canonical is doc-like, take it
        if (canonical && DOC_LIKE_RE.test(canonical)) return canonical;

        // OG URL sometimes cleaner than address bar
        if (og && DOC_LIKE_RE.test(og)) return og;

        // If none match doc-like, still prefer canonical/og for stability
        if (canonical) return canonical;
        if (og) return og;

        // Fallbacks
        return url || href || "";
    } catch {
        // If we can't inject/execute, fallback to unwrapped address bar
        return url;
    }
}

async function resolveYouTubeUrlFromExtensionUI() {
    // Called from popup/sidepanel/background (not from the page)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let url = tab?.url || "";
    if (!url) return "";

    // Prefer canonical from the page DOM when possible
    try {
        const canonical = await getCanonicalFromTab(tab.id);
        if (canonical) url = canonical;
    } catch {
        /* ignore, fall back to tab.url */
    }
    return normalizeYouTubeUrl(url);
}

/***/

let isAuthenticated = false;
let currentUser = null;

async function initializeApp() {
    try {
        showAuthStatus('Checking authentication...');

        const response = await chrome.runtime.sendMessage({action: 'getAuthStatus'});
        console.log(response)
        if (response.authenticated) {
            isAuthenticated = true;
            currentUser = response.user;
            showAuthStatus(`${currentUser.name || currentUser.email}`);
            showLandingScreen()
            enableChatInterface()
        } else {
            await chrome.runtime.sendMessage({action: 'logout'});
            isAuthenticated = false;
            currentUser = null;
            showAuthStatus('Logged out');
            showLoginPrompt();
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
    }
}

function showAuthStatus(message) {
    const statusElement = document.querySelector('.status-indicator');
    if (statusElement) {
        statusElement.innerHTML = `
            <div class="status-dot"></div>
            <span>${message}</span>
        `;
    }
}

function showLoginPrompt() {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = `
        <div class="auth-prompt">
            <div class="auth-card">
                <div class="auth-icon">
                    <img src="./images/lock_100dp_E3E3E3_FILL0_wght400_GRAD0_opsz48.png" alt="Lock Icon">
                </div>
                <h3>Authentication Required</h3>
                <p>Please authenticate with Google to use NUVIA AI Assistant</p>
                <button id="auth-continue-btn" class="auth-btn">
                    <img src="./images/google-logo.jpg" alt="Google Logo">
                    Continue with Google
                </button>
            </div>
        </div>
    `;

    if (!document.getElementById('auth-styles')) {
        const style = document.createElement('style');
        style.id = 'auth-styles';
        style.textContent = `
            .auth-prompt {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh; /* full vertical center */
                padding: 40px 20px;
            }
            
            .auth-card {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 20px;
                padding: 40px 30px;
                text-align: center;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                max-width: 320px;
                width: 100%;
            }
            
            .auth-icon img {
                display: block;
                margin: 0 auto 20px;
                width: 60px;
                height: 60px;
                opacity: 0.9;
            }
            
            .auth-card h3 {
                color: #ffffff;
                margin-bottom: 15px;
                font-size: 20px;
                font-weight: 600;
            }
            
            .auth-card p {
                color: rgba(255, 255, 255, 0.8);
                margin-bottom: 25px;
                line-height: 1.5;
                font-size: 14px;
            }
            
            .auth-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                background: black;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                width: 100%;
                margin-bottom: 10px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            }
            
            .auth-btn img {
                width: 33px;
                height: 33px;
                object-fit: contain;
            }
            
            .auth-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            }
            
            .auth-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
        `;
        document.head.appendChild(style);
    }

    const loginBtn = document.getElementById('auth-continue-btn');

    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    disableChatInterface('Please authenticate to use chat');
}

async function handleLogin() {
    const loginBtn = document.getElementById('auth-continue-btn');
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Opening Google Auth...';
    }

    try {
        await chrome.runtime.sendMessage({action: 'login'});
    } catch (error) {
        console.error('Login error:', error);
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Continue with Google';
        }
    }
}

async function handleLogout() {
    try {
        await chrome.runtime.sendMessage({action: 'logout'});
        isAuthenticated = false;
        currentUser = null;
        showAuthStatus('Logged out');
        showLoginPrompt();
        return document.getElementById('logout-btn').remove();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function disableChatInterface(message) {
    const inputElement = document.getElementById('customInput');
    const sendButton = document.getElementById('send-btn');
    if (inputElement) {
        inputElement.disabled = true;
        inputElement.placeholder = message;
    }

    if (sendButton) {
        sendButton.disabled = true;
    }
}

function enableChatInterface() {
    const inputElement = document.getElementById('customInput');
    const sendButton = document.getElementById('send-btn');

    if (inputElement) {
        inputElement.disabled = false;
        inputElement.placeholder = 'Ask anything...';
    }

    if (sendButton) {
        sendButton.disabled = false;
    }
}

function addLogoutOption() {
    const header = document.querySelector('.header');
    if (header && !document.getElementById('logout-btn') && currentUser) {
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-btn';
        logoutBtn.innerHTML = 'Logout';
        logoutBtn.title = 'Logout';
        logoutBtn.style.cssText = `
            position: absolute;
            z-index: 2;
            top: 15px;
            left: 20px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 6px;
            padding: 6px 8px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        `;

        logoutBtn.addEventListener('click', handleLogout);
        logoutBtn.addEventListener('mouseenter', () => {
            logoutBtn.style.background = 'rgba(220, 53, 69, 0.8)';
        });
        logoutBtn.addEventListener('mouseleave', () => {
            logoutBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        });

        header.appendChild(logoutBtn);
    }
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'loginSuccess') {
        isAuthenticated = true;
        currentUser = message.user;
        showAuthStatus(`Authenticated as ${currentUser.name || currentUser.email}`);
        showLandingScreen()
        addLogoutOption();
    }
});

function setupOriginalChatInterface() {
    document.getElementById("send-btn").addEventListener("click", async () => {
        if (!isAuthenticated) {
            showLoginPrompt();
            return;
        }

        const input = document.getElementById("customInput");
        const sendBtn = document.getElementById("send-btn");
        const prompt = input.value;
        if (!prompt) return;

        sendBtn.disabled = true;
        sendBtn.textContent = "Thinking...";
        input.disabled = true;

        try {
            const endpoint = currentChatId
                ? `http://localhost:8080/api/gemini/generate/${CURRENT_CHAT_ID}`
                : "http://localhost:8080/api/gemini/generate";

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain",
                    ...(currentUser ? {"Authorization": await getAuthHeader()} : {})
                },
                body: prompt
            });

            const text = await response.text();

            if (text === 'SUMMARIZATION' || text === 'VIDEO' || text === 'DOCUMENT') {
                await generateSpecialContent(text);
            }

        } catch (err) {
            console.error("Error:", err);
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = "Send";
            input.disabled = false;
        }
        loadSpecificChat(CURRENT_CHAT_ID)
        input.value = "";
    });

    if (isAuthenticated) {
        enableChatInterface();
        addLogoutOption();
    }
}

async function getAuthHeader() {
    try {
        const tokens = await chrome.storage.local.get(['accessToken']);
        return tokens.accessToken ? `Bearer ${tokens.accessToken}` : '';
    } catch (error) {
        return '';
    }
}

async function generateSpecialContent(type) {
    console.log("GENERATE SPECIAL CONTENT WITH TYPE ", type);

    if(type === 'SUMMARIZATION') {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs.length) return console.error("No active tab.");

            const tabId = tabs[0].id;

            chrome.scripting.executeScript({
                target: {tabId},
                files: ["contentScript.js"]
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Script injection failed:", chrome.runtime.lastError.message);
                    return;
                }
                chrome.tabs.sendMessage(
                    tabId,
                    {type: "SUMMARIZATION"},
                    async (response) => {
                        if (!response || !response.text) {
                            console.error("No response or missing .text");
                            return;
                        }

                        const payload = type + "###" + response.text;

                        try {
                            const authHeader = await getAuthHeader();

                            const endpoint = currentChatId
                                ? `http://localhost:8080/api/gemini/generate-special/${currentChatId}`
                                : "http://localhost:8080/api/gemini/generate-special";

                            const result = await fetch(endpoint, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "text/plain",
                                    ...(authHeader ? {"Authorization": authHeader} : {})
                                },
                                body: payload
                            });

                            const responseText = await result.text();
                            console.log("Gemini response:", responseText);
                            loadSpecificChat(CURRENT_CHAT_ID)
                        } catch (error) {
                            console.error("Error in generateSpecialContent:", error);
                        }
                        loadSpecificChat(CURRENT_CHAT_ID)
                    }
                );
            });
        });
    }
    else if (type === 'VIDEO') {
        // If this code runs in popup/sidepanel/background:
        const videoUrl = await resolveYouTubeUrlFromExtensionUI();

        // If it runs as a content script on youtube.com, use:
        // const videoUrl = normalizeYouTubeUrl(
        //   document.querySelector('link[rel="canonical"]')?.href || location.href
        // );

        if (!/^https?:\/\/(www\.)?youtube\.com|https?:\/\/youtu\.be/.test(videoUrl)) {
            console.warn("Not a YouTube URL. Open a video tab first.");
            return;
        }

        const payload = `${type}###${videoUrl}`;

        try {
            const authHeader = await getAuthHeader();
            const endpoint = currentChatId
                ? `http://localhost:8080/api/gemini/generate-special/${currentChatId}`
                : "http://localhost:8080/api/gemini/generate-special";

            const result = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain",
                    ...(authHeader ? { "Authorization": authHeader } : {})
                },
                body: payload
            });

            const responseText = await result.text();
            console.log("Gemini response:", responseText);
        } catch (error) {
            console.error("Error in generateSpecialContent:", error);
        } finally {
            loadSpecificChat(CURRENT_CHAT_ID); // call once
        }
    }
    else if(type === 'DOCUMENT'){
        const documentUrl = await resolveUrlFromExtensionUI();

        const payload = `${type}###${documentUrl}`;

        try {
            const authHeader = await getAuthHeader();
            const endpoint = currentChatId
                ? `http://localhost:8080/api/gemini/generate-special/${currentChatId}`
                : "http://localhost:8080/api/gemini/generate-special";

            const result = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain",
                    ...(authHeader ? { "Authorization": authHeader } : {})
                },
                body: payload
            });

            const responseText = await result.text();
            console.log("Gemini response:", responseText);
        } catch (error) {
            console.error("Error in generateSpecialContent:", error);
        } finally {
            loadSpecificChat(CURRENT_CHAT_ID); // call once
        }
    }
}

async function extractPageData() {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

        await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: () => {
                chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                    if (request.type === "extractPageData") {
                        sendResponse({
                            success: true,
                            data: {
                                title: document.title,
                                url: window.location.href,
                                wordCount: document.body.innerText.split(/\s+/).length,
                                headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => h.innerText),
                                links: Array.from(document.querySelectorAll('a')).length,
                                images: Array.from(document.querySelectorAll('img')).length
                            }
                        });
                    }
                    return true;
                });
            }
        });

        // Send message
        const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Timeout")), 3000);

            chrome.tabs.sendMessage(tab.id, {type: "extractPageData"}, (response) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        if (response && response.success) {
            displayPageData(response.data);
        }

    } catch (error) {
        console.error("Extract page data failed:", error);
    }
}

function displayPageData(data) {
    const chatContainer = document.getElementById("chatContainer");

    const dataMessage = document.createElement("div");
    dataMessage.className = "message bot";
    dataMessage.innerHTML = `
        <div class="message-content">
            <strong>Page Data Extracted:</strong><br>
            <strong>Title:</strong> ${data.title}<br>
            <strong>URL:</strong> ${data.url}<br>
            <strong>Word Count:</strong> ${data.wordCount}<br>
            <strong>Headings:</strong> ${data.headings.length}<br>
            <strong>Links:</strong> ${data.links.length}<br>
            <strong>Images:</strong> ${data.images.length}
        </div>
        <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
    `;

    chatContainer.appendChild(dataMessage);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}


async function highlightText(text) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
            type: "highlightText",
            text: text
        }, (response) => {
            console.log(`Highlighted ${response.highlightCount} instances`);
        });
    });
}

// tool functions handling here
async function searchCurrentPage(query) {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

        await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: (searchQuery) => {
                // clear old listener if already injected
                if (window.__nuviaSearchListener__) {
                    chrome.runtime.onMessage.removeListener(window.__nuviaSearchListener__);
                }

                // define listener
                const listener = (request, sender, sendResponse) => {
                    if (request.type === "searchPage") {
                        // cleanup old highlights
                        document.querySelectorAll('.nuvia-highlight').forEach(highlight => {
                            const parent = highlight.parentNode;
                            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
                            parent.normalize();
                        });

                        // search text nodes
                        const walker = document.createTreeWalker(
                            document.body,
                            NodeFilter.SHOW_TEXT,
                            {
                                acceptNode(node) {
                                    const tag = node.parentElement?.tagName;
                                    if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
                                    return NodeFilter.FILTER_ACCEPT;
                                }
                            }
                        );

                        const textNodes = [];
                        let node;
                        while ((node = walker.nextNode())) {
                            if (node.textContent.toLowerCase().includes(request.query.toLowerCase())) {
                                textNodes.push(node);
                            }
                        }

                        // highlight
                        let matchCount = 0;
                        textNodes.forEach(textNode => {
                            const regex = new RegExp(
                                `(${request.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
                                'gi'
                            );
                            const matches = textNode.textContent.match(regex);

                            if (matches) {
                                matchCount += matches.length;
                                const span = document.createElement('span');
                                span.innerHTML = textNode.textContent.replace(
                                    regex,
                                    '<mark class="nuvia-highlight" style="background:#ffeb3b; padding:2px 4px; border-radius:2px; font-weight:bold;">$1</mark>'
                                );
                                textNode.parentNode.replaceChild(span, textNode);
                            }
                        });

                        // scroll to first
                        if (matchCount > 0) {
                            document.querySelector('.nuvia-highlight')
                                ?.scrollIntoView({behavior: 'smooth', block: 'center'});
                        }

                        sendResponse({
                            success: true,
                            results: {count: matchCount, query: request.query}
                        });
                        return true;
                    }
                };

                // attach and store
                window.__nuviaSearchListener__ = listener;
                chrome.runtime.onMessage.addListener(listener);
            },
            args: [query]
        });

        // wait for response from listener
        const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Timeout")), 3000);

            chrome.tabs.sendMessage(tab.id, {type: "searchPage", query}, (response) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        console.log(`Found ${response.results.count} matches for "${query}"`);
        showNotificationInChat(`Found ${response.results.count} matches for "${query}"`);

    } catch (error) {
        console.error("Search failed:", error);
    }
}

function showSearchInterface() {
    const existingInterface = document.getElementById('nuvia-search-interface');
    if (existingInterface) {
        existingInterface.remove();
        return;
    }

    const searchInterface = document.createElement('div');
    searchInterface.id = 'nuvia-search-interface';
    searchInterface.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        padding: 20px;
        z-index: 10000;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
        animation: slideUp 0.3s ease-out;
    `;

    searchInterface.innerHTML = `
        <div style="color: white; font-size: 16px; margin-bottom: 15px; font-weight: 600;">
            Search This Page
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
            <input type="text" id="nuvia-search-input" placeholder="Enter search term..." style="
                flex: 1;
                padding: 10px 15px;
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 6px;
                background: rgba(255, 255, 255, 0.1);
                color: white;
                font-size: 14px;
                outline: none;
                min-width: 250px;
            ">
            <button id="nuvia-search-btn" style="
                padding: 10px 15px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
            ">Search</button>
            <button id="nuvia-search-close" style="
                padding: 10px;
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            ">Close</button>
        </div>
        <div id="nuvia-search-results" style="
            color: rgba(255, 255, 255, 0.8);
            font-size: 12px;
            margin-top: 10px;
            min-height: 20px;
        "></div>
    `;

    document.body.appendChild(searchInterface);

    const input = document.getElementById('nuvia-search-input');
    const searchBtn = document.getElementById('nuvia-search-btn');
    const resultsDiv = document.getElementById('nuvia-search-results');

    input.focus();

    async function performSearch() {
        const query = input.value.trim();
        if (!query) return;

        const response = await searchCurrentPage(query);
        if (response?.success) {
            resultsDiv.textContent = `Found ${response.results.count} matches for "${query}"`;
        } else {
            resultsDiv.textContent = 'Search failed';
        }
    }

    searchBtn.addEventListener('click', performSearch);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    document.getElementById('nuvia-search-close').addEventListener('click', () => {
        searchInterface.remove();
    });
}

document.getElementById("extract-btn").addEventListener("click", () => {
    extractPageData();
});

document.getElementById("search-btn").addEventListener("click", () => {
    showSearchInterface()
});


// tools design js logic

document.getElementById("tools-toggle").addEventListener("click", () => {
    document.getElementById("tools-section").classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
    const wrapper = document.querySelector(".tools-wrapper");
    if (!wrapper.contains(e.target)) {
        document.getElementById("tools-section").classList.add("hidden");
    }
});

// chats logic


let currentChatId = null;
let allChats = [];


document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
document.getElementById('close-sidebar').addEventListener('click', closeSidebar);

function toggleSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    if (sidebar.classList.contains('show')) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

function openSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    sidebar.classList.remove('hidden');
    sidebar.classList.add('show');
    loadChatHistory();
}

function closeSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    sidebar.classList.remove('show');
    setTimeout(() => {
        sidebar.classList.add('hidden');
    }, 300);
}

async function loadChatHistory() {
    const sidebarContent = document.getElementById('sidebar-content');
    sidebarContent.innerHTML = '<div class="loading">Loading chat history...</div>';

    if (isAuthenticated) {
        try {
            const authHeader = await getAuthHeader();
            const response = await fetch('http://localhost:8080/api/chats/', {
                headers: authHeader ? {"Authorization": authHeader} : {},
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to load chats: ${response.status}`);
            }

            const chats = await response.json();
            allChats = chats;
            displayChatHistory(chats);

            // showLandingScreen();

            console.log("Chats loaded for: ", chrome.storage.local.get(['userEmail']));

        } catch (error) {
            console.error('Error loading chat history:', error);
            sidebarContent.innerHTML = `
            <div style="text-align: center; color: rgba(255, 255, 255, 0.6); padding: 20px;">
                <p>Failed to load chat history</p>
                <p style="font-size: 12px; margin-top: 8px;">${error.message}</p>
            </div>
        `;
        }
    } else {
        sidebarContent.innerHTML = `
            <div style="text-align: center; color: rgba(255, 255, 255, 0.6); padding: 20px;">
                <p>Please create an acount first!</p>
            </div>
        `;
    }
}

function displayChatHistory(chats) {
    const sidebarContent = document.getElementById('sidebar-content');

    if (!chats || chats.length === 0) {
        sidebarContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💬</div>
                <p>No chat history yet</p>
                <p class="empty-subtitle">Start a conversation to see it here</p>
            </div>
        `;
        return;
    }

    const chatItems = chats.map(chat => {
        const logs = chat.logs || [];
        const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
        const firstLog = logs.length > 0 ? logs[0] : null;

        const chatTitle = firstLog?.request?.substring(0, 40) || "New Chat";
        const preview = lastLog?.response?.substring(0, 60) || lastLog?.request?.substring(0, 60) || "No messages";

        const lastUpdated = lastLog
            ? new Date(lastLog.stamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: new Date(lastLog.stamp).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
            })
            : new Date(chat.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: new Date(chat.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
            });

        const messageCount = logs.length;
        const isActive = chat.id === window.currentChatId ? 'active' : '';

        return `
            <div class="chat-item ${isActive}" data-chat-id="${chat.id}">
                <div class="chat-main-content">
                    <div class="chat-header">
                        <div class="chat-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                            </svg>
                        </div>
                        <div class="chat-title">${escapeHtml(chatTitle)}</div>
                    </div>
                    
                    <div class="chat-preview">${escapeHtml(preview)}</div>
                    
                    <div class="chat-footer">
                        <div class="chat-meta">
                            <span class="chat-date">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                ${lastUpdated}
                            </span>
                            <span class="chat-count">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                                </svg>
                                ${messageCount}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="chat-actions">
                    <button class="delete-chat-btn" data-chat-id="${chat.id}" title="Delete chat">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    const newChatButton = `
        <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">
            <button id="new-chat-btn-sidebar" 
                style="
                    margin-top:20px; 
                    padding:10px 20px; 
                    border:none; 
                    border-radius:8px; 
                    cursor:pointer;
                    transition: transform 0.2s ease;
                    background: white;
                    color: black;
                    font-weight: 500;
                ">
                + New Chat
            </button>
            <style>
                #new-chat-btn-sidebar:hover {
                    transform: translateY(-3px);
                }
            </style>
        </div>
    `;

    sidebarContent.innerHTML = `
        <div class="chat-list">
            ${chatItems}
        </div>
        ${newChatButton}
    `;

    setupChatItemListeners();

    // Add event listener for the new chat button
    const newChatBtn = document.getElementById("new-chat-btn-sidebar");
    if (newChatBtn) {
        newChatBtn.addEventListener("click", startNewChat);
    }
}

function setupChatItemListeners() {
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.delete-chat-btn')) return;

            const chatId = item.getAttribute('data-chat-id');
            selectChat(chatId);
        });
    });

    document.querySelectorAll('.delete-chat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const chatId = btn.getAttribute('data-chat-id');
            const chatItem = btn.closest('.chat-item');
            const chatTitle = chatItem.querySelector('.chat-title').textContent;

            showDeleteConfirmation(chatId, chatTitle);
        });
    });
}

function showDeleteConfirmation(chatId, chatTitle) {
    const modal = document.createElement('div');
    modal.className = 'delete-modal-overlay';
    modal.innerHTML = `
        <div class="delete-modal">
            <div class="modal-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#ef4444">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                <h3>Delete Chat</h3>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete this chat?</p>
                <p class="chat-title-preview">"${escapeHtml(chatTitle)}"</p>
                <p class="warning-text">This action cannot be undone.</p>
            </div>
            <div class="modal-actions">
                <button class="btn-cancel">Cancel</button>
                <button class="btn-delete">Delete</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.btn-cancel').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.querySelector('.btn-delete').addEventListener('click', () => {
        deleteChat(chatId).then(r => loadChatHistory());
        document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

async function deleteChat(chatId) {
    try {
        const authHeader = await getAuthHeader();
        const response = await fetch(`http://localhost:8080/api/chats/${chatId}`, {
            method: 'DELETE',
            headers: authHeader ? { "Authorization": authHeader } : {}
        });

        if (!response.ok) {
            throw new Error(`Failed to delete chat: ${response.status}`);
        }

        console.log(`Chat ${chatId} deleted successfully`);

        allChats = allChats.filter(chat => chat.id !== chatId);

        if (currentChatId === chatId) {
            currentChatId = null;
            showLandingScreen();
        }

        displayChatHistory(allChats);

    } catch (error) {
        console.error('Error deleting chat:', error);
    }
}
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const chatHistoryStyles = `
<style>
.chat-list {
    padding: 8px 0;
}

.chat-item {
    display: flex;
    align-items: flex-start;
    margin: 4px 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
}

.chat-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateX(2px);
}

.chat-item.active {
    background: rgba(102, 126, 234, 0.15);
    border-color: rgba(102, 126, 234, 0.3);
    box-shadow: 0 0 0 1px rgba(102, 126, 234, 0.2);
}

.chat-main-content {
    flex: 1;
    min-width: 0;
}

.chat-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
}

.chat-icon {
    color: rgba(255, 255, 255, 0.6);
    flex-shrink: 0;
}

.chat-title {
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.chat-preview {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    line-height: 1.4;
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.chat-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.chat-meta {
    display: flex;
    gap: 12px;
    align-items: center;
}

.chat-date,
.chat-count {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
}

.chat-actions {
    margin-left: 8px;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.chat-item:hover .chat-actions {
    opacity: 1;
}

.delete-chat-btn {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: rgba(239, 68, 68, 0.8);
    border-radius: 6px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.delete-chat-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: rgba(239, 68, 68, 1);
    transform: scale(1.05);
}

.empty-state {
    text-align: center;
    padding: 40px 20px;
    color: rgba(255, 255, 255, 0.6);
}

.empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.7;
}

.empty-state p {
    margin: 8px 0;
    font-size: 14px;
}

.empty-subtitle {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
}

.delete-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease;
}

.delete-modal {
    background: rgba(20, 20, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    backdrop-filter: blur(20px);
    animation: slideUp 0.3s ease;
}

.modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}

.modal-header h3 {
    color: white;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
}

.modal-body {
    margin-bottom: 24px;
}

.modal-body p {
    color: rgba(255, 255, 255, 0.8);
    margin: 8px 0;
    line-height: 1.5;
}

.chat-title-preview {
    background: rgba(255, 255, 255, 0.05);
    padding: 8px 12px;
    border-radius: 8px;
    font-style: italic;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
}

.warning-text {
    color: rgba(239, 68, 68, 0.8);
    font-size: 13px;
}

.modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.btn-cancel,
.btn-delete {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
}

.btn-cancel {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-cancel:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
}

.btn-delete {
    background: rgba(239, 68, 68, 0.8);
    color: white;
}

.btn-delete:hover {
    background: rgba(239, 68, 68, 0.9);
    transform: translateY(-1px);
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from { 
        opacity: 0;
        transform: translateY(20px);
    }
    to { 
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
`;

if (!document.getElementById('chat-history-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'chat-history-styles';
    styleElement.innerHTML = chatHistoryStyles;
    document.head.appendChild(styleElement);
}


function selectChat(chatId) {
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });

    const selectedItem = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }

    currentChatId = chatId;
    console.log(chatId)
    loadSpecificChat(chatId).then(r => enableChatInterface());
    CURRENT_CHAT_ID = chatId
}

async function loadSpecificChat(chatId) {
    try {
        const authHeader = await getAuthHeader();
        const response = await fetch(`http://localhost:8080/api/chats/${chatId}`, {
            headers: authHeader ? {"Authorization": authHeader} : {}
        });

        if (!response.ok) {
            throw new Error(`Failed to load chat: ${response.status}`);
        }

        const chat = await response.json();
        console.log("CHAT JSON: ", chat)
        displayChatMessages(chat.logs || []);

        closeSidebar();

    } catch (error) {
        showLandingScreen()
    }
}

function displayChatMessages(messages) {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = '';

    messages.forEach(message => {
        const stamp = new Date(message.stamp);
        const now = new Date();

        let formattedDate;
        if (
            stamp.getDate() === now.getDate() &&
            stamp.getMonth() === now.getMonth() &&
            stamp.getFullYear() === now.getFullYear()
        ) {
            formattedDate = `Today ${stamp.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
        } else {
            formattedDate = stamp.toLocaleDateString([], {month: 'short', day: 'numeric', year: 'numeric'}) +
                " | " +
                stamp.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        }

        // User message
        const userDiv = document.createElement('div');
        userDiv.className = 'message user';
        userDiv.innerHTML = `
            <div class="message-content">${message.request || message.userMessage}</div>
            <div class="message-time">${formattedDate}</div>
        `;
        chatContainer.appendChild(userDiv);

        if (message.response || message.botResponse) {
            const botDiv = document.createElement('div');
            botDiv.className = 'message bot';
            botDiv.innerHTML = `
                <div class="message-content">${message.response || message.botResponse}</div>
                <div class="message-time">${formattedDate}</div>
            `;
            chatContainer.appendChild(botDiv);
        }
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
}


function showLandingScreen() {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">
            <h2>Welcome</h2>
            <p>Select a chat from the sidebar or start a new one.</p>
            
        <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">
            <button id="new-chat-btn" 
                style="
                    margin-top:20px; 
                    padding:10px 20px; 
                    border:none; 
                    border-radius:8px; 
                    cursor:pointer;
                    transition: transform 0.2s ease;
                ">
                + New Chat
            </button>
            <style>
                #new-chat-btn:hover {
                    transform: translateY(-3px);
                }
            </style>
        </div>

        </div>
    `;
    disableChatInterface('Please select / create a chat')
    document.getElementById("new-chat-btn").addEventListener("click", startNewChat);

}

async function startNewChat() {
    try {
        const authHeader = await getAuthHeader();

        const response = await fetch("http://localhost:8080/api/chats/add", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(authHeader ? {"Authorization": authHeader} : {})
            },
            credentials: "include"
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to create chat: ${response.status} - ${text}`);
        }

        const newChat = await response.json();

        allChats.push(newChat);
        displayChatHistory(allChats);
        selectChat(newChat.id);
        console.log(newChat)

    } catch (error) {
        console.error("Error starting new chat:", error);
    }
}

document.getElementById("sidebar-content").addEventListener("click", (e) => {
    if (e.target && e.target.id === "new-chat-btn") {
        startNewChat();
    }
});
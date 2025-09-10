document.addEventListener('DOMContentLoaded', async () => {
    console.log('Extension loaded');

    await initializeApp();
    setupOriginalChatInterface();
});

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
            showAuthStatus(`Authenticated as ${currentUser.name || currentUser.email}`);

            await loadChatLogs();
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
    disableChatInterface();
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

function disableChatInterface() {
    const inputElement = document.getElementById('customInput');
    const sendButton = document.getElementById('send-btn');

    if (inputElement) {
        inputElement.disabled = true;
        inputElement.placeholder = 'Please authenticate to use chat';
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
        loadChatLogs();
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
            const response = await fetch("http://localhost:8080/api/gemini/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain",
                    ...(currentUser ? {"Authorization": await getAuthHeader()} : {})
                },
                body: prompt
            });

            const text = await response.text();

            if (text === 'SUMMARIZATION') {
                await generateSpecialContent(text);
            }

        } catch (err) {
            console.error("Error:", err);
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = "Send";
            input.disabled = false;
        }

        await loadChatLogs();
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

async function loadChatLogs() {
    const container = document.getElementById("chatContainer");
    container.innerHTML = "";

    try {
        const authHeader = await getAuthHeader();
        const res = await fetch("http://localhost:8080/api/logs", {
            headers: authHeader ? {"Authorization": authHeader} : {}
        });

        if (!res.ok) {
            const text = await res.text();
            console.log("Raw response from server:", text.slice(0, 500));

            // throw new Error(`Server responded with ${res.status}: ${text}`);
        }

        // Check content type to make sure it's JSON
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const text = await res.text();
            console.error("Non-JSON response from server:", text);
            throw new Error(`Expected JSON but got:\n${text.slice(0, 300)}`);
        }

        const logs = await res.json();

        logs.forEach(log => {
            const userDiv = document.createElement("div");
            userDiv.className = "message user";
            userDiv.innerHTML = `
                <div class="message-content">${log.request}</div>
                <div class="message-time">${new Date(log.stamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            })}</div>
            `;
            container.appendChild(userDiv);

            const botDiv = document.createElement("div");
            botDiv.className = "message bot";
            botDiv.innerHTML = `
                <div class="message-content">${log.response}</div>
                <div class="message-time">${new Date(log.stamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            })}</div>
            `;
            container.appendChild(botDiv);
        });

        container.scrollTop = container.scrollHeight;

        // enable interface after loading
        enableChatInterface();

    } catch (error) {
        container.innerHTML = `<p style="color:red;">Failed to load chat: ${error.message}</p>`;
        enableChatInterface();
    }
}

async function generateSpecialContent(type) {
    console.log("GENERATE SPECIAL CONTENT WITH TYPE ", type);

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

                    const payload = response.text;

                    try {
                        const authHeader = await getAuthHeader();
                        const result = await fetch("http://localhost:8080/api/gemini/generate-special", {
                            method: "POST",
                            headers: {
                                "Content-Type": "text/plain",
                                ...(authHeader ? {"Authorization": authHeader} : {})
                            },
                            body: payload
                        });

                        const responseText = await result.text();
                        console.log("Gemini response:", responseText);
                        loadChatLogs();
                    } catch (error) {
                        console.error("Error in generateSpecialContent:", error);
                    }
                }
            );
        });
    });
}

async function extractPageData() {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

        // Use inline script instead of file injection
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
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
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
                                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }

                        sendResponse({
                            success: true,
                            results: { count: matchCount, query: request.query }
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

            chrome.tabs.sendMessage(tab.id, { type: "searchPage", query }, (response) => {
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

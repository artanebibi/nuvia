console.log("ContentScript.js loaded successfully");

let isExtensionEnabled = false;
let userAuthenticated = false;

// Initialize content script
initializeContentScript();

function initializeContentScript() {
    // Check authentication status before enabling features
    chrome.runtime.sendMessage({ action: 'getAuthStatus' }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('Background script not available yet');
            return;
        }

        if (response?.authenticated) {
            userAuthenticated = true;
            enableExtensionFeatures();
        } else {
            console.log('User not authenticated - limited functionality');
            userAuthenticated = false;
        }
    });
}

// Enable extension features for authenticated users
function enableExtensionFeatures() {
    isExtensionEnabled = true;
    monitorPageActivity();
}

// Monitor page activity
function monitorPageActivity() {
    let activityData = {
        timeOnPage: 0,
        scrollDepth: 0,
        clickCount: 0,
        startTime: Date.now()
    };

    // Track scroll depth
    window.addEventListener('scroll', throttle(() => {
        const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        activityData.scrollDepth = Math.max(activityData.scrollDepth, scrollPercent);
    }, 1000));

    // Track clicks
    document.addEventListener('click', () => {
        activityData.clickCount++;
    });

    // Update time on page periodically
    setInterval(() => {
        activityData.timeOnPage = Date.now() - activityData.startTime;
    }, 10000);

    // Send activity data when page unloads
    window.addEventListener('beforeunload', () => {
        chrome.runtime.sendMessage({
            type: 'pageActivity',
            data: {
                ...activityData,
                url: window.location.href,
                title: document.title
            }
        }).catch(() => {
            // Background script might not be available
        });
    });
}

async function extractPageData() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Use inline script instead of file injection
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                    if (request.type === "extractPageData") {
                        sendResponse({
                            success: true,
                            data: {
                                title: document.title,
                                url: window.location.href,
                                wordCount: document.body.innerText.split(/\s+/).length
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

            chrome.tabs.sendMessage(tab.id, { type: "extractPageData" }, (response) => {
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
            ">✕</button>
        </div>
        <div id="nuvia-search-results" style="
            color: rgba(255, 255, 255, 0.8);
            font-size: 12px;
            margin-top: 10px;
            min-height: 20px;
        "></div>
    `;

    document.body.appendChild(searchInterface);

    // Focus input
    const input = document.getElementById('nuvia-search-input');
    input.focus();

    // Search functionality
    const searchBtn = document.getElementById('nuvia-search-btn');
    const resultsDiv = document.getElementById('nuvia-search-results');

    function performSearch() {
        const query = input.value.trim();
        if (!query) return;

        chrome.runtime.sendMessage({
            type: 'searchPage',
            query: query
        }, (response) => {
            if (response?.success) {
                resultsDiv.textContent = `Found ${response.results.count} matches for "${query}"`;
            } else {
                resultsDiv.textContent = 'Search failed';
            }
        });
    }

    searchBtn.addEventListener('click', performSearch);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Close functionality
    document.getElementById('nuvia-search-close').addEventListener('click', () => {
        searchInterface.remove();
    });
}

function openSidePanel() {
    // Try to open the side panel
    chrome.runtime.sendMessage({
        type: 'openSidePanel'
    }).catch(() => {
        showNotification('Could not open side panel. Try clicking the extension icon.', 'info');
    });
}


// Enhanced message listener with original functionality
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("ContentScript received message:", request);

    switch (request.type || request.action) {
        case "SUMMARIZATION":
            // Original functionality - extract page text
            const pageText = document.body.innerText;
            sendResponse({
                success: true,
                text: pageText,
                title: document.title,
                url: window.location.href
            });
            break;

        case "extractPageData":
            handlePageDataExtraction(sendResponse);
            break;

        case "searchPage":
            // Search for text on page
            chrome.runtime.sendMessage({
                type: 'searchPage',
                query: request.query
            }, (response) => {
                sendResponse(response);
            });
            break;

        case "highlightText":
            // Highlight specific text
            chrome.runtime.sendMessage({
                type: 'highlightText',
                text: request.text
            }, (response) => {
                sendResponse(response);
            });
            break;


        case "toggleExtensionFeatures":
            if (request.enabled && userAuthenticated) {
                enableExtensionFeatures();
            } else {
                // Disable features
                const floatBtn = document.getElementById('nuvia-float-btn');
                if (floatBtn) floatBtn.remove();
                isExtensionEnabled = false;
            }
            sendResponse({ success: true });
            break;

        default:
            console.log("Unknown message type:", request.type);
    }

    return true; // Required for async `sendResponse`
});

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    // Remove any NUVIA elements
    const nuviaElements = document.querySelectorAll('[id^="nuvia-"]');
    nuviaElements.forEach(el => el.remove());
});
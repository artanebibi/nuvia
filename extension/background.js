const API_BASE = 'http://localhost:8080';

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
    console.log('NUVIA Extension installed');
    checkAuthStatus();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('NUVIA Extension started');
    let auth = checkAuthStatus();
    if(auth === false) {
        showAuthStatus('Authentication required');
        showLoginPrompt()
    }

});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action || request.type) {
        case 'login':
            initiateGoogleAuth();
            sendResponse({ success: true });
            break;

        case 'logout':
            handleLogout();
            sendResponse({ success: true });
            break;

        case 'getAuthStatus':
            getAuthStatus().then(status => sendResponse(status));
            return true;

        case 'makeApiCall':
            makeAuthenticatedRequest(request.url, request.options)
                .then(response => response.json())
                .then(data => sendResponse({ success: true, data }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case "SUMMARIZATION":
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
                        sendResponse(response);
                    });
                }
            });
            return true;
        case 'extractPageData':
            console.log("Handling page data extraction");
            handlePageDataExtraction(sendResponse);
            break
        default:
            console.log('Unknown message type:', request);
    }
});

async function checkAuthStatus() {
    const tokens = await chrome.storage.local.get(['accessToken', 'refreshToken']);

    if (!tokens.accessToken || !tokens.refreshToken) {
        console.log('no tokens found');
        return { authenticated: false };
    }

    if (isTokenExpired(tokens.accessToken)) {
        if (isTokenExpired(tokens.refreshToken)) {
            await chrome.storage.local.clear();
            return { authenticated: false };
        } else {
            return await refreshAccessToken();
        }
    }

    console.log('user authenticated');
    return { authenticated: true };
}

async function getAuthStatus() {
    const tokens = await chrome.storage.local.get(['accessToken', 'refreshToken', 'userEmail', 'userName']);

    if (!tokens.accessToken) {
        return { authenticated: false };
    }

    if (isTokenExpired(tokens.accessToken)) {
        const refreshResult = await refreshAccessToken();
        if (refreshResult.authenticated) {
            const updatedTokens = await chrome.storage.local.get(['userEmail', 'userName']);
            return {
                authenticated: true,
                user: {
                    email: updatedTokens.userEmail,
                    name: updatedTokens.userName
                }
            };
        } else {
            return { authenticated: false };
        }
    }

    return {
        authenticated: true,
        user: {
            email: tokens.userEmail,
            name: tokens.userName
        }
    };
}

// access token expiry
function isTokenExpired(token) {
    if (!token) return true;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return Date.now() >= payload.exp * 1000;
    } catch (e) {
        console.error('Error parsing token:', e);
        return true;
    }
}

function initiateGoogleAuth() {
    const authUrl = `${API_BASE}/oauth2/authorization/google`;

    chrome.tabs.create({ url: authUrl }, (tab) => {
        const listener = (tabId, changeInfo) => {
            if (tabId === tab.id && changeInfo.url) {
                console.log('Tab URL changed to:', changeInfo.url);

                if (changeInfo.url.includes('/auth/success')) {
                    console.log('✅ Found success URL, handling callback...');
                    handleOAuthCallback(changeInfo.url, tab.id);
                    chrome.tabs.onUpdated.removeListener(listener);
                }
            }
        };

        chrome.tabs.onUpdated.addListener(listener);
    });
}
async function handleOAuthCallback(url, tabId) {
    try {
        const urlObj = new URL(url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');
        const email = urlObj.searchParams.get('email');
        const name = urlObj.searchParams.get('name');

        if (accessToken && refreshToken && email) {
            await chrome.storage.local.set({
                accessToken,
                refreshToken,
                userEmail: email,
                userName: name || email,
                loginTime: Date.now()
            });

            console.log('tokens stored for:', email);

            chrome.tabs.remove(tabId);

            chrome.runtime.sendMessage({
                action: 'loginSuccess',
                user: { email, name }
            })

        } else {
            console.error('Failed to extract tokens from callback URL');
            chrome.tabs.remove(tabId);
        }
    } catch (error) {
        console.error('Error handling OAuth callback:', error);
        chrome.tabs.remove(tabId);
    }
}

async function refreshAccessToken() {
    try {
        const tokens = await chrome.storage.local.get(['refreshToken', 'userEmail']);

        if (!tokens.refreshToken || !tokens.userEmail) {
            await chrome.storage.local.clear();
            return { authenticated: false };
        }

        const response = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refreshToken: tokens.refreshToken,
                email: tokens.userEmail
            })
        });

        if (response.ok) {
            const data = await response.json();

            await chrome.storage.local.set({
                accessToken: data.accessToken,
                refreshToken: data.refreshToken || tokens.refreshToken,
                userEmail: data.user?.email || tokens.userEmail,
                userName: data.user?.name || tokens.userEmail
            });

            console.log('Access token refreshed');
            return { authenticated: true };
        } else {
            console.error('Failed to refresh token');
            await chrome.storage.local.clear();
            return { authenticated: false };
        }
    } catch (error) {
        console.error('Token refresh error:', error);
        await chrome.storage.local.clear();
        return { authenticated: false };
    }
}

async function makeAuthenticatedRequest(url, options = {}) {
    const tokens = await chrome.storage.local.get(['accessToken']);

    if (!tokens.accessToken) {
        throw new Error('No access token available');
    }

    const headers = {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.status === 401) { // backend responds with 401 unauthorized
            console.log('Access token expired, attempting refresh...');
            const refreshResult = await refreshAccessToken();

            if (refreshResult.authenticated) {
                const newTokens = await chrome.storage.local.get(['accessToken']);
                return fetch(url, {
                    ...options,
                    headers: {
                        ...headers,
                        'Authorization': `Bearer ${newTokens.accessToken}`
                    }
                });
            } else {
                throw new Error('Authentication failed');
            }
        }

        return response;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

async function handleLogout() {
    await chrome.storage.local.clear();
    console.log('User logged out');
}
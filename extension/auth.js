class AuthManager {

    static async logout() {
        try {
            const {accessToken} = await chrome.storage.local.get(['accessToken']);

            if (accessToken) {

                const response = await fetch('http://localhost:8080/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                const result = await response.json();
                console.log('Backend logout response:', result);


            }

            await chrome.storage.local.remove([
                'accessToken',
                'refreshToken',
                'userEmail',
                'userName',
                'loginTime'
            ]);

            chrome.runtime.sendMessage({
                action: 'logoutSuccess'
            });

            return {success: true};

        } catch (error) {
            return {success: false, error: error.message};
        }
    }

    static async refreshToken() {
        try {
            const {accessToken} = await chrome.storage.local.get(['accessToken']);

            if (!accessToken) {
                throw new Error('No access token to refresh');
            }

            const response = await fetch('http://localhost:8080/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.token) {
                // Store new token
                await chrome.storage.local.set({
                    accessToken: data.token,
                    loginTime: Date.now()
                });

                return {success: true, token: data.token};
            } else {
                throw new Error('Invalid refresh response');
            }

        } catch (error) {
            await AuthManager.logout();
            return {success: false, error: error.message};
        }
    }
}

window.AuthManager = AuthManager;
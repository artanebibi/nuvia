chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SUMMARIZATION") {
        const pageText = document.body.innerText;
        sendResponse({ text: pageText });
    }
    return true; // Required for async `sendResponse`
});

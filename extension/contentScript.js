// chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
//     if (req.type === "summarize") {
//         const text = document.body.innerText;
//         sendResponse({ text });
//     }
//
//     if (req.type === "search") {
//         const input = document.querySelector('input[type="search"], input[placeholder*="Search"]');
//         if (input) {
//             input.value = req.query;
//             input.dispatchEvent(new Event('input', { bubbles: true }));
//             input.form?.submit() || input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
//         }
//     }
// });

console.log("Content script injected");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("contentScript");
    if (request.type === "SUMMARIZATION") {
        const pageText = document.body.innerText;
        sendResponse({ text: pageText });
    }
    return true; // Required for async `sendResponse`
});

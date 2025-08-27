// document.getElementById("send-btn").addEventListener("click", async () => {
//     const userInput = document.getElementById("customInput").value;
//
//     const prompt = userInput;
//
//     try {
//         const res = await fetch("http://localhost:8080/api/gemini/generate", {
//             method: "POST",
//             headers: { "Content-Type": "text/plain" },
//             body: prompt
//         });
//
//         const responseText = await res.text();
//         document.getElementById("customResponse").value = responseText;
//     } catch (error) {
//         document.getElementById("customResponse").value = "❌ Error: " + error.message;
//     }
// });
async function loadChatLogs() {
    const container = document.getElementById("chatContainer");
    container.innerHTML = ""; // Clear old messages

    try {
        const res = await fetch("http://localhost:8080/api/logs");
        const logs = await res.json();

        logs.forEach(log => {
            const userDiv = document.createElement("div");
            userDiv.className = "message user";
            userDiv.textContent = log.request;
            container.appendChild(userDiv);

            const botDiv = document.createElement("div");
            botDiv.className = "message bot";
            botDiv.innerHTML = `${log.response}<div class="meta">${log.stamp} · ${log.type}</div>`;
            container.appendChild(botDiv);
        });

        container.scrollTop = container.scrollHeight;
    } catch (error) {
        container.innerHTML = `<p style="color:red;">Failed to load chat: ${error.message}</p>`;
    }
}

document.getElementById("send-btn").addEventListener("click", async () => {
    const input = document.getElementById("customInput");
    const prompt = input.value;
    if (!prompt) return;

    try {
        const response = await fetch("http://localhost:8080/api/gemini/generate", {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: prompt
        });

        const text = await response.text(); // 👈 actually read the response content
        // console.log("response: ", response);
        // console.log("text: ", text);
        // console.log("Response text:", text);

        if (text === 'SUMMARIZATION') {
            await generateSpecialContent(text);
        }

    } catch (err) {
        console.error("Error:", err);
    }

    await loadChatLogs();
    input.value = "";

});

//
// async function generateSpecialContent(type) {
//     console.log("GENERATE SPECIAL CONTENT WITH TYPE ", type);
//     chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//         chrome.tabs.sendMessage(
//             tabs[0].id,
//             {type: "SUMMARIZATION"},
//             async (response) => {
//                 const payload = response.text;
//                 console.log("Page text:", pageText); // ✅ Now you're reading the actual webpage
//
//                 // Send it to your backend
//                 const result = await fetch("http://localhost:8080/api/gemini/generate-special", {
//                     method: "POST",
//                     headers: {"Content-Type": "text/plain"},
//                     body: payload
//                 });
//
//                 const responseText = await result.text();
//                 console.log("Gemini response:", responseText);
//             }
//         );
//     });
// }

async function generateSpecialContent(type) {
    console.log("GENERATE SPECIAL CONTENT WITH TYPE ", type);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) return console.error("No active tab.");

        const tabId = tabs[0].id;

        // First inject the content script manually
        chrome.scripting.executeScript({
            target: { tabId },
            files: ["contentScript.js"]
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Script injection failed:", chrome.runtime.lastError.message);
                return;
            }

            // Now safely send the message
            chrome.tabs.sendMessage(
                tabId,
                { type: "SUMMARIZATION" },
                async (response) => {
                    if (!response || !response.text) {
                        console.error("❌ No response or missing .text");
                        return;
                    }

                    const payload = response.text;
                    console.log("✅ Page text:", payload);

                    const result = await fetch("http://localhost:8080/api/gemini/generate-special", {
                        method: "POST",
                        headers: { "Content-Type": "text/plain" },
                        body: payload
                    });

                    const responseText = await result.text();
                    console.log("Gemini response:", responseText);
                    loadChatLogs();
                }
            );
        });
    });
}


loadChatLogs();

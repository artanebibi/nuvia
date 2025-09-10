// Preprocessing and taking actions on the result

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);

    switch (request.type) {
        case "SUMMARIZATION":
            handleSummarization(sendResponse);
            break;

        case "extractPageData":
            handlePageDataExtraction(sendResponse);
            break;

        case "searchPage":
            handlePageSearch(request.query, sendResponse);
            break;

        case "highlightText":
            handleTextHighlighting(request.text, sendResponse);
            break;

        default:
            console.log("Unknown message type:", request.type);
    }

    return true;
});

function handleSummarization(sendResponse) {
    try {
        const content = extractMainContent();

        sendResponse({
            success: true,
            text: content,
            title: document.title,
            url: window.location.href,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error("Error extracting page content:", error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

function extractMainContent() {
    const mainSelectors = [ // filter some of the tags which hold most valuable (content rich) info
        'main',
        'article',
        '[role="main"]',
        '.content',
        '.main-content',
        '#content',
        '#main'
    ];

    let mainContent = '';

    for (const selector of mainSelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText.length > 100) {
            mainContent = element.innerText;
            break;
        }
    }

    // get body if no tags above exist
    if (!mainContent) {
        const clone = document.body.cloneNode(true);
        const scripts = clone.querySelectorAll('script, style, nav, header, footer, aside');
        scripts.forEach(el => el.remove());
        mainContent = clone.innerText;
    }

    return mainContent
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n') // remove empty lines
        .trim()
        .substring(0, 10000); // limit
}

function handlePageDataExtraction(sendResponse) {
    try {
        const pageData = {
            title: document.title,
            url: window.location.href,
            description: getMetaContent('description'),
            keywords: getMetaContent('keywords'),
            author: getMetaContent('author'),
            publishDate: getMetaContent('article:published_time') || getMetaContent('datePublished'),
            selectedText: window.getSelection().toString(),
            headings: extractHeadings(),
            links: extractLinks(),
            images: extractImages(),
            wordCount: document.body.innerText.split(/\s+/).length,
            language: document.documentElement.lang || 'unknown',
            timestamp: Date.now()
        };
        console.log("Sending page data:", pageData);
        sendResponse({ success: true, data: pageData });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

function getMetaContent(name) {
    const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return meta ? meta.getAttribute('content') : '';
}

function extractHeadings() {
    const headings = [];
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

    headingElements.forEach((heading, index) => {
        if (heading.innerText.trim()) {
            headings.push({
                level: parseInt(heading.tagName.substring(1)),
                text: heading.innerText.trim(),
                id: heading.id || `heading-${index}`
            });
        }
    });

    return headings;
}

function extractLinks() {
    const links = [];
    const linkElements = document.querySelectorAll('a[href]');

    linkElements.forEach(link => {
        if (link.href && link.innerText.trim()) {
            links.push({
                text: link.innerText.trim(),
                href: link.href,
                title: link.title || ''
            });
        }
    });

    return links.slice(0, 50); // limit
}

function extractImages() {
    const images = [];
    const imgElements = document.querySelectorAll('img[src]');

    imgElements.forEach(img => {
        if (img.src) {
            images.push({
                src: img.src,
                alt: img.alt || '',
                title: img.title || '',
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height
            });
        }
    });

    return images.slice(0, 20); // limit
}

function handlePageSearch(query, sendResponse) {
    try {
        if (!query) {
            sendResponse({ success: false, error: 'No search query provided' });
            return;
        }

        removeHighlights();

        const results = searchAndHighlight(query);

        sendResponse({
            success: true,
            results: {
                count: results,
                query: query,
                timestamp: Date.now()
            }
        });
    } catch (error) {
        console.error("Error searching page:", error);
        sendResponse({ success: false, error: error.message });
    }
}

function searchAndHighlight(searchText) {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Skip script and style elements
                if (node.parentElement.tagName === 'SCRIPT' ||
                    node.parentElement.tagName === 'STYLE') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );

    const textNodes = [];
    let node;

    while (node = walker.nextNode()) {
        if (node.textContent.toLowerCase().includes(searchText.toLowerCase())) {
            textNodes.push(node);
        }
    }

    let matchCount = 0;
    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const regex = new RegExp(`(${escapeRegExp(searchText)})`, 'gi');
        const matches = text.match(regex);

        if (matches) {
            matchCount += matches.length;
            const span = document.createElement('span');
            span.innerHTML = text.replace(regex, '<mark class="nuvia-highlight" style="background: #ffeb3b; padding: 2px 4px; border-radius: 2px; font-weight: bold;">$1</mark>');
            textNode.parentNode.replaceChild(span, textNode);
        }
    });

    if (matchCount > 0) {
        const firstMatch = document.querySelector('.nuvia-highlight');
        if (firstMatch) {
            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    return matchCount;
}

function removeHighlights() {
    const highlights = document.querySelectorAll('.nuvia-highlight');
    highlights.forEach(highlight => {
        const parent = highlight.parentNode;
        parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
        parent.normalize();
    });
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function handleTextHighlighting(text, sendResponse) {
    try {
        const count = searchAndHighlight(text);
        sendResponse({
            success: true,
            highlightCount: count
        });
    } catch (error) {
        console.error("Error highlighting text:", error);
        sendResponse({ success: false, error: error.message });
    }
}


let currentUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        console.log('NUVIA: Page changed to:', currentUrl);

        removeHighlights();

        chrome.runtime.sendMessage({
            type: 'pageChanged',
            url: currentUrl,
            title: document.title
        })
    }
});

urlObserver.observe(document.body, { childList: true, subtree: true });

window.addEventListener('beforeunload', () => {
    urlObserver.disconnect();
    removeHighlights();
});
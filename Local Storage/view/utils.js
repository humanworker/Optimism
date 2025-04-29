// view/utils.js

// Make sure convertUrlsToLinks is defined BEFORE formatTextWithHeader or imported if separate

// Format text with header if needed
export function formatTextWithHeader(text, hasHeader, isHighlighted = false) {
    // VVV Fix: Call convertUrlsToLinks directly VVV
    if (!text || !hasHeader) return convertUrlsToLinks(text || '', isHighlighted);

    const lines = text.split('\n');
    if (lines.length === 0) return '';

    // Extract first line as header
    const headerLine = lines[0];
    const restOfText = lines.slice(1).join('\n');
    // VVV Fix: Call convertUrlsToLinks directly VVV
    let formattedHeader = convertUrlsToLinks(headerLine, isHighlighted);
    let formattedText = convertUrlsToLinks(restOfText, isHighlighted);

    return `<span class="first-line">${formattedHeader}</span>${formattedText}`;
}

// In view.js, update the convertUrlsToLinks method
export function convertUrlsToLinks(text, isHighlighted = false) {
        if (!text) return '';

        // Escape HTML characters to prevent XSS
        let safeText = text.replace(/[&<>"']/g, function(match) {
            switch (match) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#39;';
                default: return match;
            }
        });

        // Replace newlines with <br> tags
        safeText = safeText.replace(/\n/g, '<br>');

        // Process the text to find and replace URLs with proper anchor tags
        let result = '';
        let lastIndex = 0;

        // Updated regex to handle file URLs with encoded spaces (%20), email addresses, and hash symbols
        const urlRegex = /(\bfile:\/\/\/[a-z0-9\-._~:/?#[\]@!$&'()*+,;=%\\\s]+[a-z0-9\-_~:/[\]@!$&'()*+,;=%\\#]|\bhttps?:\/\/[a-z0-9\-._~:/?#[\]@!$&'()*+,;=]+[a-z0-9\-_~:/[\]@!$&'()*+,;=]|\bwww\.[a-z0-9\-._~:/?#[\]@!$&'()*+,;=]+[a-z0-9\-_~:/[\]@!$&'()*+,;=])/gi;

        let match;
        while ((match = urlRegex.exec(safeText)) !== null) {
            // Add text before the URL
            result += safeText.substring(lastIndex, match.index);

            // Get the URL
            let url = match[0];

            // Different handling for different URL types
            if (url.toLowerCase().startsWith('file:///')) {
                // For file URLs, keep everything including hash
                // But remove trailing punctuation except when part of valid characters
                url = url.replace(/[.,;:!?)]+$/, '');
            } else {
                // For other URLs, remove any trailing punctuation that shouldn't be part of the URL
                url = url.replace(/[.,;:!?)]+$/, '');
            }

            // Create the proper href attribute
            let href = url;
            if (url.toLowerCase().startsWith('www.')) {
                href = 'https://' + url;
            }

            // Add the anchor tag
            result += `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;

            // Update lastIndex to end of current match
            lastIndex = match.index + url.length;

            // Adjust the regex lastIndex if we modified the URL
            if (url.length !== match[0].length) {
                urlRegex.lastIndex = lastIndex;
            }
        }

        // Add any remaining text after the last URL
        result += safeText.substring(lastIndex);

        // Apply highlighting if needed
        if (isHighlighted) {
            result = `<mark>${result}</mark>`;
        }

        return result;
    }

export function findHighestImageZIndex() {
        const imageElements = document.querySelectorAll('.image-element-container');
        let maxZIndex = 1; // Default z-index for images

        imageElements.forEach(elem => {
            const zIndex = parseInt(elem.style.zIndex) || 1;
            if (zIndex > maxZIndex) {
                maxZIndex = zIndex;
            }
        });

        // Cap at 99 to ensure we're always below text elements (which are at 100+)
        return Math.min(maxZIndex, 99);
    }

export function findElementByIdRecursive(node, elementId) {
        // Check elements in this node
        if (node.elements) {
            const element = node.elements.find(el => el.id === elementId);
            if (element) return element;
        }

        // Check in children nodes
        if (node.children) {
            for (const childId in node.children) {
                // VVV Fix: Call findElementByIdRecursive directly VVV (assuming it's in the same file or imported)
                const foundElement = findElementByIdRecursive(node.children[childId], elementId);
                if (foundElement) return foundElement;
            }
        }
        return null;
    }

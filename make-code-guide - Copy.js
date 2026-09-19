const fs = require("fs");
const path = require("path");

const root = __dirname;
const output = path.join(root, "code-guide-latest.html");
const files = [
    {
        category: "Main Product Page",
        name: "2k.html",
        purpose: "The main MAVORYI product display page with the hero section and featured products."
    },
    {
        category: "Collection Pages",
        name: "collections.html",
        purpose: "A separate collections page showing the available product categories."
    },
    {
        category: "Information Pages",
        name: "about.html",
        purpose: "The About page with information panels and a responsive video."
    },
    {
        category: "Information Pages",
        name: "contact.html",
        purpose: "The Contact page with WhatsApp and Gmail actions."
    },
    {
        category: "Shared Behavior",
        name: "script.js",
        purpose: "Shared theme switching and contact-link behavior for every page."
    },
    {
        category: "Shared Data",
        name: "contact.json",
        purpose: "Separate contact configuration containing the email and WhatsApp number."
    },
    {
        category: "Shared Styling",
        name: "styles.css",
        purpose: "The active shared stylesheet, including dark/light theme variables and responsive layout."
    },
];

function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function explainLine(line, fileName) {
    const trimmed = line.trim();
    if (!trimmed) return "Blank line used to separate related code and improve readability.";
    if (trimmed.startsWith("<!--")) return "HTML comment: documents the purpose of the following section and does not render on the page.";
    if (trimmed.startsWith("/*") || trimmed.startsWith("* ") || trimmed.startsWith("*/")) return "CSS comment: labels or documents a group of style rules.";
    if (trimmed.startsWith("//")) return "JavaScript comment: documents code without changing what the browser runs.";
    if (trimmed === "<!DOCTYPE html>") return "Declares an HTML5 document so the browser uses standards mode.";
    if (trimmed.startsWith("<html")) return "Starts the root HTML element; the language attribute identifies the page language when present.";
    if (trimmed === "</html>") return "Closes the root HTML element.";
    if (trimmed.startsWith("<head")) return "Starts metadata for the document; this content is not the visible page body.";
    if (trimmed === "</head>") return "Closes the metadata section.";
    if (trimmed.startsWith("<body")) return "Starts the visible page content.";
    if (trimmed === "</body>") return "Closes the visible page content.";
    if (trimmed.startsWith("<meta")) return "Provides browser metadata; charset handles text encoding and viewport makes the layout responsive.";
    if (trimmed.startsWith("<title")) return "Sets the text shown in the browser tab.";
    if (trimmed.startsWith("<link")) return "Loads the shared CSS file so this page receives the common design.";
    if (trimmed.startsWith("<script")) return "Loads the shared JavaScript file; defer waits until HTML parsing is complete before running it.";
    if (trimmed.startsWith("<header")) return "Starts the reusable site header and navigation area.";
    if (trimmed === "</header>") return "Closes the site header.";
    if (trimmed.startsWith("<nav")) return "Groups navigation links and the theme button.";
    if (trimmed === "</nav>") return "Closes the navigation group.";
    if (trimmed.startsWith("<a ")) return "Creates a link; href gives its destination, class gives it shared styling, and aria-label describes image-only links to assistive technology.";
    if (trimmed.startsWith("<button")) return "Creates an interactive button; JavaScript attaches the theme-switching behavior.";
    if (trimmed.startsWith("<main")) return "Starts the primary content area of the page.";
    if (trimmed === "</main>") return "Closes the primary content area.";
    if (trimmed.startsWith("<h1")) return "Creates the main page heading.";
    if (trimmed.startsWith("<h2")) return "Creates a secondary section heading.";
    if (trimmed.startsWith("<p")) return "Creates a paragraph of descriptive or product text.";
    if (trimmed.startsWith("<br")) return "Inserts a line break inside the product detail text.";
    if (trimmed.startsWith("<div")) return "Starts a generic layout container; its class or id connects it to CSS rules.";
    if (trimmed === "</div>") return "Closes the current layout container.";
    if (trimmed.startsWith("<section")) return "Starts a semantic content section.";
    if (trimmed === "</section>") return "Closes the semantic content section.";
    if (trimmed.startsWith("<video")) return "Creates the responsive video player and enables the browser's playback controls.";
    if (trimmed.startsWith("<source")) return "Provides the MP4 video file and tells the browser its media type.";
    if (trimmed.startsWith("<form")) return "Starts the contact form that JavaScript converts into a WhatsApp message.";
    if (trimmed.startsWith("<label")) return "Names a form field and contains the related input control.";
    if (trimmed.startsWith("<input")) return "Creates a form input; type controls validation and name lets JavaScript read the submitted value.";
    if (trimmed.startsWith("<textarea")) return "Creates a multi-line message field.";
    if (trimmed === "</textarea>") return "Closes the message field.";
    if (trimmed === "</form>") return "Closes the contact form.";
    if (trimmed.startsWith("</")) return "Closes the HTML element opened by the matching start tag.";
    if (fileName.endsWith(".json")) {
        if (trimmed.startsWith("{") || trimmed.startsWith("}")) return "JSON object boundary containing structured configuration data.";
        if (trimmed.startsWith('"email"')) return "Stores the destination email address used by the email action.";
        if (trimmed.startsWith('"whatsappNumber"')) return "Stores the WhatsApp number in international format without punctuation.";
        if (trimmed.startsWith('"whatsappLabel"')) return "Stores a human-readable label for the WhatsApp contact action.";
    }
    if (fileName.endsWith(".js")) {
        if (trimmed.startsWith("(function")) return "Starts an immediately invoked function so variables stay private to this script.";
        if (trimmed === "})();") return "Runs and closes the private function.";
        if (trimmed.startsWith("const CONTACT_EMAIL")) return "Defines the fallback contact email as a constant.";
        if (trimmed.startsWith("const WHATSAPP_NUMBER")) return "Defines the fallback WhatsApp number as a constant.";
        if (trimmed.includes("localStorage.getItem")) return "Reads the visitor's previously selected theme from browser storage.";
        if (trimmed.includes("setAttribute(\"data-theme\"")) return "Applies the selected theme to the root HTML element so CSS variables change.";
        if (trimmed.includes("DOMContentLoaded")) return "Waits until the page markup is ready before finding controls and adding events.";
        if (trimmed.includes("querySelector")) return "Finds a page element so JavaScript can update or control it.";
        if (trimmed.includes("addEventListener")) return "Registers a function that runs when the specified page event occurs.";
        if (trimmed.includes("FormData")) return "Reads the visitor's contact form values as structured form data.";
        if (trimmed.includes("encodeURIComponent")) return "Encodes user text so it can safely be placed inside a URL.";
        if (trimmed.includes("window.location")) return "Redirects the browser to the generated WhatsApp or external contact URL.";
        if (trimmed.includes("fetch")) return "Loads the separate contact.json file when the site is hosted over HTTP or HTTPS.";
        if (trimmed.includes("localStorage.setItem")) return "Saves the selected theme so it remains active on other pages.";
        return "JavaScript statement supporting theme state, contact configuration, or page interaction.";
    }
    if (fileName.endsWith(".css")) {
        if (trimmed.endsWith("{")) return "Starts a CSS rule; the selector before the brace identifies the elements being styled.";
        if (trimmed === "}" || trimmed.endsWith("}")) return "Closes the current CSS rule or media-query block.";
        if (trimmed.startsWith("--")) return "Defines a reusable CSS custom property used by the theme palette.";
        if (trimmed.startsWith("@media")) return "Starts responsive rules that apply when the viewport is narrow.";
        if (trimmed.includes(":")) return "Sets a visual property such as color, spacing, size, layout, or animation behavior.";
        return "CSS structure supporting the shared page layout.";
    }
    return "Content line used by this page or configuration file.";
}

const grouped = new Map();
for (const file of files) {
    if (!grouped.has(file.category)) grouped.set(file.category, []);
    grouped.get(file.category).push(file);
}

let sections = "";
for (const [category, entries] of grouped) {
    sections += `<section class="category"><h2>${escapeHtml(category)}</h2>`;
    for (const entry of entries) {
        const fullPath = path.join(root, entry.name);
        const source = fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n");
        const lines = source.split("\n");
        sections += `<article class="file"><h3>${escapeHtml(entry.name)}</h3><p class="purpose">${escapeHtml(entry.purpose)}</p><table><thead><tr><th>Line</th><th>Code</th><th>Explanation</th></tr></thead><tbody>`;
        lines.forEach((line, index) => {
            sections += `<tr><td class="line-number">${index + 1}</td><td><code>${escapeHtml(line) || "&nbsp;"}</code></td><td>${escapeHtml(explainLine(line, entry.name))}</td></tr>`;
        });
        sections += "</tbody></table></article>";
    }
    sections += "</section>";
}

const documentHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MAVORYI Code Guide</title>
<style>
@page { size: A4; margin: 16mm 13mm; }
* { box-sizing: border-box; }
body { font-family: Arial, sans-serif; color: #1d1d1d; margin: 0; font-size: 9px; }
.cover { min-height: 255mm; padding: 38mm 12mm 20mm; page-break-after: always; border-bottom: 8px solid #c59c16; }
.cover h1 { font-size: 38px; letter-spacing: 5px; color: #9b7600; margin: 0 0 16px; }
.cover h2 { font-size: 22px; margin: 0 0 28px; color: #222; }
.cover p { max-width: 560px; font-size: 13px; line-height: 1.7; color: #555; }
.contents { margin-top: 42px; padding: 18px; background: #f5f2eb; border-left: 4px solid #c59c16; }
.contents strong { color: #8a6900; }
.category { page-break-before: always; }
.category:first-of-type { page-break-before: auto; }
.category > h2 { color: #9b7600; font-size: 20px; border-bottom: 2px solid #c59c16; padding-bottom: 7px; margin: 0 0 16px; }
.file { margin: 0 0 22px; page-break-inside: auto; }
.file h3 { font-size: 14px; color: #222; margin: 16px 0 3px; }
.purpose { color: #666; margin: 0 0 7px; font-style: italic; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { background: #222; color: #fff; text-align: left; padding: 5px; font-size: 8px; }
td { border-bottom: 1px solid #ddd; vertical-align: top; padding: 4px 5px; line-height: 1.35; }
.line-number { width: 6%; color: #9b7600; text-align: right; font-weight: bold; }
td:nth-child(2) { width: 48%; background: #fafafa; }
td:nth-child(3) { width: 46%; color: #444; }
code { font-family: Consolas, "Courier New", monospace; font-size: 7.3px; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
</head>
<body>
<div class="cover">
<h1>MAVORYI</h1>
<h2>Code Guide</h2>
<p>This guide categorizes the current website files and explains every source line. The code column preserves line numbers and the explanation column describes what each line contributes.</p>
<div class="contents"><strong>Categories included:</strong><br>${Array.from(grouped.keys()).map(escapeHtml).join("<br>")}</div>
<p>Generated from the files in the current MAVORYI workspace.</p>
</div>
${sections}
</body>
</html>`;

fs.writeFileSync(output, documentHtml, "utf8");
console.log(`Created ${output}`);

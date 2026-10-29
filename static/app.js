
"use strict";

const API = "";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let toastTimeout;

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 3200);
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        let message = `Request failed (${response.status})`;

        if (data && typeof data === "object") {
            message = data.detail || data.message || message;

            if (Array.isArray(message)) {
                message = message
                    .map((item) => item.msg || JSON.stringify(item))
                    .join("; ");
            }
        } else if (typeof data === "string" && data) {
            message = data;
        }

        throw new Error(message);
    }

    return data;
}

/* NAVIGATION */

function switchPage(pageName) {
    const validPages = ["dashboard", "analyze", "history"];
    const page = validPages.includes(pageName) ? pageName : "dashboard";

    $$(".page").forEach((item) => {
        item.classList.toggle("active", item.id === `page-${page}`);
    });

    $$(".nav-link").forEach((item) => {
        item.classList.toggle("active", item.dataset.page === page);
    });

    const labels = {
        dashboard: "Dashboard",
        analyze: "Analyze code",
        history: "Analysis history"
    };

    if ($("#breadcrumbPage")) {
        $("#breadcrumbPage").textContent = labels[page];
    }

    $("#sidebar")?.classList.remove("open");

    if (page === "dashboard") refreshDashboard();
    if (page === "history") refreshHistory();
}

$$("[data-page]").forEach((button) => {
    button.addEventListener("click", () => switchPage(button.dataset.page));
});

$$("[data-go]").forEach((button) => {
    button.addEventListener("click", () => switchPage(button.dataset.go));
});

$("#mobileMenu")?.addEventListener("click", () => {
    $("#sidebar")?.classList.toggle("open");
});

$("#refreshHistory")?.addEventListener("click", refreshHistory);

/* DATA NORMALIZATION */

function normalizeList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.analyses)) return data.analyses;
    if (Array.isArray(data?.results)) return data.results;
    return [];
}

function parseIssues(value) {
    if (Array.isArray(value)) return value;

    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
}

function normalizeAnalysis(data = {}) {
    const issues = parseIssues(
        data.issues ?? data.findings ?? data.issues_json
    );

    const issueCount = Number(
        data.issue_count ??
        data.issues_count ??
        data.issueCount ??
        data.total_issues ??
        issues.length
    );

    return {
        id: data.id ?? data.analysis_id ?? null,
        filename: data.filename ?? data.file_name ?? data.name ?? "Python file",
        issueCount: Number.isFinite(issueCount) ? issueCount : issues.length,
        issues,
        createdAt:
            data.created_at ??
            data.createdAt ??
            data.timestamp ??
            data.analyzed_at ??
            null,
        sourceCode:
            data.source_code ??
            data.sourceCode ??
            data.code ??
            ""
    };
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function isClean(item) {
    return item.issueCount === 0;
}

function statusMarkup(item) {
    return isClean(item)
        ? '<span class="status-pill clean">Clean</span>'
        : '<span class="status-pill issues">Needs attention</span>';
}

/* RECENT ANALYSES */

function recentItemMarkup(rawItem) {
    const item = normalizeAnalysis(rawItem);
    const issueLabel = item.issueCount === 1 ? "issue" : "issues";

    return `
        <div class="analysis-item"
             ${item.id != null ? `data-analysis-id="${escapeHtml(item.id)}"` : ""}
             role="button"
             tabindex="0">
            <div class="file-icon">.PY</div>

            <div class="analysis-meta">
                <strong title="${escapeHtml(item.filename)}">
                    ${escapeHtml(item.filename)}
                </strong>
                <small>${escapeHtml(formatDate(item.createdAt))}</small>
            </div>

            <div class="analysis-right">
                <span class="issue-count ${isClean(item) ? "clean" : "has-issues"}">
                    ${item.issueCount} ${issueLabel}
                </span>
                <small>${isClean(item) ? "No issues" : "Review findings"}</small>
            </div>
        </div>
    `;
}

function attachAnalysisClickHandlers(container) {
    container.querySelectorAll("[data-analysis-id]").forEach((element) => {
        const open = () => showAnalysisDetails(element.dataset.analysisId);

        element.addEventListener("click", open);
        element.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open();
            }
        });
    });
}

/* DASHBOARD */

async function refreshDashboard() {
    const recent = $("#recentAnalyses");
    if (!recent) return;

    recent.innerHTML = '<div class="loading-state">Loading analyses…</div>';

    try {
        const [stats, historyData] = await Promise.all([
            apiRequest("/statistics"),
            apiRequest("/analyses?limit=5")
        ]);

        if ($("#totalAnalyses")) {
            $("#totalAnalyses").textContent =
                stats.analyses_in_latest_100 ?? "—";
        }

        if ($("#totalIssues")) {
            $("#totalIssues").textContent =
                stats.total_issues_in_latest_100 ?? "—";
        }

        if ($("#cleanAnalyses")) {
            $("#cleanAnalyses").textContent =
                stats.clean_analyses_in_latest_100 ?? "—";
        }

        if ($("#issueAnalyses")) {
            $("#issueAnalyses").textContent =
                stats.analyses_with_issues_in_latest_100 ?? "—";
        }

        const items = normalizeList(historyData);

        recent.innerHTML = items.length
            ? items.map(recentItemMarkup).join("")
            : `<div class="empty-state">
                   No analyses yet. Run your first code check to get started.
               </div>`;

        attachAnalysisClickHandlers(recent);
    } catch (error) {
        recent.innerHTML = `
            <div class="empty-state">
                Could not load dashboard data.
                ${escapeHtml(error.message)}
            </div>`;

        showToast("Could not load dashboard data. Check the API.");
    }
}

/* ANALYSIS HISTORY */

async function refreshHistory() {
    const tbody = $("#historyTable");
    if (!tbody) return;

    tbody.innerHTML = `
        <tr><td colspan="5" class="loading-state">Loading history…</td></tr>`;

    try {
        const data = await apiRequest("/analyses?limit=100");
        const items = normalizeList(data).map(normalizeAnalysis);

        if (!items.length) {
            tbody.innerHTML = `
                <tr><td colspan="5" class="empty-state">
                    No analyses yet. Your results will appear here.
                </td></tr>`;
            return;
        }

        tbody.innerHTML = items.map((item) => `
            <tr>
                <td><span class="file-name">${escapeHtml(item.filename)}</span></td>
                <td>${statusMarkup(item)}</td>
                <td>${item.issueCount}</td>
                <td>${escapeHtml(formatDate(item.createdAt))}</td>
                <td>
                    ${item.id != null
                        ? `<button class="view-button"
                                   data-analysis-id="${escapeHtml(item.id)}">
                               View →
                           </button>`
                        : "—"}
                </td>
            </tr>
        `).join("");

        attachAnalysisClickHandlers(tbody);
    } catch (error) {
        tbody.innerHTML = `
            <tr><td colspan="5" class="empty-state">
                Could not load history: ${escapeHtml(error.message)}
            </td></tr>`;
    }
}

/* ISSUE INFORMATION */

function getIssueDescription(issue) {
    if (typeof issue === "string") return issue;
    if (!issue || typeof issue !== "object") {
        return String(issue ?? "Unknown issue");
    }

    return issue.message ??
        issue.description ??
        issue.detail ??
        issue.text ??
        issue.msg ??
        "No description provided";
}

function getIssueLine(issue) {
    if (!issue || typeof issue !== "object") return null;

    return issue.line ??
        issue.lineno ??
        issue.line_number ??
        issue.lineNumber ??
        issue.location?.line ??
        null;
}

function getIssueCode(issue) {
    if (!issue || typeof issue !== "object") return "";

    return issue.code ??
        issue.rule ??
        issue.type ??
        issue.category ??
        "";
}

function getIssueSeverity(issue) {
    if (!issue || typeof issue !== "object") return "warning";

    const rawSeverity = String(
        issue.severity ?? issue.level ?? issue.type ?? ""
    ).toLowerCase();

    if (
        rawSeverity.includes("error") ||
        rawSeverity.includes("critical") ||
        rawSeverity.includes("fatal") ||
        rawSeverity.includes("syntax")
    ) {
        return "error";
    }

    if (
        rawSeverity.includes("info") ||
        rawSeverity.includes("suggestion")
    ) {
        return "info";
    }

    return "warning";
}

function getIssueAdvice(issue) {
    const code = String(getIssueCode(issue)).toUpperCase();

    const advice = {
        UNUSED_IMPORT: {
            title: "Unused import",
            explanation:
                "The file imports a module or name that is not used anywhere in the analyzed code.",
            fix:
                "Remove the import if you do not need it. If you intended to use it, add the code that needs it."
        },
        MISSING_FINAL_NEWLINE: {
            title: "Missing final newline",
            explanation:
                "The file does not end with a newline character. Many code editors and tools expect a newline at the end of a text file.",
            fix:
                "Move to the end of the file and press Enter once, then save the file."
        },
        LONG_LINE: {
            title: "Line is too long",
            explanation:
                "A line exceeds the maximum length checked by this analyzer.",
            fix:
                "Split the statement across multiple lines where appropriate. For long expressions, consider using parentheses."
        },
        SYNTAX_ERROR: {
            title: "Python syntax error",
            explanation:
                "Python could not parse part of the source code.",
            fix:
                "Check the reported line for missing colons, brackets, quotation marks, or incorrect indentation."
        },
        EMPTY_FILE: {
            title: "Empty file",
            explanation:
                "The analyzer did not find any code to inspect.",
            fix:
                "Add the intended Python code to the file and run the analysis again."
        }
    };

    if (advice[code]) return advice[code];

    return {
        title: code ? code.replaceAll("_", " ") : "Code finding",
        explanation: getIssueDescription(issue),
        fix:
            "Review the finding and the reported line. The exact fix depends on the code and the rule that was triggered."
    };
}

function issueMarkup(issue, index) {
    const message = getIssueDescription(issue);
    const code = getIssueCode(issue);
    const line = getIssueLine(issue);
    const severity = getIssueSeverity(issue);

    const severityLabel = {
        error: "Error",
        warning: "Warning",
        info: "Info"
    }[severity];

    return `
        <div class="issue-row issue-clickable"
             role="button"
             tabindex="0"
             data-issue-index="${index}"
             style="cursor:pointer"
             aria-label="Open details for ${escapeHtml(code || message)}">
            <div class="issue-heading">
                <span class="issue-severity ${severity}">
                    ${severityLabel}
                </span>
                ${code
                    ? `<span class="issue-code">${escapeHtml(code)}</span>`
                    : ""}
            </div>

            <strong>
                ${line != null
                    ? `Line ${escapeHtml(line)}`
                    : `Finding ${index + 1}`}
            </strong>

            <p>${escapeHtml(message)}</p>
            <small class="issue-action-hint">
                Click to view explanation and suggested fix →
            </small>
        </div>
    `;
}

function attachIssueClickHandlers(
    container,
    filename,
    issues,
    sourceCode = "",
    targetEditorSelector = "#sourceCode"
) {
    if (!container) return;

    container.querySelectorAll("[data-issue-index]").forEach((element) => {
        const open = () => {
            const index = Number(element.dataset.issueIndex);
            const issue = issues[index];

            if (issue !== undefined) {
                showIssueDetails(
                    issue,
                    index,
                    filename,
                    sourceCode,
                    targetEditorSelector
                );
            }
        };

        element.addEventListener("click", open);

        element.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open();
            }
        });
    });
}

/* SAFE UNUSED-IMPORT DETECTION */

function getUnusedImportName(issue) {
    const message = getIssueDescription(issue);

    const patterns = [
        /Imported name\s+['"]([^'"]+)['"]\s+is not used/i,
        /unused import\s*[:\-]?\s*['"]?([A-Za-z_]\w*)/i,
        /imported\s+['"]([^'"]+)['"]\s+is unused/i
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) return match[1];
    }

    if (issue && typeof issue === "object") {
        return issue.imported_name ??
            issue.import_name ??
            issue.name ??
            null;
    }

    return null;
}

function findSafeUnusedImportLine(sourceCode, issue) {
    const importedName = getUnusedImportName(issue);

    if (!importedName || !/^[A-Za-z_]\w*$/.test(importedName)) {
        return -1;
    }

    const lines = sourceCode.split(/\r?\n/);

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];

        /*
         * Only remove a standalone "import module" statement.
         * Multiple imports on one line are intentionally not auto-fixed.
         */
        const importMatch = line.match(
            /^\s*import\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?:\s+as\s+([A-Za-z_]\w*))?\s*(?:#.*)?$/
        );

        if (importMatch) {
            const fullModuleName = importMatch[1];
            const localName = importMatch[2] || fullModuleName.split(".")[0];

            if (
                importedName === localName ||
                importedName === fullModuleName
            ) {
                return index;
            }
        }

        /*
         * Support a single name imported with "from module import name".
         * Imports containing commas, parentheses, or multiple names are
         * left untouched to avoid deleting code that may still be needed.
         */
        const fromMatch = line.match(
            /^\s*from\s+[\w.]+\s+import\s+([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?\s*(?:#.*)?$/
        );

        if (fromMatch) {
            const importedSymbol = fromMatch[1];
            const localName = fromMatch[2] || importedSymbol;

            if (
                importedName === importedSymbol ||
                importedName === localName
            ) {
                return index;
            }
        }
    }

    return -1;
}

/* INDIVIDUAL ISSUE DETAILS AND AUTO-FIX */

function showIssueDetails(
    issue,
    index,
    filename = "Python file",
    sourceCode = "",
    targetEditorSelector = "#sourceCode"
) {
    const modal = $("#detailModal");
    const title = $("#detailTitle");
    const content = $("#detailContent");

    if (!modal || !title || !content) {
        showToast("The details window is not available on this page.");
        return;
    }

    const message = getIssueDescription(issue);
    const code = String(getIssueCode(issue)).toUpperCase();
    const line = getIssueLine(issue);
    const severity = getIssueSeverity(issue);
    const advice = getIssueAdvice(issue);

    const severityLabel = {
        error: "Error",
        warning: "Warning",
        info: "Info"
    }[severity];

    // Auto-fix is available only when an editable source-code editor exists.
    const canAutoFix =
        Boolean(targetEditorSelector) &&
        (
            code === "MISSING_FINAL_NEWLINE" ||
            code === "UNUSED_IMPORT"
        );

    title.textContent = advice.title;

    content.innerHTML = `
        <div class="result-summary">
            <div class="result-symbol">!</div>
            <div>
                <strong>${escapeHtml(advice.title)}</strong>
                <small>
                    ${escapeHtml(filename)}
                    ${line != null ? ` · Line ${escapeHtml(line)}` : ""}
                </small>
            </div>
        </div>

        <div class="detail-issues">
            <div class="issue-row">
                <div class="issue-heading">
                    <span class="issue-severity ${severity}">
                        ${severityLabel}
                    </span>
                    ${code
                        ? `<span class="issue-code">${escapeHtml(code)}</span>`
                        : ""}
                </div>
                <strong>What was detected?</strong>
                <p>${escapeHtml(message)}</p>
            </div>

            <div class="issue-row">
                <strong>Explanation</strong>
                <p>${escapeHtml(advice.explanation)}</p>
            </div>

            <div class="issue-row">
                <strong>Suggested fix</strong>
                <p>${escapeHtml(advice.fix)}</p>
            </div>
        </div>

        ${canAutoFix
            ? `<div class="quick-actions">
                   <button type="button" id="autoFixButton" class="primary-button">
                       Fix automatically
                   </button>
               </div>`
            : ""}
    `;

    modal.hidden = false;

    $("#autoFixButton")?.addEventListener("click", () => {
        const editor = targetEditorSelector
            ? $(targetEditorSelector)
            : null;

        if (!editor) {
            showToast("Could not find the code editor for this fix.");
            return;
        }

        // Use the editor's current contents, not an older captured copy.
        const currentCode = editor.value;

        if (code === "MISSING_FINAL_NEWLINE") {
            if (currentCode.endsWith("\n")) {
                showToast("The code already ends with a newline.");
                return;
            }

            editor.value = currentCode + "\n";
            editor.dispatchEvent(new Event("input", { bubbles: true }));

            modal.hidden = true;
            showToast("Final newline added! Run the analysis again to verify it.");
            return;
        }

        if (code === "UNUSED_IMPORT") {
            const lineIndex = findSafeUnusedImportLine(currentCode, issue);

            if (lineIndex === -1) {
                showToast(
                    "This import cannot be safely identified. Please remove it manually."
                );
                return;
            }

            const lines = currentCode.split(/\r?\n/);
            lines.splice(lineIndex, 1);

            const lineEnding = currentCode.includes("\r\n") ? "\r\n" : "\n";
            editor.value = lines.join(lineEnding);

            editor.dispatchEvent(new Event("input", { bubbles: true }));

            modal.hidden = true;
            showToast("Unused import removed! Run the analysis again to verify it.");
        }
    });
}

/* RENDER ANALYSIS RESULTS */

function renderAnalysisResult(container, rawData) {
    const data = normalizeAnalysis(rawData);

    const success = rawData.success !== false && rawData.valid !== false;
    const clean = data.issueCount === 0 && success;

    container.hidden = false;

    const errors = data.issues.filter(
        (issue) => getIssueSeverity(issue) === "error"
    ).length;

    const warnings = data.issues.filter(
        (issue) => getIssueSeverity(issue) === "warning"
    ).length;

    container.innerHTML = `
        <div class="result-summary">
            <div class="result-symbol">${clean ? "✓" : "!"}</div>
            <div>
                <strong>
                    ${clean
                        ? "No issues found!"
                        : success
                            ? "Analysis complete"
                            : "Analysis could not complete"}
                </strong>
                <small>
                    ${escapeHtml(data.filename)}
                    · ${data.issueCount}
                    ${data.issueCount === 1 ? "issue" : "issues"} detected
                </small>
            </div>
        </div>

        <div class="result-metrics">
            <div class="result-metric">
                <strong>${data.issueCount}</strong>
                <span>Total findings</span>
            </div>
            <div class="result-metric">
                <strong>${errors}</strong>
                <span>Errors</span>
            </div>
            <div class="result-metric">
                <strong>${warnings}</strong>
                <span>Warnings</span>
            </div>
        </div>

        <div class="detail-issues">
            ${data.issues.length
                ? data.issues.map((issue, index) => issueMarkup(issue, index)).join("")
                : `<div class="issue-row">
                       <p>
                           ${clean
                               ? "Your analyzer did not detect any supported issues in this file."
                               : escapeHtml(
                                   rawData.message ??
                                   rawData.detail ??
                                   "Check the analysis response for more information."
                               )}
                       </p>
                   </div>`}
        </div>

        ${data.id != null
            ? `<div class="quick-actions">
                   <span class="hint">Saved in analysis history</span>
                   <button class="text-button" data-go="history">View history →</button>
               </div>`
            : ""}
    `;

    const isQuickAnalyzer = container.id === "quickResult";
    const targetEditorSelector = isQuickAnalyzer ? "#quickCode" : "#sourceCode";
    const sourceCode = $(targetEditorSelector)?.value ?? data.sourceCode;

    attachIssueClickHandlers(
        container,
        data.filename,
        data.issues,
        sourceCode,
        targetEditorSelector
    );

    container.querySelectorAll("[data-go]").forEach((button) => {
        button.addEventListener("click", () => switchPage(button.dataset.go));
    });
}

/* RUN ANALYSIS */

async function runAnalysis(filenameInput, codeInput, button, resultContainer) {
    if (!filenameInput || !codeInput || !button || !resultContainer) {
        showToast("Could not find the analyzer form.");
        return;
    }

    const filename = filenameInput.value.trim();
    const sourceCode = codeInput.value;

    if (!filename) {
        showToast("Please enter a filename.");
        filenameInput.focus();
        return;
    }

    if (!filename.toLowerCase().endsWith(".py")) {
        showToast("Please use a filename ending in .py");
        filenameInput.focus();
        return;
    }

    if (!sourceCode.trim()) {
        showToast("Please paste some Python code first.");
        codeInput.focus();
        return;
    }

    const originalText = button.innerHTML;

    button.disabled = true;
    button.textContent = "Analyzing…";

    resultContainer.hidden = false;
    resultContainer.innerHTML =
        '<div class="loading-state">Analyzing your code…</div>';

    try {
        const data = await apiRequest("/analyze", {
            method: "POST",
            body: JSON.stringify({
                filename,
                source_code: sourceCode
            })
        });

        renderAnalysisResult(resultContainer, data);
        showToast("Analysis completed.");
        await refreshDashboard();
    } catch (error) {
        resultContainer.hidden = false;
        resultContainer.innerHTML = `
            <div class="result-summary">
                <div class="result-symbol">!</div>
                <div>
                    <strong>Analysis failed</strong>
                    <small>${escapeHtml(error.message)}</small>
                </div>
            </div>`;

        showToast(`Analysis failed: ${error.message}`);
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

$("#quickAnalyze")?.addEventListener("click", () => {
    runAnalysis(
        $("#quickFilename"),
        $("#quickCode"),
        $("#quickAnalyze"),
        $("#quickResult")
    );
});

$("#analyzeButton")?.addEventListener("click", () => {
    runAnalysis(
        $("#filename"),
        $("#sourceCode"),
        $("#analyzeButton"),
        $("#analysisResult")
    );
});

/* SAVED ANALYSIS DETAILS */

async function showAnalysisDetails(id) {
    const modal = $("#detailModal");
    if (!modal) return;

    modal.hidden = false;
    $("#detailTitle").textContent = "Loading analysis…";
    $("#detailContent").innerHTML =
        '<div class="loading-state">Loading saved analysis…</div>';

    try {
        const rawData = await apiRequest(
            `/analyses/${encodeURIComponent(id)}`
        );

        const item = normalizeAnalysis(rawData);
        $("#detailTitle").textContent = item.filename;

        $("#detailContent").innerHTML = `
            <div class="result-summary">
                <div class="result-symbol">${item.issueCount === 0 ? "✓" : "!"}</div>
                <div>
                    <strong>
                        ${item.issueCount === 0
                            ? "No issues found"
                            : `${item.issueCount} ${item.issueCount === 1 ? "issue" : "issues"} detected`}
                    </strong>
                    <small>${escapeHtml(formatDate(item.createdAt))}</small>
                </div>
            </div>

            <div class="detail-issues">
                ${item.issues.length
                    ? item.issues.map((issue, index) => issueMarkup(issue, index)).join("")
                    : `<div class="issue-row">
                           <p>No issue details were returned for this analysis.</p>
                       </div>`}
            </div>

            ${item.sourceCode
                ? `<label class="field-label">Analyzed source code</label>
                   <textarea class="code-input large-code"
                             readonly
                             spellcheck="false">${escapeHtml(item.sourceCode)}</textarea>`
                : ""}
        `;

        attachIssueClickHandlers(
            $("#detailContent"),
            item.filename,
            item.issues,
            item.sourceCode,
            null
        );
    } catch (error) {
        $("#detailTitle").textContent = "Could not load analysis";
        $("#detailContent").innerHTML = `
            <div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
}

/* MODAL CONTROLS */

$("#closeModal")?.addEventListener("click", () => {
    $("#detailModal").hidden = true;
});

$("#detailModal")?.addEventListener("click", (event) => {
    if (event.target === $("#detailModal")) {
        $("#detailModal").hidden = true;
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && $("#detailModal")) {
        $("#detailModal").hidden = true;
    }
});

/* INITIALIZE APP */

refreshDashboard();

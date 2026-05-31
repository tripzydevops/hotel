"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Shield,
  FileText,
  Download,
  Printer,
  Eye,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  X,
  FileCode,
  Loader2,
  Lock,
  RefreshCw,
  Server,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";

interface DocInfo {
  id: string;
  title: string;
  format: string;
}

interface DocContent extends DocInfo {
  content: string;
}

export default function CompliancePanel() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocContent | null>(null);
  const [viewingDoc, setViewingDoc] = useState(false);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResults, setAuditResults] = useState<any | null>(null);

  const handleRunAudit = async () => {
    setAuditLoading(true);
    try {
      const data = await api.runSecurityAudit();
      setAuditResults(data);
      toast.success("Security configuration audit completed successfully.");
    } catch (err: any) {
      console.error("Failed to run security audit:", err);
      toast.error("Failed to run security audit: " + err.message);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await api.getComplianceDocuments();
      setDocs(data);
    } catch (err: any) {
      console.error("Failed to load compliance documents:", err);
      toast.error("Failed to load documents list: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReadDoc = async (id: string) => {
    setLoadingDocId(id);
    try {
      const doc = await api.getComplianceDocument(id);
      setSelectedDoc(doc);
      setViewingDoc(true);
    } catch (err: any) {
      console.error("Failed to load document content:", err);
      toast.error("Failed to load document: " + err.message);
    } finally {
      setLoadingDocId(null);
    }
  };

  const handleDownloadRaw = (doc: DocContent) => {
    try {
      const blob = new Blob([doc.content], {
        type: doc.format === "json" ? "application/json" : "text/markdown",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.format === "json" ? `hotelplus_openapi.json` : `${doc.id}_policy.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`${doc.title} downloaded successfully.`);
    } catch (err) {
      toast.error("Download failed.");
    }
  };

  const handlePrintDoc = (doc: DocContent) => {
    // Open a new print window and format it beautifully
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked! Please allow popups to print/save as PDF.");
      return;
    }

    const title = doc.title;
    const bodyContent = doc.format === "json" 
      ? `<pre style="font-family: monospace; white-space: pre-wrap; font-size: 11px;">${escapeHtml(doc.content)}</pre>`
      : renderSimpleMarkdown(doc.content);

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #1a1a1a;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { font-size: 24px; border-bottom: 2px solid #ea580c; padding-bottom: 10px; margin-top: 0; color: #1e293b; }
            h2 { font-size: 18px; margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; color: #334155; }
            h3 { font-size: 14px; margin-top: 20px; color: #475569; }
            p, li { font-size: 13px; color: #334155; }
            pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; font-size: 11px; overflow-x: auto; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
            th { background: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            td { border: 1px solid #cbd5e1; padding: 8px; }
            blockquote { border-left: 4px solid #ea580c; margin: 15px 0; padding-left: 15px; font-style: italic; color: #475569; }
            @media print {
              body { padding: 20px; font-size: 12px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div>${bodyContent}</div>
          <script>
            window.onload = function() {
              window.print();
              // window.close(); // Optional: close window after print dialog closes
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Basic markdown structural parser for the print window HTML rendering
  const renderSimpleMarkdown = (md: string) => {
    let html = md;
    
    // Escape HTML first to prevent raw script injections
    html = escapeHtml(html);

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, "<pre>$1</pre>");

    // Headers
    html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");
    html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
    html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");

    // Table mapping
    html = html.replace(/\|(.+?)\|/g, (match) => {
      // Very simple table row parsing
      const cells = match.split("|").slice(1, -1);
      const isHeader = html.includes("---");
      const tag = isHeader ? "th" : "td";
      return "<tr>" + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join("") + "</tr>";
    });
    // Wrap consecutive <tr> in <table>
    html = html.replace(/(<tr>[\s\S]*?<\/tr>)/g, "<table>$1</table>");
    html = html.replace(/<\/table>\s*<table>/g, ""); // Merge consecutive tables

    // Bullet points
    html = html.replace(/^\*\s+(.*?)$/gm, "<li>$1</li>");
    html = html.replace(/^- \s*(.*?)$/gm, "<li>$1</li>");
    // Wrap lists
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");

    // Blockquotes (Alerts)
    html = html.replace(/^&gt;\s*\[!IMPORTANT\](.*?)$/gm, "<blockquote><strong>IMPORTANT:</strong>$1</blockquote>");
    html = html.replace(/^&gt;\s*\[!WARNING\](.*?)$/gm, "<blockquote><strong>WARNING:</strong>$1</blockquote>");
    html = html.replace(/^&gt;\s*\[!CAUTION\](.*?)$/gm, "<blockquote><strong>CAUTION:</strong>$1</blockquote>");
    html = html.replace(/^&gt;\s*(.*?)$/gm, "<blockquote>$1</blockquote>");

    // Bold text
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Horizontal Rule
    html = html.replace(/^---$/gm, "<hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;' />");

    // Line breaks
    html = html.replace(/\n\n/g, "<p></p>");

    return html;
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      {/* Header Panel */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-[var(--overlay-border)] flex items-center justify-center">
            <Shield className="w-5 h-5 text-[var(--soft-gold)]" />
          </div>
          <div>
            <h3 className="text-xs font-black text-[var(--overlay-text)] uppercase tracking-widest">
              Compliance & Security Center
            </h3>
            <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-tighter opacity-50">
              Approved audit policies & B2B procurement data exports
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Checklist & Readiness */}
        <div className="lg:col-span-4 min-w-0 space-y-6">
          <div className="glass-card border border-[var(--overlay-border)] p-6 space-y-6">
            <h4 className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-[0.2em]">
              Vendor Readiness Scorecard
            </h4>

            {/* Shield Score */}
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-[var(--overlay-border)]">
              <div className="w-12 h-12 rounded-full bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] flex items-center justify-center text-xl font-bold shadow-inner">
                92%
              </div>
              <div>
                <h5 className="text-sm font-bold text-[var(--overlay-text)]">
                  Audit Readiness
                </h5>
                <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold mt-0.5">
                  SAQ-A Out-of-Scope Eligible
                </p>
              </div>
            </div>

            {/* Checklist Matrix */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs text-[var(--text-secondary)] font-semibold">
                  PCI DSS v4.0.1
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Exempt (SAQ-A)
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs text-[var(--text-secondary)] font-semibold">
                  GDPR / KVKK
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Compliant
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs text-[var(--text-secondary)] font-semibold">
                  SOC 2 Type II
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20">
                  In Prep (60%)
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs text-[var(--text-secondary)] font-semibold">
                  WCAG 2.1 AA (ADA)
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20">
                  In Prep (50%)
                </span>
              </div>
            </div>

            {/* Alert / Verification block */}
            <div className="bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/10 rounded-xl p-4 flex gap-3 text-xs leading-relaxed">
              <CheckCircle2 className="w-5 h-5 text-[var(--soft-gold)] shrink-0 mt-0.5" />
              <div className="text-[var(--text-muted)]">
                <strong>GDPR Purge & OpenAPI generation</strong> were executed and validated. The data isolation is active, and rate limits are fully operational.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Documents List */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-card border border-[var(--overlay-border)] overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[var(--overlay-border)] bg-white/[0.01]">
              <h4 className="text-[10px] font-black text-[var(--overlay-text)]/70 uppercase tracking-[0.2em]">
                Compliance Documents Directory
              </h4>
            </div>

            {loading ? (
              <div className="p-24 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-[var(--soft-gold)] mx-auto opacity-50" />
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-5 hover:bg-white/[0.01] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[var(--text-muted)] group-hover:border-[var(--soft-gold)]/20 group-hover:text-[var(--soft-gold)] transition-all mt-0.5">
                        {doc.format === "json" ? (
                          <FileCode className="w-5 h-5" />
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-[var(--overlay-text)] group-hover:text-[var(--soft-gold)] transition-colors">
                          {doc.title}
                        </h5>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mt-1">
                          File Type: {doc.format.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleReadDoc(doc.id)}
                        disabled={loadingDocId !== null}
                        className="p-2 text-xs font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--overlay-text)] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg flex items-center gap-1.5 transition-all"
                        title="Read Document Online"
                      >
                        {loadingDocId === doc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        <span>View</span>
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const data = await api.getComplianceDocument(doc.id);
                            handlePrintDoc(data);
                          } catch (err: any) {
                            toast.error("Failed to load document for print.");
                          }
                        }}
                        className="p-2 text-xs font-black uppercase tracking-widest text-[var(--soft-gold)] hover:text-white bg-[var(--soft-gold)]/10 hover:bg-[var(--soft-gold)]/20 border border-[var(--soft-gold)]/20 hover:border-[var(--soft-gold)] rounded-lg flex items-center gap-1.5 transition-all"
                        title="Print / Save as PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>PDF / Print</span>
                      </button>
                    </div>
                  </div>
                ))}

                {docs.length === 0 && (
                  <div className="p-20 text-center text-[var(--text-muted)] font-mono text-xs uppercase tracking-widest opacity-40">
                    <Shield className="w-10 h-10 mx-auto mb-4 opacity-20" />
                    No compliance documents found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Security Configuration Auditor ──────────────────────────────── */}
      <div className="glass-card border border-[var(--overlay-border)] p-6 space-y-6 shadow-2xl transition-all duration-500 hover:border-[var(--soft-gold)]/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-[var(--overlay-border)] flex items-center justify-center text-[var(--soft-gold)]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-[var(--overlay-text)] uppercase tracking-widest">
                Security Configuration Auditor
              </h4>
              <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-tighter opacity-50">
                On-demand defensive system architecture checks
              </p>
            </div>
          </div>
          
          <button
            onClick={handleRunAudit}
            disabled={auditLoading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--soft-gold)] text-[var(--deep-ocean)] font-bold text-xs uppercase tracking-wider hover:bg-[var(--soft-gold-hover)] active:scale-95 transition-all shadow-lg disabled:opacity-50"
          >
            {auditLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>{auditLoading ? "Auditing..." : "Run Security Audit"}</span>
          </button>
        </div>

        {!auditResults ? (
          <div className="p-12 text-center text-[var(--text-muted)] font-mono text-xs uppercase tracking-widest bg-black/10 rounded-xl border border-white/5">
            <Server className="w-8 h-8 mx-auto mb-3 opacity-20" />
            Click "Run Security Audit" to execute configuration scans.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Audit Executive Summary */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="text-xs">
                <span className="text-[var(--text-muted)]">Last Verified: </span>
                <span className="font-mono text-[var(--overlay-text)]">{new Date(auditResults.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Overall Status:</span>
                <span className={`px-3 py-1 rounded-lg text-xs font-black tracking-widest ${
                  auditResults.status === "PASS" 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20"
                }`}>
                  {auditResults.status}
                </span>
              </div>
            </div>

            {/* List of Checks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {auditResults.checks.map((check: any, idx: number) => (
                <div key={idx} className="p-5 rounded-2xl bg-white/5 border border-[var(--overlay-border)] space-y-3 hover:border-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black uppercase text-[var(--overlay-text)] tracking-wider">
                      {check.name}
                    </h5>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                      check.status === "PASS"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]"
                    }`}>
                      {check.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    {check.description}
                  </p>
                  
                  {/* Key-Value details */}
                  <div className="p-3 bg-black/30 rounded-xl border border-white/5 space-y-1.5 font-mono text-[10px]">
                    {Object.entries(check.details).map(([key, val]: [string, any]) => (
                      <div key={key} className="flex justify-between items-start gap-2">
                        <span className="text-[var(--text-muted)] shrink-0">{key}:</span>
                        <span className="text-blue-300 text-right break-all">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Online Document Reader Modal */}
      {viewingDoc && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="glass-card w-full max-w-4xl p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--overlay-border)] mb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-[var(--soft-gold)]" />
                <h3 className="text-lg font-bold text-[var(--overlay-text)]">
                  {selectedDoc.title}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePrintDoc(selectedDoc)}
                  className="p-2 text-xs font-black uppercase tracking-widest text-[var(--soft-gold)] hover:text-white bg-[var(--soft-gold)]/10 hover:bg-[var(--soft-gold)]/20 border border-[var(--soft-gold)]/20 hover:border-[var(--soft-gold)] rounded-lg flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Save as PDF / Print</span>
                </button>
                <button
                  onClick={() => handleDownloadRaw(selectedDoc)}
                  className="p-2 text-xs font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--overlay-text)] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Raw</span>
                </button>
                <button
                  onClick={() => setViewingDoc(false)}
                  className="p-2 rounded-xl bg-white/5 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--overlay-text)] transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Content Scroll View */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-black/20 p-6 rounded-xl border border-[var(--overlay-border)] text-sm font-light text-[var(--text-secondary)] leading-relaxed space-y-4 select-text">
              {selectedDoc.format === "json" ? (
                <pre className="font-mono text-xs text-blue-300 overflow-x-auto whitespace-pre-wrap select-text">
                  {selectedDoc.content}
                </pre>
              ) : (
                <div className="space-y-6 text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-sans select-text">
                  {selectedDoc.content}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

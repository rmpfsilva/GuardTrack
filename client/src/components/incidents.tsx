import { useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle, Plus, Search, Archive, ArchiveRestore, Trash2,
  Eye, Edit, Loader2, ExternalLink, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, Clock, XCircle, AlertCircle, Sparkles, Settings2, X,
  LayoutDashboard, List, Download, Wand2,
} from "lucide-react";
import type { Issue } from "@shared/schema";

const PRIORITY_COLOURS: Record<string, string> = {
  High: "text-red-600 bg-red-50 border-red-200",
  Medium: "text-amber-600 bg-amber-50 border-amber-200",
  Low: "text-green-600 bg-green-50 border-green-200",
};

const SEVERITY_COLOURS: Record<string, string> = {
  Critical: "text-red-700 bg-red-100 border-red-300",
  Severe: "text-orange-600 bg-orange-50 border-orange-200",
  Moderate: "text-amber-600 bg-amber-50 border-amber-200",
  Low: "text-green-600 bg-green-50 border-green-200",
};

const STATUS_ICONS: Record<string, any> = {
  Open: AlertCircle,
  "In progress": Clock,
  Resolved: CheckCircle2,
  Closed: XCircle,
  Reopened: RefreshCw,
};

const STATUS_COLOURS: Record<string, string> = {
  Open: "text-red-600 bg-red-50 border-red-200",
  "In progress": "text-blue-600 bg-blue-50 border-blue-200",
  Resolved: "text-green-600 bg-green-50 border-green-200",
  Closed: "text-muted-foreground bg-muted border-muted",
  Reopened: "text-orange-600 bg-orange-50 border-orange-200",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  reportedBy: "",
  assignedTo: "",
  priority: "Medium",
  category: "",
  severity: "Moderate",
  department: "Management",
  status: "Open",
  dueDate: "",
  siteName: "",
  rootCause: "",
  remedialAction: "",
  proposedAction: "",
  comments: "",
};

type FormData = typeof EMPTY_FORM;
type Section = "dashboard" | "issue-log" | "archived" | "settings";

type CompanyUser = { id: string; firstName?: string | null; lastName?: string | null; username: string; role: string; };
type CompanySite = { id: string; name: string; address: string; };

function userDisplayName(u: CompanyUser): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return name || u.username;
}

async function printIssuePDF(issue: Issue, onDone?: () => void) {
  let branding: any = {};
  try {
    const res = await fetch('/api/company-settings');
    if (res.ok) branding = await res.json();
  } catch {}

  const fmt = (d: any) => d ? new Date(d).toLocaleDateString("en-GB") : "N/A";
  const CONTAINER_W = 794;
  const LOGO_MAX_W = 300;
  const LOGO_MAX_H = 120;
  const toMm = (px: number) => (px * 210) / CONTAINER_W;

  // ── Step 1: Pre-load logo BEFORE touching the DOM ──────────────────────────
  // We compute display dimensions and downsample the logo to a print-ready
  // resolution (2× display size max) before embedding. This prevents logos
  // with huge native resolutions (e.g. 8000×8000) from inflating the PDF.
  let logoPDF: { x: number; y: number; w: number; h: number; fmt: string; dataUrl: string } | null = null;
  let logoPlaceholderHtml = '';

  if (branding.logoUrl) {
    const preload = new Image();
    await new Promise<void>((resolve) => {
      preload.onload = () => resolve();
      preload.onerror = () => resolve();
      preload.src = branding.logoUrl;
    });

    if (preload.naturalWidth > 0 && preload.naturalHeight > 0) {
      // Apply CSS max-width / max-height constraints while keeping aspect ratio
      const ratio = preload.naturalWidth / preload.naturalHeight;
      let dw = preload.naturalWidth;
      let dh = preload.naturalHeight;
      if (dw > LOGO_MAX_W) { dw = LOGO_MAX_W; dh = LOGO_MAX_W / ratio; }
      if (dh > LOGO_MAX_H) { dh = LOGO_MAX_H; dw = LOGO_MAX_H * ratio; }
      dw = Math.round(dw); dh = Math.round(dh);

      // Placeholder <div> that occupies exactly the same space the logo would
      logoPlaceholderHtml = `<div id="logo-ph" style="width:${dw}px;height:${dh}px;display:block;margin-bottom:8px;"></div>`;

      // Downsample logo to 2× display size for print-quality PDF embedding.
      // This prevents huge native resolutions (8000×8000, etc.) from bloating the PDF.
      const pdfLogoW = dw * 2;
      const pdfLogoH = dh * 2;
      const offscreen = document.createElement('canvas');
      offscreen.width = pdfLogoW;
      offscreen.height = pdfLogoH;
      const ctx = offscreen.getContext('2d')!;
      ctx.drawImage(preload, 0, 0, pdfLogoW, pdfLogoH);
      const isTransparent = branding.logoUrl.startsWith('data:image/png');
      const resizedDataUrl = offscreen.toDataURL(isTransparent ? 'image/png' : 'image/jpeg', 0.92);

      logoPDF = {
        x: 0, y: 0,
        w: toMm(dw), h: toMm(dh),
        fmt: isTransparent ? 'PNG' : 'JPEG',
        dataUrl: resizedDataUrl,
      };
    }
  }

  // ── Step 2: Build the container with placeholder (no <img> for the logo) ──
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed', 'left:-9999px', 'top:0',
    `width:${CONTAINER_W}px`, 'background:#fff', 'color:#111',
    'font-family:Arial,sans-serif', 'font-size:14px', 'padding:40px',
  ].join(';');

  container.innerHTML = `
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1d4ed8; padding-bottom:16px; margin-bottom:24px; gap:24px; }
  .header-left { flex:1; }
  .header-right { text-align:right; min-width:200px; }
  .company-name { font-size:18px; font-weight:700; color:#1d4ed8; }
  .company-details { font-size:11px; color:#6b7280; margin-top:2px; line-height:1.5; }
  .report-label { font-size:20px; font-weight:700; color:#1d4ed8; }
  .report-sub { font-size:12px; color:#6b7280; margin-top:4px; }
  .badges { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0 0; justify-content:flex-end; }
  .badge { padding:3px 10px; border-radius:4px; font-size:12px; font-weight:600; border:1px solid; }
  .badge-red { color:#dc2626; background:#fef2f2; border-color:#fecaca; }
  .badge-amber { color:#d97706; background:#fffbeb; border-color:#fde68a; }
  .badge-green { color:#16a34a; background:#f0fdf4; border-color:#bbf7d0; }
  .badge-blue { color:#2563eb; background:#eff6ff; border-color:#bfdbfe; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
  .field label { font-size:11px; text-transform:uppercase; color:#888; letter-spacing:0.05em; display:block; margin-bottom:3px; }
  .field p { font-size:14px; }
  .section { margin-bottom:20px; }
  .section h3 { font-size:12px; text-transform:uppercase; color:#888; letter-spacing:0.06em; border-bottom:1px solid #e5e7eb; padding-bottom:6px; margin-bottom:10px; }
  .section p { font-size:14px; line-height:1.7; white-space:pre-wrap; }
  .ncr-box { background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:16px; }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e5e7eb; font-size:12px; color:#888; display:flex; justify-content:space-between; }
</style>
<div class="header">
  <div class="header-left">
    ${logoPlaceholderHtml || (!branding.logoUrl && branding.companyName ? `<div class="company-name">${branding.companyName}</div>` : '')}
    <div class="company-details">
      ${branding.companyAddress ? branding.companyAddress.replace(/\n/g, ' &bull; ') + '<br>' : ''}
      ${branding.companyEmail || ''}${branding.companyPhone ? ' &bull; ' + branding.companyPhone : ''}
    </div>
  </div>
  <div class="header-right">
    <div class="report-label">NON-CONFORMANCE REPORT</div>
    <div class="report-sub">${issue.issueId}</div>
    <div class="report-sub">Generated: ${new Date().toLocaleDateString("en-GB")}</div>
    <div class="badges">
      ${issue.status ? `<span class="badge badge-blue">${issue.status}</span>` : ""}
      ${issue.priority === "High" ? `<span class="badge badge-red">${issue.priority}</span>` : issue.priority === "Medium" ? `<span class="badge badge-amber">${issue.priority}</span>` : issue.priority ? `<span class="badge badge-green">${issue.priority}</span>` : ""}
      ${issue.severity === "Critical" || issue.severity === "Severe" ? `<span class="badge badge-red">${issue.severity}</span>` : issue.severity === "Moderate" ? `<span class="badge badge-amber">${issue.severity}</span>` : issue.severity ? `<span class="badge badge-green">${issue.severity}</span>` : ""}
    </div>
  </div>
</div>
<div class="grid2">
  <div class="field"><label>Title</label><p>${issue.title || "—"}</p></div>
  <div class="field"><label>Site</label><p>${issue.siteName || "—"}</p></div>
  <div class="field"><label>Category</label><p>${issue.category || "—"}</p></div>
  <div class="field"><label>Department</label><p>${issue.department || "—"}</p></div>
  <div class="field"><label>Reported By</label><p>${issue.reportedBy || "—"}</p></div>
  <div class="field"><label>Assigned To</label><p>${issue.assignedTo || "—"}</p></div>
  <div class="field"><label>Date Logged</label><p>${fmt(issue.dateLogged)}</p></div>
  <div class="field"><label>Due Date</label><p>${fmt(issue.dueDate)}</p></div>
</div>
${issue.description ? `<div class="section"><h3>Description</h3><p>${issue.description}</p></div>` : ""}
${issue.rootCause ? `<div class="section"><h3>Root Cause</h3><p>${issue.rootCause}</p></div>` : ""}
${issue.remedialAction ? `<div class="section"><h3>Remedial Action Taken</h3><p>${issue.remedialAction}</p></div>` : ""}
${issue.proposedAction ? `<div class="section"><h3>Proposed Corrective Action</h3><p>${issue.proposedAction}</p></div>` : ""}
${issue.reportContent ? `<div class="section"><h3>AI-Generated NCR</h3><div class="ncr-box"><p>${issue.reportContent}</p></div></div>` : ""}
${issue.comments ? `<div class="section"><h3>Comments</h3><p>${issue.comments}</p></div>` : ""}
<div class="footer">
  <span>${branding.companyName || 'GuardTrack'} &bull; Incident Management &bull; Confidential</span>
  <span>${new Date().toLocaleDateString("en-GB")}</span>
</div>`;

  document.body.appendChild(container);

  // ── Step 3: Measure the placeholder position NOW (it's a plain div — always reliable) ──
  if (logoPDF) {
    const ph = container.querySelector('#logo-ph') as HTMLElement | null;
    if (ph) {
      const cRect = container.getBoundingClientRect();
      const pRect = ph.getBoundingClientRect();
      logoPDF.x = toMm(pRect.left - cRect.left);
      logoPDF.y = toMm(pRect.top  - cRect.top);
    }
  }

  try {
    // ── Step 4: Capture the page (placeholder space is blank — logo goes in next) ──
    const canvas = await html2canvas(container, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // Use JPEG for the content canvas — white background, much smaller than PNG
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * pageW) / canvas.width;

    // Multi-page: embed image data ONCE using an alias — jsPDF reuses it for each page
    const totalPages = Math.ceil(imgH / pageH);
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();
      // Shift image up by i * pageH to reveal the correct slice on each page
      pdf.addImage(imgData, 'JPEG', 0, -i * pageH, imgW, imgH, 'PAGE_CONTENT');
    }

    // ── Step 5: Stamp logo at 100% native resolution directly into the PDF ──
    // jsPDF uses the original image data — no scaling, no canvas resampling.
    if (logoPDF) {
      try {
        pdf.setPage(1);
        // Use the pre-downsampled dataUrl — never the raw original (can be 8000×8000+)
        pdf.addImage(logoPDF.dataUrl, logoPDF.fmt, logoPDF.x, logoPDF.y, logoPDF.w, logoPDF.h);
      } catch {
        // If logo fails, skip it — the rest of the PDF is still valid
      }
    }

    pdf.save(`NCR-${issue.issueId}-${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`);
  } finally {
    document.body.removeChild(container);
    onDone?.();
  }
}

function IssueForm({
  form, onChange, settings, companyUsers, companySites,
}: {
  form: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  settings: any[];
  companyUsers: CompanyUser[];
  companySites: CompanySite[];
}) {
  const opts = (type: string) => settings.filter(s => s.settingType === type).map(s => s.value);

  return (
    <div className="grid grid-cols-1 gap-4 py-2">
      <div className="space-y-1.5">
        <Label>Title *</Label>
        <Input value={form.title} onChange={e => onChange("title", e.target.value)} placeholder="Brief incident title" data-testid="input-issue-title" />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => onChange("description", e.target.value)} placeholder="Full description of the incident" rows={3} data-testid="input-issue-description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Reported By</Label>
          <Select value={form.reportedBy} onValueChange={v => onChange("reportedBy", v)}>
            <SelectTrigger data-testid="select-issue-reported-by"><SelectValue placeholder="Select person…" /></SelectTrigger>
            <SelectContent>
              {companyUsers.map(u => (
                <SelectItem key={u.id} value={userDisplayName(u)}>
                  <span>{userDisplayName(u)}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground capitalize">({u.role})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Assigned To</Label>
          <Select value={form.assignedTo} onValueChange={v => onChange("assignedTo", v)}>
            <SelectTrigger data-testid="select-issue-assigned-to"><SelectValue placeholder="Select person…" /></SelectTrigger>
            <SelectContent>
              {companyUsers.map(u => (
                <SelectItem key={u.id} value={userDisplayName(u)}>
                  <span>{userDisplayName(u)}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground capitalize">({u.role})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Site</Label>
          <Select value={form.siteName} onValueChange={v => onChange("siteName", v)}>
            <SelectTrigger data-testid="select-issue-site"><SelectValue placeholder="Select site…" /></SelectTrigger>
            <SelectContent>
              {companySites.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Due Date</Label>
          <Input type="date" value={form.dueDate} onChange={e => onChange("dueDate", e.target.value)} data-testid="input-issue-due-date" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={v => onChange("priority", v)}>
            <SelectTrigger data-testid="select-issue-priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(opts("priority").length ? opts("priority") : ["Low", "Medium", "High"]).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <Select value={form.severity} onValueChange={v => onChange("severity", v)}>
            <SelectTrigger data-testid="select-issue-severity"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(opts("severity").length ? opts("severity") : ["Low", "Moderate", "Severe", "Critical"]).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => onChange("status", v)}>
            <SelectTrigger data-testid="select-issue-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(opts("status").length ? opts("status") : ["Open", "In progress", "Resolved", "Closed"]).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => onChange("category", v)}>
            <SelectTrigger data-testid="select-issue-category"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {opts("category").map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Select value={form.department} onValueChange={v => onChange("department", v)}>
            <SelectTrigger data-testid="select-issue-department"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(opts("department").length ? opts("department") : ["Management"]).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Root Cause</Label>
        <Textarea value={form.rootCause} onChange={e => onChange("rootCause", e.target.value)} placeholder="Identified root cause" rows={2} data-testid="input-issue-root-cause" />
      </div>
      <div className="space-y-1.5">
        <Label>Remedial Action Taken</Label>
        <Textarea value={form.remedialAction} onChange={e => onChange("remedialAction", e.target.value)} placeholder="Actions already taken" rows={2} data-testid="input-issue-remedial-action" />
      </div>
      <div className="space-y-1.5">
        <Label>Proposed Corrective Action</Label>
        <Textarea value={form.proposedAction} onChange={e => onChange("proposedAction", e.target.value)} placeholder="Planned future actions" rows={2} data-testid="input-issue-proposed-action" />
      </div>
      <div className="space-y-1.5">
        <Label>Comments</Label>
        <Textarea value={form.comments} onChange={e => onChange("comments", e.target.value)} placeholder="Additional notes" rows={2} data-testid="input-issue-comments" />
      </div>
    </div>
  );
}

function IssueRow({ issue, onEdit, onView, onArchive, onDelete }: {
  issue: Issue;
  onEdit: (i: Issue) => void;
  onView: (i: Issue) => void;
  onArchive: (i: Issue) => void;
  onDelete: (i: Issue) => void;
}) {
  const StatusIcon = STATUS_ICONS[issue.status || "Open"] || AlertCircle;
  const isOverdue = issue.dueDate && new Date(issue.dueDate) < new Date() && issue.status !== "Closed" && issue.status !== "Resolved";

  return (
    <div className="flex items-start gap-3 p-4 rounded-md border hover-elevate" data-testid={`row-issue-${issue.id}`}>
      <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${STATUS_COLOURS[issue.status || "Open"]?.split(" ")[0] || "text-muted-foreground"}`} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">{issue.issueId}</span>
          {issue.priority && <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${PRIORITY_COLOURS[issue.priority] || ""}`}>{issue.priority}</span>}
          {issue.severity && <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${SEVERITY_COLOURS[issue.severity] || ""}`}>{issue.severity}</span>}
          {isOverdue && <span className="text-xs px-1.5 py-0.5 rounded border font-medium text-red-700 bg-red-100 border-red-300">Overdue</span>}
        </div>
        <p className="font-medium text-sm leading-snug">{issue.title}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {issue.siteName && <span>{issue.siteName}</span>}
          {issue.category && <span>{issue.category}</span>}
          {issue.assignedTo && <span>Assigned: {issue.assignedTo}</span>}
          {issue.dueDate && <span className={isOverdue ? "text-red-600" : ""}>Due: {new Date(issue.dueDate).toLocaleDateString("en-GB")}</span>}
          <span className={`font-medium ${STATUS_COLOURS[issue.status || "Open"]?.split(" ")[0] || ""}`}>{issue.status}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button size="icon" variant="ghost" onClick={() => onView(issue)} title="View" data-testid={`button-view-issue-${issue.id}`}><Eye className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => onEdit(issue)} title="Edit" data-testid={`button-edit-issue-${issue.id}`}><Edit className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => onArchive(issue)} title={issue.isArchived ? "Restore" : "Archive"} data-testid={`button-archive-issue-${issue.id}`}>
          {issue.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(issue)} title="Delete" data-testid={`button-delete-issue-${issue.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
    </div>
  );
}

function BreakdownTable({ title, data, colourMap }: { title: string; data: Record<string, number>; colourMap?: Record<string, string> }) {
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {sorted.map(([key, val]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${colourMap?.[key] || "text-muted-foreground bg-muted border-muted"}`}>{key}</span>
            <span className="font-semibold text-sm tabular-nums">{val}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function Incidents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [section, setSection] = useState<Section>("dashboard");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editIssue, setEditIssue] = useState<Issue | null>(null);
  const [viewIssue, setViewIssue] = useState<Issue | null>(null);
  const [deleteIssue, setDeleteIssue] = useState<Issue | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [reportExpanded, setReportExpanded] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [aiDescription, setAiDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDepartment, setNewDepartment] = useState("");

  const { data: issues = [], isLoading } = useQuery<Issue[]>({ queryKey: ["/api/issues"] });
  const { data: archived = [] } = useQuery<Issue[]>({ queryKey: ["/api/issues/archived"] });
  const { data: stats } = useQuery<any>({ queryKey: ["/api/issues/stats"] });
  const { data: settings = [] } = useQuery<any[]>({ queryKey: ["/api/issue-settings"] });
  const { data: companyUsers = [] } = useQuery<CompanyUser[]>({ queryKey: ["/api/admin/users"] });
  const { data: companySites = [] } = useQuery<CompanySite[]>({ queryKey: ["/api/sites"] });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/issues"] });
    qc.invalidateQueries({ queryKey: ["/api/issues/archived"] });
    qc.invalidateQueries({ queryKey: ["/api/issues/stats"] });
  };

  const aiFillMutation = useMutation({
    mutationFn: (desc: string) => apiRequest("POST", "/api/issues/ai-fill", { description: desc }),
    onSuccess: (data: any) => {
      const f = data.fields || {};
      setForm(prev => ({
        ...prev,
        title: f.title || prev.title,
        description: f.description || prev.description,
        category: f.category || prev.category,
        priority: f.priority || prev.priority,
        severity: f.severity || prev.severity,
        department: f.department || prev.department,
        rootCause: f.rootCause || prev.rootCause,
        remedialAction: f.remedialAction || prev.remedialAction,
        proposedAction: f.proposedAction || prev.proposedAction,
      }));
      toast({ title: "Form filled by AI", description: "Review and adjust the fields as needed." });
    },
    onError: () => toast({ title: "AI fill failed", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/issues", data),
    onSuccess: () => { toast({ title: "Incident logged" }); setCreateOpen(false); setForm(EMPTY_FORM); setAiDescription(""); invalidate(); },
    onError: () => toast({ title: "Failed to create incident", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/issues/${id}`, data),
    onSuccess: () => { toast({ title: "Incident updated" }); setEditIssue(null); setForm(EMPTY_FORM); invalidate(); },
    onError: () => toast({ title: "Failed to update incident", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/issues/${id}`),
    onSuccess: () => { toast({ title: "Incident deleted" }); setDeleteIssue(null); invalidate(); },
    onError: () => toast({ title: "Failed to delete incident", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, archive }: { id: number; archive: boolean }) =>
      apiRequest("POST", `/api/issues/${id}/${archive ? "archive" : "unarchive"}`, {}),
    onSuccess: (_, { archive }) => { toast({ title: archive ? "Incident archived" : "Incident restored" }); invalidate(); },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const reportMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/issues/${id}/generate-report`, {}),
    onSuccess: (data: any) => {
      toast({ title: "NCR report generated" });
      if (viewIssue) setViewIssue({ ...viewIssue, reportContent: data.report, reportGeneratedAt: new Date() });
      setReportExpanded(true);
      invalidate();
    },
    onError: (e: any) => toast({ title: "Failed to generate report", description: e.message, variant: "destructive" }),
  });

  const addSettingMutation = useMutation({
    mutationFn: (data: { settingType: string; value: string }) => apiRequest("POST", "/api/issue-settings", { ...data, sortOrder: 99 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/issue-settings"] }); setNewCategory(""); setNewDepartment(""); },
    onError: () => toast({ title: "Failed to add item", variant: "destructive" }),
  });

  const removeSettingMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/issue-settings/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/issue-settings"] }); },
    onError: () => toast({ title: "Failed to remove item", variant: "destructive" }),
  });

  function openCreate() { setForm(EMPTY_FORM); setAiDescription(""); setCreateOpen(true); }
  function openEdit(issue: Issue) {
    setForm({
      title: issue.title || "",
      description: issue.description || "",
      reportedBy: issue.reportedBy || "",
      assignedTo: issue.assignedTo || "",
      priority: issue.priority || "Medium",
      category: issue.category || "",
      severity: issue.severity || "Moderate",
      department: issue.department || "Management",
      status: issue.status || "Open",
      dueDate: issue.dueDate ? new Date(issue.dueDate).toISOString().split("T")[0] : "",
      siteName: issue.siteName || "",
      rootCause: issue.rootCause || "",
      remedialAction: issue.remedialAction || "",
      proposedAction: issue.proposedAction || "",
      comments: issue.comments || "",
    });
    setEditIssue(issue);
  }

  function formChange(k: keyof FormData, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function submitCreate() {
    if (!form.title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    createMutation.mutate({ ...form, issueId: "" });
  }

  function submitEdit() {
    if (!editIssue) return;
    if (!form.title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    updateMutation.mutate({ id: editIssue.id, data: form });
  }

  const displayedIssues = issues.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.title?.toLowerCase().includes(q) || i.issueId?.toLowerCase().includes(q) || i.siteName?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || i.status === filterStatus;
    const matchPriority = filterPriority === "all" || i.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const displayedArchived = archived.filter(i => {
    const q = search.toLowerCase();
    return !q || i.title?.toLowerCase().includes(q) || i.issueId?.toLowerCase().includes(q);
  });

  const tabs: { id: Section; label: string; icon: any; count?: number }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "issue-log", label: "Issue Log", icon: List, count: issues.length },
    { id: "archived", label: "Archived", icon: Archive, count: archived.length },
    { id: "settings", label: "Settings", icon: Settings2 },
  ];

  return (
    <div className="space-y-0" data-testid="incidents-section">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-6 pt-6 pb-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Incidents
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Log, track and manage operational incidents</p>
        </div>
        <Button onClick={openCreate} data-testid="button-log-incident">
          <Plus className="h-4 w-4 mr-2" />
          Log Incident
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b px-6 gap-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSection(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              section === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-incidents-${tab.id}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-0.5 text-xs tabular-nums text-muted-foreground">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">
        {/* ── DASHBOARD ── */}
        {section === "dashboard" && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Total Issues", value: stats?.total ?? 0, colour: "bg-muted text-muted-foreground" },
                { label: "Open", value: stats?.open ?? 0, colour: "bg-red-50 text-red-600" },
                { label: "In Progress", value: stats?.inProgress ?? 0, colour: "bg-blue-50 text-blue-600" },
                { label: "Resolved", value: stats?.resolved ?? 0, colour: "bg-green-50 text-green-600" },
                { label: "Closed", value: stats?.closed ?? 0, colour: "bg-muted text-muted-foreground" },
                { label: "Overdue", value: stats?.overdue ?? 0, colour: "bg-red-100 text-red-700" },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="pt-4 pb-4 px-4">
                    <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                    <p className={`text-3xl font-bold ${s.colour.split(" ").find(c => c.startsWith("text-"))}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Breakdown tables */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <BreakdownTable title="By Priority" data={stats?.byPriority ?? {}} colourMap={PRIORITY_COLOURS} />
              <BreakdownTable title="By Category" data={stats?.byCategory ?? {}} />
              <BreakdownTable title="By Severity" data={stats?.bySeverity ?? {}} colourMap={SEVERITY_COLOURS} />
              <BreakdownTable title="By Assignee" data={stats?.byAssignee ?? {}} />
            </div>

            {!stats && (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading dashboard…
              </div>
            )}
          </>
        )}

        {/* ── ISSUE LOG ── */}
        {section === "issue-log" && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search issues…" className="pl-8" data-testid="input-search-issues" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36" data-testid="select-filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {["Open", "In progress", "Resolved", "Closed", "Reopened"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-32" data-testid="select-filter-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {["Low", "Medium", "High"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
              </div>
            ) : displayedIssues.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{search || filterStatus !== "all" || filterPriority !== "all" ? "No matching incidents" : "No incidents logged yet"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedIssues.map(i => (
                  <IssueRow key={i.id} issue={i}
                    onView={setViewIssue}
                    onEdit={openEdit}
                    onArchive={issue => archiveMutation.mutate({ id: issue.id, archive: !issue.isArchived })}
                    onDelete={setDeleteIssue}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ARCHIVED ── */}
        {section === "archived" && (
          <>
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search archived…" className="pl-8" data-testid="input-search-archived" />
            </div>

            {displayedArchived.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Archive className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No archived incidents</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedArchived.map(i => (
                  <IssueRow key={i.id} issue={i}
                    onView={setViewIssue}
                    onEdit={openEdit}
                    onArchive={issue => archiveMutation.mutate({ id: issue.id, archive: false })}
                    onDelete={setDeleteIssue}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── SETTINGS ── */}
        {section === "settings" && (
          <div className="max-w-lg space-y-8">
            {/* Categories */}
            <div className="space-y-3">
              <div>
                <p className="font-semibold">Categories</p>
                <p className="text-sm text-muted-foreground">Types of incidents your team handles</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.filter(s => s.settingType === "category").map((s: any) => (
                  <div key={s.id} className="flex items-center gap-1 border rounded-md px-2.5 py-1 text-sm bg-muted/30">
                    <span>{s.value}</span>
                    <button onClick={() => removeSettingMutation.mutate(s.id)} disabled={removeSettingMutation.isPending}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors" data-testid={`button-remove-category-${s.id}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {settings.filter(s => s.settingType === "category").length === 0 && <p className="text-sm text-muted-foreground italic">No categories yet</p>}
              </div>
              <div className="flex gap-2">
                <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Add a category…"
                  onKeyDown={e => { if (e.key === "Enter" && newCategory.trim()) addSettingMutation.mutate({ settingType: "category", value: newCategory.trim() }); }}
                  data-testid="input-new-category" />
                <Button variant="outline" disabled={!newCategory.trim() || addSettingMutation.isPending}
                  onClick={() => newCategory.trim() && addSettingMutation.mutate({ settingType: "category", value: newCategory.trim() })}
                  data-testid="button-add-category">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="border-t" />

            {/* Departments */}
            <div className="space-y-3">
              <div>
                <p className="font-semibold">Departments</p>
                <p className="text-sm text-muted-foreground">Teams responsible for handling incidents</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.filter(s => s.settingType === "department").map((s: any) => (
                  <div key={s.id} className="flex items-center gap-1 border rounded-md px-2.5 py-1 text-sm bg-muted/30">
                    <span>{s.value}</span>
                    <button onClick={() => removeSettingMutation.mutate(s.id)} disabled={removeSettingMutation.isPending}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors" data-testid={`button-remove-department-${s.id}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {settings.filter(s => s.settingType === "department").length === 0 && <p className="text-sm text-muted-foreground italic">No departments yet</p>}
              </div>
              <div className="flex gap-2">
                <Input value={newDepartment} onChange={e => setNewDepartment(e.target.value)} placeholder="Add a department…"
                  onKeyDown={e => { if (e.key === "Enter" && newDepartment.trim()) addSettingMutation.mutate({ settingType: "department", value: newDepartment.trim() }); }}
                  data-testid="input-new-department" />
                <Button variant="outline" disabled={!newDepartment.trim() || addSettingMutation.isPending}
                  onClick={() => newDepartment.trim() && addSettingMutation.mutate({ settingType: "department", value: newDepartment.trim() })}
                  data-testid="button-add-department">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── CREATE DIALOG ── */}
      <Dialog open={createOpen} onOpenChange={o => { if (!o) { setCreateOpen(false); setAiDescription(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log New Incident</DialogTitle>
          </DialogHeader>

          {/* AI Fill section */}
          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">AI Form Fill</p>
              <span className="text-xs text-muted-foreground">— describe what happened and AI will populate the form</span>
            </div>
            <Textarea
              value={aiDescription}
              onChange={e => setAiDescription(e.target.value)}
              placeholder="e.g. A customer complained about a security guard being rude at the front entrance of Site A on Tuesday evening. The guard allegedly refused entry to a visitor without proper authorisation paperwork..."
              rows={3}
              data-testid="input-ai-description"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!aiDescription.trim() || aiFillMutation.isPending}
              onClick={() => aiFillMutation.mutate(aiDescription)}
              data-testid="button-ai-fill"
            >
              {aiFillMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {aiFillMutation.isPending ? "Filling form…" : "Fill Form with AI"}
            </Button>
          </div>

          <div className="border-t" />

          <IssueForm form={form} onChange={formChange} settings={settings} companyUsers={companyUsers} companySites={companySites} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setAiDescription(""); }}>Cancel</Button>
            <Button onClick={submitCreate} disabled={createMutation.isPending} data-testid="button-submit-incident">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Log Incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EDIT DIALOG ── */}
      <Dialog open={!!editIssue} onOpenChange={o => !o && setEditIssue(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Incident {editIssue?.issueId}</DialogTitle>
          </DialogHeader>
          <IssueForm form={form} onChange={formChange} settings={settings} companyUsers={companyUsers} companySites={companySites} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditIssue(null)}>Cancel</Button>
            <Button onClick={submitEdit} disabled={updateMutation.isPending} data-testid="button-save-incident-edit">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── VIEW DIALOG ── */}
      <Dialog open={!!viewIssue} onOpenChange={o => { if (!o) { setViewIssue(null); setReportExpanded(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewIssue && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-muted-foreground">{viewIssue.issueId}</span>
                  <span>{viewIssue.title}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 py-1">
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {viewIssue.status && <span className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_COLOURS[viewIssue.status] || ""}`}>{viewIssue.status}</span>}
                  {viewIssue.priority && <span className={`text-xs px-2 py-0.5 rounded border font-medium ${PRIORITY_COLOURS[viewIssue.priority] || ""}`}>{viewIssue.priority}</span>}
                  {viewIssue.severity && <span className={`text-xs px-2 py-0.5 rounded border font-medium ${SEVERITY_COLOURS[viewIssue.severity] || ""}`}>{viewIssue.severity}</span>}
                  {viewIssue.category && <Badge variant="outline">{viewIssue.category}</Badge>}
                  {viewIssue.department && <Badge variant="outline">{viewIssue.department}</Badge>}
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {viewIssue.siteName && <div><p className="text-xs text-muted-foreground">Site</p><p className="font-medium">{viewIssue.siteName}</p></div>}
                  {viewIssue.reportedBy && <div><p className="text-xs text-muted-foreground">Reported By</p><p className="font-medium">{viewIssue.reportedBy}</p></div>}
                  {viewIssue.assignedTo && <div><p className="text-xs text-muted-foreground">Assigned To</p><p className="font-medium">{viewIssue.assignedTo}</p></div>}
                  {viewIssue.dueDate && <div><p className="text-xs text-muted-foreground">Due Date</p><p className="font-medium">{new Date(viewIssue.dueDate).toLocaleDateString("en-GB")}</p></div>}
                  {viewIssue.dateLogged && <div><p className="text-xs text-muted-foreground">Logged</p><p className="font-medium">{new Date(viewIssue.dateLogged).toLocaleDateString("en-GB")}</p></div>}
                </div>

                {viewIssue.description && (
                  <div><p className="text-xs text-muted-foreground mb-1">Description</p><p className="text-sm leading-relaxed">{viewIssue.description}</p></div>
                )}
                {viewIssue.rootCause && (
                  <div><p className="text-xs text-muted-foreground mb-1">Root Cause</p><p className="text-sm leading-relaxed">{viewIssue.rootCause}</p></div>
                )}
                {viewIssue.remedialAction && (
                  <div><p className="text-xs text-muted-foreground mb-1">Remedial Action Taken</p><p className="text-sm leading-relaxed">{viewIssue.remedialAction}</p></div>
                )}
                {viewIssue.proposedAction && (
                  <div><p className="text-xs text-muted-foreground mb-1">Proposed Corrective Action</p><p className="text-sm leading-relaxed">{viewIssue.proposedAction}</p></div>
                )}
                {viewIssue.comments && (
                  <div><p className="text-xs text-muted-foreground mb-1">Comments</p><p className="text-sm leading-relaxed">{viewIssue.comments}</p></div>
                )}

                {/* NCR Section */}
                <div className="rounded-md border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Non-Conformance Report (AI)</p>
                      {viewIssue.reportGeneratedAt && (
                        <span className="text-xs text-muted-foreground">
                          Generated {new Date(viewIssue.reportGeneratedAt).toLocaleDateString("en-GB")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {viewIssue.reportContent && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => window.open(`/issue-report/${viewIssue.issueId}`, "_blank")} data-testid="button-view-public-report">
                            <ExternalLink className="h-3 w-3 mr-1" />Share
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setReportExpanded(e => !e)}>
                            {reportExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" onClick={() => reportMutation.mutate(viewIssue.id)} disabled={reportMutation.isPending} data-testid="button-generate-ncr">
                        {reportMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        {viewIssue.reportContent ? "Regenerate" : "Generate NCR"}
                      </Button>
                    </div>
                  </div>

                  {viewIssue.reportContent && reportExpanded && (
                    <div className="rounded-md border bg-background p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                      {viewIssue.reportContent}
                    </div>
                  )}

                  {!viewIssue.reportContent && (
                    <p className="text-xs text-muted-foreground">Generate an AI-written Non-Conformance Report to share with clients or export as PDF.</p>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={pdfLoading}
                  onClick={() => {
                    setPdfLoading(true);
                    printIssuePDF(viewIssue, () => setPdfLoading(false));
                  }}
                  data-testid="button-print-pdf"
                >
                  {pdfLoading
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating PDF…</>
                    : <><Download className="h-4 w-4 mr-2" />Export PDF</>}
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={() => setViewIssue(null)}>Close</Button>
                <Button onClick={() => { setViewIssue(null); openEdit(viewIssue); }} data-testid="button-edit-from-view">
                  <Edit className="h-4 w-4 mr-2" />Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM ── */}
      <AlertDialog open={!!deleteIssue} onOpenChange={o => !o && setDeleteIssue(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete incident?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteIssue?.issueId} — {deleteIssue?.title}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground"
              onClick={() => deleteIssue && deleteMutation.mutate(deleteIssue.id)} data-testid="button-confirm-delete-incident">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

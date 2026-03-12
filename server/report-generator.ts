import Anthropic from "@anthropic-ai/sdk";
import type { Issue } from "@shared/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function aiFormFill(description: string, categories: string[], departments: string[]): Promise<Record<string, string>> {
  const catList = categories.length ? categories.join(", ") : "Customer Complaint, Staff Complaint, Compliance, Security Breach, Near Miss, Theft, Trespass, Health & Safety";
  const deptList = departments.length ? departments.join(", ") : "Management, Office Manager, Health & Safety, Operations";

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `You are an expert incident report assistant for a security company. Analyse the following incident description and extract structured information to fill an incident report form.

Incident description: "${description}"

Available categories: ${catList}
Available departments: ${deptList}

Return ONLY a valid JSON object (no markdown, no code blocks, no explanation) with these exact keys:
{"title":"concise incident title max 80 chars","description":"expanded professional description","category":"one of the available categories","priority":"Low or Medium or High","severity":"Low or Moderate or Severe or Critical","department":"one of the available departments","rootCause":"identified or likely root cause","remedialAction":"immediate actions taken or recommended","proposedAction":"longer-term corrective actions"}`,
    }],
  });

  const text = response.content.find(b => b.type === "text");
  const raw = text?.type === "text" ? text.text.trim() : "{}";
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : {};
}

export async function generateNonConformanceReport(issue: Issue): Promise<string> {
  const dateLogged = issue.dateLogged ? new Date(issue.dateLogged).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  const dueDate = issue.dueDate ? new Date(issue.dueDate).toLocaleDateString('en-GB') : 'TBD';

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a professional security report writer. Generate a formal Non-Conformance Report (NCR) suitable for client distribution for the following incident:

Reference: ${issue.issueId}
Site: ${issue.siteName || 'Not specified'}
Title: ${issue.title}
Date: ${dateLogged}
Reported By: ${issue.reportedBy || 'Not specified'}
Assigned To: ${issue.assignedTo || 'Not specified'}
Category: ${issue.category || 'Not specified'}
Priority: ${issue.priority || 'Medium'}
Severity: ${issue.severity || 'Moderate'}
Department: ${issue.department || 'Management'}
Status: ${issue.status || 'Open'}
Due Date: ${dueDate}
Description: ${issue.description || 'No description provided'}
Root Cause: ${issue.rootCause || 'Under investigation'}
Remedial Action: ${issue.remedialAction || 'To be determined'}
Proposed Action: ${issue.proposedAction || 'To be determined'}
Comments: ${issue.comments || 'None'}

Generate a professional NCR with these sections:
1. Executive Summary
2. Incident Description
3. Root Cause Analysis
4. Immediate Remedial Action Taken
5. Proposed Corrective Action
6. Verification & Close-Out
7. Recommendations
8. Conclusions

Use formal British English. Format with clear section headers. Be concise yet thorough.`,
      },
    ],
  });

  const content = response.content.find(b => b.type === "text");
  return content?.type === "text" ? content.text : "Failed to generate report.";
}

import React from 'react';
import { AssessmentInfo } from '../data/assessmentData';
import { PillarData, BestPractice } from '../data/wafrData';
import { CheckRemediationData } from '../data/remediationData';
import { formatBpCode } from '../utils/formatBpCode';

export interface PrintableWAFRReportProps {
  assessment: AssessmentInfo | null;
  activePillars: PillarData[];
  overallScore: number;
  remediationsDb: Record<string, CheckRemediationData>;
}

interface QuestionEvaluation {
  id: string;
  code: string;
  number: number;
  title: string;
  risk: 'none' | 'high' | 'medium' | 'na';
  riskLabel: string;
  selectedChoices: string[];
  notSelectedChoices: string[];
  improvementPlan: string[];
}

interface PillarEvaluation {
  pillar: PillarData;
  questions: QuestionEvaluation[];
  highRiskCount: number;
  medRiskCount: number;
  passCount: number;
  naCount: number;
}

export function PrintableWAFRReport({
  assessment,
  activePillars,
  overallScore,
  remediationsDb,
}: PrintableWAFRReportProps) {
  const cloudUpper = (assessment?.cloud || 'gcp').toUpperCase();
  const workloadName = assessment?.name || 'Architecture Workload Review';
  const accountId = assessment?.accountId || 'lens-wafr-gcp';
  const reportDate = assessment?.lastRun || new Date().toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
  const currentYear = new Date().getFullYear();

  // Evaluate each pillar and each question/best practice
  const evaluatedPillars: PillarEvaluation[] = activePillars.map((p) => {
    let pHigh = 0;
    let pMed = 0;
    let pPass = 0;
    let pNa = 0;

    const questions: QuestionEvaluation[] = (p.bestPractices || []).map((bp: BestPractice, idx: number) => {
      const passingChecks = (bp.checks || []).filter((c) => c.status === 'pass');
      const failingChecks = (bp.checks || []).filter((c) => c.status === 'fail' || (c.status as string) === 'warn');

      let risk: 'none' | 'high' | 'medium' | 'na' = 'none';
      let riskLabel = 'No improvements identified';

      if ((bp.status as string) === 'na') {
        risk = 'na';
        riskLabel = 'Not applicable';
        pNa++;
      } else if (failingChecks.length > 0 || bp.status === 'fail') {
        const hasHigh = failingChecks.some(
          (c) => (c.severity || '').toLowerCase() === 'high' || (c.severity || '').toLowerCase() === 'critical'
        );
        if (hasHigh) {
          risk = 'high';
          riskLabel = 'High risk';
          pHigh++;
        } else {
          risk = 'medium';
          riskLabel = 'Medium risk';
          pMed++;
        }
      } else {
        pPass++;
      }

      const selectedChoices = passingChecks.length > 0
        ? passingChecks.map((c) => c.title)
        : bp.status === 'pass'
          ? [bp.title]
          : ['None of these'];

      const notSelectedChoices = failingChecks.length > 0
        ? failingChecks.map((c) => c.title)
        : bp.status === 'fail'
          ? [bp.title]
          : ['None of these'];

      const improvementPlan: string[] = [];
      if (risk === 'none') {
        improvementPlan.push('No risk detected for this question. No action needed.');
      } else {
        failingChecks.forEach((c) => {
          const rem = remediationsDb[c.id];
          const planText = rem?.rationale || rem?.description || c.description || c.title;
          improvementPlan.push(`${c.title}: ${planText}`);
        });
        if (improvementPlan.length === 0) {
          improvementPlan.push('Remediate configuration gaps to meet the pillar architectural standard.');
        }
      }

      return {
        id: bp.id,
        code: formatBpCode(bp.id),
        number: idx + 1,
        title: bp.title,
        risk,
        riskLabel,
        selectedChoices,
        notSelectedChoices,
        improvementPlan,
      };
    });

    return {
      pillar: p,
      questions,
      highRiskCount: pHigh,
      medRiskCount: pMed,
      passCount: pPass,
      naCount: pNa,
    };
  });

  const totalQuestions = evaluatedPillars.reduce((sum, ep) => sum + ep.questions.length, 0);
  const totalHighRisk = evaluatedPillars.reduce((sum, ep) => sum + ep.highRiskCount, 0);
  const totalMedRisk = evaluatedPillars.reduce((sum, ep) => sum + ep.medRiskCount, 0);

  return (
    <div className="wafr-print-doc font-sans text-slate-900 bg-white leading-normal" style={{ fontSize: '10pt' }}>
      {/* ── PAGE 1: COVER PAGE ────────────────────────────────────────────── */}
      <section className="print-page min-h-[960px] p-12 flex flex-col justify-between border-b print:border-none border-slate-200">
        <div>
          {/* Header Logos & Lens Title */}
          <div className="flex items-center justify-between pb-8 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <img src="/lens-logo.png" alt="L.E.N.S." className="h-8 object-contain" />
              <div>
                <span className="text-xs font-bold tracking-wider uppercase text-blue-900">
                  L.E.N.S. Continuous Architecture Assessment
                </span>
              </div>
            </div>
            <img src="/logos/cloudifyops.png" alt="CloudifyOps" className="h-7 object-contain opacity-90" />
          </div>

          {/* Main Cover Title */}
          <div className="mt-24 space-y-4 max-w-2xl">
            <div className="text-sm font-semibold tracking-wide text-blue-700 uppercase">
              Well-Architected Assessment Tool
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {workloadName} -
              <br />
              {cloudUpper} Well-Architected Framework Report
            </h1>
            <p className="text-slate-600 text-sm pt-2">
              Autonomous multi-pillar architectural evaluation, risk discovery, and compliance remediation guide.
            </p>
          </div>

          {/* Metadata Block */}
          <div className="mt-16 bg-slate-50 border border-slate-200 rounded-lg p-6 max-w-xl space-y-3">
            <div className="flex justify-between text-xs py-1 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Cloud Platform:</span>
              <span className="font-semibold text-slate-800">{cloudUpper}</span>
            </div>
            <div className="flex justify-between text-xs py-1 border-b border-slate-200">
              <span className="text-slate-500 font-medium">{cloudUpper} Scope / Account ID:</span>
              <span className="font-mono font-semibold text-slate-800">{accountId}</span>
            </div>
            <div className="flex justify-between text-xs py-1 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Report Generated Date:</span>
              <span className="font-semibold text-slate-800">{reportDate}</span>
            </div>
            <div className="flex justify-between text-xs py-1 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Overall Architecture Score:</span>
              <span className="font-bold text-emerald-700">{overallScore}%</span>
            </div>
            <div className="flex justify-between text-xs py-1">
              <span className="text-slate-500 font-medium">Evaluation Framework:</span>
              <span className="font-semibold text-slate-800">L.E.N.S. Well-Architected v2.5</span>
            </div>
          </div>
        </div>

        {/* Cover Page Footer */}
        <div className="pt-8 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <div>{reportDate}</div>
          <div>© {currentYear}, CloudifyOps Inc. or its affiliates. All rights reserved.</div>
          <div>Page 1</div>
        </div>
      </section>

      {/* ── PAGE 2: DISCLAIMER & NOTICE ──────────────────────────────────── */}
      <section className="print-page-break min-h-[960px] p-12 flex flex-col justify-between border-b print:border-none border-slate-200">
        <div className="space-y-6 max-w-3xl">
          <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-200 pb-3">
            L.E.N.S. Well-Architected Tool Report
          </h2>
          <div className="text-xs text-slate-700 space-y-4 leading-relaxed">
            <p className="font-semibold text-slate-800">
              Copyright © {currentYear} CloudifyOps Inc. and/or its affiliates. All rights reserved.
            </p>
            <p>
              Amazon Web Services, Google Cloud Platform, and Microsoft Azure trademarks and logos are the property of
              their respective owners, who may or may not be affiliated with, connected to, or sponsored by
              CloudifyOps Inc.
            </p>
            <p>
              All information, guidance, benchmarks, automated checks, and remediation instructions (collectively,
              &quot;Information&quot;) provided in connection with this Well-Architected Framework Report are for
              informational and continuous architectural improvement purposes only.
            </p>
            <p>
              You are solely responsible for making your own independent assessment of the Information and your use of
              cloud provider products, infrastructure policies, or third-party automated remediation scripts. The
              information in this report is provided &quot;as is&quot; without warranties, representations, or conditions of
              any kind, either express or implied.
            </p>
            <p>
              CloudifyOps shall not be liable for any damages arising out of or related to the use of or inability to
              use the guidance or remediation artifacts contained herein. Architectural reviews represent point-in-time
              assessments based on automated scanner queries and active cloud configuration permissions.
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <div>{reportDate}</div>
          <div>© {currentYear}, CloudifyOps Inc. or its affiliates. All rights reserved.</div>
          <div>Page 2</div>
        </div>
      </section>

      {/* ── PAGE 3: TABLE OF CONTENTS ────────────────────────────────────── */}
      <section className="print-page-break min-h-[960px] p-12 flex flex-col justify-between border-b print:border-none border-slate-200">
        <div className="space-y-8 max-w-2xl">
          <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-200 pb-3">
            Table of contents
          </h2>

          <div className="space-y-3 text-sm text-slate-800">
            <div className="flex justify-between items-baseline border-b border-dotted border-slate-300 pb-1">
              <span className="font-medium">Workload properties</span>
              <span className="font-mono text-xs text-slate-500">Page 4</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-dotted border-slate-300 pb-1">
              <span className="font-medium">Lens overview</span>
              <span className="font-mono text-xs text-slate-500">Page 5</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-dotted border-slate-300 pb-1">
              <span className="font-medium">Improvement plan</span>
              <span className="font-mono text-xs text-slate-500">Page 6</span>
            </div>
            <div className="pl-6 flex justify-between items-baseline border-b border-dotted border-slate-200 pb-1 text-xs text-slate-600">
              <span>High risk</span>
              <span className="font-mono">Page 6</span>
            </div>
            <div className="pl-6 flex justify-between items-baseline border-b border-dotted border-slate-200 pb-1 text-xs text-slate-600">
              <span>Medium risk</span>
              <span className="font-mono">Page 7</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-dotted border-slate-300 pb-1 pt-2">
              <span className="font-medium">Lens details</span>
              <span className="font-mono text-xs text-slate-500">Page 8</span>
            </div>
            {evaluatedPillars.map((ep, idx) => (
              <div
                key={ep.pillar.id}
                className="pl-6 flex justify-between items-baseline border-b border-dotted border-slate-200 pb-1 text-xs text-slate-600"
              >
                <span>{ep.pillar.label}</span>
                <span className="font-mono">Page {8 + idx * 2}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <div>{reportDate}</div>
          <div>© {currentYear}, CloudifyOps Inc. or its affiliates. All rights reserved.</div>
          <div>Page 3</div>
        </div>
      </section>

      {/* ── PAGE 4: WORKLOAD PROPERTIES ──────────────────────────────────── */}
      <section className="print-page-break min-h-[960px] p-12 flex flex-col justify-between border-b print:border-none border-slate-200">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-200 pb-3">
            Workload properties
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-xs">
            <div className="border-b border-slate-200 pb-2">
              <div className="text-slate-500 font-medium">Workload name</div>
              <div className="text-slate-900 font-semibold text-sm mt-0.5">{workloadName}</div>
            </div>

            <div className="border-b border-slate-200 pb-2">
              <div className="text-slate-500 font-medium">ARN / Project Scope</div>
              <div className="font-mono text-slate-900 font-medium text-xs mt-0.5 break-all">{accountId}</div>
            </div>

            <div className="border-b border-slate-200 pb-2">
              <div className="text-slate-500 font-medium">Description</div>
              <div className="text-slate-900 mt-0.5">Continuous Well-Architected Framework review &amp; automated gap analysis</div>
            </div>

            <div className="border-b border-slate-200 pb-2">
              <div className="text-slate-500 font-medium">Review owner</div>
              <div className="text-slate-900 font-medium mt-0.5">Cloud Architecture &amp; DevOps Advisory</div>
            </div>

            <div className="border-b border-slate-200 pb-2">
              <div className="text-slate-500 font-medium">Industry type</div>
              <div className="text-slate-900 mt-0.5">Cloud Infrastructure &amp; SaaS Workloads</div>
            </div>

            <div className="border-b border-slate-200 pb-2">
              <div className="text-slate-500 font-medium">Environment</div>
              <div className="text-slate-900 font-semibold mt-0.5">Production</div>
            </div>

            <div className="border-b border-slate-200 pb-2">
              <div className="text-slate-500 font-medium">Regions</div>
              <div className="text-slate-900 mt-0.5">{assessment?.region || 'Global / Multi-region'}</div>
            </div>

            <div className="border-b border-slate-200 pb-2">
              <div className="text-slate-500 font-medium">Account / Project IDs</div>
              <div className="font-mono text-slate-900 mt-0.5">{accountId}</div>
            </div>

            <div className="border-b border-slate-200 pb-2">
              <div className="text-slate-500 font-medium">Architectural design</div>
              <div className="text-slate-900 mt-0.5">Multi-tier Cloud Architecture (Managed Services, IAM, Storage, Compute)</div>
            </div>

            <div className="border-b border-slate-200 pb-2">
              <div className="text-slate-500 font-medium">Overall Architecture Health</div>
              <div className="text-emerald-700 font-bold text-sm mt-0.5">{overallScore}% Compliant</div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <div>{reportDate}</div>
          <div>© {currentYear}, CloudifyOps Inc. or its affiliates. All rights reserved.</div>
          <div>Page 4</div>
        </div>
      </section>

      {/* ── PAGE 5: LENS OVERVIEW ────────────────────────────────────────── */}
      <section className="print-page-break min-h-[960px] p-12 flex flex-col justify-between border-b print:border-none border-slate-200">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-200 pb-3">
            Lens overview
          </h2>

          <div className="grid grid-cols-2 gap-4 max-w-md text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded">
              <div className="text-slate-500">Questions answered</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{totalQuestions}/{totalQuestions}</div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded">
              <div className="text-slate-500">Framework Version</div>
              <div className="text-xs font-semibold text-slate-900 mt-2">L.E.N.S. Well-Architected Framework v2.5</div>
            </div>
          </div>

          <div className="pt-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Pillar summary</h3>
            <table className="w-full text-xs text-left border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Pillar</th>
                  <th className="p-2.5 text-center">Questions answered</th>
                  <th className="p-2.5 text-center">Score</th>
                  <th className="p-2.5 text-center">High risk</th>
                  <th className="p-2.5 text-center">Medium risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {evaluatedPillars.map((ep) => (
                  <tr key={ep.pillar.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-medium text-slate-900">{ep.pillar.label}</td>
                    <td className="p-2.5 text-center font-mono">{ep.questions.length}/{ep.questions.length}</td>
                    <td className="p-2.5 text-center font-bold text-blue-700">{ep.pillar.score}%</td>
                    <td className="p-2.5 text-center">
                      {ep.highRiskCount > 0 ? (
                        <span className="font-semibold text-red-700">{ep.highRiskCount}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      {ep.medRiskCount > 0 ? (
                        <span className="font-semibold text-amber-700">{ep.medRiskCount}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-4 text-xs">
            <span className="text-slate-500 font-medium">Lens notes:</span>
            <span className="ml-2 text-slate-700">Baseline review generated through continuous live telemetry and automated inventory evaluation.</span>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <div>{reportDate}</div>
          <div>© {currentYear}, CloudifyOps Inc. or its affiliates. All rights reserved.</div>
          <div>Page 5</div>
        </div>
      </section>

      {/* ── PAGE 6+: IMPROVEMENT PLAN ────────────────────────────────────── */}
      <section className="print-page-break min-h-[960px] p-12 flex flex-col justify-between border-b print:border-none border-slate-200">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-200 pb-3">
            Improvement plan
          </h2>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded max-w-md text-xs space-y-1">
            <div className="font-semibold text-slate-800">Improvement item summary</div>
            <div className="text-red-700 font-medium">High risk: {totalHighRisk}</div>
            <div className="text-amber-700 font-medium">Medium risk: {totalMedRisk}</div>
          </div>

          <div className="pt-2">
            <table className="w-full text-xs text-left border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Pillar</th>
                  <th className="p-2.5 text-center">High risk</th>
                  <th className="p-2.5 text-center">Medium risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {evaluatedPillars.map((ep) => (
                  <tr key={ep.pillar.id}>
                    <td className="p-2.5 font-medium text-slate-900">{ep.pillar.label}</td>
                    <td className="p-2.5 text-center font-semibold text-red-700">{ep.highRiskCount}</td>
                    <td className="p-2.5 text-center font-semibold text-amber-700">{ep.medRiskCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* High risk grouped list */}
          <div className="pt-4 space-y-4">
            <h3 className="text-base font-bold text-red-700">High risk</h3>
            {totalHighRisk === 0 ? (
              <p className="text-xs text-slate-500 italic">No high risk items identified across evaluated pillars.</p>
            ) : (
              evaluatedPillars.map((ep) => {
                const highQuestions = ep.questions.filter((q) => q.risk === 'high');
                if (highQuestions.length === 0) return null;
                return (
                  <div key={ep.pillar.id} className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {ep.pillar.label}
                    </h4>
                    <div className="space-y-1 pl-3 border-l-2 border-red-500 text-xs text-slate-800">
                      {highQuestions.map((q) => (
                        <div key={q.id}>
                          <span className="font-semibold text-slate-900">{q.code}.</span> {q.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Medium risk grouped list */}
          <div className="pt-4 space-y-4">
            <h3 className="text-base font-bold text-amber-700">Medium risk</h3>
            {totalMedRisk === 0 ? (
              <p className="text-xs text-slate-500 italic">No medium risk items identified across evaluated pillars.</p>
            ) : (
              evaluatedPillars.map((ep) => {
                const medQuestions = ep.questions.filter((q) => q.risk === 'medium');
                if (medQuestions.length === 0) return null;
                return (
                  <div key={ep.pillar.id} className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {ep.pillar.label}
                    </h4>
                    <div className="space-y-1 pl-3 border-l-2 border-amber-500 text-xs text-slate-800">
                      {medQuestions.map((q) => (
                        <div key={q.id}>
                          <span className="font-semibold text-slate-900">{q.code}.</span> {q.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <div>{reportDate}</div>
          <div>© {currentYear}, CloudifyOps Inc. or its affiliates. All rights reserved.</div>
          <div>Page 6</div>
        </div>
      </section>

      {/* ── LENS DETAILS PER PILLAR ───────────────────────────────────────── */}
      {evaluatedPillars.map((ep) => (
        <section
          key={ep.pillar.id}
          className="print-page-break min-h-[960px] p-12 flex flex-col justify-between border-b print:border-none border-slate-200"
        >
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Lens details
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{ep.pillar.label}</h2>
            </div>

            {/* Pillar status summary card */}
            <div className="bg-slate-50 border border-slate-200 rounded p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Questions answered:</span>
                <span className="font-semibold text-slate-900">{ep.questions.length}/{ep.questions.length}</span>
              </div>
              <div className="font-medium text-slate-800 pt-1">Question status:</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-2 text-[11px]">
                <div>High risk: <span className="font-bold text-red-700">{ep.highRiskCount}</span></div>
                <div>Medium risk: <span className="font-bold text-amber-700">{ep.medRiskCount}</span></div>
                <div>No improvements identified: <span className="font-bold text-emerald-700">{ep.passCount}</span></div>
                <div>Not Applicable: <span className="font-medium text-slate-600">{ep.naCount}</span></div>
                <div>Unanswered: <span className="font-medium text-slate-600">0</span></div>
              </div>
              <div className="pt-1 text-[11px] text-slate-500">
                Pillar notes: Standard architecture review evaluated against {cloudUpper} reference baselines.
              </div>
            </div>

            {/* Individual Questions / Controls */}
            <div className="space-y-6 pt-2">
              {ep.questions.map((q) => (
                <div
                  key={q.id}
                  className="print-avoid-break p-5 bg-white border border-slate-200 rounded-lg space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      {q.number}. {q.title}
                    </h3>
                    <span
                      className={`shrink-0 px-2.5 py-0.5 text-xs font-semibold rounded border ${
                        q.risk === 'none'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : q.risk === 'high'
                          ? 'bg-red-50 text-red-800 border-red-200'
                          : q.risk === 'medium'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {q.riskLabel}
                    </span>
                  </div>

                  {/* Selected Choices */}
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-slate-800">Selected choice(s)</div>
                    <ul className="list-disc list-inside pl-1 space-y-0.5 text-slate-700">
                      {q.selectedChoices.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Not Selected Choices */}
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-slate-800">Not selected choice(s)</div>
                    <ul className="list-disc list-inside pl-1 space-y-0.5 text-slate-700">
                      {q.notSelectedChoices.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-xs space-y-0.5">
                    <div className="font-semibold text-slate-800">Best Practices marked as Not Applicable</div>
                    <div className="text-slate-500">-</div>
                  </div>

                  <div className="text-xs space-y-0.5">
                    <div className="font-semibold text-slate-800">Notes</div>
                    <div className="text-slate-500">-</div>
                  </div>

                  {/* Improvement Plan */}
                  <div className="text-xs space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
                    <div className="font-semibold text-slate-800">Improvement plan</div>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      {q.improvementPlan.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                    {q.risk !== 'none' && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-blue-700 font-medium">
                        Ask an expert: CloudifyOps Architecture Advisory team can help validate your remediation roadmap.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
            <div>{reportDate}</div>
            <div>© {currentYear}, CloudifyOps Inc. or its affiliates. All rights reserved.</div>
            <div>{ep.pillar.label}</div>
          </div>
        </section>
      ))}
    </div>
  );
}

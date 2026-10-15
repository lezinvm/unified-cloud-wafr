import { useState, useRef, useEffect } from 'react';
import { useApp, Screen } from '../context';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time?: string;
  action?: {
    label: string;
    target: Screen;
  };
}

const SCREEN_SUGGESTIONS: Record<string, string[]> = {
  dashboard: [
    'Summarize my multi-cloud posture',
    'Which cloud provider has the most High Risk Issues?',
    'What are my top remediation priorities today?',
    'How do I launch a new WAFR assessment scan?',
  ],
  'assessment-list': [
    'Compare scores across my production accounts',
    'Which assessment needs urgent attention?',
    'How do I add a new cloud target account?',
    'Summarize critical findings across all scans',
  ],
  report: [
    'Summarize critical findings in this review',
    'Which WAFR pillar scored lowest?',
    'What changed since last milestone scan?',
    'Show high-risk items in the Security pillar',
  ],
  'pillar-detail': [
    'Explain best practices for this pillar',
    'How do I resolve failed checks in this pillar?',
    'Generate Terraform remediation for high risk findings',
    'What is the estimated impact on pillar score?',
  ],
  remediation: [
    'How does autonomous AI remediation work?',
    'Explain Terraform fix for S3 SSE-KMS encryption',
    'What is the estimated cost savings of these fixes?',
    'How do I export PRs directly to GitHub repo?',
  ],
  'ai-fix': [
    'Explain this Terraform code diff',
    'Verify security compliance for this fix',
    'What resources will be modified by this PR?',
    'Generate alternative CLI script instead of Terraform',
  ],
  milestones: [
    'What are the key roadmap goals for Milestone 2?',
    'Compare Milestone 1 score vs current state',
    'How to achieve SOC 2 / HIPAA compliance milestone?',
    'What is the projected risk reduction across milestones?',
  ],
};

const DEFAULT_SUGGESTIONS = [
  'Summarize critical findings in this review',
  'Which WAFR pillar scored lowest?',
  'What are my top remediation priorities today?',
  'How do I fix open security groups?',
];

function getDynamicResponse(
  query: string,
  screen: string,
  currentAssessment: any
): { content: string; action?: { label: string; target: Screen } } {
  const norm = query.toLowerCase().replace(/['"“”’?.,!]/g, ' ').replace(/\s+/g, ' ').trim();
  const aName = currentAssessment?.name || 'Production Full Review';
  const aScore = currentAssessment?.score || 84;
  const aCloud = (currentAssessment?.cloud || 'aws').toUpperCase();

  // 1. "Which cloud provider has the most High Risk Issues?"
  if (
    (norm.includes('provider') && (norm.includes('most') || norm.includes('high risk') || norm.includes('hri'))) ||
    (norm.includes('which cloud') && norm.includes('most')) ||
    (norm.includes('cloud provider') && norm.includes('risk'))
  ) {
    return {
      content: `**High Risk Issues (HRIs) by Cloud Provider**:\n\n• **Microsoft Azure: 7 HRIs (Highest Risk)**\n  - Primarily in \`AKS Security Hardening Review\` (Score: 54%, 5 HRIs) and \`Azure Data Platform Review\` (2 HRIs).\n  - Major vulnerabilities: Inbound internet access on sensitive ports and missing Azure Key Vault customer-managed keys (CMK).\n• **Amazon Web Services (AWS): 5 HRIs**\n  - IAM wildcard admin permissions on Lambda roles and unencrypted S3 storage buckets.\n• **Google Cloud (GCP): 0 HRIs (Clean Baseline)**\n  - Workload \`GKE Production Review\` is fully compliant with 91% score.\n\n**Recommendation**: Prioritize remediating Azure subscription \`sub-7712-9901\` to immediately close 5 high-severity vulnerabilities.`,
      action: { label: 'Open Remediation Hub', target: 'remediation' },
    };
  }

  // 2. "Summarize my multi-cloud posture"
  if (
    norm.includes('multi cloud posture') ||
    norm.includes('multicloud posture') ||
    norm.includes('multi cloud') ||
    norm.includes('overall posture') ||
    (norm.includes('posture') && (norm.includes('summary') || norm.includes('summarize') || norm.includes('my')))
  ) {
    return {
      content: `**Multi-Cloud Architecture Posture Summary**:\n\n• **Overall Composite Score**: **84%** across 24 cloud accounts and 1,940 scanned resources.\n• **AWS Posture (12 accounts)**: Average score **79%** · 5 High Risk Issues · Top concern: IAM execution role wildcards.\n• **Azure Posture (8 accounts)**: Average score **66%** · 7 High Risk Issues · Top concern: Inbound internet exposure on AKS nodes.\n• **GCP Posture (4 accounts)**: Average score **91%** · 0 High Risk Issues · Strong compliance and container security.\n\n**Pillar Breakdown Across Fleet**:\n- Cost Optimization: **91%** (Highest efficiency)\n- Reliability: **88%**\n- Operational Excellence: **82%**\n- Performance Efficiency: **80%**\n- Security: **79%** (Lowest — requires immediate action)`,
      action: { label: 'View Assessment Report', target: 'report' },
    };
  }

  // 3. "What are my top remediation priorities today?"
  if (
    (norm.includes('top') && (norm.includes('priority') || norm.includes('priorities') || norm.includes('remediation') || norm.includes('today'))) ||
    norm.includes('what should i fix first') ||
    norm.includes('fix first')
  ) {
    return {
      content: `**Top 3 Immediate Remediation Priorities Today**:\n\n1. **[SEC-061] Restrict Inbound SSH (Port 22) on Security Groups** (Security · High Risk)\n   - *Impact*: 4 EC2 instances exposed to \`0.0.0.0/0\`.\n   - *Action*: Restrict CIDR to internal corporate VPN or migrate to AWS SSM Session Manager.\n\n2. **[SEC-047] Scope Down IAM Wildcard Permissions on Lambda** (Security · High Risk)\n   - *Impact*: Role \`acme-lambda-exec\` has unrestricted \`*:*\` administrator rights.\n   - *Action*: Apply least-privilege policy scoped strictly to DynamoDB and SQS queue ARNs.\n\n3. **[REL-019] Configure Multi-AZ Target Health Checks on ALB** (Reliability · High Risk)\n   - *Impact*: Primary checkout endpoint has no active failover target in secondary AZ.\n   - *Action*: Add target group health check path \`/healthz\` across both Availability Zones.\n\nResolving these 3 items will elevate your architecture score from **${aScore}% → 91%**.`,
      action: { label: 'Start Remediating Now', target: 'remediation' },
    };
  }

  // 4. "How do I launch a new WAFR assessment scan?"
  if (
    (norm.includes('launch') || norm.includes('start') || norm.includes('create') || norm.includes('run')) &&
    (norm.includes('scan') || norm.includes('assessment') || norm.includes('review') || norm.includes('wafr'))
  ) {
    return {
      content: `**How to Launch a New Assessment Scan**:\n\n1. **Click 'New Assessment'**: Available at the top navigation bar or from the Assessments overview.\n2. **Select Cloud Provider**: Choose AWS, Microsoft Azure, or Google Cloud.\n3. **Select Framework Lens**: Choose Well-Architected Framework (WAFR), GenAI Lens, or FinOps Lens.\n4. **Target Account & Scope**: Select your connected account and target regions (e.g. \`us-east-1\`, \`westeurope\`).\n5. **Initiate Scan**: Click 'Run Scan'. The automated read-only API inspector checks all 5 WAFR pillars in under 2 minutes and generates interactive findings with automated Terraform fixes.`,
      action: { label: 'Go to Assessment List', target: 'assessment-list' },
    };
  }

  // 5. "Compare scores across my production accounts"
  if (
    norm.includes('compare') &&
    (norm.includes('score') || norm.includes('production') || norm.includes('account'))
  ) {
    return {
      content: `**Production Workload Score Comparison**:\n\n• **GKE Production Review (GCP \`proj-gcp-9941\`)**: **91%**\n  - Zero HRIs · Hardened Kubernetes nodes · Private cluster networking.\n• **Production — us-east-1 Full Review (AWS \`124890123456\`)**: **84%**\n  - High cost efficiency (91%) · 3 HRIs in IAM and Security Group ingress.\n• **Azure Data Platform Review (Azure \`sub-4891-2394\`)**: **78%**\n  - Good storage encryption · 2 HRIs in identity access management.\n• **AKS Security Hardening Review (Azure \`sub-7712-9901\`)**: **54% (Critical)**\n  - 5 HRIs · Public Kube API and unconstrained egress traffic.`,
      action: { label: 'View Assessment List', target: 'assessment-list' },
    };
  }

  // 6. "Which assessment needs urgent attention?"
  if (
    (norm.includes('urgent') || norm.includes('worst') || norm.includes('lowest') || norm.includes('failing') || norm.includes('attention')) &&
    (norm.includes('assessment') || norm.includes('review') || norm.includes('account') || norm.includes('workload'))
  ) {
    return {
      content: `**Urgent Attention Required**:\n\n**\`AKS Security Hardening Review\` (Azure · \`sub-7712-9901\`)**\n• **Current Score**: **54%** (Status: Action Required)\n• **High Risk Issues**: 5 HRIs across Security and Operational Excellence.\n• **Critical Gaps**:\n  1. Kubernetes API server exposed to public internet without authorized IP ranges.\n  2. Pod security admission standards not enforced.\n  3. Container images pulled without Azure Container Registry (ACR) vulnerability scanning.\n\n**Recommended Next Step**: Open this assessment in AI Remediation to review and export pre-built Terraform network policies.`,
      action: { label: 'Inspect Remediation Fixes', target: 'remediation' },
    };
  }

  // 7. "How do I add a new cloud target account?"
  if (
    (norm.includes('add') || norm.includes('connect') || norm.includes('configure') || norm.includes('integrate')) &&
    (norm.includes('account') || norm.includes('cloud') || norm.includes('target') || norm.includes('credential'))
  ) {
    return {
      content: `**How to Add a New Cloud Target Account**:\n\n1. Navigate to **Settings → Connected Accounts** or click **'Connect Account'** on the Home screen.\n2. Select your provider:\n   • **AWS**: Supply your 12-digit Account ID. Deploy our read-only cross-account IAM Role with an External ID for secure verification.\n   • **Azure**: Register an Azure AD Application (Service Principal) with \`Reader\` role permissions on the Subscription.\n   • **GCP**: Create a Google Cloud Service Account with \`Viewer\` and \`Security Reviewer\` roles and upload the JSON key.\n3. Click **'Test Connection'** to ensure read-only API access succeeds.\n4. Click **'Save & Continue'** to immediately run assessments against the newly connected account.`,
      action: { label: 'Go to Settings', target: 'settings' },
    };
  }

  // 8. "Summarize critical findings across all scans"
  if (
    (norm.includes('critical') || norm.includes('all findings')) &&
    (norm.includes('across all') || norm.includes('all scans') || norm.includes('all reviews') || norm.includes('all assessments') || norm.includes('across scans'))
  ) {
    return {
      content: `**Critical Findings Across All 7 Scans**:\n\nThere are **12 High Risk Issues (HRIs)** and **16 Medium Risk Issues** identified across your cloud fleet:\n\n1. **Network Boundary Exposure (4 HRIs)**: Open ingress \`0.0.0.0/0\` on SSH (port 22) and RDP (port 3389) in AWS and Azure environments.\n2. **IAM Wildcard Over-Privilege (4 HRIs)**: Service roles granting unrestricted \`Action: *\` on compute resources.\n3. **Data Protection & Encryption (2 HRIs)**: S3 buckets and EBS volumes without customer-managed KMS encryption.\n4. **High Availability & Fault Tolerance (2 HRIs)**: Single-AZ database deployments and missing load balancer health check paths.`,
      action: { label: 'Review All Findings', target: 'report' },
    };
  }

  // 9. "Summarize critical findings in this review"
  if (
    (norm.includes('summarize') || norm.includes('summary')) &&
    (norm.includes('this review') || norm.includes('this assessment') || norm.includes('findings in this') || norm.includes('critical findings'))
  ) {
    return {
      content: `**Critical Findings in ${aName} (${aCloud})**:\n\n• **SEC-047 (Security)**: IAM Wildcard permissions on Lambda execution role (\`acme-lambda-exec\`) allows full \`*:*\` administrator rights.\n• **SEC-061 (Security)**: Application Security Group allows public inbound SSH (\`0.0.0.0/0:22\`).\n• **REL-019 (Reliability)**: Production ALB missing health check target group in secondary Availability Zone (\`us-east-1b\`).\n• **OPS-012 (Operations)**: CloudWatch automated alarms missing on memory threshold metrics > 85%.\n\n**Impact**: Remediating these 4 findings will increase your review score from **${aScore}% → 92%**.`,
      action: { label: 'Go to AI Remediation', target: 'remediation' },
    };
  }

  // 10. "Which WAFR pillar scored lowest?"
  if (
    (norm.includes('pillar') && (norm.includes('lowest') || norm.includes('worst') || norm.includes('scored lowest') || norm.includes('score lowest'))) ||
    (norm.includes('which') && norm.includes('pillar') && norm.includes('low'))
  ) {
    return {
      content: `**Lowest Scoring WAFR Pillar: Security (79%)**\n\nIn **${aName}**, the **Security pillar** scored lowest at **79%**, followed by **Performance (80%)** and **Operations (82%)**.\n\n**Primary Root Causes**:\n• Unrestricted public ingress on port 22 in default and application security groups.\n• Missing AWS KMS Customer-Managed Key (CMK) encryption on primary data storage buckets.\n• IAM roles configured with broad administrative wildcards.\n\n**Action Plan**: Applying the 3 pre-generated Terraform remediation modules will raise Security to **94%**.`,
      action: { label: 'Inspect Security Pillar', target: 'report' },
    };
  }

  // 11. "What changed since last milestone scan?"
  if (
    (norm.includes('changed') || norm.includes('delta') || norm.includes('difference') || norm.includes('progress')) &&
    (norm.includes('milestone') || norm.includes('last scan') || norm.includes('previous scan'))
  ) {
    return {
      content: `**Changes Since Last Milestone Scan (v1.0 → v1.1)**:\n\n• **Overall Architecture Score**: Increased from **68% → 79%** (+11% gain).\n• **High Risk Issues**: Reduced from **9 HRIs down to 5 HRIs** (4 critical issues resolved).\n• **Security Pillar**: Rose from **58% → 74%** after enforcing S3 Block Public Access and KMS CMK encryption.\n• **Reliability Pillar**: Rose from **65% → 82%** after adding Multi-AZ RDS failover and automated daily snapshot schedules.\n• **Remaining Focus**: 5 HRIs remain, primarily in IAM least-privilege scoping and ALB health checks.`,
      action: { label: 'Open Milestones View', target: 'milestones' },
    };
  }

  // 12. "Show high-risk items in the Security pillar"
  if (
    (norm.includes('high risk') || norm.includes('hri') || norm.includes('critical')) &&
    norm.includes('security')
  ) {
    return {
      content: `**High-Risk Items in the Security Pillar**:\n\n1. **SEC-047 — IAM Lambda Execution Role Over-Privileged**:\n   - *Finding*: Role \`acme-lambda-exec\` has \`AdministratorAccess\` attached.\n   - *Risk*: Compromise of any serverless function yields full cloud account takeover.\n   - *Remediation*: Replace with scoped IAM policy restricted to target DynamoDB tables.\n\n2. **SEC-061 — Unrestricted Inbound SSH (Port 22)**:\n   - *Finding*: Security group \`sg-0e82910f2a\` permits \`0.0.0.0/0:22\`.\n   - *Risk*: Exposure to automated brute-force attacks and port scanning.\n   - *Remediation*: Restrict CIDR to internal bastion \`10.0.0.0/16\` or deploy AWS Systems Manager Session Manager.`,
      action: { label: 'Remediate Security Findings', target: 'remediation' },
    };
  }

  // 13. "Explain best practices for this pillar"
  if (norm.includes('best practice') || (norm.includes('explain') && norm.includes('pillar'))) {
    return {
      content: `**Well-Architected Framework 5 Pillars Overview**:\n\n• **Security**: Apply defense in depth, enforce least-privilege IAM with MFA, enable traceability (CloudTrail/GuardDuty), and encrypt all data in transit and at rest.\n• **Reliability**: Test recovery procedures automatically, scale horizontally to aggregate availability, implement graceful degradation, and stop guessing capacity.\n• **Cost Optimization**: Adopt a consumption model, measure efficiency with FinOps tags, stop spending on undifferentiated heavy lifting, and continuously right-size idle resources.\n• **Operational Excellence**: Perform operations as code, make frequent small reversible changes, anticipate failure, and learn from all operational events.\n• **Performance Efficiency**: Democratize advanced technologies, go global in minutes, experiment frequently, and leverage serverless architectures.`,
      action: { label: 'View Pillar Report', target: 'report' },
    };
  }

  // 14. "How do I resolve failed checks in this pillar?"
  if (
    (norm.includes('resolve') || norm.includes('fix') || norm.includes('solve')) &&
    (norm.includes('failed') || norm.includes('check') || norm.includes('pillar'))
  ) {
    return {
      content: `**How to Resolve Failed Checks in this Pillar**:\n\n1. **Open AI Remediation**: Go to the Remediation page to view all impacted resources grouped under each failed check.\n2. **Select Impacted Resource**: Click any resource (e.g. \`sg-0e82910f2a\`) to expand its tailored fix drawer.\n3. **Choose Remediation Method**:\n   • **Infrastructure as Code (IaC)**: View and copy ready-to-merge Terraform or CloudFormation modules.\n   • **Cloud CLI**: Copy pre-populated terminal commands with your exact resource IDs.\n   • **Manual Console**: Step-by-step AWS/Azure/GCP management console walkthrough.\n4. **Apply & Verify**: Click 'Rerun Check' on the impacted resource to run a live telemetry verification and confirm compliance.`,
      action: { label: 'Go to Remediation', target: 'remediation' },
    };
  }

  // 15. "Generate Terraform remediation for high risk findings"
  if (
    (norm.includes('generate') || norm.includes('create') || norm.includes('write')) &&
    (norm.includes('terraform') || norm.includes('iac') || norm.includes('code'))
  ) {
    return {
      content: `Here is the synthesized **Terraform remediation module** for the highest risk finding (\`SEC-061: Restrict Public SSH\`):\n\n\`\`\`hcl\n# Terraform Fix for SEC-061: Restrict SSH Ingress to Bastion CIDR\nresource "aws_security_group_rule" "bastion_ssh_ingress" {\n  type              = "ingress"\n  from_port         = 22\n  to_port           = 22\n  protocol          = "tcp"\n  cidr_blocks       = ["10.0.0.0/16"] # Corporate VPC CIDR\n  description       = "Restrict SSH to corporate bastion VPC network"\n  security_group_id = aws_security_group.production_app.id\n}\n\n# Enforce default EBS volume encryption with KMS CMK\nresource "aws_ebs_encryption_by_default" "enforce_ebs" {\n  enabled = true\n}\n\`\`\`\n\nThis code has been validated against Terraform >= 1.5 and is ready to push directly to your Git repository.`,
      action: { label: 'Open in AI Fix Studio', target: 'remediation' },
    };
  }

  // 16. "What is the estimated impact on pillar score?"
  if (
    (norm.includes('impact') || norm.includes('projected') || norm.includes('increase')) &&
    (norm.includes('score') || norm.includes('pillar score'))
  ) {
    return {
      content: `**Projected Score Impact Analysis**:\n\n• **Security Pillar**: Currently **79%** → Projected **94%** (+15 points)\n  - Closing SEC-047 (IAM Wildcard) adds +8 points.\n  - Closing SEC-061 (SSH Ingress) adds +7 points.\n• **Reliability Pillar**: Currently **88%** → Projected **95%** (+7 points)\n  - Resolving ALB health check redundancy adds +7 points.\n• **Overall Composite Score**:\n  - Current: **${aScore}%**\n  - After High Risk Fixes: **92%**\n  - After All 4 AI Fixes Applied: **96% (Milestone 3 Audit Ready)**`,
      action: { label: 'Preview in Milestones', target: 'milestones' },
    };
  }

  // 17. "How does autonomous AI remediation work?"
  if (
    norm.includes('autonomous') ||
    (norm.includes('how') && (norm.includes('ai remediation work') || norm.includes('remediation work')))
  ) {
    return {
      content: `**How LENS AI Remediation Works**:\n\n1. **Diagnostic Mapping**: When a WAFR scan fails a best practice check, LENS identifies and isolates the specific cloud resource identifiers (ARNs, Security Group IDs, Bucket Names).\n2. **Context-Aware Code Generation**: The AI engine inspects your architecture metadata and generates syntactically correct Terraform, CloudFormation, and CLI commands tailored to your exact resource names.\n3. **Resource Isolation**: Each impacted resource has its own dedicated fix modal so you can review diffs, test dry-runs, or execute fixes individually without blast-radius risk.\n4. **GitHub PR Export**: You can export the generated IaC code directly as a Pull Request to your connected Git repository for team code review and CI/CD deployment.`,
      action: { label: 'Explore AI Remediation', target: 'remediation' },
    };
  }

  // 18. "Explain Terraform fix for S3 SSE-KMS encryption"
  if (norm.includes('s3') && (norm.includes('sse') || norm.includes('kms') || norm.includes('encryption'))) {
    return {
      content: `**Terraform Fix for S3 SSE-KMS Encryption (SEC-004)**:\n\n\`\`\`hcl\n# Enforce KMS Server-Side Encryption on S3 Bucket\nresource "aws_s3_bucket_server_side_encryption_configuration" "kms_enforce" {\n  bucket = aws_s3_bucket.data_lake.id\n\n  rule {\n    apply_server_side_encryption_by_default {\n      kms_master_key_id = aws_kms_key.s3_cmk.arn\n      sse_algorithm     = "aws:kms"\n    }\n    bucket_key_enabled = true # Reduces KMS API costs by up to 99%\n  }\n}\n\`\`\`\n\n**Key Highlights**:\n• Uses AWS KMS Customer-Managed Keys (\`aws:kms\`) instead of default AWS-managed \`AES256\`.\n• \`bucket_key_enabled = true\` caches encryption keys at the S3 level, slashing KMS API request charges.`,
      action: { label: 'View in AI Fix', target: 'remediation' },
    };
  }

  // 19. "What is the estimated cost savings of these fixes?"
  if (
    (norm.includes('cost') || norm.includes('savings') || norm.includes('spend') || norm.includes('save')) &&
    (norm.includes('estimate') || norm.includes('these fixes') || norm.includes('potential') || norm.includes('monthly') || norm.includes('how much'))
  ) {
    return {
      content: `**Estimated Cost Savings Breakdown**:\n\n• **EBS Volume Cleanup**: 3 unattached gp2 volumes identified in \`us-east-1\` (1.2 TB total). Deleting or snapshotting saves **$144.00 / month**.\n• **EC2 Right-Sizing**: 2 \`m5.4xlarge\` instances running at <8% average CPU. Downsizing to \`m5.xlarge\` saves **$380.00 / month**.\n• **S3 Lifecycle Tiering**: Transitioning 4.8 TB of logs from Standard to Glacier Instant Retrieval saves **$84.50 / month**.\n\n**Total Estimated Savings**: **$608.50 / month** ($7,302 / year)\n**Implementation Effort**: Under 30 minutes using the generated Terraform scripts.`,
      action: { label: 'Review Cost Findings', target: 'remediation' },
    };
  }

  // 20. "How do I export PRs directly to GitHub repo?"
  if (
    (norm.includes('export') || norm.includes('create') || norm.includes('open') || norm.includes('push')) &&
    (norm.includes('github') || norm.includes('pr') || norm.includes('pull request') || norm.includes('repo'))
  ) {
    return {
      content: `**How to Export PRs Directly to GitHub**:\n\n1. Open the **AI Remediation** page.\n2. Select the resource fix you want to apply, or click **'Remediate All'**.\n3. Click **'Export to GitHub PR'** in the top action bar.\n4. Select your connected repository (e.g. \`acmecorp/cloud-infra-live\`) and target branch (\`main\` or \`feature/wafr-hardening\`).\n5. Review the auto-generated PR title and markdown description.\n6. Click **'Create Pull Request'**. LENS commits the Terraform files and opens the PR on GitHub automatically.`,
      action: { label: 'Open Remediation Hub', target: 'remediation' },
    };
  }

  // 21. "Explain this Terraform code diff"
  if (
    norm.includes('diff') ||
    norm.includes('code diff') ||
    (norm.includes('explain') && norm.includes('terraform code'))
  ) {
    return {
      content: `**Terraform Code Diff Explanation**:\n\n• **Red Lines (\`-\`)**: Removes the open CIDR block \`0.0.0.0/0\` on ingress port 22 which allowed public internet traffic to your compute instances.\n• **Green Lines (\`+\`)**: Adds restricted ingress rule scoped strictly to your internal bastion VPC network \`10.0.0.0/16\`.\n• **Security Impact**: Closes attack vectors for port scanning and SSH brute-force intrusions.\n• **Compliance**: Satisfies CIS AWS Foundations Benchmark Control 5.2 and WAFR SEC-06.`,
      action: { label: 'View Code Diff', target: 'remediation' },
    };
  }

  // 22. "Verify security compliance for this fix"
  if (
    norm.includes('verify security') ||
    norm.includes('security compliance') ||
    (norm.includes('compliance') && (norm.includes('this fix') || norm.includes('verify')))
  ) {
    return {
      content: `**Security Compliance Verification**:\n\n• **WAFR Security Pillar**: Satisfies **SEC 1 — Secure Network Foundations** and **SEC 3 — Manage Permissions**.\n• **CIS AWS Foundations v2.0**: Passes Control 5.2 ('Ensure no security groups allow ingress from 0.0.0.0/0 to port 22').\n• **SOC 2 Type II**: Satisfies CC6.6 (Logical boundary protection) and CC6.7 (Data transmission security).\n• **Regression Risk**: **Low** — Internal application connectivity remains unaffected within the VPC.`,
      action: { label: 'Inspect Compliance', target: 'report' },
    };
  }

  // 23. "What resources will be modified by this PR?"
  if (
    (norm.includes('resources') || norm.includes('modified')) &&
    (norm.includes('pr') || norm.includes('this pull request') || norm.includes('will be modified'))
  ) {
    return {
      content: `**Resources Modified by this PR**:\n\n1. \`aws_security_group.production_app\` (\`sg-0e82910f2a\`) — Ingress rule modification.\n2. \`aws_iam_role_policy.lambda_custom_policy\` — Replacing wildcard policy with scoped DynamoDB/SQS permissions.\n3. \`aws_s3_bucket_server_side_encryption_configuration.prod_bucket\` — Applying KMS CMK encryption.\n\n**State Impact**: 2 resources updated in-place, 0 resources destroyed.`,
      action: { label: 'Review PR Details', target: 'remediation' },
    };
  }

  // 24. "Generate alternative CLI script instead of Terraform"
  if (
    (norm.includes('cli') || norm.includes('bash') || norm.includes('script') || norm.includes('terminal')) &&
    (norm.includes('alternative') || norm.includes('instead of') || norm.includes('command') || norm.includes('aws cli'))
  ) {
    return {
      content: `Here is the alternative **AWS CLI command script** to apply this fix directly from your terminal:\n\n\`\`\`bash\n# 1. Revoke the public 0.0.0.0/0 SSH ingress rule\naws ec2 revoke-security-group-ingress \\\n  --group-id sg-0e82910f2a \\\n  --protocol tcp \\\n  --port 22 \\\n  --cidr 0.0.0.0/0\n\n# 2. Add authorized VPC internal CIDR rule\naws ec2 authorize-security-group-ingress \\\n  --group-id sg-0e82910f2a \\\n  --protocol tcp \\\n  --port 22 \\\n  --cidr 10.0.0.0/16\n\n# 3. Verify security group rules\naws ec2 describe-security-groups --group-ids sg-0e82910f2a --query "SecurityGroups[0].IpPermissions"\n\`\`\`\n\nYou can run these commands directly in AWS CloudShell or your local authenticated terminal.`,
      action: { label: 'Open Remediation Page', target: 'remediation' },
    };
  }

  // 25. "What are the key roadmap goals for Milestone 2?"
  if (norm.includes('milestone 2') || (norm.includes('roadmap') && norm.includes('goal'))) {
    return {
      content: `**Milestone 2 Roadmap Goals (Q3 Security & Reliability Hardening)**:\n\n• **Target Score**: **92%** (Up from baseline 79%).\n• **Zero High Risk Issues**: Remediate all 5 remaining HRIs in Security and Reliability.\n• **Key Deliverables**:\n  1. Enforce KMS CMK encryption across 100% of S3 buckets and EBS volumes.\n  2. Enforce IAM least-privilege policies with zero wildcard permissions.\n  3. Enable RDS Multi-AZ failover and automated backup retention.\n  4. Deploy AWS WAF on Application Load Balancers.\n• **Target Target Completion Date**: September 30, 2026.`,
      action: { label: 'Open Milestones View', target: 'milestones' },
    };
  }

  // 26. "Compare Milestone 1 score vs current state"
  if (
    (norm.includes('milestone 1') || norm.includes('baseline')) &&
    (norm.includes('vs') || norm.includes('compare') || norm.includes('current'))
  ) {
    return {
      content: `**Milestone 1 (Baseline) vs Current State**:\n\n• **Overall Architecture Score**: **68% → 84%** (+16 points gained).\n• **High Risk Issues**: Reduced from **9 HRIs down to 3 HRIs** (-66% risk reduction).\n• **Pillar Improvements**:\n  - **Security**: 58% → 79% (+21%)\n  - **Reliability**: 65% → 88% (+23%)\n  - **Cost Optimization**: 74% → 91% (+17%)\n  - **Operational Excellence**: 70% → 82% (+12%)\n  - **Performance**: 73% → 80% (+7%)\n• **Passed Checks**: 26 passed checks → 38 passed checks.`,
      action: { label: 'View Milestones History', target: 'milestones' },
    };
  }

  // 27. "How to achieve SOC 2 / HIPAA compliance milestone?"
  if (norm.includes('soc 2') || norm.includes('soc2') || norm.includes('hipaa')) {
    return {
      content: `**Path to SOC 2 & HIPAA Compliance Milestone**:\n\nTo satisfy SOC 2 Trust Services Criteria and HIPAA Security Rule controls:\n1. **Data at Rest Encryption**: Ensure 100% of S3 buckets, EBS volumes, and RDS instances use KMS Customer-Managed Keys.\n2. **Access Control & Auditability**: Enable AWS CloudTrail in all regions with log file integrity validation and S3 object logging.\n3. **Network Boundary Enforcement**: No database or compute instances directly exposed to public subnets (\`0.0.0.0/0\`).\n4. **Automated Backups & DR**: Define and test recovery time objective (RTO < 4h) and recovery point objective (RPO < 1h).\n\nAchieving these checks will raise your architecture score to **>95%** and unlock the 'Audit Ready' milestone status.`,
      action: { label: 'Inspect Compliance Checks', target: 'report' },
    };
  }

  // 28. "What is the projected risk reduction across milestones?"
  if (
    (norm.includes('projected') || norm.includes('reduction') || norm.includes('trajectory')) &&
    (norm.includes('risk') || norm.includes('milestone'))
  ) {
    return {
      content: `**Projected Risk Reduction Trajectory Across Milestones**:\n\n• **Milestone 1 (Migration Baseline)**: 9 High Risk Issues · 7 Medium Risk Issues (Score: 68%)\n• **Current State**: 3 High Risk Issues · 4 Medium Risk Issues (Score: 84% — **58% Risk Reduction**)\n• **Milestone 2 (Target)**: 0 High Risk Issues · 2 Medium Risk Issues (Score: 92% — **88% Risk Reduction**)\n• **Milestone 3 (Audit Ready)**: 0 High Risk Issues · 0 Medium Risk Issues (Score: 96% — **100% Critical Risk Cleared**)\n\nEach milestone records an immutable snapshot of your cloud posture for audit verification.`,
      action: { label: 'Explore Milestones', target: 'milestones' },
    };
  }

  // 29. "How do I fix open security groups?"
  if (
    norm.includes('security group') ||
    norm.includes('open port') ||
    norm.includes('port 22') ||
    norm.includes('open security')
  ) {
    return {
      content: `**How to Fix Open Security Groups (\`0.0.0.0/0\` Ingress)**:\n\n1. **Identify Exposed Ports**: Inspect ports 22 (SSH), 3389 (RDP), 3306 (MySQL), and 5432 (PostgreSQL) listening on \`0.0.0.0/0\`.\n2. **Restrict Ingress**: Replace \`0.0.0.0/0\` with your specific corporate CIDR block or VPN IP addresses.\n3. **Best Practice Recommendation**: Transition EC2 administration from direct SSH to **AWS Systems Manager Session Manager (SSM)**. SSM requires no open inbound ports and automatically logs all terminal sessions to CloudWatch.`,
      action: { label: 'Go to AI Remediation', target: 'remediation' },
    };
  }

  // 30. General Cost / FinOps questions
  if (norm.includes('cost') || norm.includes('finops') || norm.includes('pricing') || norm.includes('billing')) {
    return {
      content: `**Cost Optimization Analysis for ${aName}**:\n\n• **Monthly Savings Identified**: **$608.50 / month**\n• **Key Waste Areas**:\n  - 3 unattached EBS gp2 volumes totaling 1.2 TB ($144/mo).\n  - 2 oversized EC2 m5.4xlarge instances with <8% CPU utilization ($380/mo).\n  - S3 storage bucket lifecycle rules missing for access logs ($84.50/mo).\n\nReview the Cost findings in AI Remediation to preview downsizing and cleanup scripts.`,
      action: { label: 'Review Cost Findings', target: 'remediation' },
    };
  }

  // 31. Greetings or capabilities
  if (
    norm === 'hi' ||
    norm === 'hello' ||
    norm === 'hey' ||
    norm.includes('help') ||
    norm.includes('who are you') ||
    norm.includes('what can you do')
  ) {
    return {
      content: `Hello! I am **LENS AI Copilot**, your multi-cloud Well-Architected Framework advisor.\n\nI can assist you with:\n• Evaluating the **5 WAFR Pillars** (Security, Reliability, Cost, Operations, Performance)\n• Explaining critical **High-Risk Issues** and generating automated Terraform / CLI code fixes\n• Simulating score impact and tracking **compliance milestones** (SOC 2, HIPAA, CIS)\n• Exporting automated fixes as **GitHub Pull Requests** directly to your infrastructure repositories.\n\nAsk any question or click a suggested prompt below to get started!`,
      action: { label: 'View Assessment Report', target: 'report' },
    };
  }

  // 32. Contextual Default Fallback
  return {
    content: `I have analyzed your **${aCloud}** environment for **${aName}** (Current Score: **${aScore}%**).\n\nYou can ask me to evaluate any of the 5 WAFR pillars, generate Terraform code fixes for high-risk findings, calculate cost savings, or track milestone compliance progress.`,
    action: { label: 'Explore Remediation Hub', target: 'remediation' },
  };
}

/** Formats message text with sleek code blocks, bold text, and inline code badges */
function FormattedMessage({ content, isDark }: { content: string; isDark: boolean }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-xs leading-relaxed" style={{ color: isDark ? '#E2E8F0' : '#1E293B' }}>
      {parts.map((part, idx) => {
        if (part.startsWith('```')) {
          const match = part.match(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/);
          const lang = match ? match[1] : '';
          const code = match ? match[2] : part.slice(3, -3);
          return (
            <div
              key={idx}
              className="my-2.5 rounded-xl overflow-hidden border shadow-inner"
              style={{
                borderColor: isDark ? '#334155' : '#CBD5E1',
                backgroundColor: isDark ? '#080d17' : '#0F172A',
              }}
            >
              {lang && (
                <div
                  className="px-3 py-1 border-b text-[10px] font-mono text-cyan-400 uppercase tracking-wider flex justify-between items-center"
                  style={{
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : '#1E293B',
                    borderColor: '#334155',
                  }}
                >
                  <span>{lang}</span>
                  <span className="text-slate-400 lowercase text-[9px]">LENS Code Fix</span>
                </div>
              )}
              <pre className="p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre leading-normal">
                <code>{code.trim()}</code>
              </pre>
            </div>
          );
        }

        return (
          <div key={idx} className="space-y-1.5 whitespace-pre-wrap font-sans">
            {part.split('\n\n').map((para, pIdx) => {
              const renderFormattedText = (text: string) => {
                const subParts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
                return subParts.map((sub, sIdx) => {
                  if (sub.startsWith('**') && sub.endsWith('**')) {
                    return (
                      <strong
                        key={sIdx}
                        className="font-semibold"
                        style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}
                      >
                        {sub.slice(2, -2)}
                      </strong>
                    );
                  }
                  if (sub.startsWith('`') && sub.endsWith('`')) {
                    return (
                      <code
                        key={sIdx}
                        className="px-1.5 py-0.5 rounded font-mono text-[11px] border"
                        style={{
                          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : '#F1F5F9',
                          borderColor: isDark ? '#334155' : '#CBD5E1',
                          color: isDark ? '#67E8F9' : '#0369A1',
                        }}
                      >
                        {sub.slice(1, -1)}
                      </code>
                    );
                  }
                  return sub;
                });
              };

              return (
                <p key={pIdx} className="leading-relaxed">
                  {renderFormattedText(para)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AssessmentChat({ isOpen, onClose }: Props) {
  const { screen, theme, currentAssessment, go } = useApp();
  const isDark = theme === 'dark';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const border = isDark ? '#1E293B' : '#E2E8F0';
  const bg = isDark ? '#0e1626' : '#FFFFFF';
  const surface = isDark ? '#162032' : '#F8FAFC';
  const aBubble = isDark ? '#141E33' : '#F8FAFC';

  const currentSuggestions = SCREEN_SUGGESTIONS[screen] || DEFAULT_SUGGESTIONS;

  const send = (content: string) => {
    if (!content.trim() || thinking) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: content.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setThinking(true);

    setTimeout(() => {
      const response = getDynamicResponse(content, screen, currentAssessment);
      const botMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: response.content,
        action: response.action,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, botMsg]);
      setThinking(false);
    }, 600);
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
  };

  useEffect(() => {
    if (isOpen) {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, thinking, isOpen]);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(0,0,0,.45)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Slide-out Chat Panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300 shadow-2xl"
        style={{
          width: '450px',
          maxWidth: '100vw',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          backgroundColor: bg,
          borderLeft: `1px solid ${border}`,
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 px-5 py-3.5 flex items-center justify-between border-b"
          style={{ borderColor: border, backgroundColor: isDark ? '#111A2E' : '#FFFFFF' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 50%, #10b981 100%)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  LENS AI Copilot
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  Online
                </span>
              </div>
              <div className="text-[11px] flex items-center gap-1.5" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>
                <span>{currentAssessment?.name || 'Multi-Cloud Assessment'}</span>
                <span>·</span>
                <span className="font-semibold" style={{ color: isDark ? '#34D399' : '#059669' }}>
                  {currentAssessment?.score || 84}% Score
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                  isDark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Reset conversation"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Close Chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Thread Messages */}
        <div ref={threadRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
          {messages.length === 0 && !thinking && (
            <div className="flex flex-col gap-3 my-auto">
              <div className="text-center py-3 px-2">
                <div
                  className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 50%, #10b981 100%)' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" stroke="#10b981" />
                    <circle cx="12" cy="12" r="2" fill="#38bdf8" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  How can I assist your cloud review?
                </h3>
                <p className="text-xs mt-1 max-w-xs mx-auto leading-relaxed" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>
                  Ask questions about WAFR 5 Pillars, High-Risk Issues, Terraform code fixes, or milestones.
                </p>
              </div>

              {/* Quick suggestions based on screen context */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: isDark ? '#64748B' : '#94A3B8' }}>
                  Suggested for this page
                </span>
                {currentSuggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => send(s)}
                    className="text-left px-3.5 py-2.5 rounded-xl text-xs transition-all flex items-center justify-between group cursor-pointer hover:border-cyan-500/50"
                    style={{
                      backgroundColor: surface,
                      border: `1px solid ${border}`,
                      color: isDark ? '#CBD5E1' : '#334155',
                    }}
                  >
                    <span>{s}</span>
                    <span className="text-slate-400 group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all text-sm font-bold">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[92%] p-3.5 text-xs leading-relaxed rounded-2xl shadow-sm ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'rounded-bl-sm border'
                }`}
                style={
                  m.role === 'assistant'
                    ? {
                        backgroundColor: aBubble,
                        borderColor: isDark ? '#1E293B' : '#CBD5E1',
                        color: isDark ? '#E2E8F0' : '#1E293B',
                      }
                    : {}
                }
              >
                {m.role === 'user' ? (
                  <div className="whitespace-pre-wrap font-sans font-medium">{m.content}</div>
                ) : (
                  <FormattedMessage content={m.content} isDark={isDark} />
                )}

                {m.action && (
                  <div
                    className="mt-3 pt-2.5 border-t flex items-center justify-between"
                    style={{ borderColor: isDark ? '#1E293B' : '#E2E8F0' }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        go(m.action!.target);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{m.action.label}</span>
                      <span>→</span>
                    </button>
                  </div>
                )}
              </div>
              {m.time && (
                <span className="text-[10px] px-1.5 mt-1 font-mono" style={{ color: isDark ? '#64748B' : '#94A3B8' }}>
                  {m.time}
                </span>
              )}
            </div>
          ))}

          {thinking && (
            <div
              className="flex items-center gap-2 p-3 rounded-2xl max-w-[130px] border"
              style={{
                backgroundColor: aBubble,
                borderColor: border,
              }}
            >
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse delay-150" />
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse delay-300" />
              <span className="text-[11px] ml-1 font-medium" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>
                Analyzing...
              </span>
            </div>
          )}
        </div>

        {/* Floating Quick Prompt Pills if conversation is active */}
        {messages.length > 0 && !thinking && (
          <div
            className="px-3.5 py-2 flex items-center gap-1.5 overflow-x-auto border-t shrink-0 no-scrollbar"
            style={{
              borderColor: border,
              backgroundColor: isDark ? 'rgba(14, 22, 38, 0.95)' : '#F8FAFC',
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 mr-1" style={{ color: isDark ? '#64748B' : '#94A3B8' }}>
              Ask:
            </span>
            {currentSuggestions.slice(0, 3).map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => send(s)}
                className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer"
                style={{
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(51, 65, 85, 0.6)' : '#CBD5E1',
                  color: isDark ? '#E2E8F0' : '#334155',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input Footer */}
        <div className="shrink-0 p-3.5 border-t" style={{ borderColor: border, backgroundColor: isDark ? '#111A2E' : '#FFFFFF' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask LENS AI about ${currentAssessment?.name || 'your cloud'}…`}
              className="flex-1 px-4 py-2.5 rounded-xl text-xs outline-none border focus:border-cyan-500 transition-colors"
              style={{
                backgroundColor: isDark ? '#162032' : '#F8FAFC',
                borderColor: isDark ? '#334155' : '#CBD5E1',
                color: isDark ? '#FFFFFF' : '#0F172A',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 50%, #10b981 100%)' }}
              title="Send message"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export function ChatLauncher({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center p-4 rounded-full text-white shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer group"
      style={{
        background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 50%, #10b981 100%)',
        boxShadow: '0 8px 30px rgba(13, 148, 136, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.15)',
      }}
      title="Ask LENS AI Copilot"
    >
      <div className="relative">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
    </button>
  );
}

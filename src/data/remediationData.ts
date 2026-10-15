import { api } from '../services/apiClient';
import type { Severity } from '../components/FindingUI';

export interface ManualStepItem {
  step: number;
  title: string;
  instruction: string;
  consolePath?: string;
}

export interface CheckRemediationData {
  id: string;
  check_id?: string;
  cloud?: 'aws' | 'azure' | 'gcp';
  pillar: string;
  pillarId: string;
  severity: Severity;
  title: string;
  effort: string;
  estTime: string;
  risk: string;
  description: string;
  rationale: string;
  resources: string[];
  manualSteps: ManualStepItem[];
  cli: {
    command: string;
    explanation: string;
  };
  iac: {
    tf: string;
    cf: string;
    bicep?: string;
  };
}

export interface ResourceInfo {
  raw: string;
  shortName: string;
  type: string;
  region: string;
  service: string;
}

export function parseResourceInfo(raw: string): ResourceInfo {
  if (!raw) return { raw: '', shortName: 'resource', type: 'Cloud Resource', region: 'global', service: 'cloud' };

  // ── AZURE RESOURCE IDS ──────────────────────────────────────────────────
  if (raw.startsWith('/subscriptions/') || raw.includes('/resourceGroups/')) {
    const parts = raw.split('/');
    const subIdx = parts.indexOf('subscriptions');
    const rgIdx = parts.indexOf('resourceGroups');
    const providersIdx = parts.indexOf('providers');
    const shortName = parts[parts.length - 1] || 'azure-resource';
    
    let type = 'Azure Resource';
    let service = 'azure';

    if (providersIdx !== -1 && parts.length > providersIdx + 2) {
      const namespace = parts[providersIdx + 1]; // e.g. Microsoft.Network
      const resType = parts[providersIdx + 2];   // e.g. applicationGateways
      service = namespace.toLowerCase().replace('microsoft.', 'azure-');
      
      if (resType === 'applicationGateways') type = 'Application Gateway';
      else if (resType === 'networkSecurityGroups') type = 'Network Security Group (NSG)';
      else if (resType === 'loadBalancers') type = 'Azure Load Balancer';
      else if (resType === 'virtualMachineScaleSets') type = 'VM Scale Set';
      else if (resType === 'virtualMachines') type = 'Virtual Machine';
      else if (resType === 'storageAccounts') type = 'Storage Account';
      else if (resType === 'vaults') type = 'Key Vault';
      else if (resType === 'namespaces') type = 'Service Bus Namespace';
      else if (resType === 'queues') type = 'Service Bus Queue';
      else if (resType === 'disks') type = 'Managed Disk';
      else if (resType === 'profiles') type = 'Front Door / CDN Profile';
      else type = resType;
    }

    return { raw, shortName, type, region: 'eastus', service };
  }

  // ── GCP RESOURCE NAMES ──────────────────────────────────────────────────
  if (raw.startsWith('//') || raw.includes('googleapis.com') || raw.startsWith('projects/')) {
    const clean = raw.replace(/^\/\//, '');
    const segments = clean.split('/');
    const shortName = segments[segments.length - 1] || 'gcp-resource';
    
    let type = 'GCP Resource';
    let service = 'gcp';
    let region = 'us-central1';

    if (clean.includes('compute.googleapis.com')) {
      service = 'gcp-compute';
      if (clean.includes('/backendServices/')) type = 'Backend Service';
      else if (clean.includes('/firewalls/')) type = 'Firewall Rule';
      else if (clean.includes('/disks/')) type = 'Persistent Disk';
      else if (clean.includes('/instanceGroups/')) type = 'Instance Group';
      else type = 'Compute Engine';
    } else if (clean.includes('storage.googleapis.com') || clean.includes('/buckets/')) {
      service = 'gcp-storage';
      type = 'Cloud Storage Bucket';
    } else if (clean.includes('pubsub.googleapis.com')) {
      service = 'gcp-pubsub';
      type = clean.includes('/subscriptions/') ? 'Pub/Sub Subscription' : 'Pub/Sub Topic';
    } else if (clean.includes('iam.googleapis.com')) {
      service = 'gcp-iam';
      type = 'Service Account';
    } else if (clean.includes('cloudkms.googleapis.com')) {
      service = 'gcp-kms';
      type = 'KMS Crypto Key';
    } else if (clean.includes('logging.googleapis.com')) {
      service = 'gcp-logging';
      type = 'Log Sink';
    }

    return { raw, shortName, type, region, service };
  }

  // ── AWS ARNs & IDENTIFIERS ──────────────────────────────────────────────
  const parenMatch = raw.match(/^(sg-[a-f0-9]+)\s*\(([^)]+)\)$/i);
  if (parenMatch) {
    return {
      raw,
      shortName: parenMatch[2].trim(),
      type: 'Security Group',
      region: 'us-east-1',
      service: 'ec2',
    };
  }

  if (raw.startsWith('sg-')) {
    return {
      raw,
      shortName: raw,
      type: 'Security Group',
      region: 'us-east-1',
      service: 'ec2',
    };
  }

  if (raw.startsWith('arn:')) {
    const parts = raw.split(':');
    const service = parts[2] || 'aws';
    const region = parts[3] || 'us-east-1';
    const resourcePart = parts.slice(5).join(':');

    let type = 'Cloud Resource';
    let shortName = resourcePart;

    if (service === 'elasticloadbalancing') {
      if (resourcePart.startsWith('targetgroup/')) {
        type = 'Target Group';
        const tgParts = resourcePart.replace('targetgroup/', '').split('/');
        shortName = tgParts[0] || resourcePart;
      } else if (resourcePart.startsWith('loadbalancer/')) {
        type = 'Load Balancer';
        const lbParts = resourcePart.replace('loadbalancer/', '').split('/');
        shortName = lbParts[1] || lbParts[0] || resourcePart;
      }
    } else if (service === 'sqs') {
      type = 'SQS Queue';
      shortName = resourcePart;
    } else if (service === 'iam') {
      if (resourcePart.startsWith('role/')) {
        type = 'IAM Role';
        shortName = resourcePart.replace('role/', '');
      } else if (resourcePart.startsWith('policy/')) {
        type = 'IAM Policy';
        shortName = resourcePart.replace('policy/', '');
      } else {
        type = 'IAM Resource';
      }
    } else if (service === 'ec2') {
      if (resourcePart.startsWith('instance/')) {
        type = 'EC2 Instance';
        shortName = resourcePart.replace('instance/', '');
      } else if (resourcePart.startsWith('security-group/')) {
        type = 'Security Group';
        shortName = resourcePart.replace('security-group/', '');
      } else if (resourcePart.startsWith('volume/')) {
        type = 'EBS Volume';
        shortName = resourcePart.replace('volume/', '');
      } else {
        type = 'EC2 Resource';
      }
    } else if (service === 's3') {
      type = 'S3 Bucket';
      shortName = resourcePart.replace(/^\/+/, '');
    } else if (service === 'dynamodb') {
      type = 'DynamoDB Table';
      shortName = resourcePart.replace('table/', '');
    } else if (service === 'kms') {
      type = 'KMS Key';
      shortName = resourcePart.replace('key/', '');
    } else if (service === 'cloudwatch') {
      type = 'CloudWatch Alarm';
      shortName = resourcePart.replace('alarm:', '');
    } else {
      const slashIdx = resourcePart.lastIndexOf('/');
      if (slashIdx !== -1) {
        shortName = resourcePart.substring(slashIdx + 1);
      }
    }

    return { raw, shortName: shortName || raw, type, region, service };
  }

  return { raw, shortName: raw, type: 'Cloud Resource', region: 'us-east-1', service: 'cloud' };
}

export function getResourceSpecificRemediation(checkData: CheckRemediationData, selectedArn: string) {
  const baseArn = checkData.resources[0] || '';
  if (!selectedArn || selectedArn === baseArn) {
    return {
      tf: checkData.iac.tf,
      cf: checkData.iac.cf,
      cliCommand: checkData.cli.command,
      manualSteps: checkData.manualSteps,
    };
  }

  const baseInfo = parseResourceInfo(baseArn);
  const targetInfo = parseResourceInfo(selectedArn);

  const baseShort = baseInfo.shortName;
  const targetShort = targetInfo.shortName;

  const replaceAllSafe = (str: string, search: string, replacement: string) => {
    if (!search || !str || search === replacement) return str;
    return str.split(search).join(replacement);
  };

  let tfCode = checkData.iac.tf;
  let cfCode = checkData.iac.cf;
  let cliCommand = checkData.cli.command;

  // Replace full ARN if present
  if (baseArn) {
    tfCode = replaceAllSafe(tfCode, baseArn, selectedArn);
    cfCode = replaceAllSafe(cfCode, baseArn, selectedArn);
    cliCommand = replaceAllSafe(cliCommand, baseArn, selectedArn);
  }

  // Replace short names
  if (baseShort && targetShort && baseShort !== targetShort) {
    tfCode = replaceAllSafe(tfCode, baseShort, targetShort);
    cfCode = replaceAllSafe(cfCode, baseShort, targetShort);
    cliCommand = replaceAllSafe(cliCommand, baseShort, targetShort);
  }

  // Update manual steps
  const manualSteps = checkData.manualSteps.map(step => {
    let title = step.title;
    let instruction = step.instruction;
    let consolePath = step.consolePath || '';

    if (baseShort && targetShort && baseShort !== targetShort) {
      title = replaceAllSafe(title, baseShort, targetShort);
      instruction = replaceAllSafe(instruction, baseShort, targetShort);
      consolePath = replaceAllSafe(consolePath, baseShort, targetShort);
    }

    return {
      ...step,
      title,
      instruction,
      consolePath,
    };
  });

  return {
    tf: tfCode,
    cf: cfCode,
    cliCommand,
    manualSteps,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOUD-SPECIFIC REMEDIATION DICTIONARIES (AWS, AZURE, GCP)
// ─────────────────────────────────────────────────────────────────────────────

export const AWS_REMEDIATIONS: Record<string, CheckRemediationData> = {
  'REL-019': {
    id: 'REL-019',
    check_id: 'REL-019',
    cloud: 'aws',
    pillar: 'Reliability',
    pillarId: 'reliability',
    severity: 'high',
    title: 'ALB target group missing active health check configuration',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'High Risk',
    description: 'Application Load Balancer target group prod-api-tg lacks an explicit health check endpoint, risking traffic routing to unhealthy backend targets.',
    rationale: 'Active health checks automatically detect application degradation and deregister unhealthy instances before user impact occurs.',
    resources: [
      'arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-api-tg/a1b2c3d4e5f6',
      'arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-checkout-tg/f7e6d5c4b3a2',
      'arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-auth-tg/998877665544',
      'arn:aws:elasticloadbalancing:us-east-1:124890123456:loadbalancer/app/prod-public-alb/50dc6c495c0c9188',
      'arn:aws:ec2:us-east-1:124890123456:instance/i-0a1b2c3d4e5f67890',
    ],
    manualSteps: [
      { step: 1, title: 'Navigate to EC2 Target Groups in AWS Console', consolePath: 'EC2 Console -> Target Groups', instruction: 'Log into the AWS Management Console in region us-east-1, navigate to EC2 > Target Groups, and select "prod-api-tg".' },
      { step: 2, title: 'Open Health Checks Tab', consolePath: 'prod-api-tg -> Health checks tab -> Edit', instruction: 'Under the "Health checks" tab, click "Edit". Set Health check protocol to HTTP.' },
      { step: 3, title: 'Set Path to /healthz', consolePath: 'Health check path: /healthz | Code: 200', instruction: 'Enter "/healthz" as the path. Set Success codes to "200".' },
      { step: 4, title: 'Tune Timing Thresholds', consolePath: 'Interval: 15s | Timeout: 5s | Threshold: 3', instruction: 'Set Interval to 15 seconds, Timeout to 5 seconds, Healthy threshold to 3.' },
      { step: 5, title: 'Save and Verify Target Health', consolePath: 'Save changes -> Targets tab', instruction: 'Click "Save changes" and verify all targets show Healthy.' },
    ],
    cli: {
      command: `aws elbv2 modify-target-group \\\n  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-api-tg/a1b2c3d4e5f6 \\\n  --health-check-protocol HTTP \\\n  --health-check-port 80 \\\n  --health-check-path /healthz \\\n  --health-check-interval-seconds 15 \\\n  --health-check-timeout-seconds 5 \\\n  --healthy-threshold-count 3 \\\n  --matcher HttpCode=200`,
      explanation: 'Executes an in-place configuration update against the ALB target group ARN, applying continuous HTTP /healthz probing every 15 seconds.',
    },
    iac: {
      tf: `resource "aws_lb_target_group" "prod_api" {\n  name     = "prod-api-tg"\n  port     = 80\n  protocol = "HTTP"\n  vpc_id   = var.vpc_id\n\n  health_check {\n    enabled             = true\n    protocol            = "HTTP"\n    path                = "/healthz"\n    interval            = 15\n    timeout             = 5\n    healthy_threshold   = 3\n    unhealthy_threshold = 2\n    matcher             = "200"\n  }\n}`,
      cf: `Type: AWS::ElasticLoadBalancingV2::TargetGroup\nProperties:\n  Name: prod-api-tg\n  Port: 80\n  Protocol: HTTP\n  HealthCheckEnabled: true\n  HealthCheckPath: /healthz\n  HealthCheckIntervalSeconds: 15\n  Matcher:\n    HttpCode: '200'`,
    },
  },
  'REL-CHK-301': {
    id: 'REL-CHK-301',
    check_id: 'REL-CHK-301',
    cloud: 'aws',
    pillar: 'Reliability',
    pillarId: 'reliability',
    severity: 'medium',
    title: 'SQS Dead Letter Queue (DLQ) missing for asynchronous order processing queue',
    effort: 'Low Effort',
    estTime: '20 min',
    risk: 'High Risk',
    description: 'Standard SQS queue prod-order-processing lacks a redrive policy to route poison-pill messages to a Dead Letter Queue.',
    rationale: 'Without a DLQ, malformed messages loop endlessly through consumer workers, consuming compute and starving valid transactions.',
    resources: [
      'arn:aws:sqs:us-east-1:124890123456:prod-order-processing',
      'arn:aws:sqs:us-east-1:124890123456:prod-email-notifications',
    ],
    manualSteps: [
      { step: 1, title: 'Create DLQ in SQS Console', consolePath: 'SQS Console -> Create queue', instruction: 'Create a Standard queue named "prod-order-processing-dlq".' },
      { step: 2, title: 'Configure Redrive on Source Queue', consolePath: 'prod-order-processing -> Edit -> Dead-letter queue', instruction: 'Enable Dead-letter queue and select "prod-order-processing-dlq".' },
      { step: 3, title: 'Set Max Receive Count to 5', consolePath: 'Maximum receives: 5', instruction: 'Set Maximum receives to 5 attempts before payload isolation.' },
    ],
    cli: {
      command: `aws sqs set-queue-attributes \\\n  --queue-url https://sqs.us-east-1.amazonaws.com/124890123456/prod-order-processing \\\n  --attributes '{"RedrivePolicy":"{\\"deadLetterTargetArn\\":\\"arn:aws:sqs:us-east-1:124890123456:prod-order-processing-dlq\\",\\"maxReceiveCount\\":5}"}'`,
      explanation: 'Applies redrive policy targeting the companion dead letter queue ARN after 5 consecutive delivery failures.',
    },
    iac: {
      tf: `resource "aws_sqs_queue" "orders" {\n  name = "prod-order-processing"\n  redrive_policy = jsonencode({\n    deadLetterTargetArn = aws_sqs_queue.orders_dlq.arn\n    maxReceiveCount     = 5\n  })\n}`,
      cf: `Type: AWS::SQS::Queue\nProperties:\n  QueueName: prod-order-processing\n  RedrivePolicy:\n    deadLetterTargetArn: !GetAtt OrdersDLQ.Arn\n    maxReceiveCount: 5`,
    },
  },
  'SEC-047': {
    id: 'SEC-047',
    check_id: 'SEC-047',
    cloud: 'aws',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'critical',
    title: 'IAM role with wildcard resource permission (*) on S3 and DynamoDB',
    effort: 'Medium Effort',
    estTime: '30 min',
    risk: 'Critical Risk',
    description: 'IAM role app-backend-prod-role contains an inline policy granting Action: s3:* and dynamodb:* on Resource: * without conditions.',
    rationale: 'Wildcard access violates least-privilege principles, allowing an application compromise to pivot laterally across all account data stores.',
    resources: [
      'arn:aws:iam::124890123456:role/app-backend-prod-role',
      'arn:aws:iam::124890123456:role/lambda-data-sync-exec-role',
    ],
    manualSteps: [
      { step: 1, title: 'Inspect IAM Role Policies', consolePath: 'IAM Console -> Roles -> app-backend-prod-role', instruction: 'Open IAM Console and review permissions policies.' },
      { step: 2, title: 'Scope Actions to Least Privilege', consolePath: 'Replace s3:* with specific verbs (s3:GetObject, s3:PutObject)', instruction: 'Narrow S3 actions down strictly to required operations: s3:GetObject, s3:PutObject, s3:ListBucket.' },
      { step: 3, title: 'Restrict Resource ARNs', consolePath: 'Resource: arn:aws:s3:::prod-app-assets/*', instruction: 'Restrict resource array strictly to target bucket ARNs and DynamoDB table ARNs.' },
    ],
    cli: {
      command: `aws iam put-role-policy \\\n  --role-name app-backend-prod-role \\\n  --policy-name AppBackendDataScopedPolicy \\\n  --policy-document file://scoped-policy.json`,
      explanation: 'Replaces the wildcard inline statement with a scoped policy limiting S3 and DynamoDB actions exclusively to designated production resource ARNs.',
    },
    iac: {
      tf: `resource "aws_iam_role_policy" "scoped_data" {\n  name = "AppBackendDataScopedPolicy"\n  role = aws_iam_role.app_backend.id\n  policy = jsonencode({\n    Version = "2012-10-17"\n    Statement = [{\n      Effect = "Allow"\n      Action = ["s3:GetObject", "s3:PutObject"]\n      Resource = "\${aws_s3_bucket.prod_assets.arn}/*"\n    }]\n  })\n}`,
      cf: `Type: AWS::IAM::Policy\nProperties:\n  PolicyName: AppBackendDataScopedPolicy\n  Roles: [app-backend-prod-role]`,
    },
  },
  'SEC-061': {
    id: 'SEC-061',
    check_id: 'SEC-061',
    cloud: 'aws',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'high',
    title: 'Security group allows open ingress 0.0.0.0/0 on port 22 (SSH)',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'Critical Risk',
    description: 'EC2 Security Group sg-0a1b2c3d4e5f67890 contains an inbound rule allowing TCP port 22 from CIDR 0.0.0.0/0 (the entire Internet).',
    rationale: 'Open management ports expose instances to automated brute-force attacks and zero-day SSH vulnerabilities. AWS Systems Manager Session Manager should be utilized instead.',
    resources: [
      'arn:aws:ec2:us-east-1:124890123456:security-group/sg-0a1b2c3d4e5f67890',
      'arn:aws:ec2:us-east-1:124890123456:security-group/sg-0f9e8d7c6b5a43210',
    ],
    manualSteps: [
      { step: 1, title: 'Open Security Groups in EC2 Console', consolePath: 'EC2 Console -> Security Groups', instruction: 'Open EC2 Console, select security group sg-0a1b2c3d4e5f67890.' },
      { step: 2, title: 'Delete Open SSH Rule', consolePath: 'Inbound rules -> Delete port 22 0.0.0.0/0', instruction: 'Delete the rule specifying SSH (port 22) from Source 0.0.0.0/0.' },
      { step: 3, title: 'Save and Use SSM Session Manager', consolePath: 'Save rules -> Verify SSM connectivity', instruction: 'Save rules and use AWS Systems Manager Session Manager without open ports.' },
    ],
    cli: {
      command: `aws ec2 revoke-security-group-ingress \\\n  --group-id sg-0a1b2c3d4e5f67890 \\\n  --protocol tcp \\\n  --port 22 \\\n  --cidr 0.0.0.0/0`,
      explanation: 'Revokes the public IPv4 0.0.0.0/0 ingress authorization rule from the security group on TCP port 22.',
    },
    iac: {
      tf: `resource "aws_security_group" "bastion" {\n  name   = "bastion-sg"\n  vpc_id = var.vpc_id\n  ingress {\n    from_port   = 22\n    to_port     = 22\n    protocol    = "tcp"\n    cidr_blocks = ["10.0.0.0/16"]\n  }\n}`,
      cf: `Type: AWS::EC2::SecurityGroup\nProperties:\n  SecurityGroupIngress:\n    - IpProtocol: tcp\n      FromPort: 22\n      ToPort: 22\n      CidrIp: 10.0.0.0/16`,
    },
  },
  'SEC-024': {
    id: 'SEC-024',
    check_id: 'SEC-024',
    cloud: 'aws',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'high',
    title: 'S3 buckets without default server-side encryption enabled',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'High Risk',
    description: 'S3 bucket prod-data-exports-9941 is not configured with default AWS KMS server-side encryption (SSE-KMS).',
    rationale: 'Default encryption with customer-managed keys ensures all objects written to the bucket are automatically encrypted at rest with audited key usage.',
    resources: ['arn:aws:s3:::prod-data-exports-9941', 'arn:aws:s3:::prod-analytics-raw-bucket'],
    manualSteps: [
      { step: 1, title: 'Navigate to S3 Bucket Properties', consolePath: 'S3 Console -> prod-data-exports-9941 -> Properties', instruction: 'Open the Amazon S3 console and navigate to Properties.' },
      { step: 2, title: 'Enable SSE-KMS', consolePath: 'Default encryption -> Edit -> AWS KMS', instruction: 'Select SSE-KMS and choose your customer-managed key.' },
    ],
    cli: {
      command: `aws s3api put-bucket-encryption \\\n  --bucket prod-data-exports-9941 \\\n  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms","KMSMasterKeyID":"arn:aws:kms:us-east-1:124890123456:key/1234abcd"},"BucketKeyEnabled":true}]}'`,
      explanation: 'Enforces default SSE-KMS encryption with S3 Bucket Keys enabled on all newly written objects.',
    },
    iac: {
      tf: `resource "aws_s3_bucket_server_side_encryption_configuration" "enc" {\n  bucket = aws_s3_bucket.prod.id\n  rule {\n    apply_server_side_encryption_by_default {\n      sse_algorithm = "aws:kms"\n    }\n    bucket_key_enabled = true\n  }\n}`,
      cf: `Type: AWS::S3::Bucket\nProperties:\n  BucketEncryption:\n    ServerSideEncryptionConfiguration:\n      - ServerSideEncryptionByDefault:\n          SSEAlgorithm: aws:kms`,
    },
  },
  'SEC-033': {
    id: 'SEC-033',
    check_id: 'SEC-033',
    cloud: 'aws',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'medium',
    title: 'AWS KMS customer-managed key rotation is not enabled',
    effort: 'Low Effort',
    estTime: '5 min',
    risk: 'Medium Risk',
    description: 'Customer managed KMS key 1234abcd-12ab-34cd-56ef-1234567890ab does not have automatic yearly key rotation enabled.',
    rationale: 'Automated key rotation replaces backing cryptographic keys annually without breaking existing ciphertexts or requiring manual re-encryption.',
    resources: ['arn:aws:kms:us-east-1:124890123456:key/1234abcd-12ab-34cd-56ef-1234567890ab'],
    manualSteps: [
      { step: 1, title: 'Open KMS Console', consolePath: 'KMS Console -> Customer managed keys', instruction: 'Select key and open Key rotation tab.' },
      { step: 2, title: 'Enable Rotation', consolePath: 'Key rotation -> Automatically rotate every year', instruction: 'Check box for automatic rotation and save.' },
    ],
    cli: {
      command: `aws kms enable-key-rotation \\\n  --key-id arn:aws:kms:us-east-1:124890123456:key/1234abcd-12ab-34cd-56ef-1234567890ab`,
      explanation: 'Enables annual automatic cryptographic backing rotation for the KMS key.',
    },
    iac: {
      tf: `resource "aws_kms_key" "main" {\n  description         = "Production encryption key"\n  enable_key_rotation = true\n}`,
      cf: `Type: AWS::KMS::Key\nProperties:\n  EnableKeyRotation: true`,
    },
  },
  'COST-008': {
    id: 'COST-008',
    check_id: 'COST-008',
    cloud: 'aws',
    pillar: 'Cost Optimization',
    pillarId: 'cost',
    severity: 'medium',
    title: 'Idle unattached Amazon EBS volumes retaining billable provisioned capacity',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'Medium Risk',
    description: '5 unattached gp3/io2 EBS volumes have remained unattached to any EC2 instance for over 14 days, generating redundant monthly charges.',
    rationale: 'Detached volumes continue billing provisioned GB storage and IOPS until snapshotted and removed.',
    resources: ['arn:aws:ec2:us-east-1:124890123456:volume/vol-0987654321fedcba0'],
    manualSteps: [
      { step: 1, title: 'Filter Available Volumes in EC2 Console', consolePath: 'EC2 Console -> Volumes -> State = available', instruction: 'Filter by available state.' },
      { step: 2, title: 'Snapshot and Delete', consolePath: 'Actions -> Create snapshot -> Delete volume', instruction: 'Create snapshot backup then delete volume.' },
    ],
    cli: {
      command: `aws ec2 create-snapshot --volume-id vol-0987654321fedcba0 && aws ec2 delete-volume --volume-id vol-0987654321fedcba0`,
      explanation: 'Takes a point-in-time snapshot of the orphan EBS volume, then safely deallocates the volume to stop billable provisioned storage charges.',
    },
    iac: {
      tf: `# Remove unattached volume resources from Terraform`,
      cf: `# Remove unattached volume from CloudFormation template`,
    },
  },
  'OPS-014': {
    id: 'OPS-014',
    check_id: 'OPS-014',
    cloud: 'aws',
    pillar: 'Operational Excellence',
    pillarId: 'operational-excellence',
    severity: 'medium',
    title: 'CloudWatch log groups with indefinite (Never Expire) retention policies',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'Low Risk',
    description: 'High-volume CloudWatch log groups (/aws/lambda/checkout-service, /aws/ecs/api) retain raw events indefinitely.',
    rationale: 'Applying retention expirations (e.g., 30 or 90 days) alongside S3 glacier archiving significantly lowers ingest and storage expenses.',
    resources: ['arn:aws:logs:us-east-1:124890123456:log-group:/aws/lambda/checkout-service:*'],
    manualSteps: [
      { step: 1, title: 'Open CloudWatch Log Groups', consolePath: 'CloudWatch Console -> Logs -> Log groups', instruction: 'Select log group and click Actions > Edit retention setting.' },
      { step: 2, title: 'Set 90-Day Retention Window', consolePath: 'Retention: 90 days', instruction: 'Change retention to 90 days and save.' },
    ],
    cli: {
      command: `aws logs put-retention-policy \\\n  --log-group-name /aws/lambda/checkout-service \\\n  --retention-in-days 90`,
      explanation: 'Applies a 90-day automatic expiration lifecycle to the target CloudWatch log group.',
    },
    iac: {
      tf: `resource "aws_cloudwatch_log_group" "app_logs" {\n  name              = "/aws/lambda/checkout-service"\n  retention_in_days = 90\n}`,
      cf: `Type: AWS::Logs::LogGroup\nProperties:\n  LogGroupName: /aws/lambda/checkout-service\n  RetentionInDays: 90`,
    },
  },
  'PERF-CHK-201': {
    id: 'PERF-CHK-201',
    check_id: 'PERF-CHK-201',
    cloud: 'aws',
    pillar: 'Performance Efficiency',
    pillarId: 'performance-efficiency',
    severity: 'medium',
    title: 'CloudFront distribution missing origin response caching policies',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'Medium Risk',
    description: 'CloudFront distribution E2A1B2C3D4E5 lacks an optimized cache policy on static asset behaviors, routing redundant GET requests to backend origins.',
    rationale: 'Edge caching maximizes CDN hit ratios, reduces origin server load, and drops average TTFB (Time to First Byte) under 40ms globally.',
    resources: ['arn:aws:cloudfront::124890123456:distribution/E2A1B2C3D4E5'],
    manualSteps: [
      { step: 1, title: 'Open CloudFront Behaviors', consolePath: 'CloudFront Console -> Behaviors -> Edit', instruction: 'Attach AWS managed CachingOptimized policy to default behavior.' },
      { step: 2, title: 'Save and Invalidate', consolePath: 'Save changes -> Create invalidation', instruction: 'Save and create invalidation on /static/*.' },
    ],
    cli: {
      command: `aws cloudfront update-distribution \\\n  --id E2A1B2C3D4E5 \\\n  --default-root-object index.html`,
      explanation: 'Updates the CloudFront distribution to enforce managed CachingOptimized edge policies.',
    },
    iac: {
      tf: `resource "aws_cloudfront_distribution" "cdn" {\n  default_cache_behavior {\n    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"\n    allowed_methods = ["GET", "HEAD"]\n    cached_methods  = ["GET", "HEAD"]\n    target_origin_id = "S3-prod"\n  }\n}`,
      cf: `Type: AWS::CloudFront::Distribution\nProperties:\n  DistributionConfig:\n    DefaultCacheBehavior:\n      CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6`,
    },
  },
};

// ── AZURE REMEDIATIONS ───────────────────────────────────────────────────────
export const AZURE_REMEDIATIONS: Record<string, CheckRemediationData> = {
  'REL-019': {
    id: 'REL-019',
    check_id: 'REL-019',
    cloud: 'azure',
    pillar: 'Reliability',
    pillarId: 'reliability',
    severity: 'high',
    title: 'Azure Application Gateway backend health probe unconfigured',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'High Risk',
    description: "Azure Application Gateway 'appgw-prod-eastus' backend pool lacks custom HTTP/HTTPS health probes, risking traffic distribution to degraded backend Virtual Machine Scale Sets.",
    rationale: 'Custom health probes detect application-layer degradation and automatically remove failing nodes from incoming routing.',
    resources: [
      '/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Network/applicationGateways/appgw-prod-eastus',
      '/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Network/loadBalancers/lb-backend-prod',
      '/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Compute/virtualMachineScaleSets/vmss-api-prod',
    ],
    manualSteps: [
      { step: 1, title: 'Open Application Gateway in Azure Portal', consolePath: 'Azure Portal -> Application Gateways -> appgw-prod-eastus', instruction: 'Navigate to Application Gateways and open "appgw-prod-eastus".' },
      { step: 2, title: 'Add Custom Health Probe', consolePath: 'Settings -> Health probes -> + Add', instruction: 'Under Settings, click "Health probes" then "+ Add".' },
      { step: 3, title: 'Configure Probe Parameters', consolePath: 'Protocol: HTTP | Path: /healthz | Interval: 15s', instruction: 'Set Name to "probe-api-health", Protocol to HTTP, Path to "/healthz", Interval to 15s, Unhealthy threshold to 3.' },
      { step: 4, title: 'Associate with Backend HTTP Settings', consolePath: 'Settings -> HTTP settings -> Enable Custom Probe', instruction: 'Select the custom health probe in HTTP settings and save.' },
      { step: 5, title: 'Verify Backend Health', consolePath: 'Monitoring -> Backend health', instruction: 'Confirm all backend pool instances transition to "Healthy".' },
    ],
    cli: {
      command: `az network application-gateway probe create \\\n  --resource-group prod-rg \\\n  --gateway-name appgw-prod-eastus \\\n  --name probe-api-health \\\n  --protocol Http \\\n  --host-name-from-http-settings true \\\n  --path /healthz \\\n  --interval 15 \\\n  --timeout 5 \\\n  --threshold 3`,
      explanation: 'Creates a dedicated HTTP health probe on /healthz for Azure Application Gateway with 15s interval.',
    },
    iac: {
      tf: `resource "azurerm_application_gateway" "appgw" {\n  probe {\n    name                                      = "probe-api-health"\n    protocol                                  = "Http"\n    path                                      = "/healthz"\n    interval                                  = 15\n    timeout                                   = 5\n    unhealthy_threshold                       = 3\n    pick_host_name_from_backend_http_settings = true\n  }\n}`,
      cf: `# Azure Bicep:\nresource appGateway 'Microsoft.Network/applicationGateways@2022-07-01' = {\n  name: 'appgw-prod-eastus'\n  properties: {\n    probes: [{\n      name: 'probe-api-health'\n      properties: {\n        protocol: 'Http'\n        path: '/healthz'\n        interval: 15\n        timeout: 5\n        unhealthyThreshold: 3\n      }\n    }]\n  }\n}`,
      bicep: `resource probe 'Microsoft.Network/applicationGateways/probes@2022-07-01' = {\n  name: 'probe-api-health'\n  properties: {\n    protocol: 'Http'\n    path: '/healthz'\n    interval: 15\n  }\n}`,
    },
  },
  'REL-CHK-301': {
    id: 'REL-CHK-301',
    check_id: 'REL-CHK-301',
    cloud: 'azure',
    pillar: 'Reliability',
    pillarId: 'reliability',
    severity: 'medium',
    title: 'Azure Service Bus queue missing dead-lettering on message expiration',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'High Risk',
    description: "Azure Service Bus queue 'orders-queue' in namespace 'sb-prod-eastus' has Dead Letter Queue disabled on message expiration and max delivery count.",
    rationale: 'Enabling dead-lettering isolates corrupted transactions, preventing consumer service deadlock and maintaining pipeline telemetry.',
    resources: [
      '/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.ServiceBus/namespaces/sb-prod-eastus/queues/orders-queue',
      '/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.ServiceBus/namespaces/sb-prod-eastus/queues/notifications-queue',
    ],
    manualSteps: [
      { step: 1, title: 'Open Service Bus in Azure Portal', consolePath: 'Azure Portal -> Service Bus -> sb-prod-eastus -> Queues', instruction: 'Open Service Bus namespace "sb-prod-eastus" and select "orders-queue".' },
      { step: 2, title: 'Enable Dead Lettering on Expiration', consolePath: 'Configuration -> Dead lettering on message expiration', instruction: 'Enable "Dead lettering on message expiration" and set "Max delivery count" to 5.' },
      { step: 3, title: 'Save Configuration', consolePath: 'Save changes', instruction: 'Click Save and confirm DLQ forwarding is active.' },
    ],
    cli: {
      command: `az servicebus queue update \\\n  --resource-group prod-rg \\\n  --namespace-name sb-prod-eastus \\\n  --name orders-queue \\\n  --enable-dead-lettering-on-message-expiration true \\\n  --max-delivery-count 5`,
      explanation: 'Configures the Azure Service Bus queue to forward expired messages to its dead-letter queue after 5 failed delivery attempts.',
    },
    iac: {
      tf: `resource "azurerm_servicebus_queue" "orders" {\n  name                                 = "orders-queue"\n  namespace_id                         = azurerm_servicebus_namespace.prod.id\n  dead_lettering_on_message_expiration = true\n  max_delivery_count                   = 5\n}`,
      cf: `# Azure Bicep:\nresource sbQueue 'Microsoft.ServiceBus/namespaces/queues@2021-11-01' = {\n  name: 'orders-queue'\n  properties: {\n    deadLetteringOnMessageExpiration: true\n    maxDeliveryCount: 5\n  }\n}`,
    },
  },
  'SEC-047': {
    id: 'SEC-047',
    check_id: 'SEC-047',
    cloud: 'azure',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'critical',
    title: 'Azure Managed Identity assigned wildcard Owner/Contributor RBAC permissions',
    effort: 'Medium Effort',
    estTime: '25 min',
    risk: 'Critical Risk',
    description: "User-assigned Managed Identity 'id-prod-app' has been assigned the 'Contributor' role at the Resource Group scope.",
    rationale: 'Over-privileged Managed Identities allow an attacker with code execution on compute to create, modify, or exfiltrate all neighboring cloud resources.',
    resources: [
      '/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/id-prod-app',
      '/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Authorization/roleAssignments/ra-contributor-001',
    ],
    manualSteps: [
      { step: 1, title: 'Open Access Control (IAM) on Resource Group', consolePath: 'Azure Portal -> Resource Groups -> prod-rg -> Access control (IAM)', instruction: 'Open Access control (IAM) and view Role assignments for "id-prod-app".' },
      { step: 2, title: 'Remove Contributor Role', consolePath: 'Role assignments -> Contributor -> Remove', instruction: 'Remove the Contributor assignment.' },
      { step: 3, title: 'Assign Granular Storage/DB Roles', consolePath: '+ Add role assignment -> Storage Blob Data Contributor', instruction: 'Assign specific built-in roles such as "Storage Blob Data Contributor" scoped strictly to the target resource.' },
    ],
    cli: {
      command: `az role assignment delete \\\n  --assignee 12345678-abcd-ef01-2345-6789abcdef01 \\\n  --role Contributor \\\n  --resource-group prod-rg`,
      explanation: 'Removes the overly broad Contributor role assignment from the Azure Managed Identity.',
    },
    iac: {
      tf: `resource "azurerm_role_assignment" "storage_access" {\n  scope                = azurerm_storage_account.prod.id\n  role_definition_name = "Storage Blob Data Contributor"\n  principal_id         = azurerm_user_assigned_identity.app.principal_id\n}`,
      cf: `# Azure Bicep:\nresource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {\n  scope: storageAccount\n  properties: {\n    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')\n    principalId: managedIdentity.properties.principalId\n  }\n}`,
    },
  },
  'SEC-061': {
    id: 'SEC-061',
    check_id: 'SEC-061',
    cloud: 'azure',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'high',
    title: 'Network Security Group (NSG) allows inbound SSH (port 22) from Any (0.0.0.0/0)',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'Critical Risk',
    description: "Azure Network Security Group 'nsg-prod-vmss' contains an inbound security rule allowing TCP port 22 from Source 'Internet' / '*' without IP restriction.",
    rationale: 'Exposing management ports directly to the Internet makes VMs vulnerable to dictionary attacks. Azure Bastion or VPN gateways should be utilized.',
    resources: [
      '/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Network/networkSecurityGroups/nsg-prod-vmss',
      '/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Network/networkSecurityGroups/nsg-bastion',
    ],
    manualSteps: [
      { step: 1, title: 'Open NSG in Azure Portal', consolePath: 'Azure Portal -> Network security groups -> nsg-prod-vmss', instruction: 'Open the NSG "nsg-prod-vmss" and select "Inbound security rules".' },
      { step: 2, title: 'Delete Inbound Rule with Port 22 and Source Any', consolePath: 'Inbound security rules -> Allow-SSH-Internet -> Delete', instruction: 'Delete the rule allowing Port 22 from Source Any/Internet.' },
      { step: 3, title: 'Configure Azure Bastion Subnet', consolePath: '+ Add -> Source: AzureBastionSubnet -> Port: 22', instruction: 'Allow SSH strictly from AzureBastionSubnet CIDR (10.0.1.0/24).' },
    ],
    cli: {
      command: `az network nsg rule delete \\\n  --resource-group prod-rg \\\n  --nsg-name nsg-prod-vmss \\\n  --name Allow-SSH-Internet`,
      explanation: 'Removes the open Internet port 22 inbound rule from the Azure Network Security Group.',
    },
    iac: {
      tf: `resource "azurerm_network_security_rule" "ssh_bastion_only" {\n  name                        = "Allow-SSH-From-Bastion"\n  priority                    = 100\n  direction                   = "Inbound"\n  access                      = "Allow"\n  protocol                    = "Tcp"\n  destination_port_range      = "22"\n  source_address_prefix       = "10.0.1.0/24"\n  destination_address_prefix  = "*"\n  resource_group_name         = "prod-rg"\n  network_security_group_name = "nsg-prod-vmss"\n}`,
      cf: `# Azure Bicep:\nresource nsgRule 'Microsoft.Network/networkSecurityGroups/securityRules@2022-07-01' = {\n  name: 'nsg-prod-vmss/Allow-SSH-From-Bastion'\n  properties: {\n    priority: 100\n    direction: 'Inbound'\n    access: 'Allow'\n    destinationPortRange: '22'\n    sourceAddressPrefix: '10.0.1.0/24'\n  }\n}`,
    },
  },
  'SEC-024': {
    id: 'SEC-024',
    check_id: 'SEC-024',
    cloud: 'azure',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'high',
    title: 'Azure Storage Account blob containers allow anonymous public read access',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'High Risk',
    description: "Storage Account 'stprodeastus01' has 'Allow Blob public access' set to Enabled, risking unauthenticated data exposure.",
    rationale: 'Disabling public read access at the storage account level blocks anonymous requests even if container ACLs are misconfigured.',
    resources: ['/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Storage/storageAccounts/stprodeastus01'],
    manualSteps: [
      { step: 1, title: 'Open Storage Account Configuration', consolePath: 'Azure Portal -> Storage accounts -> Configuration', instruction: 'Set "Allow Blob public access" to Disabled.' },
      { step: 2, title: 'Save and Enforce TLS 1.2', consolePath: 'Minimum TLS: 1.2 -> Save', instruction: 'Enforce minimum TLS version 1.2 and save.' },
    ],
    cli: {
      command: `az storage account update \\\n  --name stprodeastus01 \\\n  --resource-group prod-rg \\\n  --allow-blob-public-access false \\\n  --min-tls-version TLS1_2`,
      explanation: 'Disables anonymous blob public access and enforces TLS 1.2 across the Azure Storage Account.',
    },
    iac: {
      tf: `resource "azurerm_storage_account" "prod" {\n  name                            = "stprodeastus01"\n  allow_nested_items_to_be_public = false\n  min_tls_version                 = "TLS1_2"\n}`,
      cf: `# Azure Bicep:\nresource storage 'Microsoft.Storage/storageAccounts@2022-09-01' = {\n  name: 'stprodeastus01'\n  properties: { allowBlobPublicAccess: false, minimumTlsVersion: 'TLS1_2' }\n}`,
    },
  },
  'SEC-033': {
    id: 'SEC-033',
    check_id: 'SEC-033',
    cloud: 'azure',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'medium',
    title: 'Azure Key Vault automated key rotation policy is not enabled',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'Medium Risk',
    description: "Cryptographic key 'prod-db-encryption-key' in Key Vault 'kv-prod-eastus' has no automated rotation policy configured.",
    rationale: 'Automated key rotation regularly changes the cryptographic key material without modifying the key identifier, satisfying compliance.',
    resources: ['/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.KeyVault/vaults/kv-prod-eastus/keys/prod-db-encryption-key'],
    manualSteps: [
      { step: 1, title: 'Open Key Rotation Policy', consolePath: 'Key Vault -> Keys -> Rotation policy button', instruction: 'Enable "Automatically rotate key" and set cycle to 12 months.' },
    ],
    cli: {
      command: `az keyvault key rotation-policy update \\\n  --vault-name kv-prod-eastus \\\n  --name prod-db-encryption-key \\\n  --value policy.json`,
      explanation: 'Enforces an automated annual rotation schedule on the Key Vault cryptographic key.',
    },
    iac: {
      tf: `resource "azurerm_key_vault_key" "db_key" {\n  name = "prod-db-encryption-key"\n  rotation_policy {\n    automatic { time_after_creation = "P365D" }\n  }\n}`,
      cf: `# Azure Bicep key rotation policy`,
    },
  },
  'COST-008': {
    id: 'COST-008',
    check_id: 'COST-008',
    cloud: 'azure',
    pillar: 'Cost Optimization',
    pillarId: 'cost',
    severity: 'medium',
    title: 'Unattached Azure Managed Disks incurring unallocated storage charges',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'Medium Risk',
    description: "4 Premium SSD managed disks (1024 GB each) in 'prod-rg' have remained unattached to any VM for over 30 days.",
    rationale: 'Detached Azure Managed Disks continue generating monthly provisioned disk fees regardless of allocation state.',
    resources: ['/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Compute/disks/disk-legacy-data-01'],
    manualSteps: [
      { step: 1, title: 'Filter Unattached Disks', consolePath: 'Azure Portal -> Disks -> Filter: Unattached', instruction: 'Filter by unattached disks.' },
      { step: 2, title: 'Snapshot and Delete', consolePath: '+ Create snapshot -> Delete disk', instruction: 'Take a snapshot and delete the unattached disk.' },
    ],
    cli: {
      command: `az snapshot create --resource-group prod-rg --name snap-backup --source disk-legacy-data-01 && az disk delete --resource-group prod-rg --name disk-legacy-data-01 --yes`,
      explanation: 'Creates a snapshot backup and deallocates the unattached Azure Managed Disk.',
    },
    iac: {
      tf: `# Remove unattached azurerm_managed_disk resource from Terraform state`,
      cf: `# Remove unattached disk from Bicep/ARM template`,
    },
  },
  'OPS-014': {
    id: 'OPS-014',
    check_id: 'OPS-014',
    cloud: 'azure',
    pillar: 'Operational Excellence',
    pillarId: 'operational-excellence',
    severity: 'medium',
    title: 'Azure Monitor Diagnostic Settings not streaming Activity and Security logs to Log Analytics',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'Low Risk',
    description: 'Production Key Vault and SQL Database lack diagnostic settings streaming telemetry to Azure Log Analytics.',
    rationale: 'Centralizing platform logs in Log Analytics enables automated security alerts, audit trails, and automated remediation queries.',
    resources: ['/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.KeyVault/vaults/kv-prod-eastus'],
    manualSteps: [
      { step: 1, title: 'Add Diagnostic Setting', consolePath: 'Key Vault -> Monitoring -> Diagnostic settings -> + Add', instruction: 'Select allLogs and route to Log Analytics workspace "law-prod-eastus".' },
    ],
    cli: {
      command: `az monitor diagnostic-settings create \\\n  --resource /subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.KeyVault/vaults/kv-prod-eastus \\\n  --name to-log-analytics \\\n  --workspace /subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.OperationalInsights/workspaces/law-prod-eastus \\\n  --logs '[{"categoryGroup":"allLogs","enabled":true}]'`,
      explanation: 'Creates diagnostic settings streaming all audit logs to the primary Log Analytics workspace.',
    },
    iac: {
      tf: `resource "azurerm_monitor_diagnostic_setting" "kv_logs" {\n  name                       = "to-log-analytics"\n  target_resource_id         = azurerm_key_vault.prod.id\n  log_analytics_workspace_id = azurerm_log_analytics_workspace.prod.id\n}`,
      cf: `# Azure Bicep diagnosticSettings`,
    },
  },
  'PERF-CHK-201': {
    id: 'PERF-CHK-201',
    check_id: 'PERF-CHK-201',
    cloud: 'azure',
    pillar: 'Performance Efficiency',
    pillarId: 'performance-efficiency',
    severity: 'medium',
    title: 'Azure Front Door / CDN endpoint missing origin caching and compression policies',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'Medium Risk',
    description: "Azure Front Door Standard endpoint 'afd-prod-eastus' routes static assets without enabling edge compression and caching rules.",
    rationale: 'Edge compression (Brotli/Gzip) reduces outbound egress bandwidth by 65% and cuts client response times across global geos.',
    resources: ['/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Cdn/profiles/afd-prod-eastus'],
    manualSteps: [
      { step: 1, title: 'Enable Caching and Compression', consolePath: 'Front Door -> Endpoints -> Edit route -> Enable Caching & Compression', instruction: 'Enable caching, query string ignore, and compression.' },
    ],
    cli: {
      command: `az afd route update \\\n  --resource-group prod-rg \\\n  --profile-name afd-prod-eastus \\\n  --endpoint-name ep-prod \\\n  --route-name default-route \\\n  --enable-caching true \\\n  --enable-compression true`,
      explanation: 'Enables edge caching and content compression on the Azure Front Door route.',
    },
    iac: {
      tf: `resource "azurerm_cdn_frontdoor_route" "default" {\n  cache {\n    query_string_caching_behavior = "IgnoreQueryString"\n    compression_enabled           = true\n  }\n}`,
      cf: `# Azure Bicep Front Door route cacheConfiguration`,
    },
  },
};

// ── GCP REMEDIATIONS ─────────────────────────────────────────────────────────
export const GCP_REMEDIATIONS: Record<string, CheckRemediationData> = {
  'REL-019': {
    id: 'REL-019',
    check_id: 'REL-019',
    cloud: 'gcp',
    pillar: 'Reliability',
    pillarId: 'reliability',
    severity: 'high',
    title: 'Cloud Load Balancing backend service missing active HTTP/HTTPS health check probe',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'High Risk',
    description: "Google Cloud Load Balancing backend service 'backend-api-prod' lacks a dedicated health check probe, risking traffic forwarding to crashed Google Compute Engine or Cloud Run instances.",
    rationale: 'Health checks automatically remove unhealthy instances from backend services before customer traffic fails.',
    resources: [
      '//compute.googleapis.com/projects/acme-gcp-prod-9941/global/backendServices/backend-api-prod',
      '//compute.googleapis.com/projects/acme-gcp-prod-9941/regions/us-central1/instanceGroups/mig-api-prod',
    ],
    manualSteps: [
      { step: 1, title: 'Open Load Balancing in GCP Console', consolePath: 'GCP Console -> Network Services -> Load balancing -> Backends', instruction: 'Navigate to Load balancing > Backends and select "backend-api-prod".' },
      { step: 2, title: 'Attach HTTP Health Check', consolePath: 'Edit -> Health check -> Create a health check: /healthz on Port 80', instruction: 'Create health check "hc-api-health" with HTTP on /healthz every 15 seconds.' },
      { step: 3, title: 'Save and Confirm Health', consolePath: 'Save and continue', instruction: 'Verify all backend instance groups show 100% healthy.' },
    ],
    cli: {
      command: `gcloud compute health-checks create http hc-api-health \\\n  --project=acme-gcp-prod-9941 \\\n  --port=80 \\\n  --request-path=/healthz \\\n  --check-interval=15s \\\n  --timeout=5s && \\\ngcloud compute backend-services update backend-api-prod \\\n  --project=acme-gcp-prod-9941 \\\n  --global \\\n  --health-checks=hc-api-health`,
      explanation: 'Creates a continuous HTTP /healthz probe and binds it to the global Cloud Load Balancing backend service.',
    },
    iac: {
      tf: `resource "google_compute_health_check" "api" {\n  name = "hc-api-health"\n  http_health_check {\n    port         = 80\n    request_path = "/healthz"\n  }\n}\n\nresource "google_compute_backend_service" "api" {\n  name          = "backend-api-prod"\n  health_checks = [google_compute_health_check.api.id]\n}`,
      cf: `# Google Cloud Deployment Manager / Terraform`,
    },
  },
  'REL-CHK-301': {
    id: 'REL-CHK-301',
    check_id: 'REL-CHK-301',
    cloud: 'gcp',
    pillar: 'Reliability',
    pillarId: 'reliability',
    severity: 'medium',
    title: 'Cloud Pub/Sub subscription missing dead-letter topic configuration for failed delivery',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'High Risk',
    description: "Pub/Sub subscription 'orders-sub' on topic 'orders-topic' has no dead-letter topic, causing unparseable payloads to be retried endlessly.",
    rationale: 'Dead-letter topics isolate poison pill messages without disrupting the processing of valid queue streams.',
    resources: [
      '//pubsub.googleapis.com/projects/acme-gcp-prod-9941/subscriptions/orders-sub',
      '//pubsub.googleapis.com/projects/acme-gcp-prod-9941/topics/orders-topic',
    ],
    manualSteps: [
      { step: 1, title: 'Open Subscription in GCP Console', consolePath: 'Pub/Sub -> Subscriptions -> orders-sub -> Edit', instruction: 'Enable Dead lettering and attach "orders-dlq-topic".' },
      { step: 2, title: 'Set Max Delivery Attempts to 5', consolePath: 'Max delivery attempts: 5', instruction: 'Set retry threshold to 5 attempts.' },
    ],
    cli: {
      command: `gcloud pubsub subscriptions update orders-sub \\\n  --project=acme-gcp-prod-9941 \\\n  --dead-letter-topic=orders-dlq-topic \\\n  --max-delivery-attempts=5`,
      explanation: 'Associates the dead-letter topic with the subscription after 5 delivery failures.',
    },
    iac: {
      tf: `resource "google_pubsub_subscription" "orders" {\n  name  = "orders-sub"\n  topic = google_pubsub_topic.orders.name\n  dead_letter_policy {\n    dead_letter_topic     = google_pubsub_topic.orders_dlq.id\n    max_delivery_attempts = 5\n  }\n}`,
      cf: `# Deployment Manager / Terraform GCP`,
    },
  },
  'SEC-047': {
    id: 'SEC-047',
    check_id: 'SEC-047',
    cloud: 'gcp',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'critical',
    title: 'Service Account assigned overly permissive Project Editor or Owner primitive role',
    effort: 'Medium Effort',
    estTime: '20 min',
    risk: 'Critical Risk',
    description: "Service Account 'app-backend@acme-gcp-prod-9941.iam.gserviceaccount.com' has been assigned the primitive role 'roles/editor'.",
    rationale: 'Primitive roles grant excessive blanket read/write/deploy rights across nearly all GCP services. Principle of least privilege dictates predefined fine-grained IAM roles.',
    resources: [
      '//iam.googleapis.com/projects/acme-gcp-prod-9941/serviceAccounts/app-backend@acme-gcp-prod-9941.iam.gserviceaccount.com',
    ],
    manualSteps: [
      { step: 1, title: 'Open IAM & Admin in GCP Console', consolePath: 'GCP Console -> IAM & Admin -> IAM', instruction: 'Filter by service account principal and click edit pencil.' },
      { step: 2, title: 'Remove Editor Role and Add Granular Roles', consolePath: 'Delete roles/editor -> Add: roles/storage.objectUser', instruction: 'Replace primitive Editor role with specific granular roles.' },
    ],
    cli: {
      command: `gcloud projects remove-iam-policy-binding acme-gcp-prod-9941 \\\n  --member="serviceAccount:app-backend@acme-gcp-prod-9941.iam.gserviceaccount.com" \\\n  --role="roles/editor" && \\\ngcloud projects add-iam-policy-binding acme-gcp-prod-9941 \\\n  --member="serviceAccount:app-backend@acme-gcp-prod-9941.iam.gserviceaccount.com" \\\n  --role="roles/storage.objectUser"`,
      explanation: 'Revokes the primitive Editor role and replaces it with granular storage access.',
    },
    iac: {
      tf: `resource "google_project_iam_member" "storage_access" {\n  project = "acme-gcp-prod-9941"\n  role    = "roles/storage.objectUser"\n  member  = "serviceAccount:\${google_service_account.app.email}"\n}`,
      cf: `# Deployment Manager / Terraform GCP`,
    },
  },
  'SEC-061': {
    id: 'SEC-061',
    check_id: 'SEC-061',
    cloud: 'gcp',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'high',
    title: 'VPC Firewall rule allows unrestricted inbound TCP port 22 (SSH) from 0.0.0.0/0',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'Critical Risk',
    description: "VPC firewall rule 'default-allow-ssh' allows ingress on TCP port 22 from Source IP ranges '0.0.0.0/0'.",
    rationale: 'Unrestricted management access invites continuous automated exploit scanning. Cloud IAP (Identity-Aware Proxy) should be used instead.',
    resources: [
      '//compute.googleapis.com/projects/acme-gcp-prod-9941/global/firewalls/default-allow-ssh',
      '//compute.googleapis.com/projects/acme-gcp-prod-9941/global/networks/vpc-production',
    ],
    manualSteps: [
      { step: 1, title: 'Open VPC Firewall Rules in GCP Console', consolePath: 'GCP Console -> VPC network -> Firewall', instruction: 'Select rule "default-allow-ssh" and click Edit.' },
      { step: 2, title: 'Restrict Source to Google IAP CIDR', consolePath: 'Source ranges: 35.235.240.0/20', instruction: 'Change Source from 0.0.0.0/0 to 35.235.240.0/20 (Google Cloud IAP range).' },
    ],
    cli: {
      command: `gcloud compute firewall-rules update default-allow-ssh \\\n  --project=acme-gcp-prod-9941 \\\n  --source-ranges=35.235.240.0/20`,
      explanation: 'Restricts SSH ingress exclusively to the Google Identity-Aware Proxy (IAP) CIDR block (35.235.240.0/20).',
    },
    iac: {
      tf: `resource "google_compute_firewall" "iap_ssh" {\n  name    = "allow-ssh-via-iap"\n  network = google_compute_network.vpc.name\n  allow {\n    protocol = "tcp"\n    ports    = ["22"]\n  }\n  source_ranges = ["35.235.240.0/20"]\n}`,
      cf: `# Deployment Manager / Terraform GCP`,
    },
  },
  'SEC-024': {
    id: 'SEC-024',
    check_id: 'SEC-024',
    cloud: 'gcp',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'high',
    title: 'Cloud Storage bucket allows public access (allUsers / allAuthenticatedUsers)',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'High Risk',
    description: "Cloud Storage bucket 'acme-prod-exports-9941' does not enforce Public Access Prevention.",
    rationale: 'Enabling uniform bucket-level access with Public Access Prevention guarantees no inadvertent ACL grant can expose private corporate datasets.',
    resources: ['//storage.googleapis.com/projects/acme-gcp-prod-9941/buckets/acme-prod-exports-9941'],
    manualSteps: [
      { step: 1, title: 'Open Bucket Permissions', consolePath: 'Cloud Storage -> acme-prod-exports-9941 -> Permissions', instruction: 'Click "Enforce public access prevention" and enable uniform bucket-level access.' },
    ],
    cli: {
      command: `gcloud storage buckets update gs://acme-prod-exports-9941 \\\n  --project=acme-gcp-prod-9941 \\\n  --public-access-prevention \\\n  --uniform-bucket-level-access`,
      explanation: 'Enforces public access prevention and uniform bucket-level IAM on the Google Cloud Storage bucket.',
    },
    iac: {
      tf: `resource "google_storage_bucket" "exports" {\n  name                     = "acme-prod-exports-9941"\n  public_access_prevention = "enforced"\n  uniform_bucket_level_access = true\n}`,
      cf: `# Deployment Manager / Terraform GCP`,
    },
  },
  'SEC-033': {
    id: 'SEC-033',
    check_id: 'SEC-033',
    cloud: 'gcp',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'medium',
    title: 'Cloud KMS crypto keys without automated 90-day rotation schedule',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'Medium Risk',
    description: "KMS key 'key-db-prod' in keyring 'keyring-prod' does not have an automated rotation period configured.",
    rationale: 'Automated crypto key rotation limits ciphertext lifetime under a single key version without requiring data re-encryption.',
    resources: ['//cloudkms.googleapis.com/projects/acme-gcp-prod-9941/locations/global/keyRings/keyring-prod/cryptoKeys/key-db-prod'],
    manualSteps: [
      { step: 1, title: 'Edit Key Rotation in GCP Console', consolePath: 'Security -> Key Management -> key-db-prod -> Edit rotation period', instruction: 'Set rotation to every 90 days and save.' },
    ],
    cli: {
      command: `gcloud kms keys update key-db-prod \\\n  --location=global \\\n  --keyring=keyring-prod \\\n  --rotation-period=7776000s`,
      explanation: 'Configures a 90-day automated rotation schedule on the Cloud KMS cryptographic key.',
    },
    iac: {
      tf: `resource "google_kms_crypto_key" "db_key" {\n  name            = "key-db-prod"\n  key_ring        = google_kms_key_ring.prod.id\n  rotation_period = "7776000s"\n}`,
      cf: `# Deployment Manager / Terraform GCP`,
    },
  },
  'COST-008': {
    id: 'COST-008',
    check_id: 'COST-008',
    cloud: 'gcp',
    pillar: 'Cost Optimization',
    pillarId: 'cost',
    severity: 'medium',
    title: 'Unattached Google Compute Engine persistent disks incurring persistent storage fees',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'Medium Risk',
    description: '3 persistent SSD disks in region us-central1 have remained unattached to any GCE instance for 21 days.',
    rationale: 'Orphan disks generate continuous per-GB fees every hour until snapshotting and deletion occurs.',
    resources: ['//compute.googleapis.com/projects/acme-gcp-prod-9941/zones/us-central1-a/disks/disk-archive-old-01'],
    manualSteps: [
      { step: 1, title: 'Snapshot and Delete Unattached Disk', consolePath: 'Compute Engine -> Disks -> Filter: None -> Create snapshot -> Delete disk', instruction: 'Create snapshot backup then delete unattached persistent disk.' },
    ],
    cli: {
      command: `gcloud compute disks snapshot disk-archive-old-01 --zone=us-central1-a && gcloud compute disks delete disk-archive-old-01 --zone=us-central1-a --quiet`,
      explanation: 'Creates a snapshot and deletes the idle persistent disk.',
    },
    iac: {
      tf: `# Remove unattached disk from Terraform state`,
      cf: `# Deployment Manager / Terraform GCP`,
    },
  },
  'OPS-014': {
    id: 'OPS-014',
    check_id: 'OPS-014',
    cloud: 'gcp',
    pillar: 'Operational Excellence',
    pillarId: 'operational-excellence',
    severity: 'medium',
    title: 'Cloud Logging sink missing for real-time audit log streaming to BigQuery',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'Low Risk',
    description: 'Project lacks an aggregated log sink routing Admin Activity and System Event audit logs to BigQuery for analysis.',
    rationale: 'Exporting audit logs to BigQuery enables long-term retention compliance and real-time SIEM queries.',
    resources: ['//logging.googleapis.com/projects/acme-gcp-prod-9941/sinks/audit-logs-sink'],
    manualSteps: [
      { step: 1, title: 'Create BigQuery Log Sink', consolePath: 'Logging -> Log Router -> Create sink -> BigQuery', instruction: 'Route logName:"cloudaudit.googleapis.com" to BigQuery.' },
    ],
    cli: {
      command: `gcloud logging sinks create audit-logs-sink \\\n  bigquery.googleapis.com/projects/acme-gcp-prod-9941/datasets/security_audit_logs \\\n  --log-filter='logName:"cloudaudit.googleapis.com"' \\\n  --project=acme-gcp-prod-9941`,
      explanation: 'Creates a centralized log sink routing all cloud audit logs to BigQuery.',
    },
    iac: {
      tf: `resource "google_logging_project_sink" "audit_sink" {\n  name        = "audit-logs-sink"\n  destination = "bigquery.googleapis.com/projects/acme-gcp-prod-9941/datasets/security_audit_logs"\n  filter      = "logName:\\"cloudaudit.googleapis.com\\""\n}`,
      cf: `# Deployment Manager / Terraform GCP`,
    },
  },
  'PERF-CHK-201': {
    id: 'PERF-CHK-201',
    check_id: 'PERF-CHK-201',
    cloud: 'gcp',
    pillar: 'Performance Efficiency',
    pillarId: 'performance-efficiency',
    severity: 'medium',
    title: 'Cloud CDN not enabled on Cloud Load Balancing backend services for edge caching',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'Medium Risk',
    description: "Cloud Load Balancing backend service 'backend-static-prod' has Cloud CDN disabled, causing high origin latency.",
    rationale: 'Enabling Cloud CDN caches content at Google global edge points of presence, dramatically lowering latency.',
    resources: ['//compute.googleapis.com/projects/acme-gcp-prod-9941/global/backendServices/backend-static-prod'],
    manualSteps: [
      { step: 1, title: 'Enable Cloud CDN on Backend Service', consolePath: 'Network services -> Load balancing -> Backends -> Edit -> Enable Cloud CDN', instruction: 'Enable Cloud CDN with CACHE_ALL_STATIC mode.' },
    ],
    cli: {
      command: `gcloud compute backend-services update backend-static-prod \\\n  --project=acme-gcp-prod-9941 \\\n  --global \\\n  --enable-cdn \\\n  --cache-mode=CACHE_ALL_STATIC`,
      explanation: 'Enables Google Cloud CDN with CACHE_ALL_STATIC mode on the backend service.',
    },
    iac: {
      tf: `resource "google_compute_backend_service" "static" {\n  name       = "backend-static-prod"\n  enable_cdn = true\n  cdn_policy {\n    cache_mode = "CACHE_ALL_STATIC"\n  }\n}`,
      cf: `# Deployment Manager / Terraform GCP`,
    },
  },
};

export const CLOUD_REMEDIATIONS_MAP: Record<string, Record<string, CheckRemediationData>> = {
  aws: AWS_REMEDIATIONS,
  azure: AZURE_REMEDIATIONS,
  gcp: GCP_REMEDIATIONS,
};

export function getFallbackRemediations(cloud: string): Record<string, CheckRemediationData> {
  const norm = (cloud || 'aws').toLowerCase();
  return CLOUD_REMEDIATIONS_MAP[norm] || AWS_REMEDIATIONS;
}

export async function fetchRemediationsFromDb(cloud: string): Promise<Record<string, CheckRemediationData>> {
  const norm = (cloud || 'aws').toLowerCase();
  try {
    const data = await api.getRemediations({ cloud: norm });
    if (Array.isArray(data) && data.length > 0) {
      const map: Record<string, CheckRemediationData> = {};
      data.forEach((item: any) => {
        const key = item.check_id || item.id;
        map[key] = item;
        map[item.id] = item;
      });
      return map;
    }
  } catch (err) {
    console.warn(`Could not fetch ${norm} remediations from MongoDB, falling back:`, err);
  }
  return getFallbackRemediations(norm);
}

// Backwards-compatibility default database
export const REMEDIATION_DATABASE = AWS_REMEDIATIONS;

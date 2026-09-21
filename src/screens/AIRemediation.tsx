import { useState, useEffect } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';
import { SeverityPill, type Severity } from '../components/FindingUI';
import { CloudChip } from '../components/CloudLogo';
import { PILLARS_DATA } from '../data/wafrData';
import { INITIAL_ASSESSMENTS, type AssessmentInfo } from '../data/assessmentData';

const LIGHT = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  cardAlt: '#F8FAFC',
  border: '#E2E8F0',
  text: '#0F172A',
  textSub: '#64748B',
  primary: '#2563EB',
  primaryBg: '#EFF6FF',
  success: '#059669',
  successBg: '#ECFDF5',
  error: '#E11D48',
  errorBg: '#FFF1F2',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  muted: '#94A3B8',
  shadow: '0 1px 3px rgba(0,0,0,.05),0 1px 2px rgba(0,0,0,.03)',
  shadowMd: '0 4px 6px -1px rgba(0,0,0,.06),0 2px 4px -2px rgba(0,0,0,.04)',
};

const DARK = {
  bg: '#0B1220',
  card: '#111B2E',
  cardAlt: '#172238',
  border: '#1E293B',
  text: '#F1F5F9',
  textSub: '#94A3B8',
  primary: '#3B82F6',
  primaryBg: 'rgba(59,130,246,.15)',
  success: '#52B788',
  successBg: 'rgba(82,183,136,.12)',
  error: '#FB7185',
  errorBg: 'rgba(251,113,133,.12)',
  warning: '#FBBF24',
  warningBg: 'rgba(251,191,36,.12)',
  muted: '#64748B',
  shadow: '0 1px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.2)',
  shadowMd: '0 4px 6px rgba(0,0,0,.35),0 2px 4px rgba(0,0,0,.25)',
};

export interface ManualStepItem {
  step: number;
  title: string;
  instruction: string;
  consolePath?: string;
}

export interface CheckRemediationData {
  id: string;
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
  };
}

export const REMEDIATION_DATABASE: Record<string, CheckRemediationData> = {
  // ── RELIABILITY ──────────────────────────────────────────────────────────
  'REL-019': {
    id: 'REL-019',
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
      'arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-payments-tg/332211445566',
      'arn:aws:elasticloadbalancing:us-east-1:124890123456:loadbalancer/app/prod-public-alb/50dc6c495c0c9188',
      'arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-search-tg/77aa88bb99cc',
      'arn:aws:ec2:us-east-1:124890123456:instance/i-0a1b2c3d4e5f67890',
      'arn:aws:ec2:us-east-1:124890123456:instance/i-0f9e8d7c6b5a43210',
    ],
    manualSteps: [
      {
        step: 1,
        title: 'Navigate to EC2 Target Groups in AWS Console',
        consolePath: 'EC2 Console → Load Balancing → Target Groups',
        instruction: 'Log into the AWS Management Console in region us-east-1, navigate to EC2 > Target Groups, and select "prod-api-tg".',
      },
      {
        step: 2,
        title: 'Open Health Checks Configuration Tab',
        consolePath: 'prod-api-tg → Health checks tab → Edit',
        instruction: 'Under the "Health checks" tab, click "Edit". Ensure the Health check protocol is set to HTTP.',
      },
      {
        step: 3,
        title: 'Set Health Check Path and Status Matchers',
        consolePath: 'Health check path: /healthz | Success codes: 200',
        instruction: 'Enter "/healthz" as the Health check path. Set HTTP Success codes to "200". Set Port to "Traffic port".',
      },
      {
        step: 4,
        title: 'Tune Health Check Timing Thresholds',
        consolePath: 'Interval: 15s | Timeout: 5s | Healthy: 3 | Unhealthy: 2',
        instruction: 'Set Health check interval to 15 seconds, Timeout to 5 seconds, Healthy threshold to 3 consecutive passes, and Unhealthy threshold to 2.',
      },
      {
        step: 5,
        title: 'Save and Verify Target Health',
        consolePath: 'prod-api-tg → Targets tab',
        instruction: 'Click "Save changes". Navigate to the "Targets" tab and verify all registered backend instances transition to "Healthy" state.',
      },
    ],
    cli: {
      command: `aws elbv2 modify-target-group \\
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-api-tg/a1b2c3d4e5f6 \\
  --health-check-protocol HTTP \\
  --health-check-port 80 \\
  --health-check-path /healthz \\
  --health-check-interval-seconds 15 \\
  --health-check-timeout-seconds 5 \\
  --healthy-threshold-count 3 \\
  --unhealthy-threshold-count 2 \\
  --matcher HttpCode=200`,
      explanation: 'Modifies the target group health check configuration in-place without dropping live connections.',
    },
    iac: {
      tf: `# terraform/alb_health_check.tf
resource "aws_lb_target_group" "api_tg" {
  name     = "prod-api-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/healthz"
    protocol            = "HTTP"
    port                = "traffic-port"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 2
  }

  tags = {
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}`,
      cf: `Resources:
  ApiTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: prod-api-tg
      Port: 80
      Protocol: HTTP
      VpcId: !Ref VpcId
      HealthCheckEnabled: true
      HealthCheckPath: /healthz
      HealthCheckProtocol: HTTP
      HealthCheckIntervalSeconds: 15
      HealthCheckTimeoutSeconds: 5
      HealthyThresholdCount: 3
      UnhealthyThresholdCount: 2
      Matcher:
        HttpCode: '200'`,
    },
  },

  'REL-CHK-301': {
    id: 'REL-CHK-301',
    pillar: 'Reliability',
    pillarId: 'reliability',
    severity: 'medium',
    title: 'SQS Dead Letter Queue (DLQ) missing for asynchronous order processing queue',
    effort: 'Medium Effort',
    estTime: '20 min',
    risk: 'Medium Risk',
    description: 'The production asynchronous order processing SQS queue does not have a Dead Letter Queue (DLQ) attached, risking consumer thread starvation when encountering malformed messages.',
    rationale: 'DLQs isolate poison-pill messages so normal queue processing continues uninterrupted while engineers inspect bad payloads.',
    resources: [
      'arn:aws:sqs:us-east-1:124890123456:prod-order-processing-queue',
      'arn:aws:sqs:us-east-1:124890123456:prod-email-notification-queue',
      'arn:aws:sqs:us-east-1:124890123456:prod-inventory-sync-queue',
      'arn:aws:sqs:us-east-1:124890123456:prod-billing-events-queue',
      'arn:aws:sqs:us-east-1:124890123456:prod-webhook-dispatch-queue',
      'arn:aws:sqs:us-east-1:124890123456:prod-analytics-raw-queue',
      'arn:aws:sqs:us-east-1:124890123456:prod-sms-delivery-queue',
      'arn:aws:sqs:us-east-1:124890123456:prod-report-export-queue',
    ],
    manualSteps: [
      {
        step: 1,
        title: 'Create Dead Letter Queue in SQS Console',
        consolePath: 'Amazon SQS Console → Create queue',
        instruction: 'Create a standard SQS queue named "prod-order-processing-dlq" with message retention set to 14 days.',
      },
      {
        step: 2,
        title: 'Configure Redrive Policy on Main Queue',
        consolePath: 'prod-order-processing-queue → Edit → Dead-letter queue',
        instruction: 'Select "prod-order-processing-queue", click "Edit", and expand the "Dead-letter queue" section. Set status to Enabled.',
      },
      {
        step: 3,
        title: 'Set Maximum Receives Threshold',
        consolePath: 'Dead-letter queue ARN: prod-order-processing-dlq | Maximum receives: 5',
        instruction: 'Select the newly created DLQ and set Maximum receives to 5 before automatic redrive occurs.',
      },
      {
        step: 4,
        title: 'Save and Set Alarm on DLQ Depth',
        consolePath: 'CloudWatch Alarms → Create Alarm → ApproximateNumberOfMessagesVisible > 0',
        instruction: 'Save the configuration. Create a CloudWatch Alarm to alert oncall if any message lands in the DLQ.',
      },
    ],
    cli: {
      command: `# 1. Create Dead Letter Queue
aws sqs create-queue \\
  --queue-name prod-order-processing-dlq \\
  --attributes MessageRetentionPeriod=1209600

# 2. Attach Redrive Policy to source queue
aws sqs set-queue-attributes \\
  --queue-url https://sqs.us-east-1.amazonaws.com/124890123456/prod-order-processing-queue \\
  --attributes '{"RedrivePolicy":"{\\"deadLetterTargetArn\\":\\"arn:aws:sqs:us-east-1:124890123456:prod-order-processing-dlq\\",\\"maxReceiveCount\\":\\"5\\"}"}'`,
      explanation: 'Creates a 14-day retention DLQ and binds it to the primary queue with a 5-retry limit.',
    },
    iac: {
      tf: `# terraform/sqs_dlq.tf
resource "aws_sqs_queue" "orders_dlq" {
  name                      = "prod-order-processing-dlq"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "orders_queue" {
  name                      = "prod-order-processing-queue"
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.orders_dlq.arn
    maxReceiveCount     = 5
  })
} `,
      cf: `Resources:
  OrdersDLQ:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: prod-order-processing-dlq
      MessageRetentionPeriod: 1209600
  OrdersQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: prod-order-processing-queue
      RedrivePolicy:
        deadLetterTargetArn: !GetAtt OrdersDLQ.Arn
        maxReceiveCount: 5`,
    },
  },

  // ── SECURITY ─────────────────────────────────────────────────────────────
  'SEC-047': {
    id: 'SEC-047',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'critical',
    title: 'IAM role with wildcard resource permission (*) on S3 and DynamoDB',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'Critical Risk',
    description: 'IAM role acme-lambda-exec contains inline policies granting s3:* actions across wildcard Resource: *. This violates least-privilege principles and enables unauthorized cross-bucket access.',
    rationale: 'Scoping IAM resource permissions restricts compromised compute instances from accessing sensitive backup, billing, or customer data buckets.',
    resources: [
      'arn:aws:iam::124890123456:role/acme-lambda-exec',
      'arn:aws:iam::124890123456:role/acme-batch-worker',
      'arn:aws:iam::124890123456:role/acme-api-handler',
      'arn:aws:iam::124890123456:role/acme-db-migrator-role',
      'arn:aws:iam::124890123456:role/acme-ecs-task-execution',
      'arn:aws:iam::124890123456:role/acme-ci-deployer',
      'arn:aws:s3:::acme-prod-data-lake-raw',
      'arn:aws:s3:::acme-prod-analytics-warehouse',
      'arn:aws:dynamodb:us-east-1:124890123456:table/prod-customer-sessions',
      'arn:aws:dynamodb:us-east-1:124890123456:table/prod-order-history',
    ],
    manualSteps: [
      {
        step: 1,
        title: 'Open IAM Roles in AWS Management Console',
        consolePath: 'IAM Console → Roles → acme-lambda-exec',
        instruction: 'Open IAM Console and search for the role "acme-lambda-exec".',
      },
      {
        step: 2,
        title: 'Review and Edit Inline Permission Policies',
        consolePath: 'Permissions tab → Inline policies → WildcardAccessPolicy',
        instruction: 'Under the Permissions tab, locate the policy with Resource: * statements and click "Edit policy".',
      },
      {
        step: 3,
        title: 'Scope Resource ARNs to Specific Production Buckets',
        consolePath: 'Resource: arn:aws:s3:::acme-prod-data/* and arn:aws:s3:::acme-prod-assets/*',
        instruction: 'Replace the wildcard asterisk "*" with explicit bucket ARNs required for the workload.',
      },
      {
        step: 4,
        title: 'Simulate and Review Policy',
        consolePath: 'IAM Policy Simulator → Verify GetObject and PutObject',
        instruction: 'Run the IAM Policy Simulator to confirm Lambda execution succeeds without error, then click "Save changes".',
      },
    ],
    cli: {
      command: `aws iam put-role-policy \\
  --role-name acme-lambda-exec \\
  --policy-name LambdaS3ScopedPolicy \\
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject","s3:PutObject"],
      "Resource": ["arn:aws:s3:::acme-prod-data/*","arn:aws:s3:::acme-prod-assets/*"]
    }]
  }'`,
      explanation: 'Replaces the inline policy with scoped ARN destinations, enforcing strict least-privilege.',
    },
    iac: {
      tf: `# terraform/iam.tf
resource "aws_iam_role_policy" "lambda_s3_scoped" {
  name = "LambdaS3ScopedPolicy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = [
        "arn:aws:s3:::acme-prod-data/*",
        "arn:aws:s3:::acme-prod-assets/*"
      ]
    }]
  })
}`,
      cf: `Resources:
  LambdaScopedPolicy:
    Type: AWS::IAM::Policy
    Properties:
      PolicyName: LambdaS3ScopedPolicy
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Action:
              - s3:GetObject
              - s3:PutObject
            Resource:
              - 'arn:aws:s3:::acme-prod-data/*'
              - 'arn:aws:s3:::acme-prod-assets/*'
      Roles:
        - acme-lambda-exec`,
    },
  },

  'SEC-061': {
    id: 'SEC-061',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'high',
    title: 'Security group allows open ingress 0.0.0.0/0 on port 22 (SSH)',
    effort: 'Medium Effort',
    estTime: '20 min',
    risk: 'High Risk',
    description: 'Security group prod-bastion-sg allows unrestricted ingress (0.0.0.0/0) on SSH port 22, exposing instances to unauthorized brute-force attempts.',
    rationale: 'Direct internet SSH access is a major attack vector. Replace with AWS Systems Manager (SSM) Session Manager or restrict to VPN IP ranges.',
    resources: [
      'sg-0a81b2c3d4e5f6789 (prod-bastion-sg)',
      'sg-0192837465abcde12 (prod-admin-ingress-sg)',
      'sg-05f4e3d2c1b0a9876 (prod-vpn-gateway-sg)',
      'sg-0ab9c8d7e6f5a4321 (staging-bastion-sg)',
      'sg-077aa88bb99cc0011 (legacy-jumpbox-sg)',
      'sg-04433221100aabbcc (dev-mgmt-access-sg)',
    ],
    manualSteps: [
      {
        step: 1,
        title: 'Open VPC Security Groups Console',
        consolePath: 'VPC Console → Security Groups → sg-0a81b2c3d4e5f6789',
        instruction: 'Navigate to VPC > Security Groups and select "prod-bastion-sg".',
      },
      {
        step: 2,
        title: 'Edit Inbound Rules',
        consolePath: 'Inbound rules tab → Edit inbound rules',
        instruction: 'Click "Edit inbound rules". Find the rule matching Type: SSH (Port 22) and Source: 0.0.0.0/0.',
      },
      {
        step: 3,
        title: 'Restrict Source to Corporate VPN CIDR or Delete',
        consolePath: 'Source: 10.200.0.0/16 (Corporate VPN)',
        instruction: 'Change the source CIDR from 0.0.0.0/0 to the corporate VPN block 10.200.0.0/16, or delete the rule if using AWS SSM Session Manager.',
      },
      {
        step: 4,
        title: 'Save Inbound Rules',
        consolePath: 'Click Save rules',
        instruction: 'Click "Save rules". Verify that direct public SSH access from the internet is immediately blocked.',
      },
    ],
    cli: {
      command: `# 1. Revoke public 0.0.0.0/0 SSH rule
aws ec2 revoke-security-group-ingress \\
  --group-id sg-0a81b2c3d4e5f6789 \\
  --protocol tcp --port 22 --cidr 0.0.0.0/0

# 2. Add corporate VPN CIDR rule
aws ec2 authorize-security-group-ingress \\
  --group-id sg-0a81b2c3d4e5f6789 \\
  --protocol tcp --port 22 --cidr 10.200.0.0/16`,
      explanation: 'Revokes open public SSH port 22 access and restricts inbound traffic strictly to the corporate VPN range.',
    },
    iac: {
      tf: `# terraform/security_group.tf
resource "aws_security_group_rule" "restricted_ssh" {
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = ["10.200.0.0/16"] # Corporate VPN only
  security_group_id = "sg-0a81b2c3d4e5f6789"
} `,
      cf: `SecurityGroupIngress:
  - IpProtocol: tcp
    FromPort: 22
    ToPort: 22
    CidrIp: 10.200.0.0/16`,
    },
  },

  'SEC-024': {
    id: 'SEC-024',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'high',
    title: 'S3 bucket missing server access logging and object lock protection',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'High Risk',
    description: 'S3 bucket acme-prod-assets does not have server access logging configured. Inbound HTTP requests and forensic audit trails are unmonitored.',
    rationale: 'Server access logging provides detailed records for requests made to your bucket, critical for security incident response and compliance verification.',
    resources: [
      'arn:aws:s3:::acme-prod-assets',
      'arn:aws:s3:::acme-prod-backups',
      'arn:aws:s3:::acme-prod-customer-invoices',
      'arn:aws:s3:::acme-prod-receipts-archive',
      'arn:aws:s3:::acme-prod-media-uploads',
      'arn:aws:s3:::acme-prod-audit-records',
      'arn:aws:s3:::acme-prod-reports-exports',
      'arn:aws:s3:::acme-prod-frontend-dist',
    ],
    manualSteps: [
      {
        step: 1,
        title: 'Open Amazon S3 Console and Select Bucket',
        consolePath: 'Amazon S3 Console → Buckets → acme-prod-assets',
        instruction: 'Navigate to S3 Console, choose "acme-prod-assets", and open the "Properties" tab.',
      },
      {
        step: 2,
        title: 'Enable Server Access Logging',
        consolePath: 'Properties tab → Server access logging → Edit',
        instruction: 'Under Server access logging, click "Edit", select "Enable", and set Target bucket to "acme-prod-s3-logs".',
      },
      {
        step: 3,
        title: 'Set Log Object Prefix',
        consolePath: 'Target prefix: logs/acme-prod-assets/',
        instruction: 'Set the target prefix to "logs/acme-prod-assets/" and click "Save changes".',
      },
    ],
    cli: {
      command: `aws s3api put-bucket-logging \\
  --bucket acme-prod-assets \\
  --bucket-logging-status '{
    "LoggingEnabled": {
      "TargetBucket": "acme-prod-s3-logs",
      "TargetPrefix": "logs/acme-prod-assets/"
    }
  }'`,
      explanation: 'Configures automated access logging delivered to the centralized compliance S3 bucket.',
    },
    iac: {
      tf: `# terraform/s3_logging.tf
resource "aws_s3_bucket_logging" "assets_logging" {
  bucket        = "acme-prod-assets"
  target_bucket = "acme-prod-s3-logs"
  target_prefix = "logs/acme-prod-assets/"
} `,
      cf: `Resources:
  AssetsBucketLogging:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: acme-prod-assets
      LoggingConfiguration:
        DestinationBucketName: acme-prod-s3-logs
        LogFilePrefix: logs/acme-prod-assets/`,
    },
  },

  'SEC-033': {
    id: 'SEC-033',
    pillar: 'Security',
    pillarId: 'security',
    severity: 'medium',
    title: 'AWS CloudTrail multi-region logging not enabled in secondary active regions',
    effort: 'Low Effort',
    estTime: '10 min',
    risk: 'Medium Risk',
    description: 'CloudTrail trail acme-management-events is restricted to a single region. Malicious API calls in secondary regions will bypass auditing.',
    rationale: 'Multi-region trails aggregate global AWS account events into a single tamper-evident bucket, providing comprehensive activity auditing.',
    resources: [
      'arn:aws:cloudtrail:us-east-1:124890123456:trail/acme-management-events',
      'arn:aws:cloudtrail:us-west-2:124890123456:trail/acme-secondary-trail',
      'arn:aws:cloudtrail:eu-west-1:124890123456:trail/acme-dr-region-trail',
      'arn:aws:s3:::acme-prod-audit-logs',
      'arn:aws:kms:us-east-1:124890123456:key/mrk-091823746510',
      'arn:aws:kms:us-west-2:124890123456:key/mrk-091823746510',
    ],
    manualSteps: [
      {
        step: 1,
        title: 'Open CloudTrail Console',
        consolePath: 'CloudTrail Console → Trails → acme-management-events',
        instruction: 'Select the existing trail "acme-management-events" and click "Edit".',
      },
      {
        step: 2,
        title: 'Enable Multi-Region Trail Flag',
        consolePath: 'Trail settings → Apply trail to all regions: Yes',
        instruction: 'Toggle "Apply trail to all regions" to Yes. Enable Log file validation with SHA-256.',
      },
      {
        step: 3,
        title: 'Save and Confirm Global Event Collection',
        consolePath: 'Click Save changes',
        instruction: 'Save changes and verify CloudTrail displays "Multi-region: Yes" across all active AWS regions.',
      },
    ],
    cli: {
      command: `aws cloudtrail update-trail \\
  --name acme-management-events \\
  --is-multi-region-trail \\
  --include-global-service-events \\
  --enable-log-file-validation`,
      explanation: 'Upgrades single-region trail to multi-region with cryptographic digest verification.',
    },
    iac: {
      tf: `# terraform/cloudtrail.tf
resource "aws_cloudtrail" "main" {
  name                          = "acme-management-events"
  s3_bucket_name                = "acme-prod-audit-logs"
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
} `,
      cf: `Resources:
  ManagementTrail:
    Type: AWS::CloudTrail::Trail
    Properties:
      TrailName: acme-management-events
      IsMultiRegionTrail: true
      IncludeGlobalServiceEvents: true
      EnableLogFileValidation: true`,
    },
  },

  // ── COST OPTIMIZATION ────────────────────────────────────────────────────
  'COST-008': {
    id: 'COST-008',
    pillar: 'Cost Optimization',
    pillarId: 'cost',
    severity: 'medium',
    title: '14 unattached EBS volumes incurring idle monthly charges ($342/mo)',
    effort: 'Low Effort',
    estTime: '15 min',
    risk: 'Medium Risk',
    description: 'Found 14 unattached gp2/gp3 EBS volumes leftover from decommissioned EC2 instances, generating $342/month in waste.',
    rationale: 'Cleaning up unattached storage volumes reclaims unnecessary cloud spend without affecting running production instances.',
    resources: [
      'vol-01a2b3c4d5e6f7890 (us-east-1a, 500GB gp3, unattached)',
      'vol-09876f5e4d3c2b1a0 (us-east-1b, 250GB gp2, unattached)',
      'vol-0ab12cd34ef56789a (us-east-1a, 100GB gp3, unattached)',
      'vol-0fedcba9876543210 (us-east-1c, 1000GB io2, unattached)',
      'vol-0554433221100aabb (us-east-1b, 750GB gp3, unattached)',
      'vol-0ccddeeff00112233 (us-east-1a, 320GB gp3, unattached)',
      'vol-01122334455667788 (us-east-1b, 120GB gp2, unattached)',
      'vol-09988776655443322 (us-east-1c, 500GB gp3, unattached)',
      'vol-0aabbccddeeff0011 (us-east-1a, 200GB gp3, unattached)',
      'vol-077889900aabbccdd (us-east-1b, 150GB gp2, unattached)',
      'vol-03344556677889900 (us-east-1c, 400GB gp3, unattached)',
      'vol-02233445566778899 (us-east-1a, 600GB gp3, unattached)',
      'vol-0ffeeddccbbaa9988 (us-east-1b, 800GB gp3, unattached)',
      'vol-06677889900112233 (us-east-1c, 250GB gp2, unattached)',
    ],
    manualSteps: [
      {
        step: 1,
        title: 'Filter Available Volumes in EC2 Console',
        consolePath: 'EC2 Console → Elastic Block Store → Volumes → Filter: State = Available',
        instruction: 'Filter EBS volumes with state equal to "Available" (unattached).',
      },
      {
        step: 2,
        title: 'Create Final Recovery Snapshots',
        consolePath: 'Actions → Create snapshot',
        instruction: 'Select volumes and take final safety snapshots for compliance archival.',
      },
      {
        step: 3,
        title: 'Delete Unattached Volumes',
        consolePath: 'Actions → Delete volume',
        instruction: 'Click Actions > Delete volume and confirm deletion to stop billing.',
      },
    ],
    cli: {
      command: `aws ec2 create-snapshot --volume-id vol-01a2b3c4d5e6f7890 --description "Pre-cleanup snapshot"
aws ec2 delete-volume --volume-id vol-01a2b3c4d5e6f7890`,
      explanation: 'Snapshots the detached volume for safety, then releases the idle provisioned storage.',
    },
    iac: {
      tf: `# terraform/ebs_cleanup.tf
# Deploy AWS Config rule to continuously flag unattached volumes
resource "aws_config_config_rule" "unattached_volumes" {
  name = "ec2-volume-inuse-check"
  source {
    owner             = "AWS"
    source_identifier = "EC2_VOLUME_INUSE_CHECK"
  }
} `,
      cf: `Resources:
  VolumeInUseRule:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: ec2-volume-inuse-check
      Source:
        Owner: AWS
        SourceIdentifier: EC2_VOLUME_INUSE_CHECK`,
    },
  },

  // ── OPERATIONAL EXCELLENCE ───────────────────────────────────────────────
  'OPS-014': {
    id: 'OPS-014',
    pillar: 'Operational Excellence',
    pillarId: 'operational-excellence',
    severity: 'medium',
    title: 'No automated backup retention policy configured for Amazon RDS instances',
    effort: 'Medium Effort',
    estTime: '20 min',
    risk: 'Medium Risk',
    description: 'Production RDS instance acme-main-db has backup retention disabled or set to 0 days, preventing Point-in-Time Recovery (PITR).',
    rationale: 'Enabling automated continuous backups with a minimum 7-day retention window is critical for rapid recovery from data corruption.',
    resources: [
      'arn:aws:rds:us-east-1:124890123456:db:acme-main-db',
      'arn:aws:rds:us-east-1:124890123456:db:acme-analytics-db',
      'arn:aws:rds:us-east-1:124890123456:db:acme-payments-db',
      'arn:aws:rds:us-east-1:124890123456:db:acme-staging-db',
      'arn:aws:rds:us-east-1:124890123456:db:acme-audit-archive-db',
    ],
    manualSteps: [
      {
        step: 1,
        title: 'Open Amazon RDS Console and Select Database',
        consolePath: 'RDS Console → Databases → acme-main-db → Modify',
        instruction: 'Choose "acme-main-db" and click "Modify".',
      },
      {
        step: 2,
        title: 'Configure Backup Retention Period to 30 Days',
        consolePath: 'Backup section → Backup retention period: 30 days',
        instruction: 'Set Backup retention period to 30 days and specify preferred window 03:00-04:00 UTC.',
      },
      {
        step: 3,
        title: 'Enable Deletion Protection and Apply Immediately',
        consolePath: 'Deletion protection: Enabled → Apply immediately',
        instruction: 'Enable deletion protection and select "Apply immediately".',
      },
    ],
    cli: {
      command: `aws rds modify-db-instance \\
  --db-instance-identifier acme-main-db \\
  --backup-retention-period 30 \\
  --preferred-backup-window 03:00-04:00 \\
  --apply-immediately`,
      explanation: 'Enables 30-day continuous WAL automated backup retention with PITR recovery.',
    },
    iac: {
      tf: `# terraform/rds_backup.tf
resource "aws_db_instance" "main_db" {
  identifier              = "acme-main-db"
  backup_retention_period = 30
  backup_window           = "03:00-04:00"
  copy_tags_to_snapshot   = true
  deletion_protection     = true
} `,
      cf: `Resources:
  DatabaseInstance:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: acme-main-db
      BackupRetentionPeriod: 30
      PreferredBackupWindow: '03:00-04:00'`,
    },
  },

  // ── PERFORMANCE EFFICIENCY ───────────────────────────────────────────────
  'PERF-CHK-201': {
    id: 'PERF-CHK-201',
    pillar: 'Performance Efficiency',
    pillarId: 'performance-efficiency',
    severity: 'high',
    title: 'RDS database read replica missing for high-volume analytics queries',
    effort: 'Medium Effort',
    estTime: '25 min',
    risk: 'High Risk',
    description: 'Heavy read-intensive reporting queries are executed directly on the master database instance, causing CPU contention on transactions.',
    rationale: 'Provisioning an asynchronous read replica offloads query load and isolates background reporting from real-time customer checkouts.',
    resources: [
      'arn:aws:rds:us-east-1:124890123456:db:acme-main-db',
      'arn:aws:rds:us-east-1:124890123456:db:acme-orders-db',
      'arn:aws:rds:us-east-1:124890123456:db:acme-reporting-cluster-instance-1',
      'arn:aws:rds:us-east-1:124890123456:db:acme-reporting-cluster-instance-2',
      'arn:aws:rds:us-east-1:124890123456:cluster:acme-aurora-cluster',
    ],
    manualSteps: [
      {
        step: 1,
        title: 'Open RDS Console and Choose Primary DB',
        consolePath: 'RDS Console → Databases → acme-main-db',
        instruction: 'Select "acme-main-db", click Actions > "Create read replica".',
      },
      {
        step: 2,
        title: 'Select Instance Type and Multi-AZ Placement',
        consolePath: 'DB instance identifier: acme-main-db-replica | Instance class: db.r6g.large',
        instruction: 'Choose db.r6g.large and select a secondary Availability Zone.',
      },
      {
        step: 3,
        title: 'Deploy Replica and Route Analytics Connections',
        consolePath: 'Click Create read replica',
        instruction: 'Deploy the replica and update reporting connection pools to the read-replica endpoint.',
      },
    ],
    cli: {
      command: `aws rds create-db-instance-read-replica \\
  --db-instance-identifier acme-main-db-replica \\
  --source-db-instance-identifier acme-main-db \\
  --db-instance-class db.r6g.large`,
      explanation: 'Spawns an asynchronous read-only replica to handle analytics workload traffic.',
    },
    iac: {
      tf: `# terraform/rds_replica.tf
resource "aws_db_instance" "read_replica" {
  identifier             = "acme-main-db-replica"
  replicate_source_db    = "acme-main-db"
  instance_class         = "db.r6g.large"
  publicly_accessible    = false
}`,
      cf: `Resources:
  ReadReplicaDB:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: acme-main-db-replica
      SourceDBInstanceIdentifier: acme-main-db
      DBInstanceClass: db.r6g.large`,
    },
  },
};

export function AIRemediation() {
  const {
    go,
    theme,
    remediationFindingId,
    previousScreen,
    selectedPillarId,
    assessments,
    selectedAssessmentId,
    solvedCheckIds,
    toggleCheckSolved,
    markCheckSolved,
  } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  // Git Connection State
  const [gitConfig, setGitConfig] = useState<{
    connected: boolean;
    hasExistingRepo: boolean | null;
    repoName: string;
    branch: string;
    pat: string;
  }>({
    connected: false,
    hasExistingRepo: null,
    repoName: 'acme-corp/terraform-aws-infrastructure',
    branch: 'main',
    pat: '',
  });

  const [isGitModalOpen, setIsGitModalOpen] = useState(!gitConfig.connected);
  const [gitModalStep, setGitModalStep] = useState<'ask_repo' | 'pat_form' | 'validating' | 'connected_success'>('ask_repo');
  const [pendingAssessmentId, setPendingAssessmentId] = useState<string | null>(null);
  const [patInput, setPatInput] = useState('');
  const [repoInput, setRepoInput] = useState('acme-corp/terraform-aws-infrastructure');
  const [branchInput, setBranchInput] = useState('main');
  const [showPat, setShowPat] = useState(false);
  const [patError, setPatError] = useState('');

  // AI Fix Mode: when entered directly via "AI Fix" button on a specific finding
  const isAiFixMode = Boolean(remediationFindingId);

  // Assessment Selection State (null = show assessment list view)
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(
    remediationFindingId ? (selectedAssessmentId || 'A-001') : null
  );

  // Active check in check-by-check remediation
  const [activeCheckId, setActiveCheckId] = useState<string>(
    remediationFindingId && REMEDIATION_DATABASE[remediationFindingId]
      ? remediationFindingId
      : 'REL-019'
  );

  // Check filters & search in check list
  const [checkSearch, setCheckSearch] = useState('');
  const [checkSeverityFilter, setCheckSeverityFilter] = useState<'all' | 'critical_high' | 'medium'>('all');

  // Assessment list search & filter
  const [assessmentSearch, setAssessmentSearch] = useState('');
  const [assessmentCloudFilter, setAssessmentCloudFilter] = useState<'all' | 'aws' | 'azure' | 'gcp'>('all');

  // Check detail state
  const checkData = REMEDIATION_DATABASE[activeCheckId] || REMEDIATION_DATABASE['REL-019'];
  const [methodTab, setMethodTab] = useState<'manual' | 'cli' | 'iac'>('iac');
  const [iacLanguage, setIacLanguage] = useState<'tf' | 'cf'>('tf');
  const [copied, setCopied] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationSuccess, setSimulationSuccess] = useState(false);
  const [generatingIaC, setGeneratingIaC] = useState(false);
  const [iacGenerated, setIacGenerated] = useState(false);
  const [viewIaCModalOpen, setViewIaCModalOpen] = useState(false);

  // Resources modal
  const [resourcesModalOpen, setResourcesModalOpen] = useState(false);
  const [resourceSearch, setResourceSearch] = useState('');
  const [copiedArnId, setCopiedArnId] = useState<string | null>(null);
  const [copiedAllArns, setCopiedAllArns] = useState(false);

  // GitHub Pull Request Modal State
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [prSubmitting, setPrSubmitting] = useState(false);
  const [prCreatedSuccess, setPrCreatedSuccess] = useState(false);
  const [completedChecks, setCompletedChecks] = useState<Record<string, boolean>>({});

  // Reset check detail state when check changes
  useEffect(() => {
    setSimulationSuccess(false);
    setIacGenerated(false);
    setResourceSearch('');
    setResourcesModalOpen(false);
  }, [activeCheckId]);

  // Handle Git Validation & Connect
  const handleConnectGit = () => {
    if (!patInput.trim()) {
      setPatError('Please enter your GitHub Personal Access Token (PAT)');
      return;
    }
    setPatError('');
    setGitModalStep('validating');

    setTimeout(() => {
      setGitConfig({
        connected: true,
        hasExistingRepo: gitConfig.hasExistingRepo ?? true,
        repoName: repoInput.trim() || 'acme-corp/terraform-aws-infrastructure',
        branch: branchInput.trim() || 'main',
        pat: patInput.trim(),
      });
      setGitModalStep('connected_success');
    }, 1200);
  };

  const handleFinishGitModal = () => {
    setIsGitModalOpen(false);
    setGitModalStep('ask_repo');
    if (pendingAssessmentId) {
      setActiveAssessmentId(pendingAssessmentId);
      setPendingAssessmentId(null);
    }
  };

  const handleStartRemediation = (assessmentId: string) => {
    if (!gitConfig.connected) {
      setPendingAssessmentId(assessmentId);
      setGitModalStep('ask_repo');
      setIsGitModalOpen(true);
    } else {
      setActiveAssessmentId(assessmentId);
    }
  };

  const handleOpenGitSettings = () => {
    setPatInput(gitConfig.pat || 'ghp_live983274982374982374982374');
    setRepoInput(gitConfig.repoName);
    setBranchInput(gitConfig.branch);
    setGitModalStep(gitConfig.connected ? 'connected_success' : 'ask_repo');
    setIsGitModalOpen(true);
  };

  const handleBackFromAiFix = () => {
    if (previousScreen === 'pillar-detail') {
      go('pillar-detail');
    } else {
      go('report');
    }
  };

  const handleBackFromAssessment = () => {
    if (isAiFixMode) {
      handleBackFromAiFix();
    } else {
      setActiveAssessmentId(null);
    }
  };

  const handleCopyArn = (arn: string, id: string) => {
    navigator.clipboard.writeText(arn);
    setCopiedArnId(id);
    setTimeout(() => {
      setCopiedArnId(prev => (prev === id ? null : prev));
    }, 1800);
  };

  const handleCopyAllArns = (arns: string[]) => {
    navigator.clipboard.writeText(arns.join('\n'));
    setCopiedAllArns(true);
    setTimeout(() => setCopiedAllArns(false), 1800);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(checkData.cli.command);
    setCliCopied(true);
    setTimeout(() => setCliCopied(false), 1800);
  };

  const handleDownloadCode = (code: string, ext: string) => {
    const fileName = `remediate-${checkData.id.toLowerCase()}.${ext}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulate = () => {
    setSimulating(true);
    setSimulationSuccess(false);
    setTimeout(() => {
      setSimulating(false);
      setSimulationSuccess(true);
    }, 1100);
  };

  const handleGenerateIaC = () => {
    setGeneratingIaC(true);
    setIacGenerated(false);
    setTimeout(() => {
      setGeneratingIaC(false);
      setIacGenerated(true);
    }, 900);
  };

  const handleCreatePullRequest = () => {
    if (!gitConfig.connected) {
      handleOpenGitSettings();
      return;
    }
    setPrCreatedSuccess(false);
    setPrModalOpen(true);
  };

  const handleSubmitPullRequest = () => {
    setPrSubmitting(true);
    setTimeout(() => {
      setPrSubmitting(false);
      setPrCreatedSuccess(true);
      setCompletedChecks(prev => ({ ...prev, [checkData.id]: true }));
      markCheckSolved(checkData.id, true);
    }, 1400);
  };

  // Assessment list
  const assessmentList: AssessmentInfo[] = assessments?.length ? assessments : INITIAL_ASSESSMENTS;
  const currentActiveAssessment = assessmentList.find(a => a.id === activeAssessmentId) || assessmentList[0];

  const filteredAssessments = assessmentList.filter(a => {
    if (assessmentCloudFilter !== 'all' && a.cloud !== assessmentCloudFilter) return false;
    if (assessmentSearch.trim()) {
      const q = assessmentSearch.toLowerCase().trim();
      return a.name.toLowerCase().includes(q) || a.accountName.toLowerCase().includes(q) || a.region.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
    }
    return true;
  });

  // All checks in database
  const allChecksList = Object.values(REMEDIATION_DATABASE);
  const solvedChecksCount = allChecksList.filter(c => solvedCheckIds[c.id]).length;
  const filteredChecks = allChecksList.filter(c => {
    if (checkSeverityFilter === 'critical_high' && !(c.severity === 'critical' || c.severity === 'high')) return false;
    if (checkSeverityFilter === 'medium' && c.severity !== 'medium') return false;
    if (checkSearch.trim()) {
      const q = checkSearch.toLowerCase().trim();
      return c.id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.pillar.toLowerCase().includes(q);
    }
    return true;
  });

  const allResources = checkData.resources || [];
  const DISPLAY_LIMIT = 3;
  const visibleResources = allResources.slice(0, DISPLAY_LIMIT);

  const filteredModalResources = allResources.filter(res => {
    if (!resourceSearch.trim()) return true;
    return res.toLowerCase().includes(resourceSearch.toLowerCase().trim());
  });

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: T.bg }}>

        {/* ── TOP HEADER / STATUS BAR ── */}
        <div
          className="px-6 py-3.5 flex items-center justify-between shrink-0 border-b sticky top-0 z-20"
          style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
        >
          <div className="flex items-center gap-3.5 flex-wrap">
            {isAiFixMode ? (
              <button
                type="button"
                onClick={handleBackFromAiFix}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5"
                style={{
                  borderColor: T.border,
                  color: T.textSub,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = T.primary;
                  e.currentTarget.style.borderColor = T.primary;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = T.textSub;
                  e.currentTarget.style.borderColor = T.border;
                }}
              >
                <span>{previousScreen === 'pillar-detail' ? '← Back to Pillar Details' : '← Back to Review Findings'}</span>
              </button>
            ) : activeAssessmentId ? (
              <button
                type="button"
                onClick={() => setActiveAssessmentId(null)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5"
                style={{
                  borderColor: T.border,
                  color: T.textSub,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = T.primary;
                  e.currentTarget.style.borderColor = T.primary;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = T.textSub;
                  e.currentTarget.style.borderColor = T.border;
                }}
              >
                <span>← Back to Assessment List</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => go('dashboard')}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5"
                style={{
                  borderColor: T.border,
                  color: T.textSub,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = T.primary;
                  e.currentTarget.style.borderColor = T.primary;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = T.textSub;
                  e.currentTarget.style.borderColor = T.border;
                }}
              >
                <span>← Dashboard</span>
              </button>
            )}

            <div className="h-4 w-[1px]" style={{ backgroundColor: T.border }} />

            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                </svg>
              </div>
              <h1 className="text-base font-bold" style={{ color: T.text }}>
                {isAiFixMode ? (
                  <>AI Fix · <span className="font-mono text-blue-500">{checkData.id}</span></>
                ) : activeAssessmentId ? (
                  <>Remediation · <span className="font-mono text-blue-500">{currentActiveAssessment.name}</span></>
                ) : (
                  'Remediation Hub'
                )}
              </h1>
            </div>
          </div>

          {/* Right: Git Connection Pill & Actions */}
          <div className="flex items-center gap-2.5">
            {activeAssessmentId && solvedChecksCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold"
                style={{
                  backgroundColor: isDark ? 'rgba(52,211,153,0.1)' : '#ECFDF5',
                  borderColor: isDark ? 'rgba(52,211,153,0.3)' : '#A7F3D0',
                  color: isDark ? '#6EE7B7' : '#065F46',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{solvedChecksCount} of {allChecksList.length} Solved</span>
              </div>
            )}

            {gitConfig.connected ? (
              <button
                type="button"
                onClick={handleOpenGitSettings}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-sm"
                style={{
                  backgroundColor: isDark ? 'rgba(52,211,153,0.1)' : '#ECFDF5',
                  borderColor: isDark ? 'rgba(52,211,153,0.3)' : '#A7F3D0',
                  color: isDark ? '#6EE7B7' : '#065F46',
                }}
                title="Click to view or update Git configuration"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="3" x2="6" y2="15" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M18 9a9 9 0 0 1-9 9" />
                </svg>
                <span className="font-mono">{gitConfig.repoName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 font-bold">{gitConfig.branch}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenGitSettings}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                style={{ background: 'linear-gradient(135deg,#2563EB,#059669)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="3" x2="6" y2="15" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M18 9a9 9 0 0 1-9 9" />
                </svg>
                <span>Connect Infra Repo</span>
              </button>
            )}
          </div>
        </div>

        {/* ── VIEW 1: ASSESSMENT SELECTION LIST (when activeAssessmentId is null) ── */}
        {!activeAssessmentId ? (
          <div className="max-w-6xl w-full mx-auto p-6 flex flex-col gap-6">

            {/* Git Banner */}
            <div
              className="p-5 rounded-2xl border flex items-center justify-between gap-4 flex-wrap"
              style={{
                backgroundColor: gitConfig.connected
                  ? (isDark ? 'rgba(52,211,153,0.06)' : '#F0FDF4')
                  : (isDark ? 'rgba(59,130,246,0.08)' : '#EFF6FF'),
                borderColor: gitConfig.connected
                  ? (isDark ? 'rgba(52,211,153,0.25)' : '#BBF7D0')
                  : (isDark ? 'rgba(59,130,246,0.25)' : '#BFDBFE'),
              }}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: gitConfig.connected ? (isDark ? 'rgba(52,211,153,0.2)' : '#DCFCE7') : (isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE'),
                    color: gitConfig.connected ? '#059669' : '#2563EB',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="3" x2="6" y2="15" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <path d="M18 9a9 9 0 0 1-9 9" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: T.text }}>
                    {gitConfig.connected ? (
                      <>Connected to GitHub Infra Repo: <span className="font-mono text-emerald-600 dark:text-emerald-400">{gitConfig.repoName}</span></>
                    ) : (
                      'Infrastructure Git Repository Not Connected'
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: T.textSub }}>
                    {gitConfig.connected
                      ? `Pull requests and verified Terraform/CloudFormation code fixes will target branch "${gitConfig.branch}".`
                      : 'Connect your GitHub PAT to enable one-click pull requests and IaC automation directly from assessment findings.'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenGitSettings}
                className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0"
                style={{
                  borderColor: gitConfig.connected ? (isDark ? '#059669' : '#10B981') : '#2563EB',
                  backgroundColor: gitConfig.connected ? (isDark ? 'rgba(5,150,105,0.15)' : '#FFFFFF') : '#2563EB',
                  color: gitConfig.connected ? (isDark ? '#6EE7B7' : '#059669') : '#FFFFFF',
                }}
              >
                {gitConfig.connected ? 'Repository Settings' : 'Connect Repo via GitHub PAT'}
              </button>
            </div>

            {/* Assessment Hub Header & Filters */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: T.text }}>
                    Select Assessment for Remediation
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                    Choose an assessment below to review check-by-check automated fixes, test CLI scripts, and generate Pull Requests.
                  </p>
                </div>

                {/* Cloud Filter Tabs */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9' }}>
                  {(['all', 'aws', 'azure', 'gcp'] as const).map(cloudType => (
                    <button
                      key={cloudType}
                      type="button"
                      onClick={() => setAssessmentCloudFilter(cloudType)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer"
                      style={{
                        backgroundColor: assessmentCloudFilter === cloudType ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                        color: assessmentCloudFilter === cloudType ? T.primary : T.textSub,
                        boxShadow: assessmentCloudFilter === cloudType ? T.shadow : 'none',
                      }}
                    >
                      {cloudType === 'all' ? 'All Clouds' : cloudType.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative flex items-center">
                <svg
                  className="absolute left-3.5 pointer-events-none"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: T.muted }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={assessmentSearch}
                  onChange={e => setAssessmentSearch(e.target.value)}
                  placeholder="Search assessments by name, account ID, or region..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs border outline-none transition-all"
                  style={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#FFFFFF',
                    borderColor: T.border,
                    color: T.text,
                  }}
                />
              </div>
            </div>

            {/* Assessment Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAssessments.map(assessment => {
                const highRiskCount = assessment.id === 'A-001' ? 4 : assessment.id === 'A-002' ? 3 : 2;
                const remediableCount = 8;
                return (
                  <div
                    key={assessment.id}
                    className="p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all hover:shadow-lg"
                    style={{
                      backgroundColor: T.card,
                      borderColor: T.border,
                      boxShadow: T.shadow,
                    }}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <CloudChip id={assessment.cloud} size="sm" isDark={isDark} />
                          <div>
                            <h3 className="text-sm font-bold" style={{ color: T.text }}>
                              {assessment.name}
                            </h3>
                            <div className="text-[11px] font-mono mt-0.5" style={{ color: T.textSub }}>
                              {assessment.accountName} · {assessment.region}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-sm font-bold font-mono" style={{ color: assessment.score >= 80 ? T.success : T.primary }}>
                            {assessment.score}%
                          </span>
                          <span className="text-[10px]" style={{ color: T.muted }}>Score</span>
                        </div>
                      </div>

                      {/* Pill info badges */}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                          style={{
                            backgroundColor: isDark ? 'rgba(244,63,94,0.15)' : '#FFF1F2',
                            color: isDark ? '#FB7185' : '#E11D48',
                          }}
                        >
                          {highRiskCount} High Risks
                        </span>
                        <span
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                          style={{
                            backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
                            color: isDark ? '#93C5FD' : '#2563EB',
                          }}
                        >
                          {remediableCount} Automated Fixes Ready
                        </span>
                        <span
                          className="text-[11px] font-medium px-2.5 py-1 rounded-lg"
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                            color: T.textSub,
                          }}
                        >
                          ~35 min fix time
                        </span>
                      </div>
                    </div>

                    <div className="border-t pt-3 flex items-center justify-between" style={{ borderColor: T.border }}>
                      <span className="text-[11px] font-mono" style={{ color: T.textSub }}>
                        ID: {assessment.id}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleStartRemediation(assessment.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                        style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                        </svg>
                        <span>Remediate Findings →</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── VIEW 2: CHECK-BY-CHECK REMEDIATION WORKSPACE ── */
          <div className="flex-1 flex overflow-hidden">

            {/* ── LEFT COLUMN: CHECK SELECTOR SIDEBAR ── */}
            <div
              className="w-80 shrink-0 border-r flex flex-col overflow-y-auto"
              style={{ backgroundColor: T.card, borderColor: T.border }}
            >
              {/* Sidebar Header */}
              <div className="p-3.5 border-b flex flex-col gap-2.5 shrink-0" style={{ borderColor: T.border }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: T.muted }}>
                    Remediable Checks
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                    {filteredChecks.length} available
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9' }}>
                  <button
                    type="button"
                    onClick={() => setCheckSeverityFilter('all')}
                    className="flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center"
                    style={{
                      backgroundColor: checkSeverityFilter === 'all' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                      color: checkSeverityFilter === 'all' ? T.primary : T.textSub,
                    }}
                  >
                    All ({allChecksList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckSeverityFilter('critical_high')}
                    className="flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center"
                    style={{
                      backgroundColor: checkSeverityFilter === 'critical_high' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                      color: checkSeverityFilter === 'critical_high' ? T.primary : T.textSub,
                    }}
                  >
                    High (5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckSeverityFilter('medium')}
                    className="flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center"
                    style={{
                      backgroundColor: checkSeverityFilter === 'medium' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                      color: checkSeverityFilter === 'medium' ? T.primary : T.textSub,
                    }}
                  >
                    Medium (4)
                  </button>
                </div>
              </div>

              {/* Check Items List */}
              <div className="flex flex-col p-2 gap-1.5 overflow-y-auto flex-1">
                {filteredChecks.map(item => {
                  const isSelected = item.id === activeCheckId;
                  const isCompleted = completedChecks[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveCheckId(item.id)}
                      className="p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 relative"
                      style={{
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF')
                          : (isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF'),
                        borderColor: isSelected
                          ? T.primary
                          : T.border,
                        boxShadow: isSelected ? T.shadow : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold" style={{ color: isSelected ? T.primary : T.text }}>
                            {item.id}
                          </span>
                          <SeverityPill severity={item.severity} dark={isDark} />
                        </div>

                        {solvedCheckIds[item.id] ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Solved
                          </span>
                        ) : isCompleted ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500">
                            PR Opened
                          </span>
                        ) : null}
                      </div>

                      <div className="text-xs font-semibold line-clamp-2 leading-tight" style={{ color: isSelected ? T.text : T.textSub }}>
                        {item.title}
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1" style={{ color: T.muted }}>
                        <span>{item.pillar}</span>
                        <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">IaC Ready</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── RIGHT COLUMN: CHECK REMEDIATION DETAILS ── */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-5xl">

              {/* Check Header Card */}
              <div
                className="p-6 rounded-2xl flex flex-col gap-4"
                style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg"
                      style={{
                        backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#EFF6FF',
                        color: isDark ? '#93C5FD' : '#2563EB',
                        border: `1px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE'}`,
                      }}
                    >
                      {checkData.id}
                    </span>
                    <SeverityPill severity={checkData.severity} dark={isDark} />
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                        color: T.textSub,
                      }}
                    >
                      {checkData.pillar} Pillar
                    </span>
                    <span className="text-xs" style={{ color: T.textSub }}>
                      {checkData.effort} · Est. {checkData.estTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCheckSolved(checkData.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm"
                      style={{
                        backgroundColor: solvedCheckIds[checkData.id]
                          ? (isDark ? 'rgba(52,211,153,0.15)' : '#ECFDF5')
                          : (isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF'),
                        borderColor: solvedCheckIds[checkData.id]
                          ? (isDark ? 'rgba(52,211,153,0.35)' : '#A7F3D0')
                          : T.border,
                        color: solvedCheckIds[checkData.id]
                          ? (isDark ? '#6EE7B7' : '#059669')
                          : T.text,
                      }}
                      title={solvedCheckIds[checkData.id] ? 'Click to mark as unresolved' : 'Click to mark as solved'}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{solvedCheckIds[checkData.id] ? 'Marked as Solved' : 'Mark as Solved'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCreatePullRequest}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                      style={{ background: 'linear-gradient(135deg,#2563EB,#059669)' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="6" y1="3" x2="6" y2="15" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <path d="M18 9a9 9 0 0 1-9 9" />
                      </svg>
                      <span>Create Pull Request</span>
                    </button>
                  </div>
                </div>

                <h2 className="text-xl font-bold" style={{ color: T.text }}>
                  {checkData.title}
                </h2>

                {/* Problem Statement & Rationale */}
                <div
                  className="p-4 rounded-xl border flex items-start gap-3.5"
                  style={{
                    backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : '#EFF6FF',
                    borderColor: isDark ? 'rgba(59,130,246,0.25)' : '#DBEAFE',
                  }}
                >
                  <div className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: T.primaryBg, color: T.primary }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="16" x2="12" y2="12"/>
                      <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: T.text }}>
                    <p className="font-semibold text-sm mb-1">{checkData.description}</p>
                    <p style={{ color: T.textSub }}>{checkData.rationale}</p>
                  </div>
                </div>

                {/* Impacted Resources */}
                <div>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textSub }}>
                      Impacted Resources ({allResources.length})
                    </span>

                    <button
                      type="button"
                      onClick={() => go('diagram')}
                      className="text-xs font-medium hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                      style={{ color: T.textSub }}
                    >
                      <span>View in Architecture Diagram</span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {visibleResources.map((res, i) => {
                      const isCopied = copiedArnId === `main-${i}`;
                      return (
                        <div
                          key={i}
                          className="px-3.5 py-2.5 rounded-xl text-xs font-mono flex items-center justify-between border transition-colors"
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                            borderColor: T.border,
                            color: T.text,
                          }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: isDark ? '#94A3B8' : '#64748B' }}
                            />
                            <span className="truncate select-all">{res}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyArn(res, `main-${i}`)}
                            className="text-[11px] font-sans px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                            style={{
                              borderColor: isCopied ? T.success : T.border,
                              color: isCopied ? T.success : T.textSub,
                              backgroundColor: isCopied
                                ? (isDark ? 'rgba(82,183,136,0.12)' : '#ECFDF5')
                                : (isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF'),
                            }}
                          >
                            <span>{isCopied ? 'Copied' : 'Copy ARN'}</span>
                          </button>
                        </div>
                      );
                    })}

                    {allResources.length > DISPLAY_LIMIT && (
                      <button
                        type="button"
                        onClick={() => {
                          setResourceSearch('');
                          setResourcesModalOpen(true);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                        style={{
                          borderColor: isDark ? 'rgba(59,130,246,0.35)' : '#BFDBFE',
                          backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : '#EFF6FF',
                          color: T.primary,
                        }}
                      >
                        <span>View All {allResources.length} Resources</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── THE 3 REMEDIATION METHODS SELECTOR (IaC Templates, CLI, Manual) ── */}
              <div
                className="rounded-2xl overflow-hidden flex flex-col"
                style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}
              >
                {/* 3 Tabs Bar */}
                <div className="p-3 border-b flex items-center justify-between flex-wrap gap-3" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : '#FAFBFD' }}>
                  <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9' }}>
                    <button
                      type="button"
                      onClick={() => setMethodTab('iac')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      style={{
                        backgroundColor: methodTab === 'iac' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                        color: methodTab === 'iac' ? T.primary : T.textSub,
                        boxShadow: methodTab === 'iac' ? T.shadow : 'none',
                      }}
                    >
                      <span>IaC Templates</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMethodTab('cli')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      style={{
                        backgroundColor: methodTab === 'cli' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                        color: methodTab === 'cli' ? T.primary : T.textSub,
                        boxShadow: methodTab === 'cli' ? T.shadow : 'none',
                      }}
                    >
                      <span>Cloud CLI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMethodTab('manual')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      style={{
                        backgroundColor: methodTab === 'manual' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                        color: methodTab === 'manual' ? T.primary : T.textSub,
                        boxShadow: methodTab === 'manual' ? T.shadow : 'none',
                      }}
                    >
                      <span>Manual Console Steps</span>
                    </button>
                  </div>

                  {methodTab === 'iac' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCreatePullRequest}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                        style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="6" y1="3" x2="6" y2="15" />
                          <circle cx="18" cy="6" r="3" />
                          <circle cx="6" cy="18" r="3" />
                          <path d="M18 9a9 9 0 0 1-9 9" />
                        </svg>
                        <span>Create Pull Request</span>
                      </button>
                    </div>
                  )}

                  {methodTab === 'cli' && (
                    <button
                      type="button"
                      onClick={handleCopyCli}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5"
                      style={{ borderColor: T.border, color: cliCopied ? T.success : T.textSub }}
                    >
                      <span>{cliCopied ? '✓ Copied CLI Script' : 'Copy CLI Command'}</span>
                    </button>
                  )}
                </div>

                {/* ── METHOD 1: IAC TEMPLATES ── */}
                {methodTab === 'iac' && (
                  <div className="p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-3 border-b pb-3" style={{ borderColor: T.border }}>
                      {/* Language switch */}
                      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9' }}>
                        <button
                          type="button"
                          onClick={() => setIacLanguage('tf')}
                          className="px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                          style={{
                            backgroundColor: iacLanguage === 'tf' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                            color: iacLanguage === 'tf' ? T.text : T.textSub,
                            boxShadow: iacLanguage === 'tf' ? T.shadow : 'none',
                          }}
                        >
                          Terraform (.tf)
                        </button>
                        <button
                          type="button"
                          onClick={() => setIacLanguage('cf')}
                          className="px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                          style={{
                            backgroundColor: iacLanguage === 'cf' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                            color: iacLanguage === 'cf' ? T.text : T.textSub,
                            boxShadow: iacLanguage === 'cf' ? T.shadow : 'none',
                          }}
                        >
                          CloudFormation (.yml)
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(checkData.iac[iacLanguage])}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer"
                          style={{ borderColor: T.border, color: copied ? T.success : T.textSub }}
                        >
                          {copied ? '✓ Copied' : 'Copy Template'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadCode(checkData.iac[iacLanguage], iacLanguage === 'tf' ? 'tf' : 'yml')}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer"
                          style={{ borderColor: T.border, color: T.textSub }}
                        >
                          ↓ Download {iacLanguage === 'tf' ? '.tf' : '.yml'}
                        </button>
                        <button
                          type="button"
                          onClick={handleSimulate}
                          disabled={simulating}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
                          style={{ backgroundColor: T.primary }}
                        >
                          {simulating ? 'Simulating…' : 'Simulate Plan'}
                        </button>
                      </div>
                    </div>

                    {/* Simulation Output Banner */}
                    {simulationSuccess && (
                      <div
                        className="p-4 rounded-xl border flex items-center justify-between gap-3 animate-fadeIn flex-wrap"
                        style={{
                          backgroundColor: isDark ? 'rgba(52,211,153,0.1)' : '#ECFDF5',
                          borderColor: isDark ? 'rgba(52,211,153,0.3)' : '#A7F3D0',
                          color: isDark ? '#6EE7B7' : '#065F46',
                        }}
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <span>Simulation Passed: 0 breaking changes detected. 100% compliant with WAFR standards.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCheckSolved(checkData.id)}
                          className="px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                          style={{
                            backgroundColor: solvedCheckIds[checkData.id]
                              ? (isDark ? 'rgba(52,211,153,0.25)' : '#D1FAE5')
                              : '#059669',
                            color: solvedCheckIds[checkData.id]
                              ? (isDark ? '#6EE7B7' : '#065F46')
                              : '#FFFFFF',
                          }}
                        >
                          {solvedCheckIds[checkData.id] ? '✓ Marked as Solved' : 'Mark as Solved'}
                        </button>
                      </div>
                    )}

                    {/* Code block */}
                    <div
                      className="p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed"
                      style={{
                        backgroundColor: isDark ? '#0A0E17' : '#0F172A',
                        color: '#E2E8F0',
                        border: `1px solid ${isDark ? '#1E293B' : '#334155'}`,
                      }}
                    >
                      <pre>{checkData.iac[iacLanguage]}</pre>
                    </div>
                  </div>
                )}

                {/* ── METHOD 2: USING CLI ── */}
                {methodTab === 'cli' && (
                  <div className="p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="text-sm font-bold" style={{ color: T.text }}>
                          Command Line Interface (CLI Script)
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                          {checkData.cli.explanation}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyCli}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-sm"
                        >
                          {cliCopied ? '✓ Copied' : 'Copy Script'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadCode(checkData.cli.command, 'sh')}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer"
                          style={{ borderColor: T.border, color: T.textSub }}
                        >
                          ↓ Download .sh
                        </button>
                      </div>
                    </div>

                    {/* CLI Code block */}
                    <div
                      className="p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed"
                      style={{
                        backgroundColor: isDark ? '#0A0E17' : '#0F172A',
                        color: '#E2E8F0',
                        border: `1px solid ${isDark ? '#1E293B' : '#334155'}`,
                      }}
                    >
                      <pre>{checkData.cli.command}</pre>
                    </div>
                  </div>
                )}

                {/* ── METHOD 3: MANUAL STEPS ── */}
                {methodTab === 'manual' && (
                  <div className="p-6 flex flex-col gap-4">
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: T.text }}>
                        Cloud Management Console Guided Steps
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                        Follow these step-by-step instructions inside the management console to remediate this finding.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      {checkData.manualSteps.map(step => (
                        <div
                          key={step.step}
                          className="p-4 rounded-xl border flex items-start gap-4 transition-all"
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : '#FFFFFF',
                            borderColor: T.border,
                          }}
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                            style={{
                              backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                              color: T.textSub,
                              border: `1px solid ${T.border}`,
                            }}
                          >
                            {step.step}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                              <div className="text-xs font-bold" style={{ color: T.text }}>
                                Step {step.step}: {step.title}
                              </div>
                              {step.consolePath && (
                                <span
                                  className="text-[11px] font-mono px-2 py-0.5 rounded"
                                  style={{
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                                    color: T.textSub,
                                  }}
                                >
                                  {step.consolePath}
                                </span>
                              )}
                            </div>
                            <div className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                              {step.instruction}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── GIT CONNECTION POPUP MODAL ── */}
        {isGitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: T.card,
                borderColor: T.border,
                color: T.text,
              }}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: T.border }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="6" y1="3" x2="6" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: T.text }}>
                      Git Repository Integration
                    </h3>
                    <p className="text-[11px]" style={{ color: T.textSub }}>
                      Connect your infrastructure repo to automate WAFR fixes
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFinishGitModal}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border transition-colors cursor-pointer"
                  style={{ borderColor: T.border, color: T.textSub }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body: STEP 1 - ASK FOR EXISTING REPO */}
              {gitModalStep === 'ask_repo' && (
                <div className="p-6 flex flex-col gap-4">
                  <div>
                    <h4 className="text-base font-bold" style={{ color: T.text }}>
                      Do you have an existing infra repo?
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: T.textSub }}>
                      Connect your existing Git codebase hosting Terraform, CloudFormation, or IaC definitions, or initialize a fresh repository for remediations.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setGitConfig(prev => ({ ...prev, hasExistingRepo: true }));
                        setGitModalStep('pat_form');
                      }}
                      className="p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer hover:border-blue-500 group"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                        borderColor: T.border,
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        ✓
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-2" style={{ color: T.text }}>
                          <span>Yes, I have an existing infra repo</span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-blue-500/10 text-blue-500">
                            Recommended
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: T.textSub }}>
                          Connect your GitHub repository (e.g. `acme-corp/terraform-aws-infrastructure`) to automatically open Pull Requests with targeted fixes.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setGitConfig(prev => ({ ...prev, hasExistingRepo: false }));
                        setGitModalStep('pat_form');
                      }}
                      className="p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer hover:border-blue-500 group"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                        borderColor: T.border,
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-500/10 text-slate-500 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        +
                      </div>
                      <div>
                        <div className="text-xs font-bold" style={{ color: T.text }}>
                          No, initialize a new infra repo
                        </div>
                        <p className="text-xs mt-1" style={{ color: T.textSub }}>
                          Create a dedicated repository to store and track all WAFR automated remediation templates.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Body: STEP 2 - GITHUB PAT & REPO FORM */}
              {gitModalStep === 'pat_form' && (
                <div className="p-6 flex flex-col gap-4">
                  <div>
                    <h4 className="text-base font-bold" style={{ color: T.text }}>
                      Connect via GitHub PAT
                    </h4>
                    <p className="text-xs mt-1" style={{ color: T.textSub }}>
                      Provide your GitHub Personal Access Token (PAT) with <code className="font-mono text-blue-500">repo</code> scope to enable code inspection and PR creation.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                        GitHub Personal Access Token (PAT) *
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPat ? 'text' : 'password'}
                          value={patInput}
                          onChange={e => {
                            setPatInput(e.target.value);
                            setPatError('');
                          }}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="w-full px-3.5 py-2 rounded-xl text-xs font-mono border outline-none transition-all"
                          style={{
                            backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
                            borderColor: patError ? '#E11D48' : T.border,
                            color: T.text,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPat(!showPat)}
                          className="absolute right-3 text-xs font-medium text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPat ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {patError && (
                        <p className="text-[11px] text-rose-500 mt-1 font-medium">{patError}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                        Repository Name (Owner/Repo)
                      </label>
                      <input
                        type="text"
                        value={repoInput}
                        onChange={e => setRepoInput(e.target.value)}
                        placeholder="acme-corp/terraform-aws-infrastructure"
                        className="w-full px-3.5 py-2 rounded-xl text-xs font-mono border outline-none transition-all"
                        style={{
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
                          borderColor: T.border,
                          color: T.text,
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                        Default Branch
                      </label>
                      <input
                        type="text"
                        value={branchInput}
                        onChange={e => setBranchInput(e.target.value)}
                        placeholder="main"
                        className="w-full px-3.5 py-2 rounded-xl text-xs font-mono border outline-none transition-all"
                        style={{
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
                          borderColor: T.border,
                          color: T.text,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPatInput('ghp_live983274982374982374982374');
                          setPatError('');
                        }}
                        className="text-xs font-semibold text-blue-500 hover:underline cursor-pointer"
                      >
                        Use Demo PAT
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setGitModalStep('ask_repo')}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
                          style={{ borderColor: T.border, color: T.textSub }}
                        >
                          ← Back
                        </button>
                        <button
                          type="button"
                          onClick={handleConnectGit}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm"
                        >
                          Connect & Verify
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Body: STEP 3 - VALIDATING */}
              {gitModalStep === 'validating' && (
                <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                  <div>
                    <h4 className="text-sm font-bold" style={{ color: T.text }}>
                      Verifying GitHub Authentication...
                    </h4>
                    <p className="text-xs mt-1" style={{ color: T.textSub }}>
                      Validating PAT permissions for <span className="font-mono">{repoInput}</span> on branch <span className="font-mono">{branchInput}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Modal Body: STEP 4 - SUCCESS */}
              {gitModalStep === 'connected_success' && (
                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="text-xs font-bold">Repository Connected Successfully</div>
                      <div className="text-[11px] opacity-90 font-mono">
                        {gitConfig.repoName} ({gitConfig.branch})
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                    Your Git repository is now linked. You can now browse assessments and generate automated remediation pull requests directly into your codebase.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: T.border }}>
                    <button
                      type="button"
                      onClick={handleFinishGitModal}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm"
                    >
                      Continue to Remediation
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PULL REQUEST CREATION MODAL ── */}
        {prModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full max-w-xl rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: T.card,
                borderColor: T.border,
                color: T.text,
              }}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: T.border }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="6" y1="3" x2="6" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: T.text }}>
                      Create Pull Request
                    </h3>
                    <p className="text-[11px]" style={{ color: T.textSub }}>
                      Target: <span className="font-mono text-blue-500">{gitConfig.repoName}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPrModalOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border transition-colors cursor-pointer"
                  style={{ borderColor: T.border, color: T.textSub }}
                >
                  ✕
                </button>
              </div>

              {prCreatedSuccess ? (
                <div className="p-6 flex flex-col gap-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Pull Request #42 Created on GitHub!
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        branch: wafr-fix/{checkData.id.toLowerCase()} → main
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                    The pull request contains complete Terraform configurations to resolve finding <span className="font-mono font-bold text-blue-500">{checkData.id}</span> with 0 breaking changes.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: T.border }}>
                    <button
                      type="button"
                      onClick={() => setPrModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                      PR Title
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`[WAFR Fix] ${checkData.title} (${checkData.id})`}
                      className="w-full px-3.5 py-2 rounded-xl text-xs font-medium border outline-none bg-slate-500/5"
                      style={{ borderColor: T.border, color: T.text }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                      New Branch Name
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`wafr-fix/${checkData.id.toLowerCase()}`}
                      className="w-full px-3.5 py-2 rounded-xl text-xs font-mono border outline-none bg-slate-500/5"
                      style={{ borderColor: T.border, color: T.text }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                      Changes to Commit (.tf)
                    </label>
                    <div
                      className="p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-36 leading-relaxed"
                      style={{
                        backgroundColor: isDark ? '#0A0E17' : '#0F172A',
                        color: '#6EE7B7',
                        border: `1px solid ${isDark ? '#1E293B' : '#334155'}`,
                      }}
                    >
                      <pre>+ {checkData.iac.tf.slice(0, 260)}...</pre>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: T.border }}>
                    <button
                      type="button"
                      onClick={() => setPrModalOpen(false)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
                      style={{ borderColor: T.border, color: T.textSub }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitPullRequest}
                      disabled={prSubmitting}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {prSubmitting ? 'Opening PR on GitHub...' : 'Confirm & Open PR'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── IMPACTED RESOURCES MODAL ── */}
        {resourcesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full max-w-3xl max-h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: T.card,
                borderColor: T.border,
                color: T.text,
              }}
            >
              <div
                className="px-6 py-4 border-b flex items-center justify-between shrink-0"
                style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#FAFBFD' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{
                      backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
                      color: T.primary,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold" style={{ color: T.text }}>
                        Impacted Resources
                      </h2>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#EFF6FF',
                          color: T.primary,
                        }}
                      >
                        {allResources.length} total
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: T.textSub }}>
                      Check: <span className="font-mono font-medium" style={{ color: T.primary }}>{checkData.id}</span> · {checkData.title}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setResourcesModalOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer border shrink-0 ml-2"
                  style={{ borderColor: T.border, color: T.textSub }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Search Bar */}
              <div
                className="p-4 border-b shrink-0 flex flex-col gap-2.5"
                style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : '#FFFFFF' }}
              >
                <input
                  type="text"
                  value={resourceSearch}
                  onChange={e => setResourceSearch(e.target.value)}
                  placeholder="Search resources by name, ARN, service, or region..."
                  className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none transition-all"
                  style={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
                    borderColor: T.border,
                    color: T.text,
                  }}
                />

                <div className="flex items-center justify-between text-xs px-1" style={{ color: T.textSub }}>
                  <span>Showing {filteredModalResources.length} of {allResources.length} resources</span>
                  {filteredModalResources.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopyAllArns(filteredModalResources)}
                      className="font-medium hover:underline cursor-pointer text-blue-500"
                    >
                      {copiedAllArns ? '✓ Copied All ARNs' : `Copy All (${filteredModalResources.length})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Modal Resources List */}
              <div className="p-4 flex-1 overflow-y-auto max-h-[55vh] flex flex-col gap-2">
                {filteredModalResources.map((res, i) => {
                  const isCopied = copiedArnId === `modal-${i}`;
                  return (
                    <div
                      key={i}
                      className="px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                        borderColor: T.border,
                      }}
                    >
                      <span className="font-mono text-xs break-all select-all flex-1" style={{ color: T.text }}>
                        {res}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyArn(res, `modal-${i}`)}
                        className="text-[11px] font-sans px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer"
                        style={{
                          borderColor: isCopied ? T.success : T.border,
                          color: isCopied ? T.success : T.textSub,
                        }}
                      >
                        {isCopied ? 'Copied' : 'Copy ARN'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div
                className="px-6 py-3.5 border-t flex items-center justify-end shrink-0"
                style={{ borderColor: T.border }}
              >
                <button
                  type="button"
                  onClick={() => setResourcesModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

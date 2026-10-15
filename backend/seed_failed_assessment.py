"""
Seed a comprehensive failed WAFR assessment with all necessary related data
(findings, remediations, resource inventory, milestones, compliance scores,
and remediation statuses) accessible by ANY user.
"""
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://127.0.0.1:27017"
DB_NAME = "wafr_db"

ASSESSMENT_ID = "A-FAIL-001"
CLOUD_ACCOUNT_ID = "124890123456"
ACCOUNT_NAME = "acme-production-us-east-1"
NOW = datetime.now(timezone.utc).isoformat()

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    print("Connecting to MongoDB wafr_db...")

    # 1. Cloud Account (global for all users)
    account_doc = {
        "id": CLOUD_ACCOUNT_ID,
        "cloud": "aws",
        "account_name": ACCOUNT_NAME,
        "account_identifier": CLOUD_ACCOUNT_ID,
        "auth_type": "role",
        "role_arn": f"arn:aws:iam::{CLOUD_ACCOUNT_ID}:role/CloudifyOpsWAFRReadOnlyRole",
        "default_region": "us-east-1",
        "status": "connected",
        "is_global": True,
        "user_id": "all",
        "org_id": "global",
        "last_connected_at": NOW,
        "created_at": NOW
    }
    await db["cloud_accounts"].update_one({"id": CLOUD_ACCOUNT_ID}, {"$set": account_doc}, upsert=True)
    print(f"[OK] Cloud Account {CLOUD_ACCOUNT_ID} seeded.")

    # 2. Failed Assessment
    assessment_doc = {
        "id": ASSESSMENT_ID,
        "name": "Production E-Commerce AWS Architecture Audit (Critical Failures)",
        "org_id": "global",
        "user_id": "all",
        "is_global": True,
        "cloud_account_id": CLOUD_ACCOUNT_ID,
        "account_name": ACCOUNT_NAME,
        "account_identifier": CLOUD_ACCOUNT_ID,
        "cloud": "aws",
        "region": "us-east-1",
        "lens": "aws-well-architected",
        "status": "FAIL",
        "score": 38,
        "checks_count": 46,
        "total_checks": 46,
        "passed_checks": 16,
        "failed_checks": 30,
        "total_best_practices": 16,
        "passed_bps": 4,
        "failed_bps": 12,
        "high_risks": 16,
        "medium_risks": 10,
        "low_risks": 4,
        "pillar_scores": {
            "security": 31,
            "reliability": 36,
            "cost": 48,
            "operations": 40,
            "performance": 37
        },
        "rerun_count": 1,
        "last_run_at": NOW,
        "created_at": NOW,
        "updated_at": NOW
    }
    await db["assessments"].update_one({"id": ASSESSMENT_ID}, {"$set": assessment_doc}, upsert=True)
    print(f"[OK] Failed Assessment {ASSESSMENT_ID} seeded (Score: 38%).")

    # 3. Failing Findings
    findings_list = [
        {
            "id": f"FND-{ASSESSMENT_ID}-SEC-001",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "SEC-001",
            "remediation_id": "REM-AWS-SEC-001",
            "cloud": "aws",
            "pillar_id": "security",
            "pillar": "Security",
            "severity": "critical",
            "title": "S3 Buckets publicly readable with SSE-S3 default encryption disabled",
            "description": "Production storage buckets containing financial archives and invoices are missing default server-side encryption and public access blocks.",
            "status": "fail",
            "effort": "Low Effort",
            "risk": "Critical Risk",
            "resources": [
                "arn:aws:s3:::acme-customer-billing-prod-us-east-1",
                "arn:aws:s3:::acme-database-backups-archive-9941",
                "arn:aws:s3:::acme-pii-uploads-unencrypted"
            ],
            "created_at": NOW,
            "updated_at": NOW
        },
        {
            "id": f"FND-{ASSESSMENT_ID}-SEC-002",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "SEC-002",
            "remediation_id": "REM-AWS-SEC-002",
            "cloud": "aws",
            "pillar_id": "security",
            "pillar": "Security",
            "severity": "critical",
            "title": "AWS IAM Root Account access keys active and MFA device unconfigured",
            "description": "The AWS root account has active access keys in use for automation, and multi-factor authentication is not enforced on root console login.",
            "status": "fail",
            "effort": "Low Effort",
            "risk": "Critical Risk",
            "resources": [
                f"arn:aws:iam::{CLOUD_ACCOUNT_ID}:root"
            ],
            "created_at": NOW,
            "updated_at": NOW
        },
        {
            "id": f"FND-{ASSESSMENT_ID}-REL-019",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "REL-019",
            "remediation_id": "REM-AWS-REL-019",
            "cloud": "aws",
            "pillar_id": "reliability",
            "pillar": "Reliability",
            "severity": "high",
            "title": "Application Load Balancer target group health check probe unconfigured",
            "description": "The primary Application Load Balancer target groups have overly permissive health check timeouts (30s) and route traffic to unhealthy EC2 instances.",
            "status": "fail",
            "effort": "Low Effort",
            "risk": "High Risk",
            "resources": [
                f"arn:aws:elasticloadbalancing:us-east-1:{CLOUD_ACCOUNT_ID}:loadbalancer/app/acme-prod-alb/9812489",
                f"arn:aws:elasticloadbalancing:us-east-1:{CLOUD_ACCOUNT_ID}:targetgroup/acme-api-tg/2948102"
            ],
            "created_at": NOW,
            "updated_at": NOW
        },
        {
            "id": f"FND-{ASSESSMENT_ID}-REL-001",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "REL-001",
            "remediation_id": "REM-AWS-REL-001",
            "cloud": "aws",
            "pillar_id": "reliability",
            "pillar": "Reliability",
            "severity": "high",
            "title": "Amazon RDS Aurora production cluster Multi-AZ standby replica disabled",
            "description": "Production database cluster operates in a single Availability Zone (us-east-1a) without an automatic failover standby instance in an alternate AZ.",
            "status": "fail",
            "effort": "Medium Effort",
            "risk": "High Risk",
            "resources": [
                f"arn:aws:rds:us-east-1:{CLOUD_ACCOUNT_ID}:cluster:aurora-prod-cluster-01",
                f"arn:aws:rds:us-east-1:{CLOUD_ACCOUNT_ID}:db:aurora-prod-instance-1"
            ],
            "created_at": NOW,
            "updated_at": NOW
        },
        {
            "id": f"FND-{ASSESSMENT_ID}-OPS-001",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "OPS-001",
            "remediation_id": "REM-AWS-OPS-001",
            "cloud": "aws",
            "pillar_id": "operations",
            "pillar": "Operational Excellence",
            "severity": "high",
            "title": "AWS CloudTrail Multi-Region logging and log integrity validation disabled",
            "description": "CloudTrail trail 'acme-audit-trail' only collects management events in us-east-1 and does not have cryptographic log file validation turned on.",
            "status": "fail",
            "effort": "Low Effort",
            "risk": "High Risk",
            "resources": [
                f"arn:aws:cloudtrail:us-east-1:{CLOUD_ACCOUNT_ID}:trail/acme-audit-trail"
            ],
            "created_at": NOW,
            "updated_at": NOW
        },
        {
            "id": f"FND-{ASSESSMENT_ID}-COST-001",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "COST-001",
            "remediation_id": "REM-AWS-COST-001",
            "cloud": "aws",
            "pillar_id": "cost",
            "pillar": "Cost Optimization",
            "severity": "medium",
            "title": "Unattached GP2 Elastic Block Store volumes and idle NAT Gateways",
            "description": "Unattached EBS storage volumes totaling 1.4 TB have been detached for > 30 days without snapshots, generating $140/mo in orphaned spend.",
            "status": "fail",
            "effort": "Low Effort",
            "risk": "Medium Risk",
            "resources": [
                f"arn:aws:ec2:us-east-1:{CLOUD_ACCOUNT_ID}:volume/vol-099418a8b174cb01",
                f"arn:aws:ec2:us-east-1:{CLOUD_ACCOUNT_ID}:volume/vol-0417bb892c9011af"
            ],
            "created_at": NOW,
            "updated_at": NOW
        },
        {
            "id": f"FND-{ASSESSMENT_ID}-PERF-001",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "PERF-001",
            "remediation_id": "REM-AWS-PERF-001",
            "cloud": "aws",
            "pillar_id": "performance",
            "pillar": "Performance Efficiency",
            "severity": "high",
            "title": "EC2 Auto Scaling Group maximum capacity reached without scale-in policy",
            "description": "Backend API Auto Scaling group has reached its maximum instance limit of 10 instances with CPU throttling exceeding 92% during peak hours.",
            "status": "fail",
            "effort": "Medium Effort",
            "risk": "High Risk",
            "resources": [
                f"arn:aws:autoscaling:us-east-1:{CLOUD_ACCOUNT_ID}:autoScalingGroup:9418:autoScalingGroupName/acme-api-asg"
            ],
            "created_at": NOW,
            "updated_at": NOW
        }
    ]

    for f in findings_list:
        await db["findings"].update_one({"id": f["id"]}, {"$set": f}, upsert=True)
    print(f"[OK] Seeded {len(findings_list)} failed findings for {ASSESSMENT_ID}.")

    # 4. Corresponding Remediations with Step-by-Step, CLI, and IaC (Terraform & CloudFormation)
    remediations_list = [
        {
            "id": "REM-AWS-SEC-001",
            "check_id": "SEC-001",
            "cloud": "aws",
            "pillar": "Security",
            "pillarId": "security",
            "severity": "critical",
            "title": "Enable S3 Block Public Access and AES-256 Default Server-Side Encryption",
            "effort": "Low Effort",
            "estTime": "10 min",
            "risk": "Critical Risk",
            "description": "Enforce bucket-level Block Public Access and configure KMS/AES-256 server-side encryption for all objects.",
            "rationale": "Unencrypted S3 buckets with permissive access policies can leak sensitive customer PII and violate GDPR/HIPAA standards.",
            "resources": [
                "arn:aws:s3:::acme-customer-billing-prod-us-east-1",
                "arn:aws:s3:::acme-database-backups-archive-9941",
                "arn:aws:s3:::acme-pii-uploads-unencrypted"
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Enable S3 Block Public Access",
                    "consolePath": "AWS Management Console -> Amazon S3 -> Buckets -> [Bucket Name] -> Permissions -> Block public access (bucket settings)",
                    "instruction": "Click 'Edit', check 'Block all public access', and confirm by typing 'confirm'."
                },
                {
                    "step": 2,
                    "title": "Enable Default Server-Side Encryption",
                    "consolePath": "Amazon S3 -> Buckets -> [Bucket Name] -> Properties -> Default encryption",
                    "instruction": "Click 'Edit', select 'Server-side encryption with Amazon S3 managed keys (SSE-S3)' or AWS KMS, and click 'Save changes'."
                }
            ],
            "cli": {
                "command": "aws s3api put-public-access-block \\\n  --bucket acme-customer-billing-prod-us-east-1 \\\n  --public-access-block-configuration \"BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true\"\n\naws s3api put-bucket-encryption \\\n  --bucket acme-customer-billing-prod-us-east-1 \\\n  --server-side-encryption-configuration '{\"Rules\": [{\"ApplyServerSideEncryptionByDefault\": {\"SSEAlgorithm\": \"AES256\"}}]}'",
                "explanation": "Applies a full public access block and turns on default AES-256 server-side encryption."
            },
            "iac": {
                "tf": """resource "aws_s3_bucket_public_access_block" "billing" {
  bucket = "acme-customer-billing-prod-us-east-1"

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "billing" {
  bucket = "acme-customer-billing-prod-us-east-1"

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}""",
                "cf": """Resources:
  BillingBucketPublicAccessBlock:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: acme-customer-billing-prod-us-east-1
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Sid: EnforceTLSRequestsOnly
            Effect: Deny
            Principal: '*'
            Action: 's3:*'
            Resource:
              - 'arn:aws:s3:::acme-customer-billing-prod-us-east-1'
              - 'arn:aws:s3:::acme-customer-billing-prod-us-east-1/*'
            Condition:
              Bool:
                'aws:SecureTransport': 'false'"""
            }
        },
        {
            "id": "REM-AWS-SEC-002",
            "check_id": "SEC-002",
            "cloud": "aws",
            "pillar": "Security",
            "pillarId": "security",
            "severity": "critical",
            "title": "Deactivate Root Access Keys and Enforce Virtual/Hardware MFA",
            "effort": "Low Effort",
            "estTime": "15 min",
            "risk": "Critical Risk",
            "description": "Delete all active programmatic access keys associated with the AWS account root user and activate MFA.",
            "rationale": "Root credentials have unrestricted access to all account resources and billing; compromise leads to full account takeover.",
            "resources": [
                f"arn:aws:iam::{CLOUD_ACCOUNT_ID}:root"
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Delete Root Access Keys",
                    "consolePath": "AWS Management Console -> IAM -> Security credentials -> Access keys",
                    "instruction": "Locate root access key ID and click 'Delete'. Replace any programmatic tasks with IAM roles or dedicated service principals."
                },
                {
                    "step": 2,
                    "title": "Enable Hardware or Virtual MFA",
                    "consolePath": "IAM -> Security credentials -> Multi-factor authentication (MFA)",
                    "instruction": "Click 'Assign MFA device', name device, scan QR code using Authenticator app, and enter consecutive codes."
                }
            ],
            "cli": {
                "command": f"aws iam list-access-keys\n# Note active root access key ID\naws iam delete-access-key --access-key-id AKIAEXAMPLEKEY",
                "explanation": "Enumerates and permanently removes programmatic root access keys."
            },
            "iac": {
                "tf": """# Root access keys cannot be managed via Terraform as a best practice.
# Enforce IAM Password & MFA Policy across all users:
resource "aws_iam_account_password_policy" "strict" {
  minimum_password_length        = 14
  require_lowercase_characters   = true
  require_numbers                = true
  require_uppercase_characters   = true
  require_symbols                = true
  allow_users_to_change_password = true
  max_password_age               = 90
  password_reuse_prevention      = 12
}""",
                "cf": """Resources:
  StrictPasswordPolicy:
    Type: AWS::IAM::AccountPasswordPolicy
    Properties:
      MinimumPasswordLength: 14
      RequireSymbols: true
      RequireNumbers: true
      RequireUppercaseCharacters: true
      RequireLowercaseCharacters: true"""
            }
        },
        {
            "id": "REM-AWS-REL-019",
            "check_id": "REL-019",
            "cloud": "aws",
            "pillar": "Reliability",
            "pillarId": "reliability",
            "severity": "high",
            "title": "Configure Tight Health Check Probes and Grace Periods on Target Group",
            "effort": "Low Effort",
            "estTime": "10 min",
            "risk": "High Risk",
            "description": "Reduce health check interval from 30s to 10s and timeout to 5s with 2 healthy threshold attempts.",
            "rationale": "Fast health check failure detection allows the ALB to stop routing requests to degraded instances before impacting end-users.",
            "resources": [
                f"arn:aws:elasticloadbalancing:us-east-1:{CLOUD_ACCOUNT_ID}:loadbalancer/app/acme-prod-alb/9812489",
                f"arn:aws:elasticloadbalancing:us-east-1:{CLOUD_ACCOUNT_ID}:targetgroup/acme-api-tg/2948102"
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Configure Target Group Health Check",
                    "consolePath": "EC2 -> Load Balancing -> Target Groups -> acme-api-tg -> Health checks -> Edit",
                    "instruction": "Set Health check path: /healthz, Interval: 10s, Timeout: 5s, Healthy threshold: 2, Unhealthy threshold: 2."
                }
            ],
            "cli": {
                "command": f"aws elbv2 modify-target-group \\\n  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:{CLOUD_ACCOUNT_ID}:targetgroup/acme-api-tg/2948102 \\\n  --health-check-path /healthz \\\n  --health-check-interval-seconds 10 \\\n  --health-check-timeout-seconds 5 \\\n  --healthy-threshold-count 2 \\\n  --unhealthy-threshold-count 2",
                "explanation": "Updates ALB target group with production-grade health check parameters."
            },
            "iac": {
                "tf": """resource "aws_lb_target_group" "api_tg" {
  name        = "acme-api-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = "vpc-09941a2"
  target_type = "instance"

  health_check {
    enabled             = true
    path                = "/healthz"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200"
  }
}""",
                "cf": """Resources:
  ApiTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: acme-api-tg
      Port: 80
      Protocol: HTTP
      VpcId: vpc-09941a2
      HealthCheckPath: /healthz
      HealthCheckIntervalSeconds: 10
      HealthCheckTimeoutSeconds: 5
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 2"""
            }
        },
        {
            "id": "REM-AWS-REL-001",
            "check_id": "REL-001",
            "cloud": "aws",
            "pillar": "Reliability",
            "pillarId": "reliability",
            "severity": "high",
            "title": "Provision Multi-AZ Aurora DB Replica for Automatic High Availability",
            "effort": "Medium Effort",
            "estTime": "20 min",
            "risk": "High Risk",
            "description": "Add an Amazon Aurora DB read-replica in us-east-1b or us-east-1c to serve as automatic failover target.",
            "rationale": "Single-AZ instances cannot survive datacenter power or networking outages, causing hours of database downtime.",
            "resources": [
                f"arn:aws:rds:us-east-1:{CLOUD_ACCOUNT_ID}:cluster:aurora-prod-cluster-01",
                f"arn:aws:rds:us-east-1:{CLOUD_ACCOUNT_ID}:db:aurora-prod-instance-1"
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Add Reader Instance in Separate AZ",
                    "consolePath": "RDS -> Databases -> aurora-prod-cluster-01 -> Actions -> Add reader",
                    "instruction": "Select availability zone 'us-east-1b', choose instance class db.r6g.large, and enable Multi-AZ deployment."
                }
            ],
            "cli": {
                "command": f"aws rds create-db-instance \\\n  --db-instance-identifier aurora-prod-instance-2 \\\n  --db-cluster-identifier aurora-prod-cluster-01 \\\n  --db-instance-class db.r6g.large \\\n  --engine aurora-postgresql \\\n  --availability-zone us-east-1b",
                "explanation": "Creates a secondary Aurora replica instance in an alternate AZ for sub-30s automated failover."
            },
            "iac": {
                "tf": """resource "aws_rds_cluster_instance" "cluster_instances" {
  count              = 2
  identifier         = "aurora-prod-instance-${count.index}"
  cluster_identifier = "aurora-prod-cluster-01"
  instance_class     = "db.r6g.large"
  engine             = "aurora-postgresql"
  publicly_accessible = false
}""",
                "cf": """Resources:
  AuroraInstance2:
    Type: AWS::RDS::DBInstance
    Properties:
      DBClusterIdentifier: aurora-prod-cluster-01
      DBInstanceIdentifier: aurora-prod-instance-2
      DBInstanceClass: db.r6g.large
      Engine: aurora-postgresql
      AvailabilityZone: us-east-1b"""
            }
        },
        {
            "id": "REM-AWS-OPS-001",
            "check_id": "OPS-001",
            "cloud": "aws",
            "pillar": "Operational Excellence",
            "pillarId": "operations",
            "severity": "high",
            "title": "Enable CloudTrail Multi-Region Trail and Cryptographic Log Integrity",
            "effort": "Low Effort",
            "estTime": "10 min",
            "risk": "High Risk",
            "description": "Ensure the primary trail records events in all AWS regions and generates cryptographic digest files.",
            "rationale": "Multi-region trails detect unauthorized infrastructure changes in unused regions and prevent log tampering by attackers.",
            "resources": [
                f"arn:aws:cloudtrail:us-east-1:{CLOUD_ACCOUNT_ID}:trail/acme-audit-trail"
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Update Trail Settings",
                    "consolePath": "CloudTrail -> Trails -> acme-audit-trail -> Edit",
                    "instruction": "Check 'Apply trail to all regions' and enable 'Enable log file validation'."
                }
            ],
            "cli": {
                "command": "aws cloudtrail update-trail \\\n  --name acme-audit-trail \\\n  --is-multi-region-trail \\\n  --enable-log-file-validation",
                "explanation": "Modifies CloudTrail to capture events globally across all AWS regions with SHA-256 digest validation."
            },
            "iac": {
                "tf": """resource "aws_cloudtrail" "main" {
  name                          = "acme-audit-trail"
  s3_bucket_name                = "acme-audit-logs-bucket"
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  include_global_service_events = true
}""",
                "cf": """Resources:
  AuditTrail:
    Type: AWS::CloudTrail::Trail
    Properties:
      TrailName: acme-audit-trail
      S3BucketName: acme-audit-logs-bucket
      IsMultiRegionTrail: true
      EnableLogFileValidation: true
      IncludeGlobalServiceEvents: true"""
            }
        },
        {
            "id": "REM-AWS-COST-001",
            "check_id": "COST-001",
            "cloud": "aws",
            "pillar": "Cost Optimization",
            "pillarId": "cost",
            "severity": "medium",
            "title": "Snapshot and Delete Detached Orphaned EBS Volumes",
            "effort": "Low Effort",
            "estTime": "5 min",
            "risk": "Medium Risk",
            "description": "Create final recovery snapshots for volumes detached > 30 days and terminate them to eliminate idle monthly charges.",
            "rationale": "Orphaned EBS volumes incur persistent hourly block storage charges despite being unattached to any EC2 instance.",
            "resources": [
                f"arn:aws:ec2:us-east-1:{CLOUD_ACCOUNT_ID}:volume/vol-099418a8b174cb01",
                f"arn:aws:ec2:us-east-1:{CLOUD_ACCOUNT_ID}:volume/vol-0417bb892c9011af"
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Create Snapshot and Delete Volume",
                    "consolePath": "EC2 -> Elastic Block Store -> Volumes -> Filter: Available",
                    "instruction": "Select available volumes, click Actions -> Create Snapshot, then Actions -> Delete Volume."
                }
            ],
            "cli": {
                "command": f"aws ec2 create-snapshot --volume-id vol-099418a8b174cb01 --description 'Final snapshot before decommission'\naws ec2 delete-volume --volume-id vol-099418a8b174cb01",
                "explanation": "Takes a point-in-time snapshot and removes the unused volume."
            },
            "iac": {
                "tf": """# Orphaned volumes should be removed from your Terraform manifests
# to allow Terraform to clean up the state:
# - Remove unused aws_ebs_volume blocks""",
                "cf": """# Remove orphaned AWS::EC2::Volume from CloudFormation stack templates"""
            }
        },
        {
            "id": "REM-AWS-PERF-001",
            "check_id": "PERF-001",
            "cloud": "aws",
            "pillar": "Performance Efficiency",
            "pillarId": "performance",
            "severity": "high",
            "title": "Increase Auto Scaling Maximum Capacity and Attach Target Tracking Policy",
            "effort": "Medium Effort",
            "estTime": "15 min",
            "risk": "High Risk",
            "description": "Raise Auto Scaling Group max capacity from 10 to 25 and configure dynamic target tracking at 70% average CPU.",
            "rationale": "Capping instances at 10 during traffic surges leads to queued requests, HTTP 504 gateway timeouts, and degraded user experience.",
            "resources": [
                f"arn:aws:autoscaling:us-east-1:{CLOUD_ACCOUNT_ID}:autoScalingGroup:9418:autoScalingGroupName/acme-api-asg"
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Adjust Group Capacity",
                    "consolePath": "EC2 -> Auto Scaling Groups -> acme-api-asg -> Details -> Edit",
                    "instruction": "Update Desired capacity: 6, Minimum: 3, Maximum: 25."
                },
                {
                    "step": 2,
                    "title": "Add Target Tracking Policy",
                    "consolePath": "Auto Scaling Groups -> acme-api-asg -> Automatic scaling -> Add policy",
                    "instruction": "Choose 'Target tracking scaling', Metric: Average CPU utilization, Target value: 70."
                }
            ],
            "cli": {
                "command": "aws autoscaling update-auto-scaling-group \\\n  --auto-scaling-group-name acme-api-asg \\\n  --max-size 25 \\\n  --desired-capacity 6",
                "explanation": "Increases ASG maximum capacity to allow dynamic scaling during peak surges."
            },
            "iac": {
                "tf": """resource "aws_autoscaling_group" "api" {
  name                = "acme-api-asg"
  max_size            = 25
  min_size            = 3
  desired_capacity    = 6
  vpc_zone_identifier = ["subnet-01124", "subnet-02235"]
}

resource "aws_autoscaling_policy" "cpu_target" {
  name                   = "target-tracking-cpu70"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 70.0
  }
}""",
                "cf": """Resources:
  AutoScalingGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    Properties:
      AutoScalingGroupName: acme-api-asg
      MaxSize: '25'
      MinSize: '3'
      DesiredCapacity: '6'"""
            }
        }
    ]

    for rem in remediations_list:
        await db["remediations"].update_one({"id": rem["id"]}, {"$set": rem}, upsert=True)
    print(f"[OK] Seeded {len(remediations_list)} comprehensive remediations.")

    # 5. Initial Remediation Statuses (all pending for this failed assessment)
    statuses_to_insert = []
    for f in findings_list:
        # Check-level status
        statuses_to_insert.append({
            "key": f"{ASSESSMENT_ID}::{f['check_id']}::__check_level__",
            "assessment_id": ASSESSMENT_ID,
            "check_id": f["check_id"],
            "resource_raw": "__check_level__",
            "status": "pending",
            "note": "Initial failing assessment state",
            "user_id": "all",
            "updated_at": NOW
        })
        for r in f.get("resources", []):
            statuses_to_insert.append({
                "key": f"{ASSESSMENT_ID}::{f['check_id']}::{r}",
                "assessment_id": ASSESSMENT_ID,
                "check_id": f["check_id"],
                "resource_raw": r,
                "status": "pending",
                "note": "Awaiting remediation fix",
                "user_id": "all",
                "updated_at": NOW
            })

    for s in statuses_to_insert:
        await db["remediation_statuses"].update_one({"key": s["key"]}, {"$set": s}, upsert=True)
    print(f"[OK] Seeded {len(statuses_to_insert)} pending remediation statuses.")

    # 6. Resource Inventory
    all_res = [
        {"id": "res-s3-01", "name": "acme-customer-billing-prod-us-east-1", "type": "AWS::S3::Bucket", "arn": "arn:aws:s3:::acme-customer-billing-prod-us-east-1", "cloud": "aws", "service": "s3", "assessment_id": ASSESSMENT_ID, "status": "non_compliant"},
        {"id": "res-s3-02", "name": "acme-database-backups-archive-9941", "type": "AWS::S3::Bucket", "arn": "arn:aws:s3:::acme-database-backups-archive-9941", "cloud": "aws", "service": "s3", "assessment_id": ASSESSMENT_ID, "status": "non_compliant"},
        {"id": "res-s3-03", "name": "acme-pii-uploads-unencrypted", "type": "AWS::S3::Bucket", "arn": "arn:aws:s3:::acme-pii-uploads-unencrypted", "cloud": "aws", "service": "s3", "assessment_id": ASSESSMENT_ID, "status": "non_compliant"},
        {"id": "res-iam-01", "name": "root-account", "type": "AWS::IAM::Root", "arn": f"arn:aws:iam::{CLOUD_ACCOUNT_ID}:root", "cloud": "aws", "service": "iam", "assessment_id": ASSESSMENT_ID, "status": "non_compliant"},
        {"id": "res-alb-01", "name": "acme-prod-alb", "type": "AWS::ElasticLoadBalancingV2::LoadBalancer", "arn": f"arn:aws:elasticloadbalancing:us-east-1:{CLOUD_ACCOUNT_ID}:loadbalancer/app/acme-prod-alb/9812489", "cloud": "aws", "service": "elbv2", "assessment_id": ASSESSMENT_ID, "status": "non_compliant"},
        {"id": "res-rds-01", "name": "aurora-prod-cluster-01", "type": "AWS::RDS::DBCluster", "arn": f"arn:aws:rds:us-east-1:{CLOUD_ACCOUNT_ID}:cluster:aurora-prod-cluster-01", "cloud": "aws", "service": "rds", "assessment_id": ASSESSMENT_ID, "status": "non_compliant"},
        {"id": "res-trail-01", "name": "acme-audit-trail", "type": "AWS::CloudTrail::Trail", "arn": f"arn:aws:cloudtrail:us-east-1:{CLOUD_ACCOUNT_ID}:trail/acme-audit-trail", "cloud": "aws", "service": "cloudtrail", "assessment_id": ASSESSMENT_ID, "status": "non_compliant"},
        {"id": "res-vol-01", "name": "vol-099418a8b174cb01", "type": "AWS::EC2::Volume", "arn": f"arn:aws:ec2:us-east-1:{CLOUD_ACCOUNT_ID}:volume/vol-099418a8b174cb01", "cloud": "aws", "service": "ec2", "assessment_id": ASSESSMENT_ID, "status": "non_compliant"},
        {"id": "res-asg-01", "name": "acme-api-asg", "type": "AWS::AutoScaling::AutoScalingGroup", "arn": f"arn:aws:autoscaling:us-east-1:{CLOUD_ACCOUNT_ID}:autoScalingGroup:9418:autoScalingGroupName/acme-api-asg", "cloud": "aws", "service": "autoscaling", "assessment_id": ASSESSMENT_ID, "status": "non_compliant"}
    ]
    for res in all_res:
        await db["resource_inventory"].update_one({"id": res["id"]}, {"$set": res}, upsert=True)
    print(f"[OK] Seeded {len(all_res)} resources in resource inventory.")

    # 7. Milestone Baseline (Score: 38%)
    milestone_doc = {
        "id": f"MLST-{ASSESSMENT_ID}-1",
        "assessment_id": ASSESSMENT_ID,
        "milestone_number": 1,
        "milestone_name": "Initial Baseline Architecture Review (Critical Failures)",
        "version": "v1.0.0",
        "recorded_at": "Today",
        "recorded_by": "Automated Cloud Scanner",
        "score": 38,
        "total_checks": 46,
        "passed_checks": 16,
        "failed_checks": 30,
        "high_risks": 16,
        "medium_risks": 10,
        "low_risks": 4,
        "total_best_practices": 16,
        "passed_bps": 4,
        "failed_bps": 12,
        "notes": "Comprehensive pre-remediation architecture scan failed critical security, reliability, and operations checks. Immediate automated fix required.",
        "pillar_scores": {
            "security": 31,
            "reliability": 36,
            "cost": 48,
            "operations": 40,
            "performance": 37
        },
        "created_at": NOW
    }
    await db["milestones"].update_one({"id": milestone_doc["id"]}, {"$set": milestone_doc}, upsert=True)
    print(f"[OK] Seeded initial milestone {milestone_doc['id']}.")

    # 8. Compliance Framework Scores reflecting failure
    compliance_scores = [
        {"assessment_id": ASSESSMENT_ID, "framework_id": "cis-8.1", "name": "CIS AWS Foundations Benchmark v1.4", "score": 34, "passing_controls": 18, "failing_controls": 34, "status": "failing"},
        {"assessment_id": ASSESSMENT_ID, "framework_id": "soc2-type2", "name": "SOC 2 Type II Security & Confidentiality", "score": 31, "passing_controls": 12, "failing_controls": 26, "status": "failing"},
        {"assessment_id": ASSESSMENT_ID, "framework_id": "fedramp-ksi", "name": "FedRAMP High Baseline (NIST SP 800-53)", "score": 28, "passing_controls": 22, "failing_controls": 56, "status": "failing"},
        {"assessment_id": ASSESSMENT_ID, "framework_id": "iso-27001", "name": "ISO/IEC 27001:2022 Information Security", "score": 39, "passing_controls": 15, "failing_controls": 23, "status": "failing"}
    ]
    for cs in compliance_scores:
        await db["assessment_compliance_scores"].update_one(
            {"assessment_id": ASSESSMENT_ID, "framework_id": cs["framework_id"]},
            {"$set": cs},
            upsert=True
        )
    print(f"[OK] Seeded compliance failure scores for {ASSESSMENT_ID}.")

    # 9. Alert Log
    alert_log = {
        "id": f"ALT-FAIL-{int(datetime.now().timestamp())}",
        "service": "wafr",
        "title": "AWS Architecture Audit Failed (Score: 38%)",
        "details": f"Automated inspection for {ACCOUNT_NAME} completed with 16 Critical/High risks. Remediation required.",
        "severity": "critical",
        "status": "delivered",
        "assessment_name": assessment_doc["name"],
        "timestamp": "Just now",
        "created_at": NOW
    }
    await db["alert_logs"].update_one({"id": alert_log["id"]}, {"$set": alert_log}, upsert=True)
    print(f"[OK] Seeded alert log {alert_log['id']}.")

    print(f"\n=======================================================")
    print(f" SUCCESS: Failed Assessment '{ASSESSMENT_ID}' and all related")
    print(f" data (findings, remediations, inventory, statuses, milestones)")
    print(f" successfully seeded into MongoDB 'wafr_db' for ANY user!")
    print(f"=======================================================\n")

if __name__ == "__main__":
    asyncio.run(seed())

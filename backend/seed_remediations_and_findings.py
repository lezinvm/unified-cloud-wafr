import os
import json
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wafr_db")

REMEDIATIONS = [
    # =========================================================================
    # AWS REMEDIATIONS
    # =========================================================================
    {
        "id": "REM-AWS-REL-019",
        "check_id": "REL-019",
        "cloud": "aws",
        "pillar": "Reliability",
        "pillarId": "reliability",
        "severity": "high",
        "title": "ALB target group missing active health check configuration",
        "effort": "Low Effort",
        "estTime": "15 min",
        "risk": "High Risk",
        "description": "Application Load Balancer target group prod-api-tg lacks an explicit health check endpoint, risking traffic routing to unhealthy backend targets.",
        "rationale": "Active health checks automatically detect application degradation and deregister unhealthy instances before user impact occurs.",
        "resources": [
            "arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-api-tg/a1b2c3d4e5f6",
            "arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-checkout-tg/f7e6d5c4b3a2",
            "arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-auth-tg/998877665544",
            "arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-payments-tg/332211445566",
            "arn:aws:elasticloadbalancing:us-east-1:124890123456:loadbalancer/app/prod-public-alb/50dc6c495c0c9188",
            "arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-search-tg/77aa88bb99cc",
            "arn:aws:ec2:us-east-1:124890123456:instance/i-0a1b2c3d4e5f67890",
            "arn:aws:ec2:us-east-1:124890123456:instance/i-0f9e8d7c6b5a43210"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Navigate to EC2 Target Groups in AWS Console",
                "consolePath": "EC2 Console -> Load Balancing -> Target Groups",
                "instruction": "Log into the AWS Management Console in region us-east-1, navigate to EC2 > Target Groups, and select 'prod-api-tg'."
            },
            {
                "step": 2,
                "title": "Open Health Checks Configuration Tab",
                "consolePath": "prod-api-tg -> Health checks tab -> Edit",
                "instruction": "Under the 'Health checks' tab, click 'Edit'. Ensure the Health check protocol is set to HTTP."
            },
            {
                "step": 3,
                "title": "Set Health Check Path and Status Matchers",
                "consolePath": "Health check path: /healthz | Success codes: 200",
                "instruction": "Enter '/healthz' as the Health check path. Set HTTP Success codes to '200'. Set Port to 'Traffic port'."
            },
            {
                "step": 4,
                "title": "Tune Health Check Timing Thresholds",
                "consolePath": "Interval: 15s | Timeout: 5s | Healthy: 3 | Unhealthy: 2",
                "instruction": "Set Health check interval to 15 seconds, Timeout to 5 seconds, Healthy threshold to 3 consecutive passes, and Unhealthy threshold to 2."
            },
            {
                "step": 5,
                "title": "Save and Verify Target Health",
                "consolePath": "prod-api-tg -> Targets tab",
                "instruction": "Click 'Save changes'. Navigate to the 'Targets' tab and verify all registered backend instances transition to 'Healthy' state."
            }
        ],
        "cli": {
            "command": "aws elbv2 modify-target-group \\\n  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:124890123456:targetgroup/prod-api-tg/a1b2c3d4e5f6 \\\n  --health-check-protocol HTTP \\\n  --health-check-port 80 \\\n  --health-check-path /healthz \\\n  --health-check-interval-seconds 15 \\\n  --health-check-timeout-seconds 5 \\\n  --healthy-threshold-count 3 \\\n  --unhealthy-threshold-count 2 \\\n  --matcher HttpCode=200",
            "explanation": "Executes an in-place configuration update against the ALB target group ARN, applying continuous HTTP /healthz probing every 15 seconds."
        },
        "iac": {
            "tf": "resource \"aws_lb_target_group\" \"prod_api\" {\n  name        = \"prod-api-tg\"\n  port        = 80\n  protocol    = \"HTTP\"\n  vpc_id      = var.vpc_id\n  target_type = \"instance\"\n\n  health_check {\n    enabled             = true\n    protocol            = \"HTTP\"\n    path                = \"/healthz\"\n    port                = \"traffic-port\"\n    interval            = 15\n    timeout             = 5\n    healthy_threshold   = 3\n    unhealthy_threshold = 2\n    matcher             = \"200\"\n  }\n\n  tags = {\n    Environment = \"production\"\n    ManagedBy   = \"Terraform\"\n  }\n}",
            "cf": "Type: AWS::ElasticLoadBalancingV2::TargetGroup\nProperties:\n  Name: prod-api-tg\n  Port: 80\n  Protocol: HTTP\n  VpcId: !Ref VPC\n  HealthCheckEnabled: true\n  HealthCheckProtocol: HTTP\n  HealthCheckPath: /healthz\n  HealthCheckIntervalSeconds: 15\n  HealthCheckTimeoutSeconds: 5\n  HealthyThresholdCount: 3\n  UnhealthyThresholdCount: 2\n  Matcher:\n    HttpCode: '200'"
        }
    },
    {
        "id": "REM-AWS-REL-301",
        "check_id": "REL-CHK-301",
        "cloud": "aws",
        "pillar": "Reliability",
        "pillarId": "reliability",
        "severity": "medium",
        "title": "SQS Dead Letter Queue (DLQ) missing for asynchronous order processing queue",
        "effort": "Low Effort",
        "estTime": "20 min",
        "risk": "High Risk",
        "description": "Standard SQS queue prod-order-processing lacks a redrive policy to route poison-pill messages to a Dead Letter Queue.",
        "rationale": "Without a DLQ, malformed messages loop endlessly through consumer workers, consuming compute and starving valid transactions.",
        "resources": [
            "arn:aws:sqs:us-east-1:124890123456:prod-order-processing",
            "arn:aws:sqs:us-east-1:124890123456:prod-email-notifications",
            "arn:aws:sqs:us-east-1:124890123456:prod-webhook-dispatcher"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Create SQS Dead Letter Queue in AWS Console",
                "consolePath": "SQS Console -> Create queue",
                "instruction": "Open SQS Console in us-east-1, click 'Create queue', select Standard queue, and name it 'prod-order-processing-dlq'."
            },
            {
                "step": 2,
                "title": "Set DLQ Retention Period",
                "consolePath": "prod-order-processing-dlq -> Configuration",
                "instruction": "Set Message retention period to 14 days to maximize triage window for malformed transactions."
            },
            {
                "step": 3,
                "title": "Configure Redrive Policy on Source Queue",
                "consolePath": "prod-order-processing -> Edit -> Dead-letter queue",
                "instruction": "Open source queue 'prod-order-processing', click Edit, enable Dead-letter queue, and select 'prod-order-processing-dlq'."
            },
            {
                "step": 4,
                "title": "Set Maximum Receives Threshold",
                "consolePath": "Maximum receives: 5",
                "instruction": "Set Maximum receives to 5 attempts before automatically isolating the poison payload."
            },
            {
                "step": 5,
                "title": "Save and Attach CloudWatch Alarm",
                "consolePath": "CloudWatch -> Alarms -> SQS ApproximateNumberOfMessagesVisible > 0",
                "instruction": "Save changes and verify CloudWatch alarm triggers on non-zero DLQ message depth."
            }
        ],
        "cli": {
            "command": "aws sqs set-queue-attributes \\\n  --queue-url https://sqs.us-east-1.amazonaws.com/124890123456/prod-order-processing \\\n  --attributes '{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"arn:aws:sqs:us-east-1:124890123456:prod-order-processing-dlq\\\",\\\"maxReceiveCount\\\":5}\"}'",
            "explanation": "Applies redrive policy targeting the companion dead letter queue ARN after 5 consecutive delivery failures."
        },
        "iac": {
            "tf": "resource \"aws_sqs_queue\" \"orders_dlq\" {\n  name                      = \"prod-order-processing-dlq\"\n  message_retention_seconds = 1209600 # 14 days\n}\n\nresource \"aws_sqs_queue\" \"orders\" {\n  name                      = \"prod-order-processing\"\n  redrive_policy = jsonencode({\n    deadLetterTargetArn = aws_sqs_queue.orders_dlq.arn\n    maxReceiveCount     = 5\n  })\n}",
            "cf": "Type: AWS::SQS::Queue\nProperties:\n  QueueName: prod-order-processing\n  RedrivePolicy:\n    deadLetterTargetArn: !GetAtt OrdersDLQ.Arn\n    maxReceiveCount: 5"
        }
    },
    {
        "id": "REM-AWS-SEC-047",
        "check_id": "SEC-047",
        "cloud": "aws",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "critical",
        "title": "IAM role with wildcard resource permission (*) on S3 and DynamoDB",
        "effort": "Medium Effort",
        "estTime": "30 min",
        "risk": "Critical Risk",
        "description": "IAM role app-backend-prod-role contains an inline policy granting Action: s3:* and dynamodb:* on Resource: * without conditions.",
        "rationale": "Wildcard access violates least-privilege principles, allowing an application compromise to pivot laterally across all accounts data stores.",
        "resources": [
            "arn:aws:iam::124890123456:role/app-backend-prod-role",
            "arn:aws:iam::124890123456:role/lambda-data-sync-exec-role",
            "arn:aws:iam::124890123456:policy/AppBackendDataWildcardPolicy"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Inspect IAM Role in AWS Console",
                "consolePath": "IAM Console -> Roles -> app-backend-prod-role",
                "instruction": "Open IAM Console, select 'app-backend-prod-role', and review permissions policies under the Permissions tab."
            },
            {
                "step": 2,
                "title": "Identify Overly Broad Wildcard Statements",
                "consolePath": "Permissions tab -> AppBackendDataWildcardPolicy -> JSON",
                "instruction": "Locate policy statement with 'Resource': '*' alongside 'Action': ['s3:*', 'dynamodb:*']."
            },
            {
                "step": 3,
                "title": "Scope Actions to Least Privilege",
                "consolePath": "Replace s3:* with specific verbs (s3:GetObject, s3:PutObject)",
                "instruction": "Narrow s3 actions down strictly to required operations: s3:GetObject, s3:PutObject, s3:ListBucket."
            },
            {
                "step": 4,
                "title": "Restrict Target Resource ARNs",
                "consolePath": "Resource: arn:aws:s3:::prod-app-assets/*",
                "instruction": "Restrict resource array strictly to target bucket ARNs and DynamoDB table ARNs."
            },
            {
                "step": 5,
                "title": "Apply and Run IAM Access Analyzer Validation",
                "consolePath": "Policy Editor -> Validate policy",
                "instruction": "Validate policy syntax using IAM Access Analyzer and confirm no security warnings remain."
            }
        ],
        "cli": {
            "command": "aws iam put-role-policy \\\n  --role-name app-backend-prod-role \\\n  --policy-name AppBackendDataScopedPolicy \\\n  --policy-document file://scoped-policy.json",
            "explanation": "Replaces the wildcard inline statement with a scoped policy limiting S3 and DynamoDB actions exclusively to designated production resource ARNs."
        },
        "iac": {
            "tf": "resource \"aws_iam_role_policy\" \"scoped_data_access\" {\n  name = \"AppBackendDataScopedPolicy\"\n  role = aws_iam_role.app_backend.id\n\n  policy = jsonencode({\n    Version = \"2012-10-17\"\n    Statement = [\n      {\n        Effect = \"Allow\"\n        Action = [\n          \"s3:GetObject\",\n          \"s3:PutObject\"\n        ]\n        Resource = \"${aws_s3_bucket.prod_assets.arn}/*\"\n      },\n      {\n        Effect = \"Allow\"\n        Action = [\n          \"dynamodb:GetItem\",\n          \"dynamodb:PutItem\",\n          \"dynamodb:UpdateItem\"\n        ]\n        Resource = aws_dynamodb_table.orders.arn\n      }\n    ]\n  })\n}",
            "cf": "Type: AWS::IAM::Policy\nProperties:\n  PolicyName: AppBackendDataScopedPolicy\n  Roles:\n    - app-backend-prod-role\n  PolicyDocument:\n    Statement:\n      - Effect: Allow\n        Action:\n          - s3:GetObject\n          - s3:PutObject\n        Resource: !Sub 'arn:aws:s3:::${AssetsBucket}/*'"
        }
    },
    {
        "id": "REM-AWS-SEC-061",
        "check_id": "SEC-061",
        "cloud": "aws",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "high",
        "title": "Security group allows open ingress 0.0.0.0/0 on port 22 (SSH)",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "Critical Risk",
        "description": "EC2 Security Group sg-0a1b2c3d4e5f67890 contains an inbound rule allowing TCP port 22 from CIDR 0.0.0.0/0 (the entire Internet).",
        "rationale": "Open management ports expose instances to automated brute-force attacks and zero-day SSH vulnerabilities. AWS Systems Manager Session Manager should be utilized instead.",
        "resources": [
            "arn:aws:ec2:us-east-1:124890123456:security-group/sg-0a1b2c3d4e5f67890",
            "arn:aws:ec2:us-east-1:124890123456:security-group/sg-0f9e8d7c6b5a43210"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open EC2 Security Groups in AWS Console",
                "consolePath": "EC2 Console -> Network & Security -> Security Groups",
                "instruction": "Open EC2 Console, search for security group 'sg-0a1b2c3d4e5f67890', and select it."
            },
            {
                "step": 2,
                "title": "Edit Inbound Rules",
                "consolePath": "Inbound rules tab -> Edit inbound rules",
                "instruction": "Select the Inbound rules tab and click 'Edit inbound rules'."
            },
            {
                "step": 3,
                "title": "Remove 0.0.0.0/0 SSH Rule",
                "consolePath": "Delete rule with Port 22 and Source 0.0.0.0/0",
                "instruction": "Click 'Delete' next to the rule specifying SSH (port 22) from Source '0.0.0.0/0' or '::/0'."
            },
            {
                "step": 4,
                "title": "Replace with Corporate VPN CIDR or SSM",
                "consolePath": "Source: Corporate VPN CIDR (10.0.0.0/16)",
                "instruction": "If direct SSH is required, restrict Source to specific trusted VPN bastion IP. Otherwise, rely on SSM Session Manager with no open inbound ports."
            },
            {
                "step": 5,
                "title": "Save Rules and Confirm Instance Connectivity",
                "consolePath": "Save rules -> Test via AWS Systems Manager Session Manager",
                "instruction": "Save rules and test connection via AWS Systems Manager Session Manager."
            }
        ],
        "cli": {
            "command": "aws ec2 revoke-security-group-ingress \\\n  --group-id sg-0a1b2c3d4e5f67890 \\\n  --protocol tcp \\\n  --port 22 \\\n  --cidr 0.0.0.0/0",
            "explanation": "Revokes the public IPv4 0.0.0.0/0 ingress authorization rule from the security group on TCP port 22."
        },
        "iac": {
            "tf": "resource \"aws_security_group\" \"bastion\" {\n  name        = \"bastion-sg\"\n  description = \"Restricted bastion security group\"\n  vpc_id      = var.vpc_id\n\n  # Restrict SSH strictly to internal VPN CIDR\n  ingress {\n    description = \"SSH from Corporate VPN\"\n    from_port   = 22\n    to_port     = 22\n    protocol    = \"tcp\"\n    cidr_blocks = [\"10.0.0.0/16\"]\n  }\n}",
            "cf": "Type: AWS::EC2::SecurityGroup\nProperties:\n  GroupDescription: Restricted bastion security group\n  VpcId: !Ref VPC\n  SecurityGroupIngress:\n    - IpProtocol: tcp\n      FromPort: 22\n      ToPort: 22\n      CidrIp: 10.0.0.0/16"
        }
    },
    {
        "id": "REM-AWS-SEC-024",
        "check_id": "SEC-024",
        "cloud": "aws",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "high",
        "title": "S3 buckets without default server-side encryption enabled",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "High Risk",
        "description": "S3 bucket prod-data-exports-9941 is not configured with default AWS KMS server-side encryption (SSE-KMS).",
        "rationale": "Default encryption with customer-managed keys ensures all objects written to the bucket are automatically encrypted at rest with audited key usage.",
        "resources": [
            "arn:aws:s3:::prod-data-exports-9941",
            "arn:aws:s3:::prod-analytics-raw-bucket"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Navigate to S3 Bucket Properties in AWS Console",
                "consolePath": "S3 Console -> Buckets -> prod-data-exports-9941 -> Properties",
                "instruction": "Open the Amazon S3 console, locate 'prod-data-exports-9941', and navigate to the Properties tab."
            },
            {
                "step": 2,
                "title": "Edit Default Encryption",
                "consolePath": "Default encryption -> Edit",
                "instruction": "Scroll down to 'Default encryption' and click 'Edit'."
            },
            {
                "step": 3,
                "title": "Select AWS KMS Key (SSE-KMS)",
                "consolePath": "Server-side encryption: AWS Key Management Service key (SSE-KMS)",
                "instruction": "Select 'AWS Key Management Service key (SSE-KMS)' and choose your KMS customer-managed key."
            },
            {
                "step": 4,
                "title": "Enable Bucket Key",
                "consolePath": "Bucket Key: Enable",
                "instruction": "Enable 'Bucket Key' to reduce AWS KMS request costs by up to 99%."
            },
            {
                "step": 5,
                "title": "Save Changes",
                "consolePath": "Save changes",
                "instruction": "Click 'Save changes' and verify that new uploads are encrypted with the specified key."
            }
        ],
        "cli": {
            "command": "aws s3api put-bucket-encryption \\\n  --bucket prod-data-exports-9941 \\\n  --server-side-encryption-configuration '{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"aws:kms\",\"KMSMasterKeyID\":\"arn:aws:kms:us-east-1:124890123456:key/1234abcd-12ab-34cd-56ef-1234567890ab\"},\"BucketKeyEnabled\":true}]}'",
            "explanation": "Enforces default SSE-KMS encryption with S3 Bucket Keys enabled on all newly written objects."
        },
        "iac": {
            "tf": "resource \"aws_s3_bucket_server_side_encryption_configuration\" \"prod_exports\" {\n  bucket = aws_s3_bucket.prod_exports.id\n\n  rule {\n    apply_server_side_encryption_by_default {\n      kms_master_key_id = aws_kms_key.s3_key.arn\n      sse_algorithm     = \"aws:kms\"\n    }\n    bucket_key_enabled = true\n  }\n}",
            "cf": "Type: AWS::S3::Bucket\nProperties:\n  BucketName: prod-data-exports-9941\n  BucketEncryption:\n    ServerSideEncryptionConfiguration:\n      - ServerSideEncryptionByDefault:\n          SSEAlgorithm: aws:kms\n          KMSMasterKeyId: !Ref KMSKey\n        BucketKeyEnabled: true"
        }
    },
    {
        "id": "REM-AWS-SEC-033",
        "check_id": "SEC-033",
        "cloud": "aws",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "medium",
        "title": "AWS KMS customer-managed key rotation is not enabled",
        "effort": "Low Effort",
        "estTime": "5 min",
        "risk": "Medium Risk",
        "description": "Customer managed KMS key 1234abcd-12ab-34cd-56ef-1234567890ab does not have automatic yearly key rotation enabled.",
        "rationale": "Automated key rotation replaces backing cryptographic keys annually without breaking existing ciphertexts or requiring manual re-encryption.",
        "resources": [
            "arn:aws:kms:us-east-1:124890123456:key/1234abcd-12ab-34cd-56ef-1234567890ab"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open KMS Console in AWS Management Console",
                "consolePath": "KMS Console -> Customer managed keys",
                "instruction": "Navigate to AWS Key Management Service (KMS) in us-east-1, select 'Customer managed keys'."
            },
            {
                "step": 2,
                "title": "Select Key and Open Key Rotation Tab",
                "consolePath": "Select key -> Key rotation tab",
                "instruction": "Click the KMS Key ID and open the 'Key rotation' tab."
            },
            {
                "step": 3,
                "title": "Enable Automatic Key Rotation",
                "consolePath": "Check 'Automatically rotate this KMS key every year'",
                "instruction": "Check the box for 'Automatically rotate this KMS key every year' and click Save."
            }
        ],
        "cli": {
            "command": "aws kms enable-key-rotation \\\n  --key-id arn:aws:kms:us-east-1:124890123456:key/1234abcd-12ab-34cd-56ef-1234567890ab",
            "explanation": "Enables annual automatic cryptographic backing rotation for the KMS key."
        },
        "iac": {
            "tf": "resource \"aws_kms_key\" \"main\" {\n  description             = \"Production data encryption key\"\n  enable_key_rotation     = true\n  deletion_window_in_days = 30\n}",
            "cf": "Type: AWS::KMS::Key\nProperties:\n  Description: Production data encryption key\n  EnableKeyRotation: true"
        }
    },
    {
        "id": "REM-AWS-COST-008",
        "check_id": "COST-008",
        "cloud": "aws",
        "pillar": "Cost Optimization",
        "pillarId": "cost",
        "severity": "medium",
        "title": "Idle unattached Amazon EBS volumes retaining billable provisioned capacity",
        "effort": "Low Effort",
        "estTime": "15 min",
        "risk": "Medium Risk",
        "description": "5 unattached gp3/io2 EBS volumes have remained unattached to any EC2 instance for over 14 days, generating redundant monthly charges.",
        "rationale": "Detached volumes continue billing provisioned GB storage and IOPS until snapshotted and removed.",
        "resources": [
            "arn:aws:ec2:us-east-1:124890123456:volume/vol-0987654321fedcba0",
            "arn:aws:ec2:us-east-1:124890123456:volume/vol-0123456789abcdef0"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Filter Available Volumes in EC2 Console",
                "consolePath": "EC2 Console -> Elastic Block Store -> Volumes -> Filter: State = Available",
                "instruction": "Navigate to EC2 > Volumes, filter by 'Volume state = available'."
            },
            {
                "step": 2,
                "title": "Create Snapshot Backup",
                "consolePath": "Actions -> Create snapshot",
                "instruction": "Select the unattached volume, click Actions > Create snapshot to preserve data."
            },
            {
                "step": 3,
                "title": "Delete Unattached Volume",
                "consolePath": "Actions -> Delete volume",
                "instruction": "Once the snapshot is complete, click Actions > Delete volume to eliminate charges."
            }
        ],
        "cli": {
            "command": "aws ec2 create-snapshot --volume-id vol-0987654321fedcba0 --description \"Pre-deletion backup\" && \\\naws ec2 delete-volume --volume-id vol-0987654321fedcba0",
            "explanation": "Takes a point-in-time snapshot of the orphan EBS volume, then safely deallocates the volume to stop billable provisioned storage charges."
        },
        "iac": {
            "tf": "# Remove unattached volume resources or apply lifecycle policy:\nresource \"aws_dlm_lifecycle_policy\" \"ebs_retention\" {\n  description        = \"Automated EBS cleanup\"\n  execution_role_arn = aws_iam_role.dlm.arn\n  state              = \"ENABLED\"\n  # ...\n}",
            "cf": "# Deallocate orphan AWS::EC2::Volume from CloudFormation stack"
        }
    },
    {
        "id": "REM-AWS-OPS-014",
        "check_id": "OPS-014",
        "cloud": "aws",
        "pillar": "Operational Excellence",
        "pillarId": "operational-excellence",
        "severity": "medium",
        "title": "CloudWatch log groups with indefinite (Never Expire) retention policies",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "Low Risk",
        "description": "High-volume CloudWatch log groups (/aws/lambda/checkout-service, /aws/ecs/api) retain raw events indefinitely.",
        "rationale": "Applying retention expirations (e.g., 30 or 90 days) alongside S3 glacier archiving significantly lowers ingest and storage expenses.",
        "resources": [
            "arn:aws:logs:us-east-1:124890123456:log-group:/aws/lambda/checkout-service:*",
            "arn:aws:logs:us-east-1:124890123456:log-group:/aws/ecs/api:*"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open CloudWatch Log Groups Console",
                "consolePath": "CloudWatch Console -> Logs -> Log groups",
                "instruction": "Navigate to CloudWatch > Log groups in us-east-1."
            },
            {
                "step": 2,
                "title": "Edit Retention Setting",
                "consolePath": "Actions -> Edit retention setting",
                "instruction": "Select the log group and click Actions > Edit retention setting."
            },
            {
                "step": 3,
                "title": "Set 90-Day Retention Window",
                "consolePath": "Retention: 90 days",
                "instruction": "Change retention from 'Never expire' to '90 days' and click Save."
            }
        ],
        "cli": {
            "command": "aws logs put-retention-policy \\\n  --log-group-name /aws/lambda/checkout-service \\\n  --retention-in-days 90",
            "explanation": "Applies a 90-day automatic expiration lifecycle to the target CloudWatch log group."
        },
        "iac": {
            "tf": "resource \"aws_cloudwatch_log_group\" \"app_logs\" {\n  name              = \"/aws/lambda/checkout-service\"\n  retention_in_days = 90\n}",
            "cf": "Type: AWS::Logs::LogGroup\nProperties:\n  LogGroupName: /aws/lambda/checkout-service\n  RetentionInDays: 90"
        }
    },
    {
        "id": "REM-AWS-PRF-201",
        "check_id": "PERF-CHK-201",
        "cloud": "aws",
        "pillar": "Performance Efficiency",
        "pillarId": "performance-efficiency",
        "severity": "medium",
        "title": "CloudFront distribution missing origin response caching policies",
        "effort": "Low Effort",
        "estTime": "15 min",
        "risk": "Medium Risk",
        "description": "CloudFront distribution E2A1B2C3D4E5 lacks an optimized cache policy on static asset behaviors, routing redundant GET requests to backend origins.",
        "rationale": "Edge caching maximizes CDN hit ratios, reduces origin server load, and drops average TTFB (Time to First Byte) under 40ms globally.",
        "resources": [
            "arn:aws:cloudfront::124890123456:distribution/E2A1B2C3D4E5"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open CloudFront Distributions in AWS Console",
                "consolePath": "CloudFront Console -> Distributions -> E2A1B2C3D4E5",
                "instruction": "Open the CloudFront console, select distribution 'E2A1B2C3D4E5', and open the Behaviors tab."
            },
            {
                "step": 2,
                "title": "Edit Default Cache Behavior",
                "consolePath": "Behaviors tab -> Edit default behavior",
                "instruction": "Select the default behavior (*) and click Edit."
            },
            {
                "step": 3,
                "title": "Attach Managed CachingOptimized Policy",
                "consolePath": "Cache key and origin requests -> Cache policy -> CachingOptimized",
                "instruction": "Under 'Cache key and origin requests', select 'Cache policy' and choose the AWS-managed 'CachingOptimized' policy."
            },
            {
                "step": 4,
                "title": "Save and Invalidate Distribution",
                "consolePath": "Save changes -> Invalidations tab -> Create invalidation",
                "instruction": "Save changes and execute an invalidation on /static/* to apply the edge policy."
            }
        ],
        "cli": {
            "command": "aws cloudfront update-distribution \\\n  --id E2A1B2C3D4E5 \\\n  --default-root-object index.html \\\n  --if-match E2QWRUHAPOMQ62",
            "explanation": "Updates the CloudFront distribution to enforce managed CachingOptimized edge policies."
        },
        "iac": {
            "tf": "resource \"aws_cloudfront_distribution\" \"cdn\" {\n  # ...\n  default_cache_behavior {\n    cache_policy_id = \"658327ea-f89d-4fab-a63d-7e88639e58f6\" # Managed-CachingOptimized\n    allowed_methods = [\"GET\", \"HEAD\", \"OPTIONS\"]\n    cached_methods  = [\"GET\", \"HEAD\"]\n    target_origin_id = \"S3-prod-assets\"\n    viewer_protocol_policy = \"redirect-to-https\"\n  }\n}",
            "cf": "Type: AWS::CloudFront::Distribution\nProperties:\n  DistributionConfig:\n    DefaultCacheBehavior:\n      CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6\n      TargetOriginId: S3-prod-assets\n      ViewerProtocolPolicy: redirect-to-https"
        }
    },

    # =========================================================================
    # AZURE REMEDIATIONS (Cloud: Azure)
    # =========================================================================
    {
        "id": "REM-AZ-REL-019",
        "check_id": "REL-019",
        "cloud": "azure",
        "pillar": "Reliability",
        "pillarId": "reliability",
        "severity": "high",
        "title": "Azure Application Gateway backend health probe unconfigured",
        "effort": "Low Effort",
        "estTime": "15 min",
        "risk": "High Risk",
        "description": "Azure Application Gateway 'appgw-prod-eastus' backend pool lacks custom HTTP/HTTPS health probes, risking traffic distribution to degraded backend Virtual Machine Scale Sets.",
        "rationale": "Custom health probes detect application-layer degradation (e.g. database disconnects, worker panics) and automatically remove failing nodes from incoming routing.",
        "resources": [
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Network/applicationGateways/appgw-prod-eastus",
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Network/loadBalancers/lb-backend-prod",
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Compute/virtualMachineScaleSets/vmss-api-prod"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Application Gateway in Azure Portal",
                "consolePath": "Azure Portal -> Application Gateways -> appgw-prod-eastus",
                "instruction": "In Azure Portal, navigate to Application Gateways and open 'appgw-prod-eastus'."
            },
            {
                "step": 2,
                "title": "Add Health Probe",
                "consolePath": "Settings -> Health probes -> + Add",
                "instruction": "Under Settings on the left blade, click 'Health probes' then '+ Add'."
            },
            {
                "step": 3,
                "title": "Configure Health Probe Parameters",
                "consolePath": "Protocol: HTTP | Path: /healthz | Interval: 15s | Timeout: 5s | Unhealthy: 3",
                "instruction": "Set Probe Name to 'probe-api-health', Protocol to 'HTTP', Path to '/healthz', Interval to 15 seconds, and Unhealthy threshold to 3."
            },
            {
                "step": 4,
                "title": "Associate with HTTP Settings",
                "consolePath": "Settings -> HTTP settings -> Select rule -> Enable Custom Probe",
                "instruction": "Open the Backend HTTP settings, select the custom health probe, and save."
            },
            {
                "step": 5,
                "title": "Verify Backend Health Status",
                "consolePath": "Monitoring -> Backend health",
                "instruction": "Check the 'Backend health' tab to confirm all backend pool instances report 'Healthy'."
            }
        ],
        "cli": {
            "command": "az network application-gateway probe create \\\n  --resource-group prod-rg \\\n  --gateway-name appgw-prod-eastus \\\n  --name probe-api-health \\\n  --protocol Http \\\n  --host-name-from-http-settings true \\\n  --path /healthz \\\n  --interval 15 \\\n  --timeout 5 \\\n  --threshold 3",
            "explanation": "Creates a dedicated HTTP health probe on /healthz for Azure Application Gateway with 15s interval."
        },
        "iac": {
            "tf": "resource \"azurerm_application_gateway\" \"appgw\" {\n  # ...\n  probe {\n    name                                      = \"probe-api-health\"\n    protocol                                  = \"Http\"\n    path                                      = \"/healthz\"\n    interval                                  = 15\n    timeout                                   = 5\n    unhealthy_threshold                       = 3\n    pick_host_name_from_backend_http_settings = true\n  }\n}",
            "cf": "# Azure Bicep:\nresource appGateway 'Microsoft.Network/applicationGateways@2022-07-01' = {\n  name: 'appgw-prod-eastus'\n  properties: {\n    probes: [{\n      name: 'probe-api-health'\n      properties: {\n        protocol: 'Http'\n        path: '/healthz'\n        interval: 15\n        timeout: 5\n        unhealthyThreshold: 3\n      }\n    }]\n  }\n}"
        }
    },
    {
        "id": "REM-AZ-REL-301",
        "check_id": "REL-CHK-301",
        "cloud": "azure",
        "pillar": "Reliability",
        "pillarId": "reliability",
        "severity": "medium",
        "title": "Azure Service Bus queue missing dead-lettering on message expiration",
        "effort": "Low Effort",
        "estTime": "15 min",
        "risk": "High Risk",
        "description": "Azure Service Bus queue 'orders-queue' in namespace 'sb-prod-eastus' has Dead Letter Queue disabled on message expiration and max delivery count.",
        "rationale": "Enabling dead-lettering isolates corrupted transactions, preventing consumer service deadlock and maintaining pipeline telemetry.",
        "resources": [
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.ServiceBus/namespaces/sb-prod-eastus/queues/orders-queue",
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.ServiceBus/namespaces/sb-prod-eastus/queues/notifications-queue"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Service Bus Namespace in Azure Portal",
                "consolePath": "Azure Portal -> Service Bus -> sb-prod-eastus -> Queues",
                "instruction": "Open the Service Bus namespace 'sb-prod-eastus' and select 'orders-queue'."
            },
            {
                "step": 2,
                "title": "Open Queue Configuration",
                "consolePath": "orders-queue -> Configuration",
                "instruction": "Navigate to Configuration under Settings on the left blade."
            },
            {
                "step": 3,
                "title": "Enable Dead Lettering on Expiration",
                "consolePath": "Check 'Enable dead lettering on message expiration'",
                "instruction": "Enable 'Dead lettering on message expiration' and set 'Max delivery count' to 5."
            },
            {
                "step": 4,
                "title": "Save Configuration",
                "consolePath": "Save changes",
                "instruction": "Click Save and confirm the redrive DLQ endpoint is activated."
            }
        ],
        "cli": {
            "command": "az servicebus queue update \\\n  --resource-group prod-rg \\\n  --namespace-name sb-prod-eastus \\\n  --name orders-queue \\\n  --enable-dead-lettering-on-message-expiration true \\\n  --max-delivery-count 5",
            "explanation": "Configures the Azure Service Bus queue to forward expired messages to its dead-letter queue after 5 failed delivery attempts."
        },
        "iac": {
            "tf": "resource \"azurerm_servicebus_queue\" \"orders\" {\n  name                                 = \"orders-queue\"\n  namespace_id                         = azurerm_servicebus_namespace.prod.id\n  enable_batched_operations            = true\n  dead_lettering_on_message_expiration = true\n  max_delivery_count                   = 5\n}",
            "cf": "# Azure Bicep:\nresource sbQueue 'Microsoft.ServiceBus/namespaces/queues@2021-11-01' = {\n  name: 'orders-queue'\n  properties: {\n    deadLetteringOnMessageExpiration: true\n    maxDeliveryCount: 5\n  }\n}"
        }
    },
    {
        "id": "REM-AZ-SEC-047",
        "check_id": "SEC-047",
        "cloud": "azure",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "critical",
        "title": "Azure Managed Identity assigned wildcard Owner/Contributor RBAC permissions",
        "effort": "Medium Effort",
        "estTime": "25 min",
        "risk": "Critical Risk",
        "description": "User-assigned Managed Identity 'id-prod-app' has been assigned the 'Contributor' role at the Resource Group scope.",
        "rationale": "Over-privileged Managed Identities allow an attacker with code execution on compute to create, modify, or exfiltrate all neighboring cloud resources.",
        "resources": [
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/id-prod-app",
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Authorization/roleAssignments/ra-contributor-001"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Access Control (IAM) on Resource Group",
                "consolePath": "Azure Portal -> Resource Groups -> prod-rg -> Access control (IAM)",
                "instruction": "Navigate to the 'prod-rg' resource group and select Access control (IAM)."
            },
            {
                "step": 2,
                "title": "Inspect Role Assignments",
                "consolePath": "Role assignments tab -> Filter by: Managed Identity",
                "instruction": "Open the 'Role assignments' tab and filter by Managed Identity 'id-prod-app'."
            },
            {
                "step": 3,
                "title": "Remove Contributor Role",
                "consolePath": "Select Contributor assignment -> Remove",
                "instruction": "Locate the Contributor assignment and click 'Remove'."
            },
            {
                "step": 4,
                "title": "Assign Least-Privilege Built-in Role",
                "consolePath": "+ Add -> Add role assignment -> Storage Blob Data Contributor",
                "instruction": "Assign granular roles such as 'Storage Blob Data Contributor' strictly on the designated Storage Account."
            }
        ],
        "cli": {
            "command": "az role assignment delete \\\n  --assignee 12345678-abcd-ef01-2345-6789abcdef01 \\\n  --role Contributor \\\n  --resource-group prod-rg",
            "explanation": "Removes the overly broad Contributor role assignment from the Azure Managed Identity."
        },
        "iac": {
            "tf": "resource \"azurerm_role_assignment\" \"storage_access\" {\n  scope                = azurerm_storage_account.prod.id\n  role_definition_name = \"Storage Blob Data Contributor\"\n  principal_id         = azurerm_user_assigned_identity.app.principal_id\n}",
            "cf": "# Azure Bicep:\nresource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {\n  name: guid(storageAccount.id, 'StorageBlobDataContributor', managedIdentity.id)\n  scope: storageAccount\n  properties: {\n    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')\n    principalId: managedIdentity.properties.principalId\n  }\n}"
        }
    },
    {
        "id": "REM-AZ-SEC-061",
        "check_id": "SEC-061",
        "cloud": "azure",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "high",
        "title": "Network Security Group (NSG) allows inbound SSH (port 22) from Any (0.0.0.0/0)",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "Critical Risk",
        "description": "Azure Network Security Group 'nsg-prod-vmss' contains an inbound security rule allowing TCP port 22 from Source 'Internet' / '*' without IP restriction.",
        "rationale": "Exposing management ports directly to the Internet makes VMs vulnerable to dictionary attacks. Azure Bastion or VPN gateways should be utilized.",
        "resources": [
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Network/networkSecurityGroups/nsg-prod-vmss",
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Network/networkSecurityGroups/nsg-bastion"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Network Security Group in Azure Portal",
                "consolePath": "Azure Portal -> Network security groups -> nsg-prod-vmss",
                "instruction": "In Azure Portal, open the NSG 'nsg-prod-vmss'."
            },
            {
                "step": 2,
                "title": "View Inbound Security Rules",
                "consolePath": "Settings -> Inbound security rules",
                "instruction": "Click 'Inbound security rules' under Settings on the left blade."
            },
            {
                "step": 3,
                "title": "Delete Open Port 22 Rule",
                "consolePath": "Locate rule with Port 22 and Source Any/Internet -> Delete",
                "instruction": "Find the rule named 'Allow-SSH-Internet' with Destination port 22 and Source Any, and click Delete."
            },
            {
                "step": 4,
                "title": "Configure Azure Bastion Subnet or VPN Ingress",
                "consolePath": "+ Add -> Source: AzureBastionSubnet -> Destination: 22 -> Action: Allow",
                "instruction": "If administrative SSH access is required, deploy Azure Bastion and allow ingress strictly from the AzureBastionSubnet CIDR."
            }
        ],
        "cli": {
            "command": "az network nsg rule delete \\\n  --resource-group prod-rg \\\n  --nsg-name nsg-prod-vmss \\\n  --name Allow-SSH-Internet",
            "explanation": "Removes the open Internet port 22 inbound rule from the Azure Network Security Group."
        },
        "iac": {
            "tf": "resource \"azurerm_network_security_rule\" \"ssh_bastion_only\" {\n  name                        = \"Allow-SSH-From-Bastion\"\n  priority                    = 100\n  direction                   = \"Inbound\"\n  access                      = \"Allow\"\n  protocol                    = \"Tcp\"\n  source_port_range           = \"*\"\n  destination_port_range      = \"22\"\n  source_address_prefix       = \"10.0.1.0/24\" # AzureBastionSubnet\n  destination_address_prefix  = \"*\"\n  resource_group_name         = \"prod-rg\"\n  network_security_group_name = \"nsg-prod-vmss\"\n}",
            "cf": "# Azure Bicep:\nresource nsgRule 'Microsoft.Network/networkSecurityGroups/securityRules@2022-07-01' = {\n  name: 'nsg-prod-vmss/Allow-SSH-From-Bastion'\n  properties: {\n    priority: 100\n    direction: 'Inbound'\n    access: 'Allow'\n    protocol: 'Tcp'\n    sourcePortRange: '*'\n    destinationPortRange: '22'\n    sourceAddressPrefix: '10.0.1.0/24'\n    destinationAddressPrefix: '*'\n  }\n}"
        }
    },
    {
        "id": "REM-AZ-SEC-024",
        "check_id": "SEC-024",
        "cloud": "azure",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "high",
        "title": "Azure Storage Account blob containers allow anonymous public read access",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "High Risk",
        "description": "Storage Account 'stprodeastus01' has 'Allow Blob public access' set to Enabled, risking unauthenticated data exposure.",
        "rationale": "Disabling public read access at the storage account level blocks anonymous requests even if container ACLs are misconfigured.",
        "resources": [
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Storage/storageAccounts/stprodeastus01",
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Storage/storageAccounts/stanalyticsdata01"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Storage Account in Azure Portal",
                "consolePath": "Azure Portal -> Storage accounts -> stprodeastus01",
                "instruction": "Open Storage account 'stprodeastus01' in Azure Portal."
            },
            {
                "step": 2,
                "title": "Open Configuration Blade",
                "consolePath": "Settings -> Configuration",
                "instruction": "Under Settings on the left blade, click Configuration."
            },
            {
                "step": 3,
                "title": "Disable Blob Public Access",
                "consolePath": "Allow Blob public access: Disabled",
                "instruction": "Set 'Allow Blob public access' to 'Disabled' and enforce minimum TLS version to 1.2."
            },
            {
                "step": 4,
                "title": "Save Settings",
                "consolePath": "Save changes",
                "instruction": "Click Save to enforce tenant-wide private container isolation."
            }
        ],
        "cli": {
            "command": "az storage account update \\\n  --name stprodeastus01 \\\n  --resource-group prod-rg \\\n  --allow-blob-public-access false \\\n  --min-tls-version TLS1_2",
            "explanation": "Disables anonymous blob public access and enforces TLS 1.2 across the Azure Storage Account."
        },
        "iac": {
            "tf": "resource \"azurerm_storage_account\" \"prod\" {\n  name                     = \"stprodeastus01\"\n  resource_group_name      = \"prod-rg\"\n  location                 = \"eastus\"\n  account_tier             = \"Standard\"\n  account_replication_type = \"GRS\"\n  allow_nested_items_to_be_public = false\n  min_tls_version          = \"TLS1_2\"\n}",
            "cf": "# Azure Bicep:\nresource storage 'Microsoft.Storage/storageAccounts@2022-09-01' = {\n  name: 'stprodeastus01'\n  properties: {\n    allowBlobPublicAccess: false\n    minimumTlsVersion: 'TLS1_2'\n  }\n}"
        }
    },
    {
        "id": "REM-AZ-SEC-033",
        "check_id": "SEC-033",
        "cloud": "azure",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "medium",
        "title": "Azure Key Vault automated key rotation policy is not enabled",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "Medium Risk",
        "description": "Cryptographic key 'prod-db-encryption-key' in Key Vault 'kv-prod-eastus' has no automated rotation policy configured.",
        "rationale": "Automated key rotation regularly changes the cryptographic key material without modifying the key identifier, satisfying SOC2 and ISO compliance.",
        "resources": [
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.KeyVault/vaults/kv-prod-eastus/keys/prod-db-encryption-key"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Key Vault in Azure Portal",
                "consolePath": "Azure Portal -> Key vaults -> kv-prod-eastus -> Keys",
                "instruction": "Navigate to Key Vault 'kv-prod-eastus' and select 'Keys'."
            },
            {
                "step": 2,
                "title": "Open Key Rotation Policy",
                "consolePath": "Select key -> Rotation policy button",
                "instruction": "Click 'prod-db-encryption-key' and click 'Rotation policy' in the top toolbar."
            },
            {
                "step": 3,
                "title": "Configure Rotation Interval",
                "consolePath": "Lifetime Actions: Rotate every 365 days | Notify 30 days before",
                "instruction": "Enable 'Automatically rotate key', set rotation cycle to 12 months, and save."
            }
        ],
        "cli": {
            "command": "az keyvault key rotation-policy update \\\n  --vault-name kv-prod-eastus \\\n  --name prod-db-encryption-key \\\n  --value policy.json",
            "explanation": "Enforces an automated annual rotation schedule on the Key Vault cryptographic key."
        },
        "iac": {
            "tf": "resource \"azurerm_key_vault_key\" \"db_key\" {\n  name         = \"prod-db-encryption-key\"\n  key_vault_id = azurerm_key_vault.prod.id\n  key_type     = \"RSA\"\n  key_size     = 4096\n\n  rotation_policy {\n    automatic {\n      time_after_creation = \"P365D\"\n    }\n    notify_before_expiry = \"P30D\"\n  }\n}",
            "cf": "# Azure Bicep:\nresource kvKey 'Microsoft.KeyVault/vaults/keys@2022-07-01' = {\n  name: 'kv-prod-eastus/prod-db-encryption-key'\n  properties: {\n    rotationPolicy: {\n      lifetimeActions: [{\n        action: { type: 'Rotate' }\n        trigger: { timeAfterCreate: 'P365D' }\n      }]\n    }\n  }\n}"
        }
    },
    {
        "id": "REM-AZ-COST-008",
        "check_id": "COST-008",
        "cloud": "azure",
        "pillar": "Cost Optimization",
        "pillarId": "cost",
        "severity": "medium",
        "title": "Unattached Azure Managed Disks incurring unallocated storage charges",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "Medium Risk",
        "description": "4 Premium SSD managed disks (1024 GB each) in 'prod-rg' have remained unattached to any VM for over 30 days.",
        "rationale": "Detached Azure Managed Disks continue generating monthly provisioned disk fees regardless of allocation state.",
        "resources": [
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Compute/disks/disk-legacy-data-01",
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Compute/disks/disk-legacy-data-02"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Disks Blade in Azure Portal",
                "consolePath": "Azure Portal -> Disks -> Filter: Managed disk status = Unattached",
                "instruction": "Search for 'Disks' in Azure Portal, filter by 'Owner == unattached'."
            },
            {
                "step": 2,
                "title": "Take Disk Snapshot for Archival",
                "consolePath": "Select disk -> + Create snapshot",
                "instruction": "Select disk 'disk-legacy-data-01' and create a Standard HDD snapshot for archival."
            },
            {
                "step": 3,
                "title": "Delete Unattached Managed Disk",
                "consolePath": "Delete disk button",
                "instruction": "Click Delete once the snapshot is verified to immediately stop monthly charges."
            }
        ],
        "cli": {
            "command": "az snapshot create --resource-group prod-rg --name snap-disk-backup --source disk-legacy-data-01 && \\\naz disk delete --resource-group prod-rg --name disk-legacy-data-01 --yes",
            "explanation": "Creates a snapshot backup and deallocates the unattached Azure Managed Disk."
        },
        "iac": {
            "tf": "# Delete unattached disk resource from Terraform state:\n# terraform destroy -target=azurerm_managed_disk.legacy_data",
            "cf": "# Remove disk resource from Bicep/ARM template"
        }
    },
    {
        "id": "REM-AZ-OPS-014",
        "check_id": "OPS-014",
        "cloud": "azure",
        "pillar": "Operational Excellence",
        "pillarId": "operational-excellence",
        "severity": "medium",
        "title": "Azure Monitor Diagnostic Settings not streaming Activity and Security logs to Log Analytics",
        "effort": "Low Effort",
        "estTime": "15 min",
        "risk": "Low Risk",
        "description": "Production Key Vault and SQL Database lack diagnostic settings streaming telemetry to Azure Log Analytics.",
        "rationale": "Centralizing platform logs in Log Analytics enables automated security alerts, audit trails, and automated remediation queries.",
        "resources": [
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.KeyVault/vaults/kv-prod-eastus",
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Sql/servers/sql-prod-eastus"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Resource Diagnostic Settings in Azure Portal",
                "consolePath": "Resource -> Monitoring -> Diagnostic settings -> + Add diagnostic setting",
                "instruction": "Navigate to Key Vault 'kv-prod-eastus', open 'Diagnostic settings', click '+ Add diagnostic setting'."
            },
            {
                "step": 2,
                "title": "Select Audit Categories and Log Analytics Destination",
                "consolePath": "Check: AuditEvent | Send to Log Analytics workspace",
                "instruction": "Select 'allLogs', check 'Send to Log Analytics workspace', and choose 'law-prod-eastus'."
            },
            {
                "step": 3,
                "title": "Save Setting",
                "consolePath": "Save",
                "instruction": "Click Save to initiate real-time telemetry streaming."
            }
        ],
        "cli": {
            "command": "az monitor diagnostic-settings create \\\n  --resource /subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.KeyVault/vaults/kv-prod-eastus \\\n  --name to-log-analytics \\\n  --workspace /subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.OperationalInsights/workspaces/law-prod-eastus \\\n  --logs '[{\"categoryGroup\":\"allLogs\",\"enabled\":true}]'",
            "explanation": "Creates diagnostic settings streaming all audit logs to the primary Log Analytics workspace."
        },
        "iac": {
            "tf": "resource \"azurerm_monitor_diagnostic_setting\" \"kv_logs\" {\n  name                       = \"to-log-analytics\"\n  target_resource_id         = azurerm_key_vault.prod.id\n  log_analytics_workspace_id = azurerm_log_analytics_workspace.prod.id\n\n  enabled_log {\n    category_group = \"allLogs\"\n  }\n}",
            "cf": "# Azure Bicep:\nresource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {\n  name: 'to-log-analytics'\n  scope: keyVault\n  properties: {\n    workspaceId: logAnalyticsWorkspace.id\n    logs: [{ categoryGroup: 'allLogs', enabled: true }]\n  }\n}"
        }
    },
    {
        "id": "REM-AZ-PRF-201",
        "check_id": "PERF-CHK-201",
        "cloud": "azure",
        "pillar": "Performance Efficiency",
        "pillarId": "performance-efficiency",
        "severity": "medium",
        "title": "Azure Front Door / CDN endpoint missing origin caching and compression policies",
        "effort": "Low Effort",
        "estTime": "15 min",
        "risk": "Medium Risk",
        "description": "Azure Front Door Standard endpoint 'afd-prod-eastus' routes static assets without enabling edge compression and caching rules.",
        "rationale": "Edge compression (Brotli/Gzip) reduces outbound egress bandwidth by 65% and cuts client response times across global geos.",
        "resources": [
            "/subscriptions/sub-4891-2394/resourceGroups/prod-rg/providers/Microsoft.Cdn/profiles/afd-prod-eastus"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Front Door Profile in Azure Portal",
                "consolePath": "Azure Portal -> Front Door and CDN profiles -> afd-prod-eastus",
                "instruction": "Open Azure Front Door profile 'afd-prod-eastus' and select 'Rule set' or 'Endpoints'."
            },
            {
                "step": 2,
                "title": "Enable Caching and Compression on Route",
                "consolePath": "Routing rules -> Enable Caching & Enable Compression",
                "instruction": "Edit the default route, enable Caching, set Query string caching behavior to 'Ignore query string', and enable Compression."
            },
            {
                "step": 3,
                "title": "Save Configuration",
                "consolePath": "Save changes",
                "instruction": "Click Save and verify Front Door edge cache headers (X-Cache: HIT) on test requests."
            }
        ],
        "cli": {
            "command": "az afd route update \\\n  --resource-group prod-rg \\\n  --profile-name afd-prod-eastus \\\n  --endpoint-name ep-prod \\\n  --route-name default-route \\\n  --enable-caching true \\\n  --enable-compression true",
            "explanation": "Enables edge caching and content compression on the Azure Front Door route."
        },
        "iac": {
            "tf": "resource \"azurerm_cdn_frontdoor_route\" \"default\" {\n  name                   = \"default-route\"\n  endpoint_id            = azurerm_cdn_frontdoor_endpoint.prod.id\n  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.prod.id\n  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.app.id]\n  enabled                = true\n  patterns_to_match      = [\"/*\"]\n  supported_protocols    = [\"Http\", \"Https\"]\n\n  cache {\n    query_string_caching_behavior = \"IgnoreQueryString\"\n    compression_enabled           = true\n    content_types_to_compress     = [\"text/html\", \"application/json\", \"text/css\", \"application/javascript\"]\n  }\n}",
            "cf": "# Azure Bicep:\nresource route 'Microsoft.Cdn/profiles/afdEndpoints/routes@2022-11-01-preview' = {\n  name: 'default-route'\n  properties: {\n    cacheConfiguration: {\n      queryStringCachingBehavior: 'IgnoreQueryString'\n      compressionSettings: { isCompressionEnabled: true }\n    }\n  }\n}"
        }
    },

    # =========================================================================
    # GCP REMEDIATIONS (Cloud: GCP)
    # =========================================================================
    {
        "id": "REM-GCP-REL-019",
        "check_id": "REL-019",
        "cloud": "gcp",
        "pillar": "Reliability",
        "pillarId": "reliability",
        "severity": "high",
        "title": "Cloud Load Balancing backend service missing active HTTP/HTTPS health check probe",
        "effort": "Low Effort",
        "estTime": "15 min",
        "risk": "High Risk",
        "description": "Google Cloud Load Balancing backend service 'backend-api-prod' lacks a dedicated health check probe, risking traffic forwarding to crashed Google Compute Engine or Cloud Run instances.",
        "rationale": "Health checks automatically remove unhealthy instances from backend services before customer traffic fails.",
        "resources": [
            "//compute.googleapis.com/projects/acme-gcp-prod-9941/global/backendServices/backend-api-prod",
            "//compute.googleapis.com/projects/acme-gcp-prod-9941/regions/us-central1/instanceGroups/mig-api-prod"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Load Balancing in Google Cloud Console",
                "consolePath": "GCP Console -> Network Services -> Load balancing -> Backends",
                "instruction": "Open the Google Cloud Console, navigate to Network services > Load balancing, and select 'backend-api-prod'."
            },
            {
                "step": 2,
                "title": "Edit Backend Service",
                "consolePath": "backend-api-prod -> Edit -> Health check dropdown",
                "instruction": "Click Edit and locate the 'Health check' dropdown."
            },
            {
                "step": 3,
                "title": "Create Health Check",
                "consolePath": "Create a health check: Protocol: HTTP | Port: 80 | Request path: /healthz",
                "instruction": "Select 'Create a health check', name it 'hc-api-health', set Protocol to HTTP, Port to 80, Path to '/healthz', Check interval to 15s."
            },
            {
                "step": 4,
                "title": "Save and Monitor Backends",
                "consolePath": "Save and continue",
                "instruction": "Click Save and check that all MIG instances show Healthy (100% healthy)."
            }
        ],
        "cli": {
            "command": "gcloud compute health-checks create http hc-api-health \\\n  --project=acme-gcp-prod-9941 \\\n  --port=80 \\\n  --request-path=/healthz \\\n  --check-interval=15s \\\n  --timeout=5s \\\n  --healthy-threshold=2 \\\n  --unhealthy-threshold=3 && \\\ngcloud compute backend-services update backend-api-prod \\\n  --project=acme-gcp-prod-9941 \\\n  --global \\\n  --health-checks=hc-api-health",
            "explanation": "Creates a continuous HTTP /healthz probe and binds it to the global Cloud Load Balancing backend service."
        },
        "iac": {
            "tf": "resource \"google_compute_health_check\" \"api\" {\n  name               = \"hc-api-health\"\n  check_interval_sec = 15\n  timeout_sec        = 5\n\n  http_health_check {\n    port         = 80\n    request_path = \"/healthz\"\n  }\n}\n\nresource \"google_compute_backend_service\" \"api\" {\n  name          = \"backend-api-prod\"\n  health_checks = [google_compute_health_check.api.id]\n}",
            "cf": "# Deployment Manager / Terraform GCP"
        }
    },
    {
        "id": "REM-GCP-REL-301",
        "check_id": "REL-CHK-301",
        "cloud": "gcp",
        "pillar": "Reliability",
        "pillarId": "reliability",
        "severity": "medium",
        "title": "Cloud Pub/Sub subscription missing dead-letter topic configuration for failed delivery",
        "effort": "Low Effort",
        "estTime": "15 min",
        "risk": "High Risk",
        "description": "Pub/Sub subscription 'orders-sub' on topic 'orders-topic' has no dead-letter topic, causing unparseable payloads to be retried endlessly.",
        "rationale": "Dead-letter topics isolate poison pill messages without disrupting the processing of valid queue streams.",
        "resources": [
            "//pubsub.googleapis.com/projects/acme-gcp-prod-9941/subscriptions/orders-sub",
            "//pubsub.googleapis.com/projects/acme-gcp-prod-9941/topics/orders-topic"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Cloud Pub/Sub in GCP Console",
                "consolePath": "GCP Console -> Pub/Sub -> Subscriptions -> orders-sub",
                "instruction": "Navigate to Pub/Sub > Subscriptions in project 'acme-gcp-prod-9941' and select 'orders-sub'."
            },
            {
                "step": 2,
                "title": "Edit Subscription Details",
                "consolePath": "orders-sub -> Edit -> Dead lettering",
                "instruction": "Click Edit and scroll down to the 'Dead lettering' section."
            },
            {
                "step": 3,
                "title": "Attach Dead-Letter Topic",
                "consolePath": "Check: Enable dead lettering | Topic: orders-dlq-topic",
                "instruction": "Check 'Enable dead lettering', select or create topic 'orders-dlq-topic', and set Max delivery attempts to 5."
            },
            {
                "step": 4,
                "title": "Grant Permissions and Save",
                "consolePath": "Grant Pub/Sub service agent permissions -> Save",
                "instruction": "Grant publisher/subscriber roles to the Cloud Pub/Sub service agent and save."
            }
        ],
        "cli": {
            "command": "gcloud pubsub subscriptions update orders-sub \\\n  --project=acme-gcp-prod-9941 \\\n  --dead-letter-topic=orders-dlq-topic \\\n  --max-delivery-attempts=5",
            "explanation": "Associates the dead-letter topic with the subscription after 5 delivery failures."
        },
        "iac": {
            "tf": "resource \"google_pubsub_topic\" \"orders_dlq\" {\n  name = \"orders-dlq-topic\"\n}\n\nresource \"google_pubsub_subscription\" \"orders\" {\n  name  = \"orders-sub\"\n  topic = google_pubsub_topic.orders.name\n\n  dead_letter_policy {\n    dead_letter_topic     = google_pubsub_topic.orders_dlq.id\n    max_delivery_attempts = 5\n  }\n}",
            "cf": "# Deployment Manager / Terraform GCP"
        }
    },
    {
        "id": "REM-GCP-SEC-047",
        "check_id": "SEC-047",
        "cloud": "gcp",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "critical",
        "title": "Service Account assigned overly permissive Project Editor or Owner primitive role",
        "effort": "Medium Effort",
        "estTime": "20 min",
        "risk": "Critical Risk",
        "description": "Service Account 'app-backend@acme-gcp-prod-9941.iam.gserviceaccount.com' has been assigned the primitive role 'roles/editor'.",
        "rationale": "Primitive roles grant excessive blanket read/write/deploy rights across nearly all GCP services. Principle of least privilege dictates predefined fine-grained IAM roles.",
        "resources": [
            "//iam.googleapis.com/projects/acme-gcp-prod-9941/serviceAccounts/app-backend@acme-gcp-prod-9941.iam.gserviceaccount.com"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open IAM & Admin in GCP Console",
                "consolePath": "GCP Console -> IAM & Admin -> IAM",
                "instruction": "Navigate to IAM & Admin > IAM in project 'acme-gcp-prod-9941'."
            },
            {
                "step": 2,
                "title": "Locate Service Account Role",
                "consolePath": "Filter: app-backend@acme-gcp-prod-9941.iam.gserviceaccount.com",
                "instruction": "Locate the service account principal and click the pencil icon to edit."
            },
            {
                "step": 3,
                "title": "Remove Editor Role and Add Specific Roles",
                "consolePath": "Delete roles/editor -> Add: Storage Object Admin, Cloud SQL Client",
                "instruction": "Remove 'Editor' and add specific roles such as 'roles/storage.objectAdmin' and 'roles/cloudsql.client'."
            },
            {
                "step": 4,
                "title": "Save Changes",
                "consolePath": "Save",
                "instruction": "Click Save and verify through IAM Recommender that no excessive permissions persist."
            }
        ],
        "cli": {
            "command": "gcloud projects remove-iam-policy-binding acme-gcp-prod-9941 \\\n  --member=\"serviceAccount:app-backend@acme-gcp-prod-9941.iam.gserviceaccount.com\" \\\n  --role=\"roles/editor\" && \\\ngcloud projects add-iam-policy-binding acme-gcp-prod-9941 \\\n  --member=\"serviceAccount:app-backend@acme-gcp-prod-9941.iam.gserviceaccount.com\" \\\n  --role=\"roles/storage.objectUser\"",
            "explanation": "Revokes the primitive Editor role and replaces it with granular storage access."
        },
        "iac": {
            "tf": "resource \"google_project_iam_member\" \"storage_access\" {\n  project = \"acme-gcp-prod-9941\"\n  role    = \"roles/storage.objectUser\"\n  member  = \"serviceAccount:${google_service_account.app.email}\"\n}",
            "cf": "# Deployment Manager / Terraform GCP"
        }
    },
    {
        "id": "REM-GCP-SEC-061",
        "check_id": "SEC-061",
        "cloud": "gcp",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "high",
        "title": "VPC Firewall rule allows unrestricted inbound TCP port 22 (SSH) from 0.0.0.0/0",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "Critical Risk",
        "description": "VPC firewall rule 'default-allow-ssh' allows ingress on TCP port 22 from Source IP ranges '0.0.0.0/0'.",
        "rationale": "Unrestricted management access invites continuous automated exploit scanning. Cloud IAP (Identity-Aware Proxy) should be used instead.",
        "resources": [
            "//compute.googleapis.com/projects/acme-gcp-prod-9941/global/firewalls/default-allow-ssh",
            "//compute.googleapis.com/projects/acme-gcp-prod-9941/global/networks/vpc-production"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open VPC Network Firewall in GCP Console",
                "consolePath": "GCP Console -> VPC network -> Firewall",
                "instruction": "Navigate to VPC network > Firewall in project 'acme-gcp-prod-9941'."
            },
            {
                "step": 2,
                "title": "Select Rule Allowing 0.0.0.0/0 on Port 22",
                "consolePath": "Filter: default-allow-ssh -> Edit",
                "instruction": "Click rule 'default-allow-ssh' and click Edit."
            },
            {
                "step": 3,
                "title": "Restrict Source to Identity-Aware Proxy (IAP) CIDR",
                "consolePath": "Source IPv4 ranges: 35.235.240.0/20",
                "instruction": "Change Source IPv4 ranges from '0.0.0.0/0' to '35.235.240.0/20' (the official Google Cloud IAP IP range)."
            },
            {
                "step": 4,
                "title": "Save Changes",
                "consolePath": "Save",
                "instruction": "Save the firewall rule and verify access works seamlessly via 'gcloud compute ssh --tunnel-through-iap'."
            }
        ],
        "cli": {
            "command": "gcloud compute firewall-rules update default-allow-ssh \\\n  --project=acme-gcp-prod-9941 \\\n  --source-ranges=35.235.240.0/20",
            "explanation": "Restricts SSH ingress exclusively to the Google Identity-Aware Proxy (IAP) CIDR block (35.235.240.0/20)."
        },
        "iac": {
            "tf": "resource \"google_compute_firewall\" \"iap_ssh\" {\n  name    = \"allow-ssh-via-iap\"\n  network = google_compute_network.vpc.name\n\n  allow {\n    protocol = \"tcp\"\n    ports    = [\"22\"]\n  }\n\n  source_ranges = [\"35.235.240.0/20\"]\n  target_tags   = [\"allow-iap-ssh\"]\n}",
            "cf": "# Deployment Manager / Terraform GCP"
        }
    },
    {
        "id": "REM-GCP-SEC-024",
        "check_id": "SEC-024",
        "cloud": "gcp",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "high",
        "title": "Cloud Storage bucket allows public access (allUsers / allAuthenticatedUsers)",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "High Risk",
        "description": "Cloud Storage bucket 'acme-prod-exports-9941' does not enforce Public Access Prevention.",
        "rationale": "Enabling uniform bucket-level access with Public Access Prevention guarantees no inadvertent ACL grant can expose private corporate datasets.",
        "resources": [
            "//storage.googleapis.com/projects/acme-gcp-prod-9941/buckets/acme-prod-exports-9941"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Cloud Storage in GCP Console",
                "consolePath": "GCP Console -> Cloud Storage -> Buckets -> acme-prod-exports-9941",
                "instruction": "Open Cloud Storage in project 'acme-gcp-prod-9941' and select 'acme-prod-exports-9941'."
            },
            {
                "step": 2,
                "title": "Open Permissions Tab",
                "consolePath": "Permissions tab -> Prevent public access",
                "instruction": "Click the 'Permissions' tab and locate 'Public access prevention'."
            },
            {
                "step": 3,
                "title": "Enforce Public Access Prevention",
                "consolePath": "Prevent public access -> Enforce",
                "instruction": "Click 'Enforce public access prevention' to permanently reject anonymous access."
            }
        ],
        "cli": {
            "command": "gcloud storage buckets update gs://acme-prod-exports-9941 \\\n  --project=acme-gcp-prod-9941 \\\n  --public-access-prevention \\\n  --uniform-bucket-level-access",
            "explanation": "Enforces public access prevention and uniform bucket-level IAM on the Google Cloud Storage bucket."
        },
        "iac": {
            "tf": "resource \"google_storage_bucket\" \"exports\" {\n  name                     = \"acme-prod-exports-9941\"\n  location                 = \"US\"\n  public_access_prevention = \"enforced\"\n  uniform_bucket_level_access = true\n}",
            "cf": "# Deployment Manager / Terraform GCP"
        }
    },
    {
        "id": "REM-GCP-SEC-033",
        "check_id": "SEC-033",
        "cloud": "gcp",
        "pillar": "Security",
        "pillarId": "security",
        "severity": "medium",
        "title": "Cloud KMS crypto keys without automated 90-day rotation schedule",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "Medium Risk",
        "description": "KMS key 'key-db-prod' in keyring 'keyring-prod' does not have an automated rotation period configured.",
        "rationale": "Automated crypto key rotation limits ciphertext lifetime under a single key version without requiring data re-encryption.",
        "resources": [
            "//cloudkms.googleapis.com/projects/acme-gcp-prod-9941/locations/global/keyRings/keyring-prod/cryptoKeys/key-db-prod"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open KMS in GCP Console",
                "consolePath": "GCP Console -> Security -> Key Management -> keyring-prod",
                "instruction": "Navigate to Key Management > Key Rings and select 'keyring-prod'."
            },
            {
                "step": 2,
                "title": "Edit Key Rotation Schedule",
                "consolePath": "key-db-prod -> Edit rotation period",
                "instruction": "Click key 'key-db-prod', click the three dots menu, and select 'Edit rotation period'."
            },
            {
                "step": 3,
                "title": "Set Rotation to 90 Days",
                "consolePath": "Rotation period: 90 days",
                "instruction": "Select 'Rotate every 90 days' and save."
            }
        ],
        "cli": {
            "command": "gcloud kms keys update key-db-prod \\\n  --location=global \\\n  --keyring=keyring-prod \\\n  --rotation-period=7776000s \\\n  --next-rotation-time=2026-11-01T00:00:00Z",
            "explanation": "Configures a 90-day automated rotation schedule on the Cloud KMS cryptographic key."
        },
        "iac": {
            "tf": "resource \"google_kms_crypto_key\" \"db_key\" {\n  name            = \"key-db-prod\"\n  key_ring        = google_kms_key_ring.prod.id\n  rotation_period = \"7776000s\" # 90 days\n}",
            "cf": "# Deployment Manager / Terraform GCP"
        }
    },
    {
        "id": "REM-GCP-COST-008",
        "check_id": "COST-008",
        "cloud": "gcp",
        "pillar": "Cost Optimization",
        "pillarId": "cost",
        "severity": "medium",
        "title": "Unattached Google Compute Engine persistent disks incurring persistent storage fees",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "Medium Risk",
        "description": "3 persistent SSD disks in region us-central1 have remained unattached to any GCE instance for 21 days.",
        "rationale": "Orphan disks generate continuous per-GB fees every hour until snapshotting and deletion occurs.",
        "resources": [
            "//compute.googleapis.com/projects/acme-gcp-prod-9941/zones/us-central1-a/disks/disk-archive-old-01"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Disks in GCP Console",
                "consolePath": "GCP Console -> Compute Engine -> Storage -> Disks",
                "instruction": "Open Compute Engine > Disks and filter by 'In use by: None'."
            },
            {
                "step": 2,
                "title": "Create Snapshot Backup",
                "consolePath": "Select disk -> Create snapshot",
                "instruction": "Click 'Create snapshot' to preserve data for historical audit."
            },
            {
                "step": 3,
                "title": "Delete Unattached Disk",
                "consolePath": "Delete disk button",
                "instruction": "Delete the disk to permanently release provisioned capacity billing."
            }
        ],
        "cli": {
            "command": "gcloud compute disks snapshot disk-archive-old-01 \\\n  --zone=us-central1-a \\\n  --snapshot-names=snap-disk-archive-old-01 && \\\ngcloud compute disks delete disk-archive-old-01 \\\n  --zone=us-central1-a --quiet",
            "explanation": "Creates a snapshot and deletes the idle persistent disk."
        },
        "iac": {
            "tf": "# Remove unattached google_compute_disk resource from Terraform configuration",
            "cf": "# Deployment Manager / Terraform GCP"
        }
    },
    {
        "id": "REM-GCP-OPS-014",
        "check_id": "OPS-014",
        "cloud": "gcp",
        "pillar": "Operational Excellence",
        "pillarId": "operational-excellence",
        "severity": "medium",
        "title": "Cloud Logging sink missing for real-time audit log streaming to BigQuery",
        "effort": "Low Effort",
        "estTime": "15 min",
        "risk": "Low Risk",
        "description": "Project lacks an aggregated log sink routing Admin Activity and System Event audit logs to BigQuery for analysis.",
        "rationale": "Exporting audit logs to BigQuery enables long-term retention compliance and real-time SIEM queries.",
        "resources": [
            "//logging.googleapis.com/projects/acme-gcp-prod-9941/sinks/audit-logs-sink"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Log Router in GCP Console",
                "consolePath": "GCP Console -> Logging -> Log Router -> Create sink",
                "instruction": "Navigate to Logging > Log Router and click 'Create sink'."
            },
            {
                "step": 2,
                "title": "Configure Sink Destination",
                "consolePath": "Sink service: BigQuery dataset | Dataset: security_audit_logs",
                "instruction": "Select 'BigQuery dataset' as the destination and select your security audit dataset."
            },
            {
                "step": 3,
                "title": "Set Inclusion Filter",
                "consolePath": "Filter: logName:\"cloudaudit.googleapis.com\"",
                "instruction": "Set inclusion filter to 'logName:\"cloudaudit.googleapis.com\"' and create the sink."
            }
        ],
        "cli": {
            "command": "gcloud logging sinks create audit-logs-sink \\\n  bigquery.googleapis.com/projects/acme-gcp-prod-9941/datasets/security_audit_logs \\\n  --log-filter='logName:\"cloudaudit.googleapis.com\"' \\\n  --project=acme-gcp-prod-9941",
            "explanation": "Creates a centralized log sink routing all cloud audit logs to BigQuery."
        },
        "iac": {
            "tf": "resource \"google_logging_project_sink\" \"audit_sink\" {\n  name        = \"audit-logs-sink\"\n  destination = \"bigquery.googleapis.com/projects/acme-gcp-prod-9941/datasets/security_audit_logs\"\n  filter      = \"logName:\\\"cloudaudit.googleapis.com\\\"\"\n\n  unique_writer_identity = true\n}",
            "cf": "# Deployment Manager / Terraform GCP"
        }
    },
    {
        "id": "REM-GCP-PRF-201",
        "check_id": "PERF-CHK-201",
        "cloud": "gcp",
        "pillar": "Performance Efficiency",
        "pillarId": "performance-efficiency",
        "severity": "medium",
        "title": "Cloud CDN not enabled on Cloud Load Balancing backend services for edge caching",
        "effort": "Low Effort",
        "estTime": "10 min",
        "risk": "Medium Risk",
        "description": "Cloud Load Balancing backend service 'backend-static-prod' has Cloud CDN disabled, causing high origin latency.",
        "rationale": "Enabling Cloud CDN caches content at Google global edge points of presence, dramatically lowering latency.",
        "resources": [
            "//compute.googleapis.com/projects/acme-gcp-prod-9941/global/backendServices/backend-static-prod"
        ],
        "manualSteps": [
            {
                "step": 1,
                "title": "Open Load Balancing in GCP Console",
                "consolePath": "GCP Console -> Network services -> Load balancing -> Backends",
                "instruction": "Select backend service 'backend-static-prod' and click Edit."
            },
            {
                "step": 2,
                "title": "Enable Cloud CDN",
                "consolePath": "Check 'Enable Cloud CDN' -> Cache mode: Cache static content",
                "instruction": "Check 'Enable Cloud CDN', set Cache mode to 'Cache static content', and save."
            }
        ],
        "cli": {
            "command": "gcloud compute backend-services update backend-static-prod \\\n  --project=acme-gcp-prod-9941 \\\n  --global \\\n  --enable-cdn \\\n  --cache-mode=CACHE_ALL_STATIC",
            "explanation": "Enables Google Cloud CDN with CACHE_ALL_STATIC mode on the backend service."
        },
        "iac": {
            "tf": "resource \"google_compute_backend_service\" \"static\" {\n  name        = \"backend-static-prod\"\n  enable_cdn  = true\n\n  cdn_policy {\n    cache_mode = \"CACHE_ALL_STATIC\"\n  }\n}",
            "cf": "# Deployment Manager / Terraform GCP"
        }
    }
]

def seed_remediations_and_findings():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    print(f"Connecting to MongoDB at {MONGO_URI} [db: {DB_NAME}]...")

    # 1. Seed Remediations collection
    db["remediations"].drop()
    db["remediations"].insert_many(REMEDIATIONS)
    print(f"[OK] Seeded {len(REMEDIATIONS)} cloud-specific remediations into 'remediations' collection (AWS: 9, Azure: 9, GCP: 9)")

    # 2. Seed default findings for existing assessments
    assessments = list(db["assessments"].find({}, {"_id": 0}))
    all_findings = []
    
    for asm in assessments:
        asm_id = asm["id"]
        asm_cloud = (asm.get("cloud") or "aws").lower()
        
        # Select matching remediations for this cloud
        cloud_rems = [r for r in REMEDIATIONS if r["cloud"] == asm_cloud]
        if not cloud_rems:
            cloud_rems = [r for r in REMEDIATIONS if r["cloud"] == "aws"]
            
        for rem in cloud_rems:
            finding = {
                "id": f"FND-{asm_id}-{rem['check_id']}",
                "assessment_id": asm_id,
                "check_id": rem["check_id"],
                "remediation_id": rem["id"],
                "cloud": asm_cloud,
                "pillar_id": rem["pillarId"],
                "pillar": rem["pillar"],
                "severity": rem["severity"],
                "title": rem["title"],
                "description": rem["description"],
                "status": "fail",  # These are the failing checks requiring remediation
                "effort": rem["effort"],
                "risk": rem["risk"],
                "resources": rem["resources"],
                "created_at": asm.get("created_at") or "2026-10-13T12:00:00Z",
                "updated_at": asm.get("updated_at") or "2026-10-13T12:00:00Z"
            }
            all_findings.append(finding)

    if all_findings:
        db["findings"].drop()
        db["findings"].insert_many(all_findings)
        print(f"[OK] Seeded {len(all_findings)} assessment findings into 'findings' collection linked to assessments.")

    # 3. Ensure cloud_provider is reflected in checks collection
    print(f"[SUCCESS] Database successfully seeded with cloud-specific remediations and findings!")

if __name__ == "__main__":
    seed_remediations_and_findings()

"""
Authored GCP remediation guidance, keyed by catalog control_id.

IMPORTANT: this is written guidance, not scan data. The failing resources
attached to each remediation come from the real scan; the steps and commands
below are hand-authored per control and should be reviewed before use. Each
remediation doc written by load_assessment_to_db.py is tagged
`guidance_source: "authored"` so the UI/readers can tell the two apart.

Template placeholders in `cli` (rendered once per failing resource):
    {project}  scanned project id
    {name}     resource name from the scan
    {loc}      zone/region resolved from the scan ('' when not applicable)

Words in CAPITALS (e.g. TRUSTED_CIDR) are values the operator must choose.
"""
from __future__ import annotations

# Common warnings reused below.
_WARN_PROD_VM = ("Check first whether this resource serves the running application "
                 "(e.g. the lens-multicloud VM). Changing it can take the app offline.")

GUIDANCE: dict[str, dict] = {
    "IAM-02": {
        "effort": "Medium Effort", "estTime": "30 min",
        "steps": [
            ("Review current bindings", "IAM & Admin -> IAM",
             "List who holds roles/owner, roles/editor or roles/viewer on the project."),
            ("Grant predefined roles", "IAM & Admin -> IAM -> Edit principal",
             "Give each principal the narrowest predefined role it needs."),
            ("Remove primitive roles", "IAM & Admin -> IAM -> Edit principal",
             "Remove the owner/editor/viewer binding once the replacement role works."),
        ],
        "cli": "gcloud projects get-iam-policy {project} --format=json\n"
               "# then, per principal:\n"
               "gcloud projects remove-iam-policy-binding {project} --member=PRINCIPAL --role=roles/editor",
        "explanation": "Shows the current policy, then removes a primitive role from one principal.",
    },
    "IAM-05": {
        "effort": "Medium Effort", "estTime": "20 min",
        "steps": [
            ("Find the admin binding", "IAM & Admin -> IAM",
             "Confirm which owner/editor role this service account holds."),
            ("Replace with least privilege", "IAM & Admin -> IAM -> Edit principal",
             "Grant only the predefined roles the workload uses, then remove owner/editor."),
            ("Review its keys", "IAM & Admin -> Service accounts -> Keys",
             "Delete user-managed keys that are not needed."),
        ],
        "cli": "gcloud projects remove-iam-policy-binding {project} --member=serviceAccount:{name} --role=roles/editor\n"
               "gcloud iam service-accounts keys list --iam-account={name}",
        "explanation": "Removes the editor role from the service account and lists its keys for review.",
    },
    "DAT-02": {
        "effort": "Low Effort", "estTime": "5 min",
        "steps": [
            ("Check intended access", "Cloud Storage -> Buckets -> Permissions",
             "Confirm the bucket is not meant to serve public content."),
            ("Enforce public access prevention", "Cloud Storage -> Buckets -> Permissions",
             "Set Public access prevention to Enforced."),
        ],
        "cli": "gcloud storage buckets update gs://{name} --public-access-prevention",
        "explanation": "Blocks allUsers/allAuthenticatedUsers access on the bucket.",
    },
    "DAT-03": {
        "effort": "Low Effort", "estTime": "5 min",
        "steps": [
            ("Enable object versioning", "Cloud Storage -> Buckets -> Protection",
             "Turn on Object versioning. Add a lifecycle rule to expire old versions to control cost."),
        ],
        "cli": "gcloud storage buckets update gs://{name} --versioning",
        "explanation": "Keeps prior object versions so overwrites and deletes can be recovered.",
    },
    "DAT-04": {
        "effort": "Low Effort", "estTime": "10 min",
        "steps": [
            ("Move ACL grants to IAM", "Cloud Storage -> Buckets -> Permissions",
             "Recreate any object/bucket ACL grants as IAM bindings first."),
            ("Enable uniform bucket-level access", "Cloud Storage -> Buckets -> Permissions",
             "Switch Access control to Uniform."),
        ],
        "cli": "gcloud storage buckets update gs://{name} --uniform-bucket-level-access",
        "explanation": "Disables per-object ACLs so access is controlled only by IAM.",
    },
    "DAT-07": {
        "effort": "Low Effort", "estTime": "15 min",
        "steps": [
            ("Write a lifecycle policy", "Cloud Storage -> Buckets -> Lifecycle",
             "Add rules for deleting or tiering objects by age that match the data's retention needs."),
        ],
        "cli": "gcloud storage buckets update gs://{name} --lifecycle-file=LIFECYCLE.json",
        "explanation": "Applies a lifecycle policy from a JSON file you author.",
    },
    "DAT-10": {
        "effort": "High Effort", "estTime": "1-2 h",
        "steps": [
            ("Decide if redundancy is needed", "Cloud Storage -> Buckets",
             "A bucket's location cannot be changed in place. Only migrate buckets that need regional-outage tolerance."),
            ("Create a dual-region bucket and copy", "Cloud Storage -> Create bucket",
             "Create the new bucket in a dual-region location, copy the data, then switch clients over."),
        ],
        "cli": "gcloud storage buckets create gs://{name}-dr --location=NAM4 --project={project}\n"
               "gcloud storage rsync -r gs://{name} gs://{name}-dr",
        "explanation": "Creates a dual-region copy of the bucket and syncs the data into it.",
    },
    "SUS-01": {
        "effort": "Low Effort", "estTime": "15 min",
        "steps": [
            ("Add storage-class tiering", "Cloud Storage -> Buckets -> Lifecycle",
             "Add a SetStorageClass rule (e.g. to NEARLINE/COLDLINE/ARCHIVE) for data that is rarely read."),
        ],
        "cli": "gcloud storage buckets update gs://{name} --lifecycle-file=LIFECYCLE.json",
        "explanation": "Applies a lifecycle file containing a SetStorageClass action.",
    },
    "NET-01": {
        "effort": "Low Effort", "estTime": "10 min",
        "warning": "Narrowing SSH can cut off your own access. Browser SSH from the console needs 35.235.240.0/20 (IAP) allowed.",
        "steps": [
            ("Identify who needs admin access", "VPC network -> Firewall",
             "Decide the trusted source ranges (office/VPN IPs, or IAP 35.235.240.0/20)."),
            ("Restrict the source range", "VPC network -> Firewall -> Edit rule",
             "Replace 0.0.0.0/0 with the trusted ranges, or delete the rule if unused."),
        ],
        "cli": "gcloud compute firewall-rules update {name} --project={project} --source-ranges=TRUSTED_CIDR",
        "explanation": "Limits SSH/RDP ingress on this rule to trusted source ranges.",
    },
    "NET-02": {
        "effort": "Low Effort", "estTime": "10 min",
        "steps": [
            ("Confirm the port must be reachable", "VPC network -> Firewall",
             "Databases and admin consoles should not be reachable from the internet."),
            ("Restrict or remove the rule", "VPC network -> Firewall -> Edit rule",
             "Limit the source ranges, or delete the rule and use private access."),
        ],
        "cli": "gcloud compute firewall-rules update {name} --project={project} --source-ranges=TRUSTED_CIDR",
        "explanation": "Limits internet ingress on this high-risk port rule to trusted ranges.",
    },
    "NET-03": {
        "effort": "Low Effort", "estTime": "5 min",
        "steps": [
            ("Enable VPC flow logs", "VPC network -> Subnets -> Edit",
             "Turn Flow logs on. Use sampling to control log volume and cost."),
        ],
        "cli": "gcloud compute networks subnets update {name} --region={loc} --project={project} --enable-flow-logs",
        "explanation": "Turns on VPC flow logs for the subnet.",
    },
    "NET-04": {
        "effort": "High Effort", "estTime": "2-4 h",
        "warning": "The default network cannot be deleted while VMs, subnets or rules use it. " + _WARN_PROD_VM,
        "steps": [
            ("Inventory what uses it", "VPC network -> default",
             "List VMs, connectors and rules attached to the default network."),
            ("Migrate to a custom VPC", "VPC network -> Create VPC",
             "Recreate the workloads in a custom-mode VPC with planned subnets."),
            ("Delete the default network", "VPC network -> default -> Delete",
             "Delete it only after nothing depends on it."),
        ],
        "cli": "gcloud compute instances list --project={project} --filter=\"networkInterfaces.network~/default$\"\n"
               "# after migrating everything off it:\n"
               "gcloud compute networks delete default --project={project}",
        "explanation": "Lists what still uses the default network, then deletes it once it is empty.",
    },
    "NET-05": {
        "effort": "High Effort", "estTime": "1-2 h",
        "warning": "Deleting a default internet route removes egress for every VM in that network. " + _WARN_PROD_VM,
        "steps": [
            ("Plan private egress", "Network services -> Cloud NAT",
             "Set up Cloud NAT so private instances keep outbound access."),
            ("Remove the direct internet route", "VPC network -> Routes",
             "Delete or narrow the 0.0.0.0/0 route only once egress goes through NAT."),
        ],
        "cli": "gcloud compute routes describe {name} --project={project}\n"
               "# only after Cloud NAT is in place:\n"
               "gcloud compute routes delete {name} --project={project}",
        "explanation": "Shows the route, then deletes it once Cloud NAT provides egress.",
    },
    "NET-06": {
        "effort": "Low Effort", "estTime": "5 min",
        "steps": [
            ("Enable firewall rule logging", "VPC network -> Firewall -> Edit rule",
             "Turn Logs on for the rule."),
        ],
        "cli": "gcloud compute firewall-rules update {name} --project={project} --enable-logging",
        "explanation": "Records connections matched by this firewall rule.",
    },
    "NET-07": {
        "effort": "Medium Effort", "estTime": "20 min",
        "warning": "Removing default-allow-ssh can block browser SSH unless another rule allows 35.235.240.0/20.",
        "steps": [
            ("Replace with scoped rules", "VPC network -> Firewall",
             "Create explicit rules for the traffic you actually need."),
            ("Delete the default rule", "VPC network -> Firewall -> Delete",
             "Remove the auto-created default-allow rule."),
        ],
        "cli": "gcloud compute firewall-rules delete {name} --project={project}",
        "explanation": "Deletes the auto-created default-allow rule.",
    },
    "NET-09": {
        "effort": "Low Effort", "estTime": "5 min",
        "steps": [
            ("Enable Private Google Access", "VPC network -> Subnets -> Edit",
             "Turn Private Google Access on so VMs without external IPs reach Google APIs."),
        ],
        "cli": "gcloud compute networks subnets update {name} --region={loc} --project={project} --enable-private-ip-google-access",
        "explanation": "Lets internal-only VMs in this subnet reach Google APIs.",
    },
    "CMP-01": {
        "effort": "Medium Effort", "estTime": "20 min",
        "warning": "Changing scopes requires stopping the VM. " + _WARN_PROD_VM,
        "steps": [
            ("Stop the instance", "Compute Engine -> VM instances -> Stop", "Plan a maintenance window."),
            ("Narrow access scopes", "Compute Engine -> VM -> Edit -> API and identity",
             "Replace 'Allow full access' with only the scopes needed, or use a dedicated service account with IAM roles."),
            ("Start the instance", "Compute Engine -> VM instances -> Start", ""),
        ],
        "cli": "gcloud compute instances stop {name} --zone={loc} --project={project}\n"
               "gcloud compute instances set-service-account {name} --zone={loc} --project={project} "
               "--service-account=SERVICE_ACCOUNT --scopes=SCOPES\n"
               "gcloud compute instances start {name} --zone={loc} --project={project}",
        "explanation": "Restarts the VM with narrower OAuth scopes.",
    },
    "CMP-02": {
        "effort": "Medium Effort", "estTime": "20 min",
        "warning": _WARN_PROD_VM,
        "steps": [
            ("Plan access without a public IP", "Network services -> Cloud NAT / IAP",
             "Use Cloud NAT for egress and IAP or a load balancer for inbound access."),
            ("Remove the external IP", "Compute Engine -> VM -> Edit -> Network interfaces",
             "Set External IPv4 address to None."),
        ],
        "cli": "gcloud compute instances describe {name} --zone={loc} --project={project} "
               "--format=\"value(networkInterfaces[0].accessConfigs[0].name)\"\n"
               "gcloud compute instances delete-access-config {name} --zone={loc} --project={project} "
               "--access-config-name=ACCESS_CONFIG_NAME",
        "explanation": "Finds the access-config name, then removes the VM's external IP.",
    },
    "CMP-03": {
        "effort": "High Effort", "estTime": "1 h",
        "warning": "A disk's encryption key cannot be changed in place; the disk must be recreated. " + _WARN_PROD_VM,
        "steps": [
            ("Create a KMS key", "Security -> Key Management", "Create a key ring and key for disk encryption."),
            ("Snapshot the disk", "Compute Engine -> Disks -> Create snapshot", ""),
            ("Recreate the disk with CMEK", "Compute Engine -> Disks -> Create disk",
             "Create the new disk from the snapshot using the KMS key, then swap it in."),
        ],
        "cli": "gcloud compute disks snapshot {name} --zone={loc} --project={project} --snapshot-names={name}-pre-cmek\n"
               "gcloud compute disks create {name}-cmek --zone={loc} --project={project} "
               "--source-snapshot={name}-pre-cmek --kms-key=KMS_KEY_RESOURCE_NAME",
        "explanation": "Snapshots the disk and creates a CMEK-encrypted copy to swap in.",
    },
    "CMP-06": {
        "effort": "Medium Effort", "estTime": "30 min",
        "steps": [
            ("Create a Serverless VPC Access connector", "VPC network -> Serverless VPC access", ""),
            ("Redeploy the function with the connector", "Cloud Run functions -> Edit -> Networking",
             "Select the connector and set egress as needed."),
        ],
        "cli": "gcloud functions deploy {name} --gen2 --region={loc} --project={project} --vpc-connector=CONNECTOR_NAME",
        "explanation": "Redeploys the function so its traffic uses the VPC connector. Run from the function's source directory.",
    },
    "PERF-01": {
        "effort": "High Effort", "estTime": "1 h",
        "warning": _WARN_PROD_VM,
        "steps": [
            ("Confirm the workload needs it", "Monitoring -> Disk metrics",
             "Only move to pd-ssd/Hyperdisk if disk throughput or latency is a real bottleneck."),
            ("Recreate on a faster type", "Compute Engine -> Disks", "Snapshot, then create a pd-ssd disk from the snapshot."),
        ],
        "cli": "gcloud compute disks snapshot {name} --zone={loc} --project={project} --snapshot-names={name}-pre-ssd\n"
               "gcloud compute disks create {name}-ssd --zone={loc} --project={project} --type=pd-ssd --source-snapshot={name}-pre-ssd",
        "explanation": "Creates a pd-ssd copy of the disk from a snapshot.",
    },
    "OPS-02": {
        "effort": "Low Effort", "estTime": "10 min",
        "steps": [
            ("Create a snapshot schedule", "Compute Engine -> Snapshots -> Snapshot schedules", "Daily, with a retention that fits your RPO."),
            ("Attach it to the disk", "Compute Engine -> Disks -> Edit", ""),
        ],
        "cli": "gcloud compute resource-policies create snapshot-schedule daily-backup --project={project} "
               "--region=REGION --daily-schedule --start-time=02:00 --max-retention-days=14\n"
               "gcloud compute disks add-resource-policies {name} --zone={loc} --project={project} --resource-policies=daily-backup",
        "explanation": "Creates a daily snapshot schedule and attaches it to the disk. REGION must match the disk's zone.",
    },
    "CST-02": {
        "effort": "Low Effort", "estTime": "5 min",
        "steps": [
            ("Confirm the address is unused", "VPC network -> IP addresses",
             "A reserved address may be kept on purpose for a planned service or allowlist."),
            ("Release it", "VPC network -> IP addresses -> Release", ""),
        ],
        "cli": "gcloud compute addresses delete {name} --region={loc} --project={project}",
        "explanation": "Releases the idle reserved address. A released IP cannot be recovered.",
    },
    "LOG-02": {
        "effort": "Low Effort", "estTime": "15 min",
        "steps": [
            ("Pick a destination", "Cloud Storage / BigQuery", "Create a bucket or dataset for long-term audit logs."),
            ("Create the sink", "Logging -> Log router -> Create sink", "Filter on audit logs."),
            ("Grant the sink writer", "IAM", "Give the sink's writer identity access to the destination."),
        ],
        "cli": "gcloud logging sinks create audit-export storage.googleapis.com/DEST_BUCKET --project={project} "
               "--log-filter='logName:\"cloudaudit.googleapis.com\"'",
        "explanation": "Exports audit logs to a bucket for retention outside the default buckets.",
    },
    "LOG-07": {
        "effort": "Low Effort", "estTime": "15 min",
        "steps": [
            ("Create a log-based metric", "Logging -> Log-based metrics", "Match route insert/delete events."),
            ("Add an alert", "Monitoring -> Alerting", "Alert on any count above 0."),
        ],
        "cli": "gcloud logging metrics create network-route-changes --project={project} "
               "--description=\"VPC route changes\" "
               "--log-filter='resource.type=\"gce_route\" AND (protoPayload.methodName:\"compute.routes.delete\" "
               "OR protoPayload.methodName:\"compute.routes.insert\")'",
        "explanation": "Counts VPC route changes so an alert policy can fire on them.",
    },
    "LOG-08": {
        "effort": "Low Effort", "estTime": "15 min",
        "steps": [
            ("Create a log-based metric", "Logging -> Log-based metrics", "Match firewall insert/patch/delete events."),
            ("Add an alert", "Monitoring -> Alerting", "Alert on any count above 0."),
        ],
        "cli": "gcloud logging metrics create firewall-rule-changes --project={project} "
               "--description=\"VPC firewall rule changes\" "
               "--log-filter='resource.type=\"gce_firewall_rule\" AND (protoPayload.methodName:\"compute.firewalls.patch\" "
               "OR protoPayload.methodName:\"compute.firewalls.insert\" OR protoPayload.methodName:\"compute.firewalls.delete\")'",
        "explanation": "Counts firewall rule changes so an alert policy can fire on them.",
    },
    "SEC-01": {
        "effort": "Medium Effort", "estTime": "30 min",
        "steps": [
            ("Create a rotation topic", "Pub/Sub -> Topics", "Secret Manager publishes rotation notices to it."),
            ("Set a rotation schedule", "Security -> Secret Manager -> Edit", "Set a rotation period and next rotation time."),
            ("Handle the notice", "Cloud Run functions", "Subscribe a job that creates the new secret version."),
        ],
        "cli": "gcloud secrets update {name} --project={project} --rotation-period=7776000s "
               "--next-rotation-time=NEXT_ROTATION_RFC3339 --add-topics=projects/{project}/topics/ROTATION_TOPIC",
        "explanation": "Schedules 90-day rotation notices for the secret. Rotation itself is done by your handler.",
    },
    "SEC-02": {
        "effort": "Medium Effort", "estTime": "30 min",
        "steps": [
            ("Store the value in Secret Manager", "Security -> Secret Manager", ""),
            ("Bind it to the function", "Cloud Run functions -> Edit -> Security and image repo",
             "Reference the secret instead of a plain environment variable, then remove the plain variable."),
        ],
        "cli": "gcloud functions deploy {name} --gen2 --region={loc} --project={project} --set-secrets=ENV_VAR=SECRET_NAME:latest",
        "explanation": "Redeploys the function with a Secret Manager binding. Run from the function's source directory.",
    },
    "DBS-10": {
        "effort": "High Effort", "estTime": "2 h",
        "warning": "CMEK can only be set when a Firestore database is created; this needs a new database and a data migration.",
        "steps": [
            ("Create a KMS key", "Security -> Key Management", ""),
            ("Create a CMEK database", "Firestore -> Create database", "Select the key under encryption."),
            ("Migrate data", "Firestore -> Import/Export", "Export from the old database and import into the new one."),
        ],
        "cli": "gcloud firestore databases create --database=NEW_DB_ID --location=LOCATION --project={project} "
               "--kms-key-name=KMS_KEY_RESOURCE_NAME",
        "explanation": "Creates a new CMEK-encrypted Firestore database to migrate into.",
    },
    "MSG-03": {
        "effort": "Low Effort", "estTime": "10 min",
        "warning": "Eventarc-managed subscriptions may be reset by Eventarc; configure retries on the trigger instead where possible.",
        "steps": [
            ("Create a dead-letter topic", "Pub/Sub -> Topics", ""),
            ("Attach it to the subscription", "Pub/Sub -> Subscriptions -> Edit", "Set max delivery attempts."),
        ],
        "cli": "gcloud pubsub subscriptions update {name} --project={project} "
               "--dead-letter-topic=projects/{project}/topics/DLQ_TOPIC --max-delivery-attempts=5",
        "explanation": "Routes messages that keep failing to a dead-letter topic.",
    },
    "MSG-04": {
        "effort": "Low Effort", "estTime": "10 min",
        "warning": "Eventarc-managed subscriptions may be reset by Eventarc; configure retries on the trigger instead where possible.",
        "steps": [
            ("Create a dead-letter topic", "Pub/Sub -> Topics", ""),
            ("Attach it to the subscription", "Pub/Sub -> Subscriptions -> Edit", "Set max delivery attempts."),
        ],
        "cli": "gcloud pubsub subscriptions update {name} --project={project} "
               "--dead-letter-topic=projects/{project}/topics/DLQ_TOPIC --max-delivery-attempts=5",
        "explanation": "Routes messages that keep failing to a dead-letter topic.",
    },
    "IAM-10": {
        "effort": "Medium Effort", "estTime": "30 min",
        "steps": [
            ("Choose baseline constraints", "IAM & Admin -> Organization policies",
             "Common ones: block service-account key creation, require OS Login, restrict public IPs."),
            ("Enforce them on the project", "IAM & Admin -> Organization policies -> Edit", ""),
        ],
        "cli": "gcloud resource-manager org-policies enable-enforce iam.disableServiceAccountKeyCreation --project={project}\n"
               "gcloud resource-manager org-policies enable-enforce compute.requireOsLogin --project={project}",
        "explanation": "Enforces two common baseline organization policy constraints on the project.",
    },
    "OPS-01": {
        "effort": "High Effort", "estTime": "1-2 h",
        "steps": [
            ("Define required labels", "", "Agree the label keys every resource must carry (owner, env, cost-centre)."),
            ("Enforce with a custom constraint", "IAM & Admin -> Organization policies",
             "Requires organization-level access to create a custom constraint."),
        ],
        "cli": "# Requires organization admin: create a custom org policy constraint that checks resource labels.",
        "explanation": "Required-label enforcement needs an organization-level custom constraint.",
    },
}


def render_cli(control_id: str, project: str, resources: list[tuple[str, str]],
               max_resources: int = 10) -> str:
    """Render the CLI template once per failing (name, loc) resource."""
    g = GUIDANCE.get(control_id)
    if not g:
        return ""
    tpl = g["cli"]
    # Templates without {name} are project-level: render once.
    if "{name}" not in tpl:
        return tpl.format(project=project, name="", loc="")
    out = []
    for name, loc in resources[:max_resources]:
        label = f"{loc}/{name}" if loc else name
        out.append(f"# {label}\n" + tpl.format(project=project, name=name, loc=loc or "LOCATION"))
    if len(resources) > max_resources:
        out.append(f"# ...and {len(resources) - max_resources} more resource(s)")
    return "\n\n".join(out)

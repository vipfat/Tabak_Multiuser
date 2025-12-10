<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1iEyMT_otaxkuigZ1ZSRTKg07YvtK57Kl

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Database and infrastructure decisions

### Primary database
- Use **PostgreSQL** as the primary relational database.

### Cloud and deployment model
- Target cloud: **AWS**.
- Service: **Amazon RDS for PostgreSQL** (managed). Chosen for automated backups, monitoring, Multi-AZ support, and reduced operational overhead compared to self-managed VMs.

### Managed RDS parameters
- **Region:** `eu-central-1` (Frankfurt) to minimize latency for EU users and keep data in the EU.
- **Instance class:** `db.t3.medium` (2 vCPU, 4 GiB) for baseline workloads; scale vertically to `t3.large`/`m6g.large` as load grows.
- **Storage:** General Purpose SSD (**gp3**) with 100 GiB initial allocation; enable autoscaling up to 500 GiB.
- **High availability:** Enable **Multi-AZ** deployment for automatic failover and synchronous replication.
- **Backups:** Daily automated backups with a 7–14 day retention window; enable point-in-time recovery.
- **Networking and isolation:**
  - Place RDS inside a dedicated **VPC** with private subnets across at least two Availability Zones.
  - Attach a dedicated **security group** allowing inbound traffic only from the app’s ECS/EKS/EC2 security group on port 5432.
  - No public access; connect via internal load balancer or VPC peering. Use **TLS in transit** and **KMS** encryption at rest.

### If managed RDS is not approved (VM fallback)
- Provision a VM (e.g., EC2 `t3.medium` in `eu-central-1`) within a private subnet; expose PostgreSQL only on the VPC CIDR via security groups/firewall rules.
- Use **gp3** SSD volumes (100 GiB, autoscaling via additional EBS volumes as needed) with encrypted storage and regular snapshots.
- Configure **Patroni**/**repmgr** + **pgBouncer** for HA/failover and connection pooling; consider a second VM in another AZ for asynchronous replication.
- Automate backups (base + WAL archiving to S3) and monitoring/alerting (CloudWatch/Prometheus + Grafana).

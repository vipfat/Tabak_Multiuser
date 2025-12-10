# Database environment and access policy

This guide defines how to separate environments, provision accounts, and manage connection secrets for the application databases.

## Environment isolation
- **Separate clusters per environment (preferred):** Provision independent clusters for `dev`, `stage`, and `prod` to avoid noisy neighbors, simplify maintenance windows, and allow different performance/backup settings.
- **Fallback:** If clusters cannot be separated, create distinct databases inside a single cluster with strict network segmentation (VPC/security groups) per environment and disallow cross-database access.
- **Baseline settings per environment:**
  - Enforce automated backups and point-in-time recovery appropriate to the environment.
  - Apply environment-specific parameters (e.g., dev with cheaper instances, prod with HA/multi-AZ).
  - Restrict inbound access to only the corresponding application tier and admin subnet/VPN.

## Application accounts
Create one application role per environment with the least privileges required by the service.

### Example role creation (PostgreSQL)
```sql
-- Dev
CREATE ROLE app_dev LOGIN PASSWORD '<generated-secret>';
GRANT CONNECT ON DATABASE app_dev_db TO app_dev;
GRANT USAGE ON SCHEMA public TO app_dev;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_dev;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO app_dev;

-- Repeat for stage/prod with their own databases and passwords.
```

> Do **not** grant `SUPERUSER`, `CREATEDB`, or cross-database privileges to application roles. Rotate generated passwords through the secret store (below).

## Administrative access
- Use a dedicated admin role for maintenance and migrations (e.g., `db_admin`).
- Require SSO/MFA for admin authentication (managed database IAM roles or identity provider integration where available).
- Avoid using superuser accounts in application runtimes; reserve them only for break-glass situations with audited access.
- Keep admin connections over secure channels (TLS, VPN/bastion) and log all DDL/DCL operations.

## Secret storage and rotation
- Store database credentials in an external secret manager (e.g., HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager).
- Configure automatic rotation at least every **90 days**; shorter intervals for prod are recommended.
- Use separate secrets per environment (e.g., `db/app/dev`, `db/app/stage`, `db/app/prod`) and include:
  - Username and generated password.
  - Host, port, and database name.
  - TLS requirements (certificate/CA bundle reference when applicable).
- Applications should fetch credentials at startup (or via sidecar/agent) rather than baking them into images or config files.
- When rotating, apply new credentials, reload application config, then revoke old credentials to minimize downtime.

## Documented DSN examples
Use explicit DSN strings per environment for clarity and auditing. Replace placeholders with values from the secret manager.

- Dev: `postgresql://app_dev:<secret>@<dev-host>:5432/app_dev_db?sslmode=require`
- Stage: `postgresql://app_stage:<secret>@<stage-host>:5432/app_stage_db?sslmode=require`
- Prod: `postgresql://app_prod:<secret>@<prod-host>:5432/app_prod_db?sslmode=require`

Keep DSNs in deployment configuration (e.g., environment variables, orchestrator secrets) and never commit them to source control.

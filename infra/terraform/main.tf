# Beyond Shape — Cloudflare infra as code (Terraform / cloudflare provider).
# Owns the resources that must EXIST but are not "application code":
#   - the D1 database (the `contributions` table — DR-1/DR-3)
#   - the Pages project + its D1 binding (so `functions/api/contribute.ts` gets
#     `env.DB` at runtime)
#   - the schema migration (schema/schema.sql is the single source of truth)
# Apply once: `terraform init && terraform apply` (with CLOUDFLARE_API_TOKEN +
# CLOUDFLARE_ACCOUNT_ID exported, or sourced from ./.cf.env at repo root).

terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
    }
  }
  required_version = ">= 1.4"
}

# Credentials come from the environment only (CLOUDFLARE_API_TOKEN,
# CLOUDFLARE_ACCOUNT_ID) — never committed, never in the plan output.
provider "cloudflare" {}

# The living archive's database (DR-1/DR-3). `id` is the D1 database_id.
resource "cloudflare_d1_database" "beyond_shape" {
  account_id = var.account_id
  name       = "beyond-shape"
}

# The Pages project the app deploys to. Bound to the same D1 under the
# binding name `DB` — which is what functions/api/contribute.ts reads as
# `context.env.DB`. No Git source block: the app is deployed as-built assets
# via `npm run deploy:pages` (wrangler pages deploy), keeping infra declarative
# and the deploy one command.
resource "cloudflare_pages_project" "beyond_shape" {
  account_id        = var.account_id
  name              = "beyond-shape"
  production_branch = "main"

  build_config = {
    build_command   = "npm run build"
    destination_dir = "dist"
  }

  deployment_configs = {
    production = {
      d1_databases = {
        DB = {
          id = cloudflare_d1_database.beyond_shape.id
        }
      }
    }
    preview = {
      d1_databases = {
        DB = {
          id = cloudflare_d1_database.beyond_shape.id
        }
      }
    }
  }
}

# Apply the schema once the database exists. Idempotent (CREATE TABLE IF NOT
# EXISTS); re-runs only when schema/schema.sql changes. The wrangler subprocess
# inherits CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID from the environment.
resource "null_resource" "d1_migration" {
  triggers = {
    schema_sha = filemd5("${path.module}/../../schema/schema.sql")
  }
  provisioner "local-exec" {
    command = "npx wrangler d1 execute beyond-shape --file=${path.module}/../../schema/schema.sql --remote --yes"
  }
  depends_on = [cloudflare_d1_database.beyond_shape]
}

output "d1_database_id" {
  description = "The D1 database_id — paste into wrangler.toml for local dev parity."
  value       = cloudflare_d1_database.beyond_shape.id
}

output "pages_project" {
  value = cloudflare_pages_project.beyond_shape.name
}

# The account id (wolf.wikgren@gmail.com's account) — a constant, not a secret.
variable "account_id" {
  type        = string
  default     = "4d3a0b7cb6c34f1ccb1b9035a3cdfe58"
  description = "Cloudflare account id (read-only, non-secret)."
}

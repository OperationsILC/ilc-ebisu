CREATE TABLE "accounts" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_uq" UNIQUE("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "audit_cells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"table_name" text NOT NULL,
	"row_id" uuid NOT NULL,
	"column_name" text NOT NULL,
	"operation" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"qap_line_id" uuid NOT NULL,
	"type_name_snapshot" text,
	"catalog_no_snapshot" text,
	"manufacturer_name_snapshot" text,
	"description_snapshot" text,
	"qty_snapshot" numeric,
	"current_dn_snapshot" numeric,
	"margin_pct_snapshot" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"budget_no" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"description" text,
	"margin_pct" numeric,
	"freight_pct" numeric,
	"warehousing_pct" numeric,
	"sales_tax_pct" numeric,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"street" text,
	"city" text,
	"state" text,
	"zip" text,
	"phone" text,
	"website" text,
	"quote_emails" text,
	"order_emails" text,
	"payment_terms_days" integer,
	"ffa" numeric,
	"credit_limit" numeric,
	"parent_company_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "companies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "company_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "company_roles_uq" UNIQUE("company_id","role")
);
--> statement-breakpoint
CREATE TABLE "import_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"user_id" uuid,
	"source_filename" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"total_rows" integer,
	"rows_imported" integer,
	"rows_skipped" integer,
	"rows_failed" integer,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"validation_report" jsonb
);
--> statement-breakpoint
CREATE TABLE "manufacturer_rep" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manufacturer_company_id" uuid NOT NULL,
	"rep_firm_company_id" uuid NOT NULL,
	"notes" text,
	CONSTRAINT "manufacturer_rep_uq" UNIQUE("manufacturer_company_id","rep_firm_company_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manufacturer_company_id" uuid,
	"catalog_no" text NOT NULL,
	"description" text,
	"finish" text,
	"cct" text,
	"wattage" text,
	"voltage" text,
	"dim" text,
	"mounting" text,
	"fixture_or_control" text,
	"notes" text,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_mfr_catalog_uq" UNIQUE("manufacturer_company_id","catalog_no")
);
--> statement-breakpoint
CREATE TABLE "project_rep" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"rep_firm_company_id" uuid NOT NULL,
	"manufacturer_company_id" uuid,
	CONSTRAINT "project_rep_uq" UNIQUE("project_id","rep_firm_company_id","manufacturer_company_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"client_company_id" uuid,
	"gc_company_id" uuid,
	"designer_company_id" uuid,
	"project_manager_user_id" uuid,
	"margin_pct" numeric,
	"freight_pct" numeric,
	"warehousing_pct" numeric,
	"sales_tax_pct" numeric,
	"delivery_street" text,
	"delivery_city" text,
	"delivery_state" text,
	"delivery_zip" text,
	"site_street" text,
	"site_city" text,
	"site_state" text,
	"site_zip" text,
	"total_sf" integer,
	"interior_sf" integer,
	"exterior_sf" integer,
	"design_start_date" timestamp with time zone,
	"rough_in_start_date" timestamp with time zone,
	"construction_start_date" timestamp with time zone,
	"description" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "projects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "qap_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qap_id_text" text,
	"qty" numeric,
	"current_dn" numeric,
	"margin_pct" numeric,
	"fixture_or_control" text,
	"finish" text,
	"cct" text,
	"wattage" text,
	"voltage" text,
	"dim" text,
	"mounting" text,
	"rough_in_required" text,
	"fixture_category" text,
	"fixture_location" text,
	"attic_stock" text,
	"internal_designer_notes" text,
	"notes" text,
	"description" text,
	"pr_original_manufacturer" text,
	"pr_original_spec" text,
	"pr_original_spec_detail" text,
	"source_row_hash" text,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"last_import_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	CONSTRAINT "qap_lines_project_type_product_uq" UNIQUE("project_id","type_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "reps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rep_firm_company_id" uuid NOT NULL,
	"name" text,
	"quote_email" text,
	"orders_email" text,
	"phone" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"family" text,
	"fixture_or_control" text,
	"master_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"emailVerified" timestamp with time zone,
	"name" text,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_uq" UNIQUE("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_cells" ADD CONSTRAINT "audit_cells_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_qap_line_id_qap_lines_id_fk" FOREIGN KEY ("qap_line_id") REFERENCES "public"."qap_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_roles" ADD CONSTRAINT "company_roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturer_rep" ADD CONSTRAINT "manufacturer_rep_manufacturer_company_id_companies_id_fk" FOREIGN KEY ("manufacturer_company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturer_rep" ADD CONSTRAINT "manufacturer_rep_rep_firm_company_id_companies_id_fk" FOREIGN KEY ("rep_firm_company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_manufacturer_company_id_companies_id_fk" FOREIGN KEY ("manufacturer_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_rep" ADD CONSTRAINT "project_rep_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_rep" ADD CONSTRAINT "project_rep_rep_firm_company_id_companies_id_fk" FOREIGN KEY ("rep_firm_company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_rep" ADD CONSTRAINT "project_rep_manufacturer_company_id_companies_id_fk" FOREIGN KEY ("manufacturer_company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_company_id_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_gc_company_id_companies_id_fk" FOREIGN KEY ("gc_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_designer_company_id_companies_id_fk" FOREIGN KEY ("designer_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_manager_user_id_users_id_fk" FOREIGN KEY ("project_manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qap_lines" ADD CONSTRAINT "qap_lines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qap_lines" ADD CONSTRAINT "qap_lines_type_id_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qap_lines" ADD CONSTRAINT "qap_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qap_lines" ADD CONSTRAINT "qap_lines_last_import_session_id_import_sessions_id_fk" FOREIGN KEY ("last_import_session_id") REFERENCES "public"."import_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qap_lines" ADD CONSTRAINT "qap_lines_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qap_lines" ADD CONSTRAINT "qap_lines_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reps" ADD CONSTRAINT "reps_rep_firm_company_id_companies_id_fk" FOREIGN KEY ("rep_firm_company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_cells_row_idx" ON "audit_cells" USING btree ("table_name","row_id");--> statement-breakpoint
CREATE INDEX "audit_cells_user_idx" ON "audit_cells" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "qap_lines_project_idx" ON "qap_lines" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "qap_lines_source_hash_idx" ON "qap_lines" USING btree ("source_row_hash");
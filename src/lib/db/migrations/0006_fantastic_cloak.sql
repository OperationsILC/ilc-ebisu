CREATE TABLE "bill_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"order_line_id" uuid,
	"description_text" text,
	"catalog_no_text" text,
	"qty" numeric,
	"unit_price" numeric,
	"line_total" numeric,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"purchase_order_id" uuid,
	"vendor_company_id" uuid,
	"bill_no" text NOT NULL,
	"vendor_bill_no" text,
	"bill_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"total_amount" numeric,
	"paid_amount" numeric,
	"notes" text,
	"source_pdf_url" text,
	"source_parsed_json" jsonb,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"rejected_by_user_id" uuid,
	"rejected_at" timestamp with time zone,
	"rejected_reason" text,
	"qbo_id" text,
	"qbo_status" text DEFAULT 'not_pushed' NOT NULL,
	"qbo_pushed_at" timestamp with time zone,
	"qbo_last_error" text,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "bills_bill_no_unique" UNIQUE("bill_no")
);
--> statement-breakpoint
CREATE TABLE "client_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_company_id" uuid NOT NULL,
	"credit_no" text NOT NULL,
	"amount" numeric NOT NULL,
	"origin" text NOT NULL,
	"origin_ref_invoice_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "client_credits_credit_no_unique" UNIQUE("credit_no")
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"order_line_id" uuid,
	"shipment_line_id" uuid,
	"type_snapshot" text,
	"catalog_no_snapshot" text,
	"manufacturer_snapshot" text,
	"description_snapshot" text,
	"qty_invoiced" numeric,
	"qty_type" text,
	"unit_dn_snapshot" numeric,
	"unit_cn_snapshot" numeric,
	"margin_pct_snapshot" numeric,
	"line_total" numeric,
	"design_fee_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sales_order_id" uuid,
	"invoice_no" text NOT NULL,
	"type" text DEFAULT 'product' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"design_phase" text,
	"invoice_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"client_po_no" text,
	"sales_tax_pct" numeric,
	"sales_tax_name" text,
	"deposit_applied_amount" numeric DEFAULT '0',
	"credit_applied_amount" numeric DEFAULT '0',
	"total_amount" numeric DEFAULT '0',
	"amount_due" numeric DEFAULT '0',
	"paid_amount" numeric DEFAULT '0',
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"qbo_id" text,
	"qbo_status" text DEFAULT 'not_pushed' NOT NULL,
	"qbo_pushed_at" timestamp with time zone,
	"qbo_last_error" text,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "invoices_invoice_no_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "qbo_customer_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "qbo_vendor_id" text;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_company_id_companies_id_fk" FOREIGN KEY ("vendor_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_rejected_by_user_id_users_id_fk" FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_credits" ADD CONSTRAINT "client_credits_client_company_id_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_credits" ADD CONSTRAINT "client_credits_origin_ref_invoice_id_invoices_id_fk" FOREIGN KEY ("origin_ref_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_credits" ADD CONSTRAINT "client_credits_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_shipment_line_id_shipment_lines_id_fk" FOREIGN KEY ("shipment_line_id") REFERENCES "public"."shipment_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_lines_bill_idx" ON "bill_lines" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bill_lines_order_line_idx" ON "bill_lines" USING btree ("order_line_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_order_line_idx" ON "invoice_lines" USING btree ("order_line_id");
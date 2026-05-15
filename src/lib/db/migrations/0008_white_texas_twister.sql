CREATE TABLE "change_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_order_id" uuid NOT NULL,
	"order_line_id" uuid,
	"operation" text NOT NULL,
	"type_before" text,
	"catalog_no_before" text,
	"manufacturer_before" text,
	"description_before" text,
	"qty_before" numeric,
	"qty_type_before" text,
	"unit_dn_before" numeric,
	"type_after" text,
	"catalog_no_after" text,
	"manufacturer_after" text,
	"description_after" text,
	"qty_after" numeric,
	"qty_type_after" text,
	"unit_dn_after" numeric,
	"line_total_delta" numeric,
	"reason_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"co_no" text NOT NULL,
	"version_no_before" integer NOT NULL,
	"version_no_after" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"description" text,
	"reason" text,
	"custom_email_message" text,
	"net_amount_change" numeric DEFAULT '0',
	"sent_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejected_reason" text,
	"applied_by_user_id" uuid,
	"qbo_id" text,
	"qbo_status" text DEFAULT 'not_pushed' NOT NULL,
	"qbo_pushed_at" timestamp with time zone,
	"qbo_last_error" text,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "change_orders_co_no_unique" UNIQUE("co_no")
);
--> statement-breakpoint
ALTER TABLE "change_order_lines" ADD CONSTRAINT "change_order_lines_change_order_id_change_orders_id_fk" FOREIGN KEY ("change_order_id") REFERENCES "public"."change_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_order_lines" ADD CONSTRAINT "change_order_lines_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_applied_by_user_id_users_id_fk" FOREIGN KEY ("applied_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_order_lines_co_idx" ON "change_order_lines" USING btree ("change_order_id");--> statement-breakpoint
CREATE INDEX "change_order_lines_order_line_idx" ON "change_order_lines" USING btree ("order_line_id");
ALTER TABLE "projects" ADD COLUMN "phase" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "project_type" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "design_lead_user_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "second_designer_user_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sales_person_user_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "ca_manager_user_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "service_type" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "ifc_sub_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "expected_order_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sales_tax_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "projected_design_fee_total" numeric;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "emails_for_budgets" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "emails_for_quotes_so" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "emails_for_shipment_updates" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "delivery_site_contact_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "delivery_site_contact_phone" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "job_site_contact_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "job_site_contact_phone" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "num_units_rooms" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "unit_room_sf" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "garage_sf" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "boh_sf" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "open_office_sf" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "private_office_sf" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "corridor_area_sf" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "amenity_area_sf" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "unfinished_office_sf" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "project_stats" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_design_lead_user_id_users_id_fk" FOREIGN KEY ("design_lead_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_second_designer_user_id_users_id_fk" FOREIGN KEY ("second_designer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_sales_person_user_id_users_id_fk" FOREIGN KEY ("sales_person_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_ca_manager_user_id_users_id_fk" FOREIGN KEY ("ca_manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE TABLE "qbo_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment" text NOT NULL,
	"realm_id" text NOT NULL,
	"access_token_ciphertext" text NOT NULL,
	"refresh_token_ciphertext" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"default_income_account_id" text,
	"default_income_account_name" text,
	"default_cogs_account_id" text,
	"default_cogs_account_name" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"connected_by_user_id" uuid,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "qbo_item_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "qbo_status" text DEFAULT 'not_pushed' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "qbo_pushed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "qbo_last_error" text;--> statement-breakpoint
ALTER TABLE "qbo_connections" ADD CONSTRAINT "qbo_connections_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
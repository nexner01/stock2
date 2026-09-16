CREATE TABLE `collection_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_key` text NOT NULL,
	`status` text NOT NULL,
	`market_timestamp` text,
	`collected_at` text NOT NULL,
	`payload_json` text NOT NULL,
	`validation_succeeded` integer NOT NULL,
	`diagnostic_id` text
);
--> statement-breakpoint
CREATE INDEX `collection_runs_group_collected_at` ON `collection_runs` (`group_key`,`collected_at`);--> statement-breakpoint
CREATE TABLE `group_states` (
	`group_key` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL,
	`diagnostic_id` text
);
--> statement-breakpoint
CREATE TABLE `healthy_snapshots` (
	`group_key` text PRIMARY KEY NOT NULL,
	`run_id` integer NOT NULL,
	`market_timestamp` text NOT NULL,
	`collected_at` text NOT NULL,
	`payload_json` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `collection_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `index_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`exchange` text NOT NULL,
	`market_timestamp` text NOT NULL,
	`collected_at` text NOT NULL,
	`price` text NOT NULL,
	`previous_close` text NOT NULL,
	`change_percent` text NOT NULL,
	`currency` text NOT NULL,
	`market_status` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `index_snapshot_identity_unique` ON `index_snapshots` (`symbol`,`exchange`,`market_timestamp`,`source`);--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`exchange` text NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`kind` text NOT NULL,
	`provider_symbol` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instruments_symbol_exchange_unique` ON `instruments` (`symbol`,`exchange`);--> statement-breakpoint
CREATE UNIQUE INDEX `instruments_provider_symbol_unique` ON `instruments` (`provider_symbol`);--> statement-breakpoint
CREATE TABLE `latest_collection_results` (
	`group_key` text PRIMARY KEY NOT NULL,
	`run_id` integer NOT NULL,
	`market_timestamp` text,
	`collected_at` text NOT NULL,
	`payload_json` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `collection_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ohlcv_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`exchange` text NOT NULL,
	`interval` text NOT NULL,
	`timestamp` text NOT NULL,
	`open` text NOT NULL,
	`high` text NOT NULL,
	`low` text NOT NULL,
	`close` text NOT NULL,
	`adjusted_close` text NOT NULL,
	`volume` text NOT NULL,
	`currency` text NOT NULL,
	`source` text NOT NULL,
	CONSTRAINT "ohlcv_non_negative_values" CHECK(cast("ohlcv_records"."open" as real) >= 0 and cast("ohlcv_records"."high" as real) >= 0 and cast("ohlcv_records"."low" as real) >= 0 and cast("ohlcv_records"."close" as real) >= 0 and cast("ohlcv_records"."adjusted_close" as real) >= 0 and cast("ohlcv_records"."volume" as real) >= 0),
	CONSTRAINT "ohlcv_price_relationships" CHECK(cast("ohlcv_records"."high" as real) >= cast("ohlcv_records"."open" as real) and cast("ohlcv_records"."high" as real) >= cast("ohlcv_records"."low" as real) and cast("ohlcv_records"."high" as real) >= cast("ohlcv_records"."close" as real) and cast("ohlcv_records"."low" as real) <= cast("ohlcv_records"."open" as real) and cast("ohlcv_records"."low" as real) <= cast("ohlcv_records"."high" as real) and cast("ohlcv_records"."low" as real) <= cast("ohlcv_records"."close" as real)),
	CONSTRAINT "ohlcv_integer_volume" CHECK(cast("ohlcv_records"."volume" as real) = cast("ohlcv_records"."volume" as integer)),
	CONSTRAINT "ohlcv_utc_timestamp" CHECK("ohlcv_records"."timestamp" like '%Z')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ohlcv_identity_unique` ON `ohlcv_records` (`symbol`,`exchange`,`interval`,`timestamp`,`source`);--> statement-breakpoint
CREATE INDEX `ohlcv_range_lookup` ON `ohlcv_records` (`symbol`,`exchange`,`interval`,`timestamp`);--> statement-breakpoint
CREATE TABLE `quote_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`exchange` text NOT NULL,
	`market_timestamp` text NOT NULL,
	`collected_at` text NOT NULL,
	`price` text NOT NULL,
	`previous_close` text NOT NULL,
	`change_percent` text NOT NULL,
	`currency` text NOT NULL,
	`market_status` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_snapshot_identity_unique` ON `quote_snapshots` (`symbol`,`exchange`,`market_timestamp`,`source`);
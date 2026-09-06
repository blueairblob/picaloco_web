// Hand-authored against the live `rat` schema (verified via direct psql inspection and PostgREST
// queries, 2026-09-06 — see filemaker_sync/devlog/worksheet.md Session 14). Not a `supabase gen
// types` output: this instance's DB credentials aren't wired into a type-gen workflow yet.
// Covers only what this app queries: `mobile_catalog_view` + the small lookup tables.
//
// Reference only — not currently passed as createClient's generic (client.ts explains why). Domain
// types (src/types/catalog.ts) are what services/*.ts actually returns to the rest of the app.

export interface Database {
  rat: {
    Tables: {
      photographer: { Row: { id: string; name: string | null } }
      location: { Row: { id: string; name: string | null } }
      organisation: { Row: { id: string; name: string | null; type: string | null } }
      collection: { Row: { id: string; name: string | null } }
      country: { Row: { id: string; name: string | null } }
      route: { Row: { id: string; name: string | null } }
      builder: { Row: { id: string; code: string | null; name: string | null } }
    }
    Views: {
      mobile_catalog_view: {
        Row: {
          image_no: string
          category: string | null
          date_taken: string | null
          circa: string | null
          imprecise_date: string | null
          description: string | null
          gauge: string | null
          thumbnail_url: string | null
          country: string | null
          organisation: string | null
          organisation_type: string | null
          location: string | null
          route: string | null
          collection: string | null
          photographer: string | null
          prints_allowed: boolean | null
          internet_use: boolean | null
          publications_use: boolean | null
          builders: Array<{
            builder_name: string | null
            builder_code: string | null
            works_number: string | null
            year_built: string | null
            plant_code: string | null
            builder_order: number | null
          }> | null
          file_type: string | null
          width: number | null
          height: number | null
          resolution: string | null
          colour_space: string | null
          colour_mode: string | null
          cd_no: string | null
          cd_no_hr: string | null
          bw_image_no: string | null
          bw_cd_no: string | null
          active_area: string | null
          corporate_body: string | null
          facility: string | null
          last_updated: string | null
        }
      }
    }
  }
}

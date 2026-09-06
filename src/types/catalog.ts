export interface Builder {
  builder_name: string | null
  builder_code: string | null
  works_number: string | null
  year_built: string | null
  plant_code: string | null
  builder_order: number | null
}

export interface CatalogPhoto {
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
  builders: Builder[] | null
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

export interface CatalogFilters {
  category?: string
  photographer?: string
  location?: string
  organisation?: string
  country?: string
  route?: string
  collection?: string
  gauge?: string
  dateFrom?: string
  dateTo?: string
  builderCode?: string
  worksNumber?: string
}

export interface SearchParams {
  imageNo?: string
  freeText?: string
  filters?: CatalogFilters
  page: number
  pageSize: number
}

export interface SearchResult {
  photos: CatalogPhoto[]
  count: number | null
  countIsExact: boolean
}

export interface LookupOption {
  id: string
  name: string
}

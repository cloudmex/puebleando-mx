export type EventStatus = 'nuevo' | 'actualizado' | 'duplicado' | 'pendiente_revision' | 'publicado' | 'descartado';

export interface ScrapingSource {
  id: string;
  name: string;
  base_url: string;
  default_category?: string;
  parser_config: {
    selectors?: {
      item?: string;
      title?: string;
      description?: string;
      date?: string;
      venue?: string;
      address?: string;
      image?: string;
      price?: string;
    };
    patterns?: {
      date_regex?: string;
      date_format?: string;
    };
    depth?: number;
    max_pages?: number;
    render?: boolean;
  };
  is_active: boolean;
  last_run_at?: string;
  frequency_hours: number;
  target_location?: string;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description?: string;
  short_description?: string;
  source_name: string;
  source_url: string;
  source_type: string;
  category?: string;
  subcategory?: string;
  tags: string[];
  start_date: string;
  end_date?: string;
  time_text?: string;
  venue_name?: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  price_text?: string;
  is_free: boolean;
  image_url?: string;
  scraped_at: string;
  updated_at: string;
  published_at?: string;
  status: EventStatus;
  confidence_score: number;
  dedup_hash?: string;
}

export interface ScrapingJob {
  id: string;
  source_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  finished_at?: string;
  total_scraped: number;
  new_events: number;
  updated_events: number;
  failed_events: number;
  error_message?: string;
}

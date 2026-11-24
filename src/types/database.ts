import type { Listing, ReportReason } from './listing'

export type Database = {
  public: {
    Tables: {
      listings: {
        Row: Listing
        Insert: {
          id?: string
          title: string
          description?: string | null
          quantity?: string | null
          category?: string | null
          photo_url?: string | null
          location_text: string
          approx_latitude?: number | null
          approx_longitude?: number | null
          pickup_window_start: string
          pickup_window_end: string
          status?: 'available' | 'claimed' | 'picked_up'
          posted_by: string
          claimed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          quantity?: string | null
          category?: string | null
          photo_url?: string | null
          location_text?: string
          approx_latitude?: number | null
          approx_longitude?: number | null
          pickup_window_start?: string
          pickup_window_end?: string
          status?: 'available' | 'claimed' | 'picked_up'
          posted_by?: string
          claimed_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      listing_pickup_details: {
        Row: {
          listing_id: string
          pickup_address: string
          pickup_instructions: string | null
          contact_phone: string | null
          pickup_latitude: number | null
          pickup_longitude: number | null
        }
        Insert: {
          listing_id: string
          pickup_address: string
          pickup_instructions?: string | null
          contact_phone?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
        }
        Update: {
          listing_id?: string
          pickup_address?: string
          pickup_instructions?: string | null
          contact_phone?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
        }
        Relationships: []
      }
      listing_reports: {
        Row: {
          id: string
          listing_id: string
          reported_by: string
          reason: ReportReason
          details: string | null
          created_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          reported_by: string
          reason: ReportReason
          details?: string | null
          created_at?: string
        }
        Update: {
          reason?: ReportReason
          details?: string | null
        }
        Relationships: []
      }
      listing_messages: {
        Row: {
          id: string
          listing_id: string
          sender_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          sender_id: string
          body: string
          created_at?: string
        }
        Update: {
          body?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_listing_with_pickup_details: {
        Args: {
          p_title: string
          p_description: string | null
          p_category: string
          p_quantity: string | null
          p_photo_url: string | null
          p_location_text: string
          p_approx_latitude: number
          p_approx_longitude: number
          p_pickup_window_start: string
          p_pickup_window_end: string
          p_pickup_address: string
          p_pickup_latitude: number | null
          p_pickup_longitude: number | null
          p_contact_phone: string
          p_pickup_instructions: string | null
        }
        Returns: Listing | null
      }
      claim_listing: {
        Args: {
          p_listing_id: string
        }
        Returns: Listing | null
      }
      mark_listing_picked_up: {
        Args: {
          p_listing_id: string
        }
        Returns: Listing | null
      }
      cancel_listing: {
        Args: {
          p_listing_id: string
        }
        Returns: boolean
      }
      unclaim_listing: {
        Args: {
          p_listing_id: string
        }
        Returns: Listing | null
      }
      report_listing: {
        Args: {
          p_listing_id: string
          p_reason: ReportReason
          p_details: string | null
        }
        Returns: string
      }
      send_listing_message: {
        Args: {
          p_listing_id: string
          p_body: string
        }
        Returns: {
          id: string
          listing_id: string
          sender_id: string
          body: string
          created_at: string
        }
      }
      edit_listing: {
        Args: {
          p_listing_id: string
          p_title: string
          p_description: string | null
          p_quantity: string | null
          p_pickup_window_end: string
        }
        Returns: Listing | null
      }
    }
  }
}

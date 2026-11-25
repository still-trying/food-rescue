import type {
  DietaryType,
  Listing,
  OrganizationType,
  ReportReason,
  StorageType,
  UserProfile,
} from './listing'

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
          pickup_pin?: string | null
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
      profiles: {
        Row: UserProfile
        Insert: {
          id: string
          display_name?: string | null
          organization_name?: string | null
          organization_type?: OrganizationType | null
          is_verified?: boolean
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          organization_name?: string | null
          organization_type?: OrganizationType | null
          updated_at?: string
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
      get_listings_feed: {
        Args: {
          p_limit?: number
          p_offset?: number
        }
        Returns: Listing[]
      }
      set_listing_safety_metadata: {
        Args: {
          p_listing_id: string
          p_dietary_type: DietaryType | null
          p_allergens: string[]
          p_storage_type: StorageType | null
        }
        Returns: Listing | null
      }
      generate_pickup_pin: {
        Args: {
          p_listing_id: string
        }
        Returns: string
      }
      verify_and_mark_picked_up: {
        Args: {
          p_listing_id: string
          p_pin: string
        }
        Returns: Listing | null
      }
    }
  }
}

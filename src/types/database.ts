export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      campaigns: {
        Row: {
          audience: NonNullable<Json>;
          body: string;
          channel: Database['public']['Enums']['campaign_channel'];
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          restaurant_id: string;
          scheduled_at: string | null;
          sent_at: string | null;
          stats: NonNullable<Json>;
          status: Database['public']['Enums']['campaign_status'];
          subject: string | null;
          updated_at: string;
        };
        Insert: {
          audience?: NonNullable<Json>;
          body?: string;
          channel: Database['public']['Enums']['campaign_channel'];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          restaurant_id: string;
          scheduled_at?: string | null;
          sent_at?: string | null;
          stats?: NonNullable<Json>;
          status?: Database['public']['Enums']['campaign_status'];
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          audience?: NonNullable<Json>;
          body?: string;
          channel?: Database['public']['Enums']['campaign_channel'];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          restaurant_id?: string;
          scheduled_at?: string | null;
          sent_at?: string | null;
          stats?: NonNullable<Json>;
          status?: Database['public']['Enums']['campaign_status'];
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaigns_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          emoji: string | null;
          id: string;
          is_active: boolean;
          menu_id: string;
          name: string;
          position: number;
          restaurant_id: string;
          tone: Database['public']['Enums']['accent_tone'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          emoji?: string | null;
          id?: string;
          is_active?: boolean;
          menu_id: string;
          name: string;
          position?: number;
          restaurant_id: string;
          tone?: Database['public']['Enums']['accent_tone'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          emoji?: string | null;
          id?: string;
          is_active?: boolean;
          menu_id?: string;
          name?: string;
          position?: number;
          restaurant_id?: string;
          tone?: Database['public']['Enums']['accent_tone'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_menu_id_restaurant_id_fkey';
            columns: ['menu_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'menus';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      customers: {
        Row: {
          created_at: string;
          email: string | null;
          first_name: string;
          id: string;
          last_order_at: string | null;
          marketing_opt_in: boolean;
          orders_count: number;
          phone: string | null;
          restaurant_id: string;
          total_spent_cents: number;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          first_name: string;
          id?: string;
          last_order_at?: string | null;
          marketing_opt_in?: boolean;
          orders_count?: number;
          phone?: string | null;
          restaurant_id: string;
          total_spent_cents?: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          first_name?: string;
          id?: string;
          last_order_at?: string | null;
          marketing_opt_in?: boolean;
          orders_count?: number;
          phone?: string | null;
          restaurant_id?: string;
          total_spent_cents?: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      deliveries: {
        Row: {
          cancelled_at: string | null;
          courier_name: string | null;
          courier_phone: string | null;
          courier_photo_url: string | null;
          courier_vehicle: string | null;
          created_at: string;
          delivered_at: string | null;
          driver_id: string | null;
          dropoff_eta: string | null;
          external_id: string | null;
          failure_reason: string | null;
          fee_cents: number | null;
          handoff_code: string | null;
          id: string;
          idempotency_key: string;
          last_heading: number | null;
          last_lat: number | null;
          last_lng: number | null;
          last_position_at: string | null;
          order_id: string;
          picked_up_at: string | null;
          pickup_eta: string | null;
          proof_photo_url: string | null;
          provider: Database['public']['Enums']['delivery_provider'];
          restaurant_id: string;
          status: Database['public']['Enums']['delivery_status'];
          tracking_url: string | null;
          updated_at: string;
        };
        Insert: {
          cancelled_at?: string | null;
          courier_name?: string | null;
          courier_phone?: string | null;
          courier_photo_url?: string | null;
          courier_vehicle?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          driver_id?: string | null;
          dropoff_eta?: string | null;
          external_id?: string | null;
          failure_reason?: string | null;
          fee_cents?: number | null;
          handoff_code?: string | null;
          id?: string;
          idempotency_key: string;
          last_heading?: number | null;
          last_lat?: number | null;
          last_lng?: number | null;
          last_position_at?: string | null;
          order_id: string;
          picked_up_at?: string | null;
          pickup_eta?: string | null;
          proof_photo_url?: string | null;
          provider: Database['public']['Enums']['delivery_provider'];
          restaurant_id: string;
          status?: Database['public']['Enums']['delivery_status'];
          tracking_url?: string | null;
          updated_at?: string;
        };
        Update: {
          cancelled_at?: string | null;
          courier_name?: string | null;
          courier_phone?: string | null;
          courier_photo_url?: string | null;
          courier_vehicle?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          driver_id?: string | null;
          dropoff_eta?: string | null;
          external_id?: string | null;
          failure_reason?: string | null;
          fee_cents?: number | null;
          handoff_code?: string | null;
          id?: string;
          idempotency_key?: string;
          last_heading?: number | null;
          last_lat?: number | null;
          last_lng?: number | null;
          last_position_at?: string | null;
          order_id?: string;
          picked_up_at?: string | null;
          pickup_eta?: string | null;
          proof_photo_url?: string | null;
          provider?: Database['public']['Enums']['delivery_provider'];
          restaurant_id?: string;
          status?: Database['public']['Enums']['delivery_status'];
          tracking_url?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'deliveries_driver_id_restaurant_id_fkey';
            columns: ['driver_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id', 'restaurant_id'];
          },
          {
            foreignKeyName: 'deliveries_order_id_restaurant_id_fkey';
            columns: ['order_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      delivery_events: {
        Row: {
          created_at: string;
          delivery_id: string;
          id: string;
          occurred_at: string;
          payload: NonNullable<Json>;
          provider_status: string | null;
          restaurant_id: string;
          status: Database['public']['Enums']['delivery_status'];
        };
        Insert: {
          created_at?: string;
          delivery_id: string;
          id?: string;
          occurred_at?: string;
          payload?: NonNullable<Json>;
          provider_status?: string | null;
          restaurant_id: string;
          status: Database['public']['Enums']['delivery_status'];
        };
        Update: {
          created_at?: string;
          delivery_id?: string;
          id?: string;
          occurred_at?: string;
          payload?: NonNullable<Json>;
          provider_status?: string | null;
          restaurant_id?: string;
          status?: Database['public']['Enums']['delivery_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'delivery_events_delivery_id_restaurant_id_fkey';
            columns: ['delivery_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'deliveries';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      delivery_provider_logs: {
        Row: {
          created_at: string;
          delivery_id: string | null;
          direction: Database['public']['Enums']['log_direction'];
          duration_ms: number | null;
          error: string | null;
          http_status: number | null;
          id: string;
          operation: string;
          provider: Database['public']['Enums']['delivery_provider'];
          request: Json | null;
          response: Json | null;
          restaurant_id: string;
          success: boolean;
        };
        Insert: {
          created_at?: string;
          delivery_id?: string | null;
          direction: Database['public']['Enums']['log_direction'];
          duration_ms?: number | null;
          error?: string | null;
          http_status?: number | null;
          id?: string;
          operation: string;
          provider: Database['public']['Enums']['delivery_provider'];
          request?: Json | null;
          response?: Json | null;
          restaurant_id: string;
          success: boolean;
        };
        Update: {
          created_at?: string;
          delivery_id?: string | null;
          direction?: Database['public']['Enums']['log_direction'];
          duration_ms?: number | null;
          error?: string | null;
          http_status?: number | null;
          id?: string;
          operation?: string;
          provider?: Database['public']['Enums']['delivery_provider'];
          request?: Json | null;
          response?: Json | null;
          restaurant_id?: string;
          success?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'delivery_provider_logs_delivery_id_fkey';
            columns: ['delivery_id'];
            isOneToOne: false;
            referencedRelation: 'deliveries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'delivery_provider_logs_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      delivery_tracks: {
        Row: {
          accuracy: number | null;
          delivery_id: string;
          heading: number | null;
          id: number;
          lat: number;
          lng: number;
          recorded_at: string;
          restaurant_id: string;
          speed: number | null;
        };
        Insert: {
          accuracy?: number | null;
          delivery_id: string;
          heading?: number | null;
          id?: never;
          lat: number;
          lng: number;
          recorded_at?: string;
          restaurant_id: string;
          speed?: number | null;
        };
        Update: {
          accuracy?: number | null;
          delivery_id?: string;
          heading?: number | null;
          id?: never;
          lat?: number;
          lng?: number;
          recorded_at?: string;
          restaurant_id?: string;
          speed?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'delivery_tracks_delivery_id_restaurant_id_fkey';
            columns: ['delivery_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'deliveries';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      delivery_zones: {
        Row: {
          created_at: string;
          eta_minutes: number;
          fee_cents: number;
          free_above_cents: number | null;
          id: string;
          is_active: boolean;
          kind: Database['public']['Enums']['zone_kind'];
          location_id: string;
          min_order_cents: number;
          name: string;
          polygon: Json | null;
          position: number;
          radius_m: number | null;
          restaurant_id: string;
          tone: Database['public']['Enums']['accent_tone'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          eta_minutes?: number;
          fee_cents?: number;
          free_above_cents?: number | null;
          id?: string;
          is_active?: boolean;
          kind: Database['public']['Enums']['zone_kind'];
          location_id: string;
          min_order_cents?: number;
          name: string;
          polygon?: Json | null;
          position?: number;
          radius_m?: number | null;
          restaurant_id: string;
          tone?: Database['public']['Enums']['accent_tone'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          eta_minutes?: number;
          fee_cents?: number;
          free_above_cents?: number | null;
          id?: string;
          is_active?: boolean;
          kind?: Database['public']['Enums']['zone_kind'];
          location_id?: string;
          min_order_cents?: number;
          name?: string;
          polygon?: Json | null;
          position?: number;
          radius_m?: number | null;
          restaurant_id?: string;
          tone?: Database['public']['Enums']['accent_tone'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'delivery_zones_location_id_restaurant_id_fkey';
            columns: ['location_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      drivers: {
        Row: {
          created_at: string;
          display_name: string;
          gps_consent_at: string | null;
          id: string;
          invite_code: string | null;
          invite_expires_at: string | null;
          is_active: boolean;
          last_seen_at: string | null;
          phone: string | null;
          photo_url: string | null;
          restaurant_id: string;
          updated_at: string;
          user_id: string | null;
          vehicle: Database['public']['Enums']['vehicle_type'];
        };
        Insert: {
          created_at?: string;
          display_name: string;
          gps_consent_at?: string | null;
          id?: string;
          invite_code?: string | null;
          invite_expires_at?: string | null;
          is_active?: boolean;
          last_seen_at?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          restaurant_id: string;
          updated_at?: string;
          user_id?: string | null;
          vehicle?: Database['public']['Enums']['vehicle_type'];
        };
        Update: {
          created_at?: string;
          display_name?: string;
          gps_consent_at?: string | null;
          id?: string;
          invite_code?: string | null;
          invite_expires_at?: string | null;
          is_active?: boolean;
          last_seen_at?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          restaurant_id?: string;
          updated_at?: string;
          user_id?: string | null;
          vehicle?: Database['public']['Enums']['vehicle_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'drivers_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string;
          product_id: string;
          restaurant_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          product_id: string;
          restaurant_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          product_id?: string;
          restaurant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorites_product_id_restaurant_id_fkey';
            columns: ['product_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      jobs: {
        Row: {
          attempts: number;
          created_at: string;
          dedupe_key: string | null;
          id: string;
          kind: string;
          last_error: string | null;
          locked_at: string | null;
          max_attempts: number;
          payload: NonNullable<Json>;
          run_at: string;
          status: Database['public']['Enums']['job_status'];
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          kind: string;
          last_error?: string | null;
          locked_at?: string | null;
          max_attempts?: number;
          payload?: NonNullable<Json>;
          run_at?: string;
          status?: Database['public']['Enums']['job_status'];
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          kind?: string;
          last_error?: string | null;
          locked_at?: string | null;
          max_attempts?: number;
          payload?: NonNullable<Json>;
          run_at?: string;
          status?: Database['public']['Enums']['job_status'];
          updated_at?: string;
        };
        Relationships: [];
      };
      location_closures: {
        Row: {
          ends_on: string;
          id: string;
          location_id: string;
          reason: string | null;
          restaurant_id: string;
          starts_on: string;
        };
        Insert: {
          ends_on: string;
          id?: string;
          location_id: string;
          reason?: string | null;
          restaurant_id: string;
          starts_on: string;
        };
        Update: {
          ends_on?: string;
          id?: string;
          location_id?: string;
          reason?: string | null;
          restaurant_id?: string;
          starts_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'location_closures_location_id_restaurant_id_fkey';
            columns: ['location_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      locations: {
        Row: {
          address_line: string;
          city: string;
          country: string;
          created_at: string;
          delivery_assignment: Database['public']['Enums']['assignment_mode'];
          delivery_enabled: boolean;
          delivery_provider: Database['public']['Enums']['delivery_provider'];
          id: string;
          is_active: boolean;
          lat: number;
          lng: number;
          menu_id: string | null;
          name: string;
          on_site_payment_enabled: boolean;
          phone: string | null;
          pickup_enabled: boolean;
          postal_code: string;
          prep_time_minutes: number;
          restaurant_id: string;
          rush_extra_minutes: number;
          rush_mode: Database['public']['Enums']['rush_mode'];
          slot_capacity: number;
          slot_interval_minutes: number;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address_line: string;
          city: string;
          country?: string;
          created_at?: string;
          delivery_assignment?: Database['public']['Enums']['assignment_mode'];
          delivery_enabled?: boolean;
          delivery_provider?: Database['public']['Enums']['delivery_provider'];
          id?: string;
          is_active?: boolean;
          lat: number;
          lng: number;
          menu_id?: string | null;
          name: string;
          on_site_payment_enabled?: boolean;
          phone?: string | null;
          pickup_enabled?: boolean;
          postal_code: string;
          prep_time_minutes?: number;
          restaurant_id: string;
          rush_extra_minutes?: number;
          rush_mode?: Database['public']['Enums']['rush_mode'];
          slot_capacity?: number;
          slot_interval_minutes?: number;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          address_line?: string;
          city?: string;
          country?: string;
          created_at?: string;
          delivery_assignment?: Database['public']['Enums']['assignment_mode'];
          delivery_enabled?: boolean;
          delivery_provider?: Database['public']['Enums']['delivery_provider'];
          id?: string;
          is_active?: boolean;
          lat?: number;
          lng?: number;
          menu_id?: string | null;
          name?: string;
          on_site_payment_enabled?: boolean;
          phone?: string | null;
          pickup_enabled?: boolean;
          postal_code?: string;
          prep_time_minutes?: number;
          restaurant_id?: string;
          rush_extra_minutes?: number;
          rush_mode?: Database['public']['Enums']['rush_mode'];
          slot_capacity?: number;
          slot_interval_minutes?: number;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'locations_menu_id_restaurant_id_fkey';
            columns: ['menu_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'menus';
            referencedColumns: ['id', 'restaurant_id'];
          },
          {
            foreignKeyName: 'locations_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      loyalty_accounts: {
        Row: {
          balance: number;
          customer_id: string;
          id: string;
          lifetime: number;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          balance?: number;
          customer_id: string;
          id?: string;
          lifetime?: number;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          balance?: number;
          customer_id?: string;
          id?: string;
          lifetime?: number;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'loyalty_accounts_customer_id_restaurant_id_fkey';
            columns: ['customer_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      menus: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'menus_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      opening_hours: {
        Row: {
          closes_at: string;
          id: string;
          location_id: string;
          opens_at: string;
          restaurant_id: string;
          service: Database['public']['Enums']['fulfillment_type'];
          weekday: number;
        };
        Insert: {
          closes_at: string;
          id?: string;
          location_id: string;
          opens_at: string;
          restaurant_id: string;
          service: Database['public']['Enums']['fulfillment_type'];
          weekday: number;
        };
        Update: {
          closes_at?: string;
          id?: string;
          location_id?: string;
          opens_at?: string;
          restaurant_id?: string;
          service?: Database['public']['Enums']['fulfillment_type'];
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'opening_hours_location_id_restaurant_id_fkey';
            columns: ['location_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      option_groups: {
        Row: {
          id: string;
          max_select: number;
          min_select: number;
          name: string;
          position: number;
          product_id: string;
          restaurant_id: string;
        };
        Insert: {
          id?: string;
          max_select?: number;
          min_select?: number;
          name: string;
          position?: number;
          product_id: string;
          restaurant_id: string;
        };
        Update: {
          id?: string;
          max_select?: number;
          min_select?: number;
          name?: string;
          position?: number;
          product_id?: string;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'option_groups_product_id_restaurant_id_fkey';
            columns: ['product_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      options: {
        Row: {
          group_id: string;
          id: string;
          is_active: boolean;
          name: string;
          position: number;
          price_delta_cents: number;
          restaurant_id: string;
        };
        Insert: {
          group_id: string;
          id?: string;
          is_active?: boolean;
          name: string;
          position?: number;
          price_delta_cents?: number;
          restaurant_id: string;
        };
        Update: {
          group_id?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          position?: number;
          price_delta_cents?: number;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'options_group_id_restaurant_id_fkey';
            columns: ['group_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'option_groups';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          name: string;
          notes: string | null;
          options: NonNullable<Json>;
          order_id: string;
          product_id: string | null;
          quantity: number;
          restaurant_id: string;
          total_cents: number;
          unit_price_cents: number;
        };
        Insert: {
          id?: string;
          name: string;
          notes?: string | null;
          options?: NonNullable<Json>;
          order_id: string;
          product_id?: string | null;
          quantity: number;
          restaurant_id: string;
          total_cents: number;
          unit_price_cents: number;
        };
        Update: {
          id?: string;
          name?: string;
          notes?: string | null;
          options?: NonNullable<Json>;
          order_id?: string;
          product_id?: string | null;
          quantity?: number;
          restaurant_id?: string;
          total_cents?: number;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_restaurant_id_fkey';
            columns: ['order_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id', 'restaurant_id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          accepted_at: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          customer_email: string | null;
          customer_id: string | null;
          customer_name: string;
          customer_phone: string | null;
          customer_user_id: string | null;
          delivery_address: Json | null;
          delivery_fee_cents: number;
          delivery_lat: number | null;
          delivery_lng: number | null;
          delivery_zone_id: string | null;
          discount_cents: number;
          estimated_ready_at: string | null;
          extra_minutes: number;
          fulfillment: Database['public']['Enums']['fulfillment_type'];
          id: string;
          locale: string;
          location_id: string;
          notes: string | null;
          number: number;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status: Database['public']['Enums']['payment_status'];
          placed_at: string | null;
          promo_code_id: string | null;
          public_token: string;
          ready_at: string | null;
          restaurant_id: string;
          scheduled_for: string | null;
          status: Database['public']['Enums']['order_status'];
          stripe_payment_intent_id: string | null;
          subtotal_cents: number;
          tip_cents: number;
          total_cents: number;
          tracking_expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name: string;
          customer_phone?: string | null;
          customer_user_id?: string | null;
          delivery_address?: Json | null;
          delivery_fee_cents?: number;
          delivery_lat?: number | null;
          delivery_lng?: number | null;
          delivery_zone_id?: string | null;
          discount_cents?: number;
          estimated_ready_at?: string | null;
          extra_minutes?: number;
          fulfillment: Database['public']['Enums']['fulfillment_type'];
          id?: string;
          locale?: string;
          location_id: string;
          notes?: string | null;
          number: number;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status?: Database['public']['Enums']['payment_status'];
          placed_at?: string | null;
          promo_code_id?: string | null;
          public_token?: string;
          ready_at?: string | null;
          restaurant_id: string;
          scheduled_for?: string | null;
          status?: Database['public']['Enums']['order_status'];
          stripe_payment_intent_id?: string | null;
          subtotal_cents: number;
          tip_cents?: number;
          total_cents: number;
          tracking_expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name?: string;
          customer_phone?: string | null;
          customer_user_id?: string | null;
          delivery_address?: Json | null;
          delivery_fee_cents?: number;
          delivery_lat?: number | null;
          delivery_lng?: number | null;
          delivery_zone_id?: string | null;
          discount_cents?: number;
          estimated_ready_at?: string | null;
          extra_minutes?: number;
          fulfillment?: Database['public']['Enums']['fulfillment_type'];
          id?: string;
          locale?: string;
          location_id?: string;
          notes?: string | null;
          number?: number;
          payment_method?: Database['public']['Enums']['payment_method'];
          payment_status?: Database['public']['Enums']['payment_status'];
          placed_at?: string | null;
          promo_code_id?: string | null;
          public_token?: string;
          ready_at?: string | null;
          restaurant_id?: string;
          scheduled_for?: string | null;
          status?: Database['public']['Enums']['order_status'];
          stripe_payment_intent_id?: string | null;
          subtotal_cents?: number;
          tip_cents?: number;
          total_cents?: number;
          tracking_expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_customer_id_restaurant_id_fkey';
            columns: ['customer_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id', 'restaurant_id'];
          },
          {
            foreignKeyName: 'orders_delivery_zone_id_restaurant_id_fkey';
            columns: ['delivery_zone_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'delivery_zones';
            referencedColumns: ['id', 'restaurant_id'];
          },
          {
            foreignKeyName: 'orders_location_id_restaurant_id_fkey';
            columns: ['location_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id', 'restaurant_id'];
          },
          {
            foreignKeyName: 'orders_promo_code_id_restaurant_id_fkey';
            columns: ['promo_code_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'promo_codes';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      products: {
        Row: {
          allergens: Database['public']['Enums']['allergen'][];
          category_id: string;
          created_at: string;
          description: string | null;
          diet_tags: Database['public']['Enums']['diet_tag'][];
          id: string;
          image_urls: string[];
          is_active: boolean;
          is_sold_out: boolean;
          is_upsell: boolean;
          name: string;
          position: number;
          prep_time_minutes: number | null;
          price_cents: number;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          allergens?: Database['public']['Enums']['allergen'][];
          category_id: string;
          created_at?: string;
          description?: string | null;
          diet_tags?: Database['public']['Enums']['diet_tag'][];
          id?: string;
          image_urls?: string[];
          is_active?: boolean;
          is_sold_out?: boolean;
          is_upsell?: boolean;
          name: string;
          position?: number;
          prep_time_minutes?: number | null;
          price_cents: number;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          allergens?: Database['public']['Enums']['allergen'][];
          category_id?: string;
          created_at?: string;
          description?: string | null;
          diet_tags?: Database['public']['Enums']['diet_tag'][];
          id?: string;
          image_urls?: string[];
          is_active?: boolean;
          is_sold_out?: boolean;
          is_upsell?: boolean;
          name?: string;
          position?: number;
          prep_time_minutes?: number | null;
          price_cents?: number;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_id_restaurant_id_fkey';
            columns: ['category_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      promo_codes: {
        Row: {
          code: string;
          created_at: string;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          kind: Database['public']['Enums']['promo_kind'];
          max_uses: number | null;
          min_order_cents: number;
          restaurant_id: string;
          starts_at: string | null;
          updated_at: string;
          uses_count: number;
          value: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          kind: Database['public']['Enums']['promo_kind'];
          max_uses?: number | null;
          min_order_cents?: number;
          restaurant_id: string;
          starts_at?: string | null;
          updated_at?: string;
          uses_count?: number;
          value?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: Database['public']['Enums']['promo_kind'];
          max_uses?: number | null;
          min_order_cents?: number;
          restaurant_id?: string;
          starts_at?: string | null;
          updated_at?: string;
          uses_count?: number;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'promo_codes_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      provider_credentials: {
        Row: {
          created_at: string;
          encrypted_secret: string;
          id: string;
          last_error: string | null;
          last_tested_at: string | null;
          provider: Database['public']['Enums']['delivery_provider'];
          restaurant_id: string;
          secret_hint: string | null;
          status: Database['public']['Enums']['credential_status'];
          updated_at: string;
          webhook_token: string;
        };
        Insert: {
          created_at?: string;
          encrypted_secret: string;
          id?: string;
          last_error?: string | null;
          last_tested_at?: string | null;
          provider: Database['public']['Enums']['delivery_provider'];
          restaurant_id: string;
          secret_hint?: string | null;
          status?: Database['public']['Enums']['credential_status'];
          updated_at?: string;
          webhook_token?: string;
        };
        Update: {
          created_at?: string;
          encrypted_secret?: string;
          id?: string;
          last_error?: string | null;
          last_tested_at?: string | null;
          provider?: Database['public']['Enums']['delivery_provider'];
          restaurant_id?: string;
          secret_hint?: string | null;
          status?: Database['public']['Enums']['credential_status'];
          updated_at?: string;
          webhook_token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'provider_credentials_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurants: {
        Row: {
          accent_color: string;
          cover_url: string | null;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          is_published: boolean;
          locale: string;
          logo_url: string | null;
          loyalty_enabled: boolean;
          loyalty_goal: number;
          loyalty_kind: Database['public']['Enums']['loyalty_kind'];
          loyalty_reward_cents: number;
          name: string;
          onboarding_step: number;
          order_seq: number;
          plan: string;
          slug: string;
          stripe_account_id: string | null;
          stripe_charges_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          accent_color?: string;
          cover_url?: string | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_published?: boolean;
          locale?: string;
          logo_url?: string | null;
          loyalty_enabled?: boolean;
          loyalty_goal?: number;
          loyalty_kind?: Database['public']['Enums']['loyalty_kind'];
          loyalty_reward_cents?: number;
          name: string;
          onboarding_step?: number;
          order_seq?: number;
          plan?: string;
          slug: string;
          stripe_account_id?: string | null;
          stripe_charges_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          accent_color?: string;
          cover_url?: string | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_published?: boolean;
          locale?: string;
          logo_url?: string | null;
          loyalty_enabled?: boolean;
          loyalty_goal?: number;
          loyalty_kind?: Database['public']['Enums']['loyalty_kind'];
          loyalty_reward_cents?: number;
          name?: string;
          onboarding_step?: number;
          order_seq?: number;
          plan?: string;
          slug?: string;
          stripe_account_id?: string | null;
          stripe_charges_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          account: string | null;
          id: string;
          received_at: string;
          type: string;
        };
        Insert: {
          account?: string | null;
          id: string;
          received_at?: string;
          type: string;
        };
        Update: {
          account?: string | null;
          id?: string;
          received_at?: string;
          type?: string;
        };
        Relationships: [];
      };
      time_slots: {
        Row: {
          capacity: number | null;
          id: string;
          is_blocked: boolean;
          location_id: string;
          restaurant_id: string;
          starts_at: string;
        };
        Insert: {
          capacity?: number | null;
          id?: string;
          is_blocked?: boolean;
          location_id: string;
          restaurant_id: string;
          starts_at: string;
        };
        Update: {
          capacity?: number | null;
          id?: string;
          is_blocked?: boolean;
          location_id?: string;
          restaurant_id?: string;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'time_slots_location_id_restaurant_id_fkey';
            columns: ['location_id', 'restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id', 'restaurant_id'];
          },
        ];
      };
      users_roles: {
        Row: {
          created_at: string;
          id: string;
          restaurant_id: string;
          role: Database['public']['Enums']['member_role'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          restaurant_id: string;
          role: Database['public']['Enums']['member_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          restaurant_id?: string;
          role?: Database['public']['Enums']['member_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'users_roles_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_restaurant: {
        Args: { p_location: Json; p_name: string; p_slug: string };
        Returns: string;
      };
      has_role: {
        Args: { p_restaurant_id: string; p_roles?: Database['public']['Enums']['member_role'][] };
        Returns: boolean;
      };
      is_assigned_driver: { Args: { p_delivery_id: string }; Returns: boolean };
      is_manager: { Args: { p_restaurant_id: string }; Returns: boolean };
      is_owner: { Args: { p_restaurant_id: string }; Returns: boolean };
      is_public_restaurant: { Args: { p_restaurant_id: string }; Returns: boolean };
      is_staff: { Args: { p_restaurant_id: string }; Returns: boolean };
      mark_order_paid: {
        Args: { p_amount_cents: number; p_payment_intent: string };
        Returns: string;
      };
      order_transition_allowed: {
        Args: {
          p_from: Database['public']['Enums']['order_status'];
          p_to: Database['public']['Enums']['order_status'];
        };
        Returns: boolean;
      };
      owns_order: { Args: { p_order_id: string }; Returns: boolean };
      place_order: {
        Args: { p: Json };
        Returns: {
          order_id: string;
          order_number: number;
          order_token: string;
        }[];
      };
      purge_delivery_tracks: { Args: { p_older_than?: string }; Returns: number };
      random_token: { Args: { p_bytes?: number }; Returns: string };
      redeem_driver_invite: { Args: { p_code: string }; Returns: string };
      replace_opening_hours: {
        Args: {
          p_location_id: string;
          p_ranges: Json;
          p_service: Database['public']['Enums']['fulfillment_type'];
        };
        Returns: number;
      };
      slot_load: {
        Args: { p_from: string; p_location_id: string; p_to: string };
        Returns: {
          orders_count: number;
          slot_start: string;
        }[];
      };
    };
    Enums: {
      accent_tone: 'blue' | 'violet' | 'pink' | 'orange' | 'green';
      allergen:
        | 'gluten'
        | 'crustaceans'
        | 'eggs'
        | 'fish'
        | 'peanuts'
        | 'soy'
        | 'milk'
        | 'nuts'
        | 'celery'
        | 'mustard'
        | 'sesame'
        | 'sulphites'
        | 'lupin'
        | 'molluscs';
      assignment_mode: 'manual' | 'auto';
      campaign_channel: 'email' | 'sms';
      campaign_status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
      credential_status: 'connected' | 'error' | 'disconnected';
      delivery_provider: 'internal' | 'uber_direct' | 'stuart' | 'shipday';
      delivery_status:
        | 'pending'
        | 'assigned'
        | 'en_route_to_pickup'
        | 'at_pickup'
        | 'picked_up'
        | 'en_route_to_dropoff'
        | 'arrived'
        | 'delivered'
        | 'cancelled'
        | 'failed';
      diet_tag: 'vegetarian' | 'vegan' | 'gluten_free' | 'spicy' | 'new';
      fulfillment_type: 'pickup' | 'delivery';
      job_status: 'pending' | 'running' | 'succeeded' | 'failed';
      log_direction: 'outbound' | 'inbound';
      loyalty_kind: 'stamps' | 'points';
      member_role: 'owner' | 'manager' | 'kitchen';
      order_status:
        | 'pending_payment'
        | 'new'
        | 'accepted'
        | 'preparing'
        | 'ready'
        | 'in_delivery'
        | 'completed'
        | 'cancelled'
        | 'rejected';
      payment_method: 'card' | 'on_site';
      payment_status: 'pending' | 'paid' | 'unpaid' | 'failed' | 'refunded' | 'partially_refunded';
      promo_kind: 'percent' | 'fixed' | 'free_delivery';
      rush_mode: 'off' | 'extended' | 'paused';
      vehicle_type: 'foot' | 'bike' | 'ebike' | 'scooter' | 'car';
      zone_kind: 'radius' | 'polygon';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      accent_tone: ['blue', 'violet', 'pink', 'orange', 'green'],
      allergen: [
        'gluten',
        'crustaceans',
        'eggs',
        'fish',
        'peanuts',
        'soy',
        'milk',
        'nuts',
        'celery',
        'mustard',
        'sesame',
        'sulphites',
        'lupin',
        'molluscs',
      ],
      assignment_mode: ['manual', 'auto'],
      campaign_channel: ['email', 'sms'],
      campaign_status: ['draft', 'scheduled', 'sending', 'sent', 'cancelled'],
      credential_status: ['connected', 'error', 'disconnected'],
      delivery_provider: ['internal', 'uber_direct', 'stuart', 'shipday'],
      delivery_status: [
        'pending',
        'assigned',
        'en_route_to_pickup',
        'at_pickup',
        'picked_up',
        'en_route_to_dropoff',
        'arrived',
        'delivered',
        'cancelled',
        'failed',
      ],
      diet_tag: ['vegetarian', 'vegan', 'gluten_free', 'spicy', 'new'],
      fulfillment_type: ['pickup', 'delivery'],
      job_status: ['pending', 'running', 'succeeded', 'failed'],
      log_direction: ['outbound', 'inbound'],
      loyalty_kind: ['stamps', 'points'],
      member_role: ['owner', 'manager', 'kitchen'],
      order_status: [
        'pending_payment',
        'new',
        'accepted',
        'preparing',
        'ready',
        'in_delivery',
        'completed',
        'cancelled',
        'rejected',
      ],
      payment_method: ['card', 'on_site'],
      payment_status: ['pending', 'paid', 'unpaid', 'failed', 'refunded', 'partially_refunded'],
      promo_kind: ['percent', 'fixed', 'free_delivery'],
      rush_mode: ['off', 'extended', 'paused'],
      vehicle_type: ['foot', 'bike', 'ebike', 'scooter', 'car'],
      zone_kind: ['radius', 'polygon'],
    },
  },
} as const;

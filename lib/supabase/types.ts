export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_id: string | null
          capa_id: string | null
          created_at: string
          id: string
          incident_id: string | null
          investigation_id: string | null
          payload: Json
          verb: string
        }
        Insert: {
          actor_id?: string | null
          capa_id?: string | null
          created_at?: string
          id?: string
          incident_id?: string | null
          investigation_id?: string | null
          payload?: Json
          verb: string
        }
        Update: {
          actor_id?: string | null
          capa_id?: string | null
          created_at?: string
          id?: string
          incident_id?: string | null
          investigation_id?: string | null
          payload?: Json
          verb?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capas_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations_active"
            referencedColumns: ["id"]
          },
        ]
      }
      capas: {
        Row: {
          closed_at: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          follow_up_capa_id: string | null
          id: string
          incident_id: string | null
          investigation_id: string | null
          org_id: string
          owner_id: string
          progress_pct: number
          re_verify_at: string | null
          ref_code: string | null
          rejection_reason: string | null
          site_id: string
          status: Database["public"]["Enums"]["capa_status"]
          title: string
          type: Database["public"]["Enums"]["capa_type"]
          updated_at: string
          verification_method:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_result:
            | Database["public"]["Enums"]["verification_result"]
            | null
          verified_at: string | null
          verifier_id: string | null
        }
        Insert: {
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          follow_up_capa_id?: string | null
          id?: string
          incident_id?: string | null
          investigation_id?: string | null
          org_id: string
          owner_id: string
          progress_pct?: number
          re_verify_at?: string | null
          ref_code?: string | null
          rejection_reason?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["capa_status"]
          title: string
          type: Database["public"]["Enums"]["capa_type"]
          updated_at?: string
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_result?:
            | Database["public"]["Enums"]["verification_result"]
            | null
          verified_at?: string | null
          verifier_id?: string | null
        }
        Update: {
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          follow_up_capa_id?: string | null
          id?: string
          incident_id?: string | null
          investigation_id?: string | null
          org_id?: string
          owner_id?: string
          progress_pct?: number
          re_verify_at?: string | null
          ref_code?: string | null
          rejection_reason?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["capa_status"]
          title?: string
          type?: Database["public"]["Enums"]["capa_type"]
          updated_at?: string
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_result?:
            | Database["public"]["Enums"]["verification_result"]
            | null
          verified_at?: string | null
          verifier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capas_follow_up_capa_id_fkey"
            columns: ["follow_up_capa_id"]
            isOneToOne: false
            referencedRelation: "capas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_follow_up_capa_id_fkey"
            columns: ["follow_up_capa_id"]
            isOneToOne: false
            referencedRelation: "capas_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_verifier_id_fkey"
            columns: ["verifier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hse_notification_records: {
        Row: {
          created_at: string
          hse_phone_reference: string | null
          id: string
          incident_id: string
          phone_called_at: string | null
          phoned_by: string | null
          riddor_online_reference: string | null
          written_submitted_at: string | null
        }
        Insert: {
          created_at?: string
          hse_phone_reference?: string | null
          id?: string
          incident_id: string
          phone_called_at?: string | null
          phoned_by?: string | null
          riddor_online_reference?: string | null
          written_submitted_at?: string | null
        }
        Update: {
          created_at?: string
          hse_phone_reference?: string | null
          id?: string
          incident_id?: string
          phone_called_at?: string | null
          phoned_by?: string | null
          riddor_online_reference?: string | null
          written_submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hse_notification_records_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hse_notification_records_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hse_notification_records_phoned_by_fkey"
            columns: ["phoned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          incident_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          incident_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          incident_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_attachments_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_attachments_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          area: string | null
          classified_at: string | null
          closed_at: string | null
          created_at: string
          dangerous_occurrence_kind: string | null
          deleted_at: string | null
          description: string | null
          equipment: string | null
          id: string
          is_sandbox: boolean
          location: string | null
          occurred_at: string
          org_id: string
          osha_recordable: boolean
          ppe_worn: string[] | null
          quantity_unit: string | null
          quantity_value: number | null
          ref_code: string | null
          reporter_id: string | null
          riddor_reportable: boolean
          severity: Database["public"]["Enums"]["severity"] | null
          site_id: string
          status: Database["public"]["Enums"]["incident_status"]
          substance: string | null
          title: string
          track: Database["public"]["Enums"]["track"] | null
          type: Database["public"]["Enums"]["incident_type"]
          updated_at: string
        }
        Insert: {
          area?: string | null
          classified_at?: string | null
          closed_at?: string | null
          created_at?: string
          dangerous_occurrence_kind?: string | null
          deleted_at?: string | null
          description?: string | null
          equipment?: string | null
          id?: string
          is_sandbox?: boolean
          location?: string | null
          occurred_at: string
          org_id: string
          osha_recordable?: boolean
          ppe_worn?: string[] | null
          quantity_unit?: string | null
          quantity_value?: number | null
          ref_code?: string | null
          reporter_id?: string | null
          riddor_reportable?: boolean
          severity?: Database["public"]["Enums"]["severity"] | null
          site_id: string
          status?: Database["public"]["Enums"]["incident_status"]
          substance?: string | null
          title: string
          track?: Database["public"]["Enums"]["track"] | null
          type: Database["public"]["Enums"]["incident_type"]
          updated_at?: string
        }
        Update: {
          area?: string | null
          classified_at?: string | null
          closed_at?: string | null
          created_at?: string
          dangerous_occurrence_kind?: string | null
          deleted_at?: string | null
          description?: string | null
          equipment?: string | null
          id?: string
          is_sandbox?: boolean
          location?: string | null
          occurred_at?: string
          org_id?: string
          osha_recordable?: boolean
          ppe_worn?: string[] | null
          quantity_unit?: string | null
          quantity_value?: number | null
          ref_code?: string | null
          reporter_id?: string | null
          riddor_reportable?: boolean
          severity?: Database["public"]["Enums"]["severity"] | null
          site_id?: string
          status?: Database["public"]["Enums"]["incident_status"]
          substance?: string | null
          title?: string
          track?: Database["public"]["Enums"]["track"] | null
          type?: Database["public"]["Enums"]["incident_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      injured_persons: {
        Row: {
          body_parts: Database["public"]["Enums"]["body_part"][] | null
          created_at: string
          date_of_death: string | null
          days_away: number | null
          days_restricted: number | null
          department: string | null
          employment_status:
            | Database["public"]["Enums"]["employment_status"]
            | null
          fatality: boolean
          hospitalized: boolean
          id: string
          incident_id: string
          injury_nature: string | null
          job_title: string | null
          mechanism: string | null
          name: string
          object_substance: string | null
          riddor_specified_injury:
            | Database["public"]["Enums"]["riddor_specified_injury"]
            | null
          supervisor_id: string | null
          treatment: Database["public"]["Enums"]["treatment"] | null
        }
        Insert: {
          body_parts?: Database["public"]["Enums"]["body_part"][] | null
          created_at?: string
          date_of_death?: string | null
          days_away?: number | null
          days_restricted?: number | null
          department?: string | null
          employment_status?:
            | Database["public"]["Enums"]["employment_status"]
            | null
          fatality?: boolean
          hospitalized?: boolean
          id?: string
          incident_id: string
          injury_nature?: string | null
          job_title?: string | null
          mechanism?: string | null
          name: string
          object_substance?: string | null
          riddor_specified_injury?:
            | Database["public"]["Enums"]["riddor_specified_injury"]
            | null
          supervisor_id?: string | null
          treatment?: Database["public"]["Enums"]["treatment"] | null
        }
        Update: {
          body_parts?: Database["public"]["Enums"]["body_part"][] | null
          created_at?: string
          date_of_death?: string | null
          days_away?: number | null
          days_restricted?: number | null
          department?: string | null
          employment_status?:
            | Database["public"]["Enums"]["employment_status"]
            | null
          fatality?: boolean
          hospitalized?: boolean
          id?: string
          incident_id?: string
          injury_nature?: string | null
          job_title?: string | null
          mechanism?: string | null
          name?: string
          object_substance?: string | null
          riddor_specified_injury?:
            | Database["public"]["Enums"]["riddor_specified_injury"]
            | null
          supervisor_id?: string | null
          treatment?: Database["public"]["Enums"]["treatment"] | null
        }
        Relationships: [
          {
            foreignKeyName: "injured_persons_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injured_persons_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injured_persons_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_evidence: {
        Row: {
          file_name: string
          id: string
          investigation_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          type: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          id?: string
          investigation_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          type?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          id?: string
          investigation_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          type?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investigation_evidence_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_evidence_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_team_members: {
        Row: {
          added_at: string
          investigation_id: string
          profile_id: string
          role: Database["public"]["Enums"]["investigation_team_role"]
        }
        Insert: {
          added_at?: string
          investigation_id: string
          profile_id: string
          role?: Database["public"]["Enums"]["investigation_team_role"]
        }
        Update: {
          added_at?: string
          investigation_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["investigation_team_role"]
        }
        Relationships: [
          {
            foreignKeyName: "investigation_team_members_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_team_members_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investigations: {
        Row: {
          closed_at: string | null
          created_at: string
          deleted_at: string | null
          due_date: string | null
          findings: string | null
          id: string
          incident_id: string
          lead_investigator_id: string | null
          org_id: string
          rca_method: string
          ref_code: string | null
          root_cause_summary: string | null
          site_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["investigation_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          findings?: string | null
          id?: string
          incident_id: string
          lead_investigator_id?: string | null
          org_id: string
          rca_method?: string
          ref_code?: string | null
          root_cause_summary?: string | null
          site_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          findings?: string | null
          id?: string
          incident_id?: string
          lead_investigator_id?: string | null
          org_id?: string
          rca_method?: string
          ref_code?: string | null
          root_cause_summary?: string | null
          site_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigations_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_lead_investigator_id_fkey"
            columns: ["lead_investigator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_recipients: {
        Row: {
          created_at: string
          external_email: string | null
          id: string
          notification_kind: Database["public"]["Enums"]["notification_kind"]
          recipient_profile_id: string | null
          site_id: string
        }
        Insert: {
          created_at?: string
          external_email?: string | null
          id?: string
          notification_kind: Database["public"]["Enums"]["notification_kind"]
          recipient_profile_id?: string | null
          site_id: string
        }
        Update: {
          created_at?: string
          external_email?: string | null
          id?: string
          notification_kind?: Database["public"]["Enums"]["notification_kind"]
          recipient_profile_id?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_recipients_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          acknowledged_at: string | null
          body: string | null
          capa_id: string | null
          created_at: string
          deadline_at: string | null
          id: string
          incident_id: string | null
          kind: Database["public"]["Enums"]["notification_kind"]
          recipient_id: string | null
          resolved_at: string | null
          site_id: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          body?: string | null
          capa_id?: string | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          incident_id?: string | null
          kind: Database["public"]["Enums"]["notification_kind"]
          recipient_id?: string | null
          resolved_at?: string | null
          site_id: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          body?: string | null
          capa_id?: string | null
          created_at?: string
          deadline_at?: string | null
          id?: string
          incident_id?: string | null
          kind?: Database["public"]["Enums"]["notification_kind"]
          recipient_id?: string | null
          resolved_at?: string | null
          site_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capas_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          id: string
          industry: Database["public"]["Enums"]["industry_type"] | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: Database["public"]["Enums"]["industry_type"] | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          industry?: Database["public"]["Enums"]["industry_type"] | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          description: string
          key: string
        }
        Insert: {
          description: string
          key: string
        }
        Update: {
          description?: string
          key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          org_id: string
          seen_welcome: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id: string
          org_id: string
          seen_welcome?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          org_id?: string
          seen_welcome?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      rca_whys: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          investigation_id: string
          is_root_cause: boolean | null
          level: number
          question: string | null
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          investigation_id: string
          is_root_cause?: boolean | null
          level: number
          question?: string | null
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          investigation_id?: string
          is_root_cause?: boolean | null
          level?: number
          question?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rca_whys_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rca_whys_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations_active"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_id: string
        }
        Insert: {
          permission_key: string
          role_id: string
        }
        Update: {
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          key: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          key: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          key?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      severity_overrides: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          new_severity: Database["public"]["Enums"]["severity"]
          original_severity: Database["public"]["Enums"]["severity"]
          overridden_by: string
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          new_severity: Database["public"]["Enums"]["severity"]
          original_severity: Database["public"]["Enums"]["severity"]
          overridden_by: string
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          new_severity?: Database["public"]["Enums"]["severity"]
          original_severity?: Database["public"]["Enums"]["severity"]
          overridden_by?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "severity_overrides_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "severity_overrides_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "severity_overrides_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_members: {
        Row: {
          created_at: string
          id: string
          include_children: boolean
          profile_id: string
          role_id: string
          site_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          include_children?: boolean
          profile_id: string
          role_id: string
          site_id: string
        }
        Update: {
          created_at?: string
          id?: string
          include_children?: boolean
          profile_id?: string
          role_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_members_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          country: string
          created_at: string
          id: string
          naics_code: string | null
          name: string
          org_id: string
          osha_establishment_id: string | null
          parent_site_id: string | null
          region: string | null
          setup_completed_at: string | null
          setup_progress: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          country: string
          created_at?: string
          id?: string
          naics_code?: string | null
          name: string
          org_id: string
          osha_establishment_id?: string | null
          parent_site_id?: string | null
          region?: string | null
          setup_completed_at?: string | null
          setup_progress?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          country?: string
          created_at?: string
          id?: string
          naics_code?: string | null
          name?: string
          org_id?: string
          osha_establishment_id?: string | null
          parent_site_id?: string | null
          region?: string | null
          setup_completed_at?: string | null
          setup_progress?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_parent_site_id_fkey"
            columns: ["parent_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          profile_id: string
          role_id: string | null
          team_id: string
        }
        Insert: {
          profile_id: string
          role_id?: string | null
          team_id: string
        }
        Update: {
          profile_id?: string
          role_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_permissions: {
        Row: {
          permission_key: string
          team_id: string
        }
        Insert: {
          permission_key: string
          team_id: string
        }
        Update: {
          permission_key?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "team_permissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_sites: {
        Row: {
          site_id: string
          team_id: string
        }
        Insert: {
          site_id: string
          team_id: string
        }
        Update: {
          site_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_sites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      witnesses: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          incident_id: string
          name: string
          statement: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          incident_id: string
          name: string
          statement?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          name?: string
          statement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "witnesses_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "witnesses_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      capas_active: {
        Row: {
          closed_at: string | null
          completed_at: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          follow_up_capa_id: string | null
          id: string | null
          incident_id: string | null
          investigation_id: string | null
          org_id: string | null
          owner_id: string | null
          progress_pct: number | null
          re_verify_at: string | null
          ref_code: string | null
          rejection_reason: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["capa_status"] | null
          title: string | null
          type: Database["public"]["Enums"]["capa_type"] | null
          updated_at: string | null
          verification_method:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_result:
            | Database["public"]["Enums"]["verification_result"]
            | null
          verified_at: string | null
          verifier_id: string | null
        }
        Insert: {
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          follow_up_capa_id?: string | null
          id?: string | null
          incident_id?: string | null
          investigation_id?: string | null
          org_id?: string | null
          owner_id?: string | null
          progress_pct?: number | null
          re_verify_at?: string | null
          ref_code?: string | null
          rejection_reason?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["capa_status"] | null
          title?: string | null
          type?: Database["public"]["Enums"]["capa_type"] | null
          updated_at?: string | null
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_result?:
            | Database["public"]["Enums"]["verification_result"]
            | null
          verified_at?: string | null
          verifier_id?: string | null
        }
        Update: {
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          follow_up_capa_id?: string | null
          id?: string | null
          incident_id?: string | null
          investigation_id?: string | null
          org_id?: string | null
          owner_id?: string | null
          progress_pct?: number | null
          re_verify_at?: string | null
          ref_code?: string | null
          rejection_reason?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["capa_status"] | null
          title?: string | null
          type?: Database["public"]["Enums"]["capa_type"] | null
          updated_at?: string | null
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_result?:
            | Database["public"]["Enums"]["verification_result"]
            | null
          verified_at?: string | null
          verifier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capas_follow_up_capa_id_fkey"
            columns: ["follow_up_capa_id"]
            isOneToOne: false
            referencedRelation: "capas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_follow_up_capa_id_fkey"
            columns: ["follow_up_capa_id"]
            isOneToOne: false
            referencedRelation: "capas_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_verifier_id_fkey"
            columns: ["verifier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents_active: {
        Row: {
          area: string | null
          classified_at: string | null
          closed_at: string | null
          created_at: string | null
          dangerous_occurrence_kind: string | null
          deleted_at: string | null
          description: string | null
          equipment: string | null
          id: string | null
          is_sandbox: boolean | null
          location: string | null
          occurred_at: string | null
          org_id: string | null
          osha_recordable: boolean | null
          ppe_worn: string[] | null
          quantity_unit: string | null
          quantity_value: number | null
          ref_code: string | null
          reporter_id: string | null
          riddor_reportable: boolean | null
          severity: Database["public"]["Enums"]["severity"] | null
          site_id: string | null
          status: Database["public"]["Enums"]["incident_status"] | null
          substance: string | null
          title: string | null
          track: Database["public"]["Enums"]["track"] | null
          type: Database["public"]["Enums"]["incident_type"] | null
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          classified_at?: string | null
          closed_at?: string | null
          created_at?: string | null
          dangerous_occurrence_kind?: string | null
          deleted_at?: string | null
          description?: string | null
          equipment?: string | null
          id?: string | null
          is_sandbox?: boolean | null
          location?: string | null
          occurred_at?: string | null
          org_id?: string | null
          osha_recordable?: boolean | null
          ppe_worn?: string[] | null
          quantity_unit?: string | null
          quantity_value?: number | null
          ref_code?: string | null
          reporter_id?: string | null
          riddor_reportable?: boolean | null
          severity?: Database["public"]["Enums"]["severity"] | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["incident_status"] | null
          substance?: string | null
          title?: string | null
          track?: Database["public"]["Enums"]["track"] | null
          type?: Database["public"]["Enums"]["incident_type"] | null
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          classified_at?: string | null
          closed_at?: string | null
          created_at?: string | null
          dangerous_occurrence_kind?: string | null
          deleted_at?: string | null
          description?: string | null
          equipment?: string | null
          id?: string | null
          is_sandbox?: boolean | null
          location?: string | null
          occurred_at?: string | null
          org_id?: string | null
          osha_recordable?: boolean | null
          ppe_worn?: string[] | null
          quantity_unit?: string | null
          quantity_value?: number | null
          ref_code?: string | null
          reporter_id?: string | null
          riddor_reportable?: boolean | null
          severity?: Database["public"]["Enums"]["severity"] | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["incident_status"] | null
          substance?: string | null
          title?: string | null
          track?: Database["public"]["Enums"]["track"] | null
          type?: Database["public"]["Enums"]["incident_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      investigations_active: {
        Row: {
          closed_at: string | null
          created_at: string | null
          deleted_at: string | null
          due_date: string | null
          findings: string | null
          id: string | null
          incident_id: string | null
          lead_investigator_id: string | null
          org_id: string | null
          rca_method: string | null
          ref_code: string | null
          root_cause_summary: string | null
          site_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["investigation_status"] | null
          updated_at: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          due_date?: string | null
          findings?: string | null
          id?: string | null
          incident_id?: string | null
          lead_investigator_id?: string | null
          org_id?: string | null
          rca_method?: string | null
          ref_code?: string | null
          root_cause_summary?: string | null
          site_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["investigation_status"] | null
          updated_at?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          due_date?: string | null
          findings?: string | null
          id?: string | null
          incident_id?: string | null
          lead_investigator_id?: string | null
          org_id?: string | null
          rca_method?: string | null
          ref_code?: string | null
          root_cause_summary?: string | null
          site_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["investigation_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investigations_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_lead_investigator_id_fkey"
            columns: ["lead_investigator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      classify_incident_v1: {
        Args: {
          p_actor_id: string
          p_deadlines: Json
          p_incident_id: string
          p_severity: Database["public"]["Enums"]["severity"]
          p_track: Database["public"]["Enums"]["track"]
        }
        Returns: undefined
      }
      current_org: { Args: never; Returns: string }
      has_permission: {
        Args: { p_permission: string; p_site_id: string }
        Returns: boolean
      }
      next_ref_code: {
        Args: { p_prefix: string; p_seq: string }
        Returns: string
      }
      org_id_of_event: {
        Args: { e: Database["public"]["Tables"]["activity_events"]["Row"] }
        Returns: string
      }
      resolve_permissions: { Args: { p_site_id: string }; Returns: string[] }
      seed_default_roles: { Args: { p_org_id: string }; Returns: undefined }
      user_can_access_site: { Args: { p_site_id: string }; Returns: boolean }
    }
    Enums: {
      body_part:
        | "head"
        | "neck"
        | "chest"
        | "abdomen"
        | "back"
        | "left_arm"
        | "right_arm"
        | "left_hand"
        | "right_hand"
        | "left_leg"
        | "right_leg"
        | "left_foot"
        | "right_foot"
        | "left_eye"
        | "right_eye"
        | "other"
      capa_status:
        | "created"
        | "in_progress"
        | "completed"
        | "pending_verification"
        | "verified"
        | "closed"
      capa_type: "corrective" | "preventive"
      employment_status: "employee" | "contractor" | "visitor" | "agency"
      incident_status:
        | "draft"
        | "submitted"
        | "classified"
        | "under_investigation"
        | "awaiting_capa"
        | "closed"
      incident_type:
        | "injury"
        | "illness"
        | "near_miss"
        | "property_damage"
        | "environmental_release"
        | "unsafe_condition"
        | "observation"
        | "dangerous_occurrence"
      industry_type:
        | "healthcare"
        | "education"
        | "manufacturing"
        | "warehouse"
        | "office"
        | "construction"
        | "lab"
      investigation_status:
        | "pending_assignment"
        | "in_progress"
        | "awaiting_capa"
        | "closed"
      investigation_team_role: "lead" | "member" | "observer"
      notification_kind:
        | "osha_8hr"
        | "osha_24hr"
        | "riddor_immediate"
        | "riddor_f2508_10d"
        | "riddor_7day"
        | "riddor_disease"
        | "capa_overdue"
        | "capa_escalated"
        | "assigned"
      riddor_specified_injury:
        | "fracture"
        | "amputation"
        | "sight_loss"
        | "crush_internal"
        | "serious_burn"
        | "scalping"
        | "loss_of_consciousness"
        | "enclosed_space_injury"
      severity: "S1" | "S2" | "S3" | "S4" | "S5"
      track: "A" | "B" | "C"
      treatment: "none" | "first_aid" | "medical" | "hospitalization"
      verification_method:
        | "inspection"
        | "monitoring"
        | "audit_trend"
        | "re_interview"
        | "document_review"
      verification_result:
        | "effective"
        | "partially_effective"
        | "not_effective"
        | "too_early_to_verify"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      body_part: [
        "head",
        "neck",
        "chest",
        "abdomen",
        "back",
        "left_arm",
        "right_arm",
        "left_hand",
        "right_hand",
        "left_leg",
        "right_leg",
        "left_foot",
        "right_foot",
        "left_eye",
        "right_eye",
        "other",
      ],
      capa_status: [
        "created",
        "in_progress",
        "completed",
        "pending_verification",
        "verified",
        "closed",
      ],
      capa_type: ["corrective", "preventive"],
      employment_status: ["employee", "contractor", "visitor", "agency"],
      incident_status: [
        "draft",
        "submitted",
        "classified",
        "under_investigation",
        "awaiting_capa",
        "closed",
      ],
      incident_type: [
        "injury",
        "illness",
        "near_miss",
        "property_damage",
        "environmental_release",
        "unsafe_condition",
        "observation",
        "dangerous_occurrence",
      ],
      industry_type: [
        "healthcare",
        "education",
        "manufacturing",
        "warehouse",
        "office",
        "construction",
        "lab",
      ],
      investigation_status: [
        "pending_assignment",
        "in_progress",
        "awaiting_capa",
        "closed",
      ],
      investigation_team_role: ["lead", "member", "observer"],
      notification_kind: [
        "osha_8hr",
        "osha_24hr",
        "riddor_immediate",
        "riddor_f2508_10d",
        "riddor_7day",
        "riddor_disease",
        "capa_overdue",
        "capa_escalated",
        "assigned",
      ],
      riddor_specified_injury: [
        "fracture",
        "amputation",
        "sight_loss",
        "crush_internal",
        "serious_burn",
        "scalping",
        "loss_of_consciousness",
        "enclosed_space_injury",
      ],
      severity: ["S1", "S2", "S3", "S4", "S5"],
      track: ["A", "B", "C"],
      treatment: ["none", "first_aid", "medical", "hospitalization"],
      verification_method: [
        "inspection",
        "monitoring",
        "audit_trend",
        "re_interview",
        "document_review",
      ],
      verification_result: [
        "effective",
        "partially_effective",
        "not_effective",
        "too_early_to_verify",
      ],
    },
  },
} as const

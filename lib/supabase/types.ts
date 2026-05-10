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
          actor_kind: string
          asset_id: string | null
          capa_id: string | null
          created_at: string
          document_id: string | null
          document_link_id: string | null
          finding_id: string | null
          id: string
          incident_id: string | null
          inspection_id: string | null
          investigation_id: string | null
          payload: Json
          template_id: string | null
          verb: string
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string
          asset_id?: string | null
          capa_id?: string | null
          created_at?: string
          document_id?: string | null
          document_link_id?: string | null
          finding_id?: string | null
          id?: string
          incident_id?: string | null
          inspection_id?: string | null
          investigation_id?: string | null
          payload?: Json
          template_id?: string | null
          verb: string
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          asset_id?: string | null
          capa_id?: string | null
          created_at?: string
          document_id?: string | null
          document_link_id?: string | null
          finding_id?: string | null
          id?: string
          incident_id?: string | null
          inspection_id?: string | null
          investigation_id?: string | null
          payload?: Json
          template_id?: string | null
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
            foreignKeyName: "activity_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
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
            foreignKeyName: "activity_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_document_link_id_fkey"
            columns: ["document_link_id"]
            isOneToOne: false
            referencedRelation: "document_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "inspection_findings"
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
            foreignKeyName: "activity_events_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections_active"
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
          {
            foreignKeyName: "activity_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      argus_suggestions: {
        Row: {
          cache_create_tokens: number
          cache_read_tokens: number
          completion_tokens: number
          created_at: string
          id: string
          model: string
          org_id: string
          outcome: string | null
          outcome_at: string | null
          payload: Json
          prompt_tokens: number
          site_id: string | null
          surface: string
          target_id: string | null
          target_kind: string | null
          user_id: string
        }
        Insert: {
          cache_create_tokens?: number
          cache_read_tokens?: number
          completion_tokens: number
          created_at?: string
          id?: string
          model: string
          org_id: string
          outcome?: string | null
          outcome_at?: string | null
          payload: Json
          prompt_tokens: number
          site_id?: string | null
          surface: string
          target_id?: string | null
          target_kind?: string | null
          user_id: string
        }
        Update: {
          cache_create_tokens?: number
          cache_read_tokens?: number
          completion_tokens?: number
          created_at?: string
          id?: string
          model?: string
          org_id?: string
          outcome?: string | null
          outcome_at?: string | null
          payload?: Json
          prompt_tokens?: number
          site_id?: string | null
          surface?: string
          target_id?: string | null
          target_kind?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "argus_suggestions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "argus_suggestions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "argus_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          condition: Database["public"]["Enums"]["asset_condition"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          last_inspected_at: string | null
          location: string | null
          name: string
          next_pm_at: string | null
          notes: string | null
          org_id: string
          ref_code: string
          sds_document_id: string | null
          site_id: string
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
        }
        Insert: {
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["asset_kind"]
          last_inspected_at?: string | null
          location?: string | null
          name: string
          next_pm_at?: string | null
          notes?: string | null
          org_id: string
          ref_code?: string
          sds_document_id?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
        }
        Update: {
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          last_inspected_at?: string | null
          location?: string | null
          name?: string
          next_pm_at?: string | null
          notes?: string | null
          org_id?: string
          ref_code?: string
          sds_document_id?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_sds_document_id_fkey"
            columns: ["sds_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
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
      document_links: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          link_role: string | null
          parent_id: string
          parent_type: Database["public"]["Enums"]["document_link_parent"]
          removed_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          link_role?: string | null
          parent_id: string
          parent_type: Database["public"]["Enums"]["document_link_parent"]
          removed_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          link_role?: string | null
          parent_id?: string
          parent_type?: Database["public"]["Enums"]["document_link_parent"]
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          archived_at: string | null
          archived_reason: string | null
          expiry_date: string | null
          file_name: string
          id: string
          mime_type: string
          name: string
          notes: string | null
          org_id: string
          site_id: string | null
          size_bytes: number
          storage_path: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_reason?: string | null
          expiry_date?: string | null
          file_name: string
          id?: string
          mime_type: string
          name: string
          notes?: string | null
          org_id: string
          site_id?: string | null
          size_bytes: number
          storage_path: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_reason?: string | null
          expiry_date?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          name?: string
          notes?: string | null
          org_id?: string
          site_id?: string | null
          size_bytes?: number
          storage_path?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
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
          equipment_asset_id: string | null
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
          stop_work: boolean
          stop_work_acknowledged_at: string | null
          stop_work_acknowledged_by: string | null
          stop_work_raised_at: string | null
          stop_work_raised_by: string | null
          stop_work_reason: string | null
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
          equipment_asset_id?: string | null
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
          stop_work?: boolean
          stop_work_acknowledged_at?: string | null
          stop_work_acknowledged_by?: string | null
          stop_work_raised_at?: string | null
          stop_work_raised_by?: string | null
          stop_work_reason?: string | null
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
          equipment_asset_id?: string | null
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
          stop_work?: boolean
          stop_work_acknowledged_at?: string | null
          stop_work_acknowledged_by?: string | null
          stop_work_raised_at?: string | null
          stop_work_raised_by?: string | null
          stop_work_reason?: string | null
          substance?: string | null
          title?: string
          track?: Database["public"]["Enums"]["track"] | null
          type?: Database["public"]["Enums"]["incident_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_equipment_asset_id_fkey"
            columns: ["equipment_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
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
      inspection_assignees: {
        Row: {
          assigned_at: string
          inspection_id: string
          profile_id: string
        }
        Insert: {
          assigned_at?: string
          inspection_id: string
          profile_id: string
        }
        Update: {
          assigned_at?: string
          inspection_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_assignees_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_assignees_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_findings: {
        Row: {
          comment: string | null
          created_at: string
          escalated_incident_id: string | null
          failed_response_label: string | null
          id: string
          inspection_id: string
          item_id: string
          item_label: string
          org_id: string
          photo_paths: string[]
          ref_code: string
          resolved_at: string | null
          resolved_by: string | null
          site_id: string
          status: Database["public"]["Enums"]["finding_status"]
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          escalated_incident_id?: string | null
          failed_response_label?: string | null
          id?: string
          inspection_id: string
          item_id: string
          item_label: string
          org_id: string
          photo_paths?: string[]
          ref_code?: string
          resolved_at?: string | null
          resolved_by?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["finding_status"]
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          escalated_incident_id?: string | null
          failed_response_label?: string | null
          id?: string
          inspection_id?: string
          item_id?: string
          item_label?: string
          org_id?: string
          photo_paths?: string[]
          ref_code?: string
          resolved_at?: string | null
          resolved_by?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["finding_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_findings_escalated_incident_id_fkey"
            columns: ["escalated_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_findings_escalated_incident_id_fkey"
            columns: ["escalated_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_findings_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_findings_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_findings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_findings_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_findings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_uploads: {
        Row: {
          deleted_at: string | null
          file_name: string
          id: string
          inspection_id: string
          item_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          deleted_at?: string | null
          file_name: string
          id?: string
          inspection_id: string
          item_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          deleted_at?: string | null
          file_name?: string
          id?: string
          inspection_id?: string
          item_id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_uploads_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_uploads_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          abandon_reason: string | null
          abandoned_at: string | null
          answers: Json
          assignment_id: string | null
          completed_at: string | null
          conducted_at: string | null
          created_at: string
          deleted_at: string | null
          header_responses: Json
          id: string
          inspector_id: string | null
          is_failed: boolean
          org_id: string
          ref_code: string
          score_max: number | null
          score_total: number | null
          site_id: string
          started_at: string
          status: Database["public"]["Enums"]["inspection_status"]
          template_id: string
          template_version_id: string
          title: string
          updated_at: string
        }
        Insert: {
          abandon_reason?: string | null
          abandoned_at?: string | null
          answers?: Json
          assignment_id?: string | null
          completed_at?: string | null
          conducted_at?: string | null
          created_at?: string
          deleted_at?: string | null
          header_responses?: Json
          id?: string
          inspector_id?: string | null
          is_failed?: boolean
          org_id: string
          ref_code?: string
          score_max?: number | null
          score_total?: number | null
          site_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["inspection_status"]
          template_id: string
          template_version_id: string
          title: string
          updated_at?: string
        }
        Update: {
          abandon_reason?: string | null
          abandoned_at?: string | null
          answers?: Json
          assignment_id?: string | null
          completed_at?: string | null
          conducted_at?: string | null
          created_at?: string
          deleted_at?: string | null
          header_responses?: Json
          id?: string
          inspector_id?: string | null
          is_failed?: boolean
          org_id?: string
          ref_code?: string
          score_max?: number | null
          score_total?: number | null
          site_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["inspection_status"]
          template_id?: string
          template_version_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "template_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
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
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          include_children: boolean
          invited_by: string | null
          org_id: string
          revoked_at: string | null
          role_id: string
          site_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          include_children?: boolean
          invited_by?: string | null
          org_id: string
          revoked_at?: string | null
          role_id: string
          site_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          include_children?: boolean
          invited_by?: string | null
          org_id?: string
          revoked_at?: string | null
          role_id?: string
          site_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_site_id_fkey"
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
          argus_daily_token_budget: number
          argus_enabled: boolean
          created_at: string
          id: string
          industry: Database["public"]["Enums"]["industry_type"] | null
          is_demo: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          argus_daily_token_budget?: number
          argus_enabled?: boolean
          created_at?: string
          id?: string
          industry?: Database["public"]["Enums"]["industry_type"] | null
          is_demo?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          argus_daily_token_budget?: number
          argus_enabled?: boolean
          created_at?: string
          id?: string
          industry?: Database["public"]["Enums"]["industry_type"] | null
          is_demo?: boolean
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
          onboarded_at: string | null
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
          onboarded_at?: string | null
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
          onboarded_at?: string | null
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
      site_annual_hours: {
        Row: {
          hours_worked: number
          site_id: string
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          hours_worked: number
          site_id: string
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          hours_worked?: number
          site_id?: string
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_annual_hours_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_annual_hours_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_emergency_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string | null
          site_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          role?: string | null
          site_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          site_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_emergency_contacts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
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
          applicable_standards: string[]
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          avg_employees_year: number | null
          city: string | null
          closed_on: string | null
          country: string
          created_at: string
          crn: string | null
          ein: string | null
          gb_jurisdiction: string | null
          hazard_tags: string[]
          hse_establishment_number: string | null
          id: string
          ita_establishment_id: string | null
          latitude: number | null
          longitude: number | null
          naics_code: string | null
          name: string
          opened_on: string | null
          operational_status: string
          org_id: string
          osha_establishment_id: string | null
          osha_jurisdiction: string | null
          parent_site_id: string | null
          partially_exempt_override: boolean
          peak_employees_year: number | null
          postal_code: string | null
          psm_applicable: boolean
          region: string | null
          riddor_responsible_person_name: string | null
          riddor_responsible_person_role: string | null
          setup_completed_at: string | null
          setup_progress: Json
          sic_code: string | null
          site_ehs_lead_id: string | null
          site_type: string
          state_or_region: string | null
          state_plan_code: string | null
          street_1: string | null
          street_2: string | null
          timezone: string
          uk_sic_2007: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          applicable_standards?: string[]
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          avg_employees_year?: number | null
          city?: string | null
          closed_on?: string | null
          country: string
          created_at?: string
          crn?: string | null
          ein?: string | null
          gb_jurisdiction?: string | null
          hazard_tags?: string[]
          hse_establishment_number?: string | null
          id?: string
          ita_establishment_id?: string | null
          latitude?: number | null
          longitude?: number | null
          naics_code?: string | null
          name: string
          opened_on?: string | null
          operational_status?: string
          org_id: string
          osha_establishment_id?: string | null
          osha_jurisdiction?: string | null
          parent_site_id?: string | null
          partially_exempt_override?: boolean
          peak_employees_year?: number | null
          postal_code?: string | null
          psm_applicable?: boolean
          region?: string | null
          riddor_responsible_person_name?: string | null
          riddor_responsible_person_role?: string | null
          setup_completed_at?: string | null
          setup_progress?: Json
          sic_code?: string | null
          site_ehs_lead_id?: string | null
          site_type?: string
          state_or_region?: string | null
          state_plan_code?: string | null
          street_1?: string | null
          street_2?: string | null
          timezone?: string
          uk_sic_2007?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          applicable_standards?: string[]
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          avg_employees_year?: number | null
          city?: string | null
          closed_on?: string | null
          country?: string
          created_at?: string
          crn?: string | null
          ein?: string | null
          gb_jurisdiction?: string | null
          hazard_tags?: string[]
          hse_establishment_number?: string | null
          id?: string
          ita_establishment_id?: string | null
          latitude?: number | null
          longitude?: number | null
          naics_code?: string | null
          name?: string
          opened_on?: string | null
          operational_status?: string
          org_id?: string
          osha_establishment_id?: string | null
          osha_jurisdiction?: string | null
          parent_site_id?: string | null
          partially_exempt_override?: boolean
          peak_employees_year?: number | null
          postal_code?: string | null
          psm_applicable?: boolean
          region?: string | null
          riddor_responsible_person_name?: string | null
          riddor_responsible_person_role?: string | null
          setup_completed_at?: string | null
          setup_progress?: Json
          sic_code?: string | null
          site_ehs_lead_id?: string | null
          site_type?: string
          state_or_region?: string | null
          state_plan_code?: string | null
          street_1?: string | null
          street_2?: string | null
          timezone?: string
          uk_sic_2007?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "sites_site_ehs_lead_id_fkey"
            columns: ["site_ehs_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      template_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          include_children: boolean
          schedule_cron: string | null
          schedule_kind: Database["public"]["Enums"]["template_schedule_kind"]
          site_id: string
          start_time_local: string | null
          template_id: string
          template_version_id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          include_children?: boolean
          schedule_cron?: string | null
          schedule_kind: Database["public"]["Enums"]["template_schedule_kind"]
          site_id: string
          start_time_local?: string | null
          template_id: string
          template_version_id: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          include_children?: boolean
          schedule_cron?: string | null
          schedule_kind?: Database["public"]["Enums"]["template_schedule_kind"]
          site_id?: string
          start_time_local?: string | null
          template_id?: string
          template_version_id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_assignments_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          header: Json
          id: string
          items: Json
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["template_status"]
          template_data: Json
          template_id: string
          updated_at: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          header?: Json
          id?: string
          items?: Json
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          template_data?: Json
          template_id: string
          updated_at?: string
          version_number: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          header?: Json
          id?: string
          items?: Json
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          template_data?: Json
          template_id?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          current_version_id: string | null
          description: string | null
          id: string
          industry: Database["public"]["Enums"]["industry_type"]
          is_featured: boolean
          is_imported: boolean
          is_system_preset: boolean
          logo_url: string | null
          name: string
          org_id: string | null
          slug: string | null
          source_preset_id: string | null
          status: Database["public"]["Enums"]["template_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          id?: string
          industry: Database["public"]["Enums"]["industry_type"]
          is_featured?: boolean
          is_imported?: boolean
          is_system_preset?: boolean
          logo_url?: string | null
          name: string
          org_id?: string | null
          slug?: string | null
          source_preset_id?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["industry_type"]
          is_featured?: boolean
          is_imported?: boolean
          is_system_preset?: boolean
          logo_url?: string | null
          name?: string
          org_id?: string | null
          slug?: string | null
          source_preset_id?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_source_preset_id_fkey"
            columns: ["source_preset_id"]
            isOneToOne: false
            referencedRelation: "templates"
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
      inspections_active: {
        Row: {
          abandon_reason: string | null
          abandoned_at: string | null
          answers: Json | null
          assignment_id: string | null
          completed_at: string | null
          conducted_at: string | null
          created_at: string | null
          deleted_at: string | null
          header_responses: Json | null
          id: string | null
          inspector_id: string | null
          is_failed: boolean | null
          org_id: string | null
          ref_code: string | null
          score_max: number | null
          score_total: number | null
          site_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["inspection_status"] | null
          template_id: string | null
          template_version_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          abandon_reason?: string | null
          abandoned_at?: string | null
          answers?: Json | null
          assignment_id?: string | null
          completed_at?: string | null
          conducted_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          header_responses?: Json | null
          id?: string | null
          inspector_id?: string | null
          is_failed?: boolean | null
          org_id?: string | null
          ref_code?: string | null
          score_max?: number | null
          score_total?: number | null
          site_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["inspection_status"] | null
          template_id?: string | null
          template_version_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          abandon_reason?: string | null
          abandoned_at?: string | null
          answers?: Json | null
          assignment_id?: string | null
          completed_at?: string | null
          conducted_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          header_responses?: Json | null
          id?: string | null
          inspector_id?: string | null
          is_failed?: boolean | null
          org_id?: string | null
          ref_code?: string | null
          score_max?: number | null
          score_total?: number | null
          site_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["inspection_status"] | null
          template_id?: string | null
          template_version_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "template_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
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
      _phase13_high_hazard_naics_prefixes: { Args: never; Returns: string[] }
      _phase13_partially_exempt_naics_prefixes: {
        Args: never
        Returns: string[]
      }
      accept_invitation_v1: {
        Args: { p_token: string }
        Returns: {
          org_id: string
          role_id: string
          site_id: string
          site_name: string
        }[]
      }
      add_site_member_v1: {
        Args: {
          p_include_children?: boolean
          p_profile_id: string
          p_role_id: string
          p_site_id: string
        }
        Returns: undefined
      }
      archive_document_v1: {
        Args: { p_document_id: string; p_force?: boolean; p_reason?: string }
        Returns: undefined
      }
      archive_site_v1: {
        Args: { p_reason?: string; p_site_id: string }
        Returns: undefined
      }
      assign_capa_from_investigation_v1: {
        Args: {
          p_actor_id: string
          p_description: string
          p_due_date: string
          p_investigation_id: string
          p_owner_id: string
          p_title: string
          p_type: Database["public"]["Enums"]["capa_type"]
          p_verifier_id: string
        }
        Returns: string
      }
      bootstrap_org_v1: {
        Args: {
          p_country: string
          p_industry: Database["public"]["Enums"]["industry_type"]
          p_org_name: string
          p_site_name: string
          p_timezone: string
        }
        Returns: {
          org_id: string
          site_id: string
        }[]
      }
      can_edit_parent: {
        Args: {
          p_parent_id: string
          p_parent_type: Database["public"]["Enums"]["document_link_parent"]
        }
        Returns: boolean
      }
      change_site_member_role_v1: {
        Args: {
          p_include_children?: boolean
          p_profile_id: string
          p_role_id: string
          p_site_id: string
        }
        Returns: undefined
      }
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
      complete_inspection_v1: {
        Args: { p_inspection_id: string }
        Returns: undefined
      }
      create_invitation_v1: {
        Args: {
          p_email: string
          p_include_children?: boolean
          p_role_id: string
          p_site_id: string
        }
        Returns: {
          invitation_id: string
          token: string
        }[]
      }
      create_role_v1: {
        Args: {
          p_description: string
          p_name: string
          p_permission_keys: string[]
        }
        Returns: string
      }
      create_site_v1: {
        Args: {
          p_address?: string
          p_country: string
          p_naics_code?: string
          p_name: string
          p_parent_site_id?: string
          p_timezone?: string
        }
        Returns: string
      }
      current_org: { Args: never; Returns: string }
      delete_role_v1: { Args: { p_role_id: string }; Returns: undefined }
      escalate_finding_to_incident_v1: {
        Args: { p_finding_id: string }
        Returns: string
      }
      has_org_permission: { Args: { p_permission: string }; Returns: boolean }
      has_permission: {
        Args: { p_permission: string; p_site_id: string }
        Returns: boolean
      }
      import_preset_to_org_v1: {
        Args: { p_preset_id: string }
        Returns: string
      }
      invite_member_to_site_v1: {
        Args: {
          p_email: string
          p_include_children?: boolean
          p_role_id: string
          p_site_id: string
        }
        Returns: undefined
      }
      is_ita_required: {
        Args: { p_naics: string; p_peak_employees: number }
        Returns: boolean
      }
      is_partially_exempt: {
        Args: { p_naics: string; p_peak_employees: number }
        Returns: boolean
      }
      link_document_v1: {
        Args: {
          p_document_id: string
          p_link_role?: string
          p_parent_id: string
          p_parent_type: Database["public"]["Enums"]["document_link_parent"]
        }
        Returns: string
      }
      load_sample_chain_v1: {
        Args: { p_actor_id: string; p_site_id: string; p_verifier_id: string }
        Returns: string
      }
      next_ref_code: {
        Args: { p_prefix: string; p_seq: string }
        Returns: string
      }
      org_id_of_event: {
        Args: { e: Database["public"]["Tables"]["activity_events"]["Row"] }
        Returns: string
      }
      publish_template_version_v1: {
        Args: {
          p_actor_id: string
          p_change_summary: string
          p_draft_version_id: string
          p_template_id: string
        }
        Returns: undefined
      }
      regenerate_item_ids: { Args: { p_items: Json }; Returns: Json }
      remove_site_member_v1: {
        Args: { p_profile_id: string; p_site_id: string }
        Returns: undefined
      }
      replace_document_file_v1: {
        Args: {
          p_document_id: string
          p_file_name: string
          p_mime_type: string
          p_size_bytes: number
          p_storage_path: string
        }
        Returns: undefined
      }
      reset_demo_data_v1: { Args: { p_org_id: string }; Returns: undefined }
      resolve_org_permissions: { Args: never; Returns: string[] }
      resolve_permissions: { Args: { p_site_id: string }; Returns: string[] }
      revoke_invitation_v1: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      seed_default_roles: { Args: { p_org_id: string }; Returns: undefined }
      unarchive_site_v1: { Args: { p_site_id: string }; Returns: undefined }
      unlink_document_v1: { Args: { p_link_id: string }; Returns: undefined }
      update_role_v1: {
        Args: {
          p_description?: string
          p_name?: string
          p_permission_keys?: string[]
          p_role_id: string
        }
        Returns: undefined
      }
      update_site_v1: {
        Args: {
          p_address?: string
          p_clear_parent?: boolean
          p_naics_code?: string
          p_name?: string
          p_osha_establishment_id?: string
          p_parent_site_id?: string
          p_region?: string
          p_site_id: string
          p_timezone?: string
        }
        Returns: undefined
      }
      user_can_access_site: { Args: { p_site_id: string }; Returns: boolean }
      verify_capa_v1: {
        Args: {
          p_actor_id: string
          p_capa_id: string
          p_method: Database["public"]["Enums"]["verification_method"]
          p_notes: string
          p_re_verify_at: string
          p_result: Database["public"]["Enums"]["verification_result"]
        }
        Returns: string
      }
    }
    Enums: {
      asset_condition: "excellent" | "good" | "fair" | "poor" | "unsafe"
      asset_kind:
        | "forklift"
        | "fume_hood"
        | "fire_extinguisher"
        | "aed"
        | "conveyor"
        | "ergonomic_station"
        | "machine_guard"
        | "press"
        | "crane"
        | "vehicle"
        | "eyewash_station"
        | "spill_kit"
        | "safety_shower"
        | "generator"
        | "other"
      asset_status: "active" | "retired"
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
      document_link_parent:
        | "incident"
        | "investigation"
        | "capa"
        | "asset"
        | "site"
        | "inspection"
        | "finding"
      document_type:
        | "sds"
        | "sop"
        | "policy"
        | "training_cert"
        | "form"
        | "evidence"
        | "audit_report"
        | "other"
      employment_status: "employee" | "contractor" | "visitor" | "agency"
      finding_status:
        | "open"
        | "in_progress"
        | "resolved"
        | "escalated_to_incident"
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
      inspection_status: "draft" | "in_progress" | "completed" | "abandoned"
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
        | "invited"
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
      template_schedule_kind:
        | "daily"
        | "weekly"
        | "monthly"
        | "custom"
        | "on_demand"
      template_status: "draft" | "published" | "archived"
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
      asset_condition: ["excellent", "good", "fair", "poor", "unsafe"],
      asset_kind: [
        "forklift",
        "fume_hood",
        "fire_extinguisher",
        "aed",
        "conveyor",
        "ergonomic_station",
        "machine_guard",
        "press",
        "crane",
        "vehicle",
        "eyewash_station",
        "spill_kit",
        "safety_shower",
        "generator",
        "other",
      ],
      asset_status: ["active", "retired"],
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
      document_link_parent: [
        "incident",
        "investigation",
        "capa",
        "asset",
        "site",
        "inspection",
        "finding",
      ],
      document_type: [
        "sds",
        "sop",
        "policy",
        "training_cert",
        "form",
        "evidence",
        "audit_report",
        "other",
      ],
      employment_status: ["employee", "contractor", "visitor", "agency"],
      finding_status: [
        "open",
        "in_progress",
        "resolved",
        "escalated_to_incident",
      ],
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
      inspection_status: ["draft", "in_progress", "completed", "abandoned"],
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
        "invited",
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
      template_schedule_kind: [
        "daily",
        "weekly",
        "monthly",
        "custom",
        "on_demand",
      ],
      template_status: ["draft", "published", "archived"],
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

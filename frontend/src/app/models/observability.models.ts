export type MonitorStatus='up'|'down'|'pending'|'paused';
export interface Monitor{id:string;name:string;url:string;interval_seconds:number;timeout_seconds:number;expected_status:number;keyword?:string;enabled:boolean;created_at:string;updated_at:string}
export interface HistoryPoint{checked_at:string;status:'up'|'down';status_code:number;latency_ms:number;error_category?:string}
export interface MonitorSummary{monitor:Monitor;status:MonitorStatus;uptime:number;average_latency_ms:number;p95_latency_ms:number;check_count:number;points?:HistoryPoint[]}
export interface HistorySeries extends MonitorSummary{points:HistoryPoint[]}
export interface Incident{id:string;monitor_id:string;monitor_name:string;state:'active'|'resolved';cause:string;first_failure_at:string;last_failure_at:string;opened_at:string;resolved_at?:string;duration_seconds?:number}
export interface OverviewSummary{range:'24h'|'7d'|'30d';total_monitors:number;enabled_monitors:number;active_incidents:number;uptime:number;average_latency_ms:number;monitors:MonitorSummary[]}
export interface ApiError{error:{code:string;message:string;fields?:Record<string,string>}}

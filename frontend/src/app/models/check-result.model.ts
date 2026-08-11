export interface CheckResult {
  name?: string;
  url: string;
  status: 'up' | 'down' | string;
  status_code?: number | null;
  response_time?: number | null;
  response_time_ms?: number | null;
  checked_at?: string;
  error?: string;
}

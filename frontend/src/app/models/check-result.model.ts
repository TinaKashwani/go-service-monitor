export interface CheckResult {
  url: string;
  status: 'up' | 'down' | string;
  status_code: number;
  response_time: number;
  response_time_ms: number;
  checked_at: string;
  error?: string;
}

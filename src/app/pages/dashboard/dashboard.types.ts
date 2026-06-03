export type DashboardStatTone = 'blue' | 'ochre' | 'green' | 'red';

export interface DashboardStat {
  label: string;
  valueStr: string;
  sub: string;
  tone: DashboardStatTone;
}

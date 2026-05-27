import { AxiosInstance } from 'axios';
import { pickArray } from './shared.js';
import { logger } from '../logger.js';

export type EmployeeRow = {
  id: number;
  displayName: string;
  username: string;
  email: string;
  badge: string;
};

function describeShape(body: unknown): string {
  if (Array.isArray(body)) return `Array(len=${body.length})`;
  if (body && typeof body === 'object') {
    const keys = Object.keys(body as Record<string, unknown>).slice(0, 10);
    return `Object(keys=[${keys.join(', ')}])`;
  }
  return typeof body;
}

export function makeEmployeesApi(http: AxiosInstance) {
  return {
    async listTeamMembers(): Promise<EmployeeRow[]> {
      const res = await http.get('/TimeAttendance/Employees/TeamMember/0');
      const rows = pickArray<any>(res.data);
      const sampleKeys = rows.length > 0 ? Object.keys(rows[0]).slice(0, 20) : [];
      logger.info({
        rawShape: describeShape(res.data),
        rowCount: rows.length,
        sampleKeys,
        sampleEmpStatus: rows[0]?.EmpStatus,
      }, 'dw.employees.listTeamMembers: parsed');

      // Be lenient with EmpStatus: DW may use 'Active', 'A', 'ACTIVE', empty, or omit it entirely.
      // Filter only when an explicit Inactive/Terminated marker is present.
      const INACTIVE = new Set(['inactive', 'i', 'terminated', 't', 'disabled', 'd']);
      const filtered = rows.filter(r => {
        const status = String(r.EmpStatus ?? r.Status ?? '').trim().toLowerCase();
        return !INACTIVE.has(status);
      });

      const mapped = filtered.map(r => ({
        id: Number(r.Id ?? r.TeamMemberId ?? r.EmployeeId ?? 0),
        displayName: String(
          r.DisplayName
          ?? `${r.FirstName ?? ''} ${r.LastName ?? ''}`.trim()
          || r.UserName
          || r.EmployeeNo
          || `#${r.Id ?? '?'}`,
        ),
        username: String(r.UserName ?? r.Username ?? ''),
        email: String(r.Email ?? r.EmailAddress ?? ''),
        badge: String(r.BadgeNo ?? r.EmployeeNo ?? r.Badge ?? ''),
      }));

      logger.info({ active: mapped.length, total: rows.length }, 'dw.employees.listTeamMembers: filtered');
      return mapped;
    },

    async getByUsername(username: string): Promise<EmployeeRow | null> {
      const all = await this.listTeamMembers();
      const found = all.find(e => e.username.toLowerCase() === username.toLowerCase()) ?? null;
      if (!found) {
        logger.warn({ username, candidateCount: all.length, candidates: all.slice(0, 5).map(e => e.username) },
          'dw.employees.getByUsername: no match');
      }
      return found;
    },
  };
}

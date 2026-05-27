import { AxiosInstance } from 'axios';
import { pickArray } from './shared.js';

export type EmployeeRow = {
  id: number;
  displayName: string;
  username: string;
  email: string;
  badge: string;
};

export function makeEmployeesApi(http: AxiosInstance) {
  return {
    async listTeamMembers(): Promise<EmployeeRow[]> {
      const res = await http.get('/TimeAttendance/Employees/TeamMember/0');
      const rows = pickArray<any>(res.data);
      return rows
        .filter(r => String(r.EmpStatus ?? '').toLowerCase() === 'active')
        .map(r => ({
          id: Number(r.Id ?? r.TeamMemberId ?? 0),
          displayName: String(r.DisplayName ?? `${r.FirstName ?? ''} ${r.LastName ?? ''}`.trim()),
          username: String(r.UserName ?? ''),
          email: String(r.Email ?? ''),
          badge: String(r.BadgeNo ?? r.EmployeeNo ?? ''),
        }));
    },

    async getByUsername(username: string): Promise<EmployeeRow | null> {
      const all = await this.listTeamMembers();
      return all.find(e => e.username.toLowerCase() === username.toLowerCase()) ?? null;
    },
  };
}

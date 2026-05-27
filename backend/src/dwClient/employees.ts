import { AxiosInstance } from 'axios';
import { pickArray } from './shared.js';
import { logger } from '../logger.js';

/**
 * EmployeeRow models a row from the DW PR_EMP (Payroll Employee) table,
 * fetched through /Workforce/EmployeeMaintenance/PREmployees/0.
 *
 * PR_EMP intentionally has no UserName / Email columns — those live in the
 * separate IQMS_USER security table and there is no public WebAPI endpoint
 * exposing the link. So `username` and `email` here default to empty and we
 * treat the EmpNo (badge) as the human-friendly stable identifier.
 */
export type EmployeeRow = {
  id: number;          // PR_EMP.Id (the FK other endpoints expect)
  empNo: string;       // PR_EMP.EmpNo (badge, eg "001")
  firstName: string;
  lastName: string;
  displayName: string; // "FirstName LastName" or fallback to empNo
  department: string;
  /** Always empty for now — PR_EMP has no Email column. */
  email: string;
  /** Same as empNo. Kept for compatibility with auth/session code. */
  username: string;
  /** Same as empNo. */
  badge: string;
};

function buildDisplayName(r: any): string {
  const first = String(r.FirstName ?? '').trim();
  const last  = String(r.LastName  ?? '').trim();
  const full  = `${first} ${last}`.trim();
  if (full) return full;
  return String(r.EmpNo ?? `#${r.Id ?? '?'}`);
}

export function makeEmployeesApi(http: AxiosInstance) {
  async function fetchAll(): Promise<EmployeeRow[]> {
    const res = await http.get('/Workforce/EmployeeMaintenance/PREmployees/0', { params: { pageSize: 2000 } });
    const rows = pickArray<any>(res.data);
    logger.info({ rowCount: rows.length, sampleKeys: rows[0] ? Object.keys(rows[0]).slice(0, 10) : [] }, 'dw.employees.PREmployees: parsed');

    return rows
      .filter(r => String(r.PkHide ?? 'N').toUpperCase() !== 'Y')
      .map(r => {
        const empNo = String(r.EmpNo ?? '').trim();
        return {
          id: Number(r.Id ?? 0),
          empNo,
          firstName: String(r.FirstName ?? ''),
          lastName: String(r.LastName ?? ''),
          displayName: buildDisplayName(r),
          department: String(r.PRDepartment ?? ''),
          email: '',
          username: empNo,
          badge: empNo,
        };
      });
  }

  return {
    /** Full list of PR_EMP employees (PkHide=N). */
    listTeamMembers: fetchAll,
    listAll: fetchAll,

    /** Look up one PR_EMP row by Id. */
    async getById(id: number): Promise<EmployeeRow | null> {
      const all = await fetchAll();
      return all.find(e => e.id === id) ?? null;
    },

    /**
     * Best-effort lookup by what the caller used to log in.
     * We match against EmpNo since PR_EMP has no UserName column.
     * Returns null if no match — callers must tolerate it.
     */
    async getByUsername(username: string): Promise<EmployeeRow | null> {
      const all = await fetchAll();
      const u = username.trim().toLowerCase();
      return all.find(e =>
        e.empNo.toLowerCase() === u
        || e.displayName.toLowerCase() === u
      ) ?? null;
    },
  };
}

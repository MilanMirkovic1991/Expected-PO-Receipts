import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { createDwClient } from '../../src/dwClient/index.js';

const BASE = 'http://dw.example';
beforeEach(() => nock.disableNetConnect());
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

describe('employees (PR_EMP via /Workforce/EmployeeMaintenance/PREmployees/0)', () => {
  it('returns visible PR_EMP rows mapped to {id, empNo, displayName, department}', async () => {
    nock(BASE).get(/PREmployees\/0/).query(true).reply(200, { data: [
      { Id: 13, EmpNo: '001', FirstName: 'Milan',   LastName: 'Mirković', PRDepartment: 'WMS', PkHide: 'N' },
      { Id: 14, EmpNo: '002', FirstName: 'Ana',     LastName: 'A',         PRDepartment: '',    PkHide: 'N' },
      { Id: 15, EmpNo: '003', FirstName: 'Hidden',  LastName: 'X',         PRDepartment: '',    PkHide: 'Y' },
    ]});
    const dw = createDwClient({ baseUrl: BASE });
    const list = await dw.employees.listTeamMembers();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id: 13, empNo: '001', displayName: 'Milan Mirković', department: 'WMS', username: '001', badge: '001' });
    expect(list[0]?.email).toBe(''); // PR_EMP has no email column
  });

  it('getById returns the matching row', async () => {
    nock(BASE).get(/PREmployees\/0/).query(true).reply(200, { data: [
      { Id: 13, EmpNo: '001', FirstName: 'Milan', LastName: 'Mirković', PkHide: 'N' },
    ]});
    const dw = createDwClient({ baseUrl: BASE });
    const emp = await dw.employees.getById(13);
    expect(emp?.displayName).toBe('Milan Mirković');
  });

  it('getByUsername falls back to EmpNo (no UserName column in PR_EMP)', async () => {
    nock(BASE).get(/PREmployees\/0/).query(true).reply(200, { data: [
      { Id: 13, EmpNo: '001', FirstName: 'Milan', LastName: 'Mirković', PkHide: 'N' },
    ]}).persist();
    const dw = createDwClient({ baseUrl: BASE });
    expect((await dw.employees.getByUsername('001'))?.id).toBe(13);
    expect(await dw.employees.getByUsername('nope')).toBeNull();
  });
});

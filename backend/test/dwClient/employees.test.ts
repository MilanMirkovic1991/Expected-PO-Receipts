import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { createDwClient } from '../../src/dwClient/index.js';

const BASE = 'http://dw.example';
beforeEach(() => nock.disableNetConnect());
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

describe('employees.listTeamMembers', () => {
  it('returns only active members with id+name+email+username', async () => {
    nock(BASE).get(/TeamMember\/0/).reply(200, { data: [
      { Id: 1, FirstName: 'Ana', LastName: 'A', Email: 'a@x', UserName: 'ana', EmpStatus: 'Active', DisplayName: 'Ana A', BadgeNo: '001' },
      { Id: 2, FirstName: 'Bob', LastName: 'B', Email: 'b@x', UserName: 'bob', EmpStatus: 'Inactive', DisplayName: 'Bob B', BadgeNo: '002' },
    ]});
    const dw = createDwClient({ baseUrl: BASE });
    const list = await dw.employees.listTeamMembers();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 1, username: 'ana', email: 'a@x' });
  });
});

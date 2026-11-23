import { effectiveRights, PermissionRow } from './node-access';

const row = (roleId: string, nodeId: string, flags: Partial<PermissionRow> = {}): PermissionRow => ({
  roleId,
  nodeId,
  canRead: true,
  canWrite: false,
  canDelete: false,
  canAdmin: false,
  ...flags,
});

describe('effectiveRights', () => {
  const path = '/F/S/D/';

  it("hérite de la règle posée sur l'ancêtre", () => {
    const r = effectiveRights(path, ['comptable'], [row('comptable', 'F', { canWrite: true })]);
    expect(r).toEqual({ read: true, write: true, delete: false, admin: false });
  });

  it('une règle plus profonde remplace celle du dessus', () => {
    const rows = [row('comptable', 'F', { canWrite: true }), row('comptable', 'S', { canRead: false })];
    expect(effectiveRights(path, ['comptable'], rows).read).toBe(false);
  });

  it("additionne les droits de plusieurs rôles", () => {
    const rows = [row('auditeur', 'F'), row('archiviste', 'D', { canDelete: true })];
    const r = effectiveRights(path, ['auditeur', 'archiviste'], rows);
    expect(r.read).toBe(true);
    expect(r.delete).toBe(true);
  });

  it("n'accorde rien sans règle", () => {
    expect(effectiveRights(path, ['juriste'], [row('comptable', 'F')]).read).toBe(false);
  });
});

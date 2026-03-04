import { useEffect, useState } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { Button } from '@fsa/shared-ui';
import { Save, Key } from 'lucide-react';

interface Role { id: number; code: string; description: string }
interface Policy { id: number; code: string; description: string; isActive: boolean }
interface PolicyGroup { id: number; code: string; description: string; policies: Policy[] }
interface RolePolicy { id: number; policyId: number; roleId: number; policy: Policy }

export default function AccessControlPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [policyGroups, setPolicyGroups] = useState<PolicyGroup[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [checkedPolicies, setCheckedPolicies] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([
      userControlApi.getRoles({ size: 1000 }),
      userControlApi.getPolicyGroups(),
    ]).then(([r, pg]) => {
      setRoles(r.data?.content ?? []);
      setPolicyGroups(pg.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const handleSelectRole = async (role: Role) => {
    setSelectedRole(role);
    setLoading(true);
    try {
      const res = await userControlApi.getRolePolicies(role.id);
      const rps: RolePolicy[] = res.data ?? [];
      const checked = new Set(rps.map((rp) => rp.policy?.id ?? rp.policyId));
      setCheckedPolicies(checked);

      const expanded = new Set<number>();
      policyGroups.forEach((pg) => {
        const groupPolicies = pg.policies.map((p) => p.id);
        const checkedInGroup = groupPolicies.filter((id) => checked.has(id));
        if (checkedInGroup.length > 0 && checkedInGroup.length < groupPolicies.length) {
          expanded.add(pg.id);
        }
      });
      setExpandedGroups(expanded);
    } finally { setLoading(false); }
  };

  const togglePolicy = (policyId: number) => {
    setCheckedPolicies((prev) => {
      const next = new Set(prev);
      if (next.has(policyId)) next.delete(policyId);
      else next.add(policyId);
      return next;
    });
  };

  const toggleGroup = (pg: PolicyGroup) => {
    const groupIds = pg.policies.map((p) => p.id);
    const allChecked = groupIds.every((id) => checkedPolicies.has(id));
    setCheckedPolicies((prev) => {
      const next = new Set(prev);
      groupIds.forEach((id) => { if (allChecked) next.delete(id); else next.add(id); });
      return next;
    });
  };

  const toggleExpanded = (pgId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(pgId)) next.delete(pgId); else next.add(pgId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    if (!confirm('Are you sure you want to update the policies for this role?')) return;
    setSaving(true);
    try {
      await userControlApi.updateRolePolicies(selectedRole.id, Array.from(checkedPolicies));
    } finally { setSaving(false); }
  };

  const isGroupChecked = (pg: PolicyGroup) => pg.policies.length > 0 && pg.policies.every((p) => checkedPolicies.has(p.id));
  const isGroupIndeterminate = (pg: PolicyGroup) => {
    const some = pg.policies.some((p) => checkedPolicies.has(p.id));
    return some && !isGroupChecked(pg);
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Key size={24} className="text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">Access Control</h2>
      </div>

      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Select Role</label>
          <select
            value={selectedRole?.id ?? ''}
            onChange={(e) => {
              const role = roles.find((r) => r.id === Number(e.target.value));
              if (role) handleSelectRole(role);
              else { setSelectedRole(null); setCheckedPolicies(new Set()); }
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Select a role...</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.description} ({r.code})</option>)}
          </select>
        </div>

        {selectedRole && !loading && (
          <>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save size={16} /> {saving ? 'Saving...' : 'Save'}
            </Button>

            <div className="rounded-lg border border-gray-200 bg-white" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              {policyGroups.map((pg) => (
                <div key={pg.id} className="border-b border-gray-200 last:border-b-0">
                  <div
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50"
                    onClick={() => toggleExpanded(pg.id)}
                  >
                    <span className="text-xs text-primary-600">{expandedGroups.has(pg.id) ? '▼' : '▶'}</span>
                    <input
                      type="checkbox"
                      checked={isGroupChecked(pg)}
                      ref={(el) => { if (el) el.indeterminate = isGroupIndeterminate(pg); }}
                      onChange={(e) => { e.stopPropagation(); toggleGroup(pg); }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-semibold text-gray-800">{pg.code}</span>
                    {pg.description && <span className="text-xs text-gray-500">— {pg.description}</span>}
                  </div>
                  {expandedGroups.has(pg.id) && (
                    <div className="border-t border-gray-100 bg-gray-50 pl-12">
                      {pg.policies.map((p) => (
                        <label key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                          <input
                            type="checkbox"
                            checked={checkedPolicies.has(p.id)}
                            onChange={() => togglePolicy(p.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          {p.code}
                          {p.description && <span className="text-xs text-gray-400">— {p.description}</span>}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {loading && selectedRole && (
          <div className="py-12 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
          </div>
        )}
      </div>
    </div>
  );
}

import { GitBranch } from 'lucide-react';

export default function SystemFlowsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <GitBranch size={24} className="text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-800">Fluxos de Sistema</h2>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500">
        Em construção.
      </div>
    </div>
  );
}

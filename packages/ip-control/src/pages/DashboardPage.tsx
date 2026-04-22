import { Lightbulb } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-100">
        <Lightbulb className="h-10 w-10 text-primary-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">FSA IP Control</h1>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        Bem-vindo ao módulo de Iluminação Pública. Os itens do menu serão adicionados em breve.
      </p>
    </div>
  );
}

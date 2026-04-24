import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { useAuth, MembershipInfo } from './AuthProvider';

interface CategoryInfo {
  id: number;
  code: string;
  description: string;
  iconUrl: string | null;
}

interface ContractOption {
  id: number;
  name: string;
  roleId: number;
  roleName: string;
  permissions: string[];
  membershipId: number;
  municipalityId: number | null;
  categories: CategoryInfo[];
}

interface ContractContextType {
  contracts: ContractOption[];
  selectedContract: ContractOption | null;
  setSelectedContractId: (id: number) => void;
  loading: boolean;
}

const ContractContext = createContext<ContractContextType | undefined>(undefined);

export function useContract() {
  const ctx = useContext(ContractContext);
  if (!ctx) throw new Error('useContract must be used within ContractProvider');
  return ctx;
}

const SERVICE_MENU_ROLES = ['Admin', 'AdminSystem', 'AdminEntity', 'Supervisor', 'Agent'];

export function canSeeServiceMenu(contract: ContractOption | null): boolean {
  if (!contract) return false;
  return SERVICE_MENU_ROLES.includes(contract.roleName);
}

export function ContractProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractOption | null>(null);
  const [loading, setLoading] = useState(true);

  // Build contracts from JWT memberships, then fetch categories per contract via API
  useEffect(() => {
    if (!user || !isAuthenticated) {
      setContracts([]);
      setSelectedContract(null);
      setLoading(false);
      return;
    }

    const membershipsWithContract = user.memberships.filter(
      (m) => m.contractId !== null && m.contractName !== null
    );

    if (membershipsWithContract.length === 0) {
      setContracts([]);
      setSelectedContract(null);
      setLoading(false);
      return;
    }

    // Build contract options from JWT data (roles/permissions available immediately)
    const contractOptions: ContractOption[] = membershipsWithContract.map((m) => ({
      id: m.contractId!,
      name: m.contractName!,
      roleId: m.roleId,
      roleName: m.roleName,
      permissions: m.permissions,
      membershipId: m.membershipId,
      municipalityId: m.municipalityId,
      categories: [], // will be loaded from API
    }));

    setContracts(contractOptions);
    setSelectedContract(contractOptions[0]);

    // Fetch categories for each contract in the background
    const loadCategories = async () => {
      try {
        const contractIds = contractOptions.map((c) => c.id);
        // Fetch each contract with categories
        const results = await Promise.all(
          contractIds.map((id) => userControlApi.getContract(id).catch(() => null))
        );

        setContracts((prev) =>
          prev.map((c, i) => {
            const contractData = results[i]?.data;
            if (contractData?.categories) {
              return { ...c, categories: contractData.categories };
            }
            return c;
          })
        );

        // Update selected contract categories too
        setSelectedContract((prev) => {
          if (!prev) return prev;
          const idx = contractOptions.findIndex((c) => c.id === prev.id);
          const contractData = idx >= 0 ? results[idx]?.data : null;
          if (contractData?.categories) {
            return { ...prev, categories: contractData.categories };
          }
          return prev;
        });
      } catch {
        // Categories will remain empty
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [user, isAuthenticated]);

  const setSelectedContractId = useCallback(
    (id: number) => {
      const found = contracts.find((c) => c.id === id);
      if (found) setSelectedContract(found);
    },
    [contracts]
  );

  return (
    <ContractContext.Provider
      value={{ contracts, selectedContract, setSelectedContractId, loading }}
    >
      {children}
    </ContractContext.Provider>
  );
}
